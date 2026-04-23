local rides          = {}
local rideCounter    = 0
local playerRides    = {}
local driverRides    = {}
local pendingRatings = {}
local rideQueues     = {}
local rideTimers     = {}
local ESX            = nil


-- ==========================================
-- INIT ESX
-- ==========================================

local ESX = nil

CreateThread(function()
    while GetResourceState('es_extended') ~= 'started' do
        Wait(500)
    end
    ESX = exports['es_extended']:getSharedObject()
    print("^2[TAXI] ESX chargé^7")
end)

AddEventHandler('onResourceStart', function(resourceName)
    if resourceName == GetCurrentResourceName() then
        if GetResourceState('es_extended') == 'started' then
            ESX = exports['es_extended']:getSharedObject()
        end
    end
end)

-- Notifie tous les clients quand un taxi prend/quitte son service
AddEventHandler('esx:setJob', function(source, job, lastJob)
    if job.name == Config.TaxiJob or lastJob.name == Config.TaxiJob then
        for _, playerId in ipairs(GetPlayers()) do
            local src = tonumber(playerId)
            TriggerClientEvent('taxi-app:client:driversCountChanged', src, true)
        end
    end
end)


-- ==========================================
-- HELPERS
-- ==========================================

function GetPlayerJob(source)
    if ESX then
        local xPlayer = ESX.GetPlayerFromId(source)
        if xPlayer then
            return xPlayer.job and xPlayer.job.name or xPlayer.getJob().name
        end
    end
    -- Fallback QBCore
    if GetResourceState('qb-core') == 'started' then
        local QBCore = exports['qb-core']:GetCoreObject()
        local Player = QBCore.Functions.GetPlayer(source)
        if Player then return Player.PlayerData.job.name end
    end
    return nil
end

function GetPlayerNameSafe(source)
    return GetPlayerName(source) or "Inconnu"
end

function CalculateDistance(a, b)
    if not a or not b then return 0 end
    local dx = a.x - b.x
    local dy = a.y - b.y
    return math.sqrt(dx * dx + dy * dy)
end

function CalculatePrice(pickup, destination)
    local dist  = CalculateDistance(pickup, destination)
    local km    = dist / 1000
    local price = km * Config.PricePerKm

    local hour    = tonumber(os.date("%H"))
    local isNight = hour >= 22 or hour < 6
    if isNight then
        price = price * Config.NightMultiplier
    end

    if price < Config.MinPrice then
        price = Config.MinPrice
    end

    return math.floor(price), isNight
end

function GetAvailableRides()
    local available = {}
    for id, ride in pairs(rides) do
        if ride.status == 'pending' then
            table.insert(available, ride)
        end
    end
    return available
end

function GetPlayerTotalMoney(source)
    if ESX then
        local xPlayer = ESX.GetPlayerFromId(source)
        if xPlayer then
            local cash = xPlayer.getMoney() or 0
            local bank = xPlayer.getAccount('bank') and xPlayer.getAccount('bank').money or 0
            return cash + bank
        end
    end
    return 0
end

function RemovePlayerMoney(source, amount)
    if ESX then
        local xPlayer = ESX.GetPlayerFromId(source)
        if not xPlayer then return false end

        local cash = xPlayer.getMoney() or 0
        if cash >= amount then
            xPlayer.removeMoney(amount)
            TriggerClientEvent('taxi-app:client:notify', source, "💵 Payé en cash : $" .. amount)
            return true
        end

        local bank = xPlayer.getAccount('bank') and xPlayer.getAccount('bank').money or 0
        if bank >= amount then
            xPlayer.removeAccountMoney('bank', amount)
            TriggerClientEvent('taxi-app:client:notify', source, "🏦 Payé par banque : $" .. amount)
            return true
        end

        return false
    end
    return false
end

function AddPlayerMoney(source, amount)
    if ESX then
        local xPlayer = ESX.GetPlayerFromId(source)
        if xPlayer then
            xPlayer.addMoney(amount)
            return true
        end
    end
    return false
end

function NotifyAllDrivers(action, data)
    for _, playerId in ipairs(GetPlayers()) do
        local src = tonumber(playerId)
        if GetPlayerJob(src) == Config.TaxiJob then
            TriggerClientEvent('taxi-app:client:updateRides', src, GetAvailableRides())
            if action and data then
                TriggerClientEvent('taxi-app:client:notify', src, data)
            end
        end
    end
end

function PhoneNotify(src, title, message)
    exports['17mov_Phone']:SendNotificationToSrc(src, {
        app     = "MESSAGES",
        title   = title,
        message = message,
        data    = { alwaysShow = true }
    })
end

function GetDriversSortedByDistance(pickupCoords)
    local drivers = {}
    for _, playerId in ipairs(GetPlayers()) do
        local src = tonumber(playerId)
        local job = GetPlayerJob(src)

        print("^3[TAXI] src=" .. src .. " job=" .. tostring(job) .. " taxiJob=" .. tostring(Config.TaxiJob) .. " driverRides=" .. tostring(driverRides[src]) .. "^7")

        if job == Config.TaxiJob and not driverRides[src] then
            local ped    = GetPlayerPed(src)
            local coords = GetEntityCoords(ped)
            local dist   = CalculateDistance(
                { x = coords.x, y = coords.y },
                pickupCoords
            )
            table.insert(drivers, { id = src, dist = dist })
        end
    end
    table.sort(drivers, function(a, b) return a.dist < b.dist end)
    return drivers
end

function DispatchNextDriver(rideId)
    local ride  = rides[rideId]
    local queue = rideQueues[rideId]

    if not ride or not queue or #queue == 0 then
        -- Notifie le dernier chauffeur dispatché que l'offre est terminée
        if ride and ride.dispatchedTo then
            TriggerClientEvent('taxi-app:client:rideOfferExpired', ride.dispatchedTo, { id = rideId })
        end
        if ride then
            TriggerClientEvent('taxi-app:client:notify', ride.clientId,
                "Aucun chauffeur disponible. Réessayez.")
            playerRides[ride.clientId] = nil
            rides[rideId]              = nil
        end
        rideQueues[rideId] = nil
        return
    end

    local driver = table.remove(queue, 1)
    local src    = driver.id

    -- Chauffeur déconnecté ou déjà en course, passe au suivant
    if not GetPlayerName(src) or driverRides[src] then
        DispatchNextDriver(rideId)
        return
    end

    -- Notifie l'ancien chauffeur que l'offre est passée
    if ride.dispatchedTo and ride.dispatchedTo ~= src then
        TriggerClientEvent('taxi-app:client:rideOfferExpired', ride.dispatchedTo, { id = rideId })
    end

    ride.dispatchedTo = src

    TriggerClientEvent('taxi-app:client:rideOffer', src, {
        id                = ride.id,
        clientName        = ride.clientName,
        clientRating      = ride.clientRating,
        pickup            = ride.pickup,
        pickupStreet      = ride.pickupStreet,
        destination       = ride.destination,
        destinationStreet = ride.destinationStreet,
        price             = ride.price,
        isNight           = ride.isNight,
        distance          = math.floor(driver.dist),
        timeout           = Config.DispatchTimeout,
    })

    PhoneNotify(src,
        "🚖 Course proposée !",
        "De " .. ride.pickupStreet .. " → " .. ride.destinationStreet ..
        " ($" .. ride.price .. ") — " .. math.floor(driver.dist) .. "m"
    )

    if rideTimers[rideId] then
        ClearTimeout(rideTimers[rideId])
    end

    rideTimers[rideId] = SetTimeout(Config.DispatchTimeout * 1000, function()
        if rides[rideId] and rides[rideId].status == 'pending'
           and rides[rideId].dispatchedTo == src then
            DispatchNextDriver(rideId)
        end
    end)
end


-- ==========================================
-- RATING SYSTEM
-- ==========================================

function GetClientRating(source, callback)
    local identifier = GetPlayerIdentifier(source, 0) or tostring(source)
    exports.oxmysql:scalar(
        "SELECT average FROM taxi_ratings WHERE identifier = ? AND role = 'client'",
        { identifier },
        function(result)
            callback(result or 5.0)
        end
    )
end

function UpdateClientRating(clientId, stars)
    local identifier = GetPlayerIdentifier(clientId, 0) or tostring(clientId)
    local name       = GetPlayerNameSafe(clientId)
    exports.oxmysql:execute([[
        INSERT INTO taxi_ratings (player_name, identifier, total_stars, rating_count, average, role)
        VALUES (?, ?, ?, 1, ?, 'client')
        ON DUPLICATE KEY UPDATE
            player_name  = VALUES(player_name),
            total_stars  = total_stars + VALUES(total_stars),
            rating_count = rating_count + 1,
            average      = ROUND((total_stars + VALUES(total_stars)) / (rating_count + 1), 1)
    ]], { name, identifier, stars, stars })
end

function GetDriverRating(driverId, callback)
    local identifier = GetPlayerIdentifier(driverId, 0) or tostring(driverId)
    exports.oxmysql:scalar(
        "SELECT average FROM taxi_ratings WHERE identifier = ? AND role = 'driver'",
        { identifier },
        function(result)
            callback(result or 5.0)
        end
    )
end


-- ==========================================
-- STATS & HISTORIQUE
-- ==========================================

function SaveRideToHistory(driverId, ride)
    local driverIdentifier = GetPlayerIdentifier(driverId, 0) or tostring(driverId)
    local clientIdentifier = GetPlayerIdentifier(ride.clientId, 0) or tostring(ride.clientId)
    exports.oxmysql:execute([[
        INSERT INTO taxi_ride_history
            (driver_id, driver_name, client_id, client_name, pickup_street, destination_street, price, is_night)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ]], {
        driverIdentifier,
        GetPlayerNameSafe(driverId),
        clientIdentifier,
        ride.clientName,
        ride.pickupStreet,
        ride.destinationStreet,
        ride.price,
        ride.isNight and 1 or 0,
    })
end

function UpdateDriverStats(driverId, amount)
    local identifier = GetPlayerIdentifier(driverId, 0) or tostring(driverId)
    local name       = GetPlayerNameSafe(driverId)
    exports.oxmysql:execute([[
        INSERT INTO taxi_driver_stats (identifier, player_name, total_rides, total_earned, today_rides, today_earned, last_reset)
        VALUES (?, ?, 1, ?, 1, ?, CURDATE())
        ON DUPLICATE KEY UPDATE
            player_name  = VALUES(player_name),
            total_rides  = total_rides + 1,
            total_earned = total_earned + VALUES(total_earned),
            today_rides  = IF(last_reset = CURDATE(), today_rides + 1,  1),
            today_earned = IF(last_reset = CURDATE(), today_earned + VALUES(today_earned), VALUES(today_earned)),
            last_reset   = CURDATE()
    ]], { identifier, name, amount, amount })
end


-- ==========================================
-- EVENTS
-- ==========================================

RegisterNetEvent('taxi-app:server:requestRide', function(data)
    local source = source

    if not data or not data.pickup or not data.destination then
        TriggerClientEvent('taxi-app:client:notify', source, "Données invalides.")
        return
    end

    if playerRides[source] then
        TriggerClientEvent('taxi-app:client:notify', source, "Vous avez déjà une course en cours.")
        return
    end

    local price, isNight = CalculatePrice(data.pickup, data.destination)
    local totalMoney     = GetPlayerTotalMoney(source)

    if totalMoney < price then
        TriggerClientEvent('taxi-app:client:notify', source,
            "Pas assez d'argent ! Il vous faut $" .. price ..
            " (vous avez $" .. totalMoney .. " en cash+banque)")
        return
    end

    GetClientRating(source, function(rating)
        rideCounter = rideCounter + 1
        local rideId = rideCounter

        local ride = {
            id                = rideId,
            clientId          = source,
            clientName        = GetPlayerNameSafe(source),
            clientRating      = rating,
            pickup            = data.pickup,
            pickupStreet      = data.pickupStreet,
            destination       = data.destination,
            destinationStreet = data.destinationStreet,
            price             = price,
            isNight           = isNight,
            distance          = CalculateDistance(data.pickup, data.destination),
            status            = 'pending',
            driverId          = nil,
            dispatchedTo      = nil,
            createdAt         = os.time(),
        }

        rides[rideId]       = ride
        playerRides[source] = rideId

        TriggerClientEvent('taxi-app:client:rideCreated', source, ride)

        local drivers = GetDriversSortedByDistance(data.pickup)
        if #drivers == 0 then
            TriggerClientEvent('taxi-app:client:notify', source,
                "Aucun chauffeur disponible pour le moment.")
            playerRides[source] = nil
            rides[rideId]       = nil
            return
        end

        rideQueues[rideId] = drivers
        DispatchNextDriver(rideId)
    end)
end)

RegisterNetEvent('taxi-app:server:getRides', function()
    local source = source
    TriggerClientEvent('taxi-app:client:updateRides', source, GetAvailableRides())
end)

RegisterNetEvent('taxi-app:server:acceptRide', function(rideId)
    local source = source
    local ride   = rides[rideId]

    if not ride or ride.dispatchedTo ~= source then
        TriggerClientEvent('taxi-app:client:notify', source, "Cette course n'est plus disponible.")
        return
    end

    if ride.status ~= 'pending' then
        TriggerClientEvent('taxi-app:client:notify', source, "Cette course a déjà été prise.")
        return
    end

    if driverRides[source] then
        TriggerClientEvent('taxi-app:client:notify', source, "Vous avez déjà une course en cours.")
        return
    end

    if rideTimers[rideId] then
        ClearTimeout(rideTimers[rideId])
        rideTimers[rideId] = nil
    end
    rideQueues[rideId] = nil

    ride.status   = 'accepted'
    ride.driverId = source
    driverRides[source] = rideId

    local driverCoords = GetEntityCoords(GetPlayerPed(source))

    GetDriverRating(source, function(driverRating)
        TriggerClientEvent('taxi-app:client:rideAccepted', ride.clientId, {
            id                = ride.id,
            driverId          = source,
            driverName        = GetPlayerNameSafe(source),
            driverRating      = driverRating,
            driverCoords      = { x = driverCoords.x, y = driverCoords.y, z = driverCoords.z },
            pickup            = ride.pickup,
            pickupStreet      = ride.pickupStreet,
            destination       = ride.destination,
            destinationStreet = ride.destinationStreet,
            price             = ride.price,
            isNight           = ride.isNight,
            status            = 'accepted',
        })
    end)

    TriggerClientEvent('taxi-app:client:rideAssigned', source, {
        id                = ride.id,
        clientId          = ride.clientId,
        clientName        = ride.clientName,
        pickup            = ride.pickup,
        pickupStreet      = ride.pickupStreet,
        destination       = ride.destination,
        destinationStreet = ride.destinationStreet,
        price             = ride.price,
        isNight           = ride.isNight,
        status            = 'accepted',
    })

    PhoneNotify(ride.clientId,
        "🚖 Taxi en route !",
        "Votre chauffeur " .. GetPlayerNameSafe(source) .. " arrive !"
    )

    NotifyAllDrivers(nil, nil)
end)

RegisterNetEvent('taxi-app:server:declineRide', function(rideId)
    local source = source
    local ride   = rides[rideId]

    if not ride or ride.dispatchedTo ~= source then return end

    if rideTimers[rideId] then
        ClearTimeout(rideTimers[rideId])
        rideTimers[rideId] = nil
    end

    DispatchNextDriver(rideId)
end)

RegisterNetEvent('taxi-app:server:clientPickedUp', function(rideId)
    local source = source
    local ride   = rides[rideId]

    if not ride or ride.driverId ~= source then return end

    local driverCoords = GetEntityCoords(GetPlayerPed(source))
    local clientCoords = GetEntityCoords(GetPlayerPed(ride.clientId))

    local dist = CalculateDistance(
        { x = driverCoords.x, y = driverCoords.y, z = driverCoords.z },
        { x = clientCoords.x, y = clientCoords.y, z = clientCoords.z }
    )

    if dist > 30.0 then
        TriggerClientEvent('taxi-app:client:notify', source,
            "Le client n'est pas encore monté ! (" .. math.floor(dist) .. "m)")
        return
    end

    ride.status = 'inprogress'

    TriggerClientEvent('taxi-app:client:clientPickedUp', source, {
        id                = ride.id,
        destination       = ride.destination,
        destinationStreet = ride.destinationStreet,
        price             = ride.price,
        status            = 'inprogress',
    })

    TriggerClientEvent('taxi-app:client:rideStarted', ride.clientId, {
        id                = ride.id,
        destination       = ride.destination,
        destinationStreet = ride.destinationStreet,
        price             = ride.price,
        status            = 'inprogress',
    })
end)

RegisterNetEvent('taxi-app:server:cancelRide', function()
    local source = source

    local rideId = playerRides[source] or driverRides[source]

    if not rideId then
        -- Rien à annuler côté serveur, juste reset l'UI client
        TriggerClientEvent('taxi-app:client:rideCancelled', source, { id = 0 })
        return
    end

    local ride = rides[rideId]
    if not ride then
        playerRides[source] = nil
        driverRides[source] = nil
        TriggerClientEvent('taxi-app:client:rideCancelled', source, { id = rideId })
        return
    end

    -- Stoppe le timer dispatch
    if rideTimers[rideId] then
        ClearTimeout(rideTimers[rideId])
        rideTimers[rideId] = nil
    end
    rideQueues[rideId] = nil

    -- Notifie le chauffeur en attente de l'offre
    if ride.dispatchedTo then
        TriggerClientEvent('taxi-app:client:rideOfferExpired', ride.dispatchedTo, { id = rideId })
    end

    -- Notifie le chauffeur assigné si course acceptée
    if ride.driverId and ride.driverId ~= source then
        TriggerClientEvent('taxi-app:client:rideCancelled', ride.driverId, { id = rideId })
        driverRides[ride.driverId] = nil
        PhoneNotify(ride.driverId, "❌ Course annulée", "Le client a annulé la course.")
    end

    -- Notifie le client si c'est le chauffeur qui annule
    if ride.clientId and ride.clientId ~= source then
        TriggerClientEvent('taxi-app:client:rideCancelled', ride.clientId, { id = rideId })
        PhoneNotify(ride.clientId, "❌ Course annulée", "Votre chauffeur a annulé.")
    end

    TriggerClientEvent('taxi-app:client:rideCancelled', source, { id = rideId })

    playerRides[ride.clientId] = nil
    if ride.driverId then driverRides[ride.driverId] = nil end
    rides[rideId] = nil

    NotifyAllDrivers(nil, nil)
end)

RegisterNetEvent('taxi-app:server:finishRide', function(rideId)
    local source = source
    local ride   = rides[rideId]

    if not ride then return end

    local driverCoords = GetEntityCoords(GetPlayerPed(source))
    local dist = CalculateDistance(
        { x = driverCoords.x, y = driverCoords.y, z = driverCoords.z },
        ride.destination
    )

    if dist > 50.0 then
        TriggerClientEvent('taxi-app:client:notify', source,
            "Vous devez être proche de la destination ! (" .. math.floor(dist) .. "m restants)")
        return
    end

    ride.status = 'finished'

    local clientId   = ride.clientId
    local clientName = ride.clientName
    local price      = ride.price

    local removed = RemovePlayerMoney(clientId, price)
    if removed then
        AddPlayerMoney(source, price)
        TriggerClientEvent('taxi-app:client:notify', source,
            "Course terminée ! Vous avez reçu $" .. price .. " 💰")
        TriggerClientEvent('taxi-app:client:notify', clientId,
            "Vous avez payé $" .. price .. " pour la course. Merci !")

        SaveRideToHistory(source, ride)
        UpdateDriverStats(source, price)
    else
        TriggerClientEvent('taxi-app:client:notify', source, "Erreur lors du paiement.")
        TriggerClientEvent('taxi-app:client:notify', clientId,
            "Erreur de paiement, contactez un admin.")
    end

    pendingRatings[source] = clientId

    playerRides[clientId] = nil
    driverRides[source]   = nil
    rides[rideId]         = nil

    TriggerClientEvent('taxi-app:client:rideFinished', clientId, {
        id = rideId, price = price, clientName = clientName,
    })
    TriggerClientEvent('taxi-app:client:rideFinished', source, {
        id = rideId, price = price, clientName = clientName,
    })

    TriggerClientEvent('taxi-app:client:showRating', source, {
        rideId     = rideId,
        clientName = clientName,
    })

    NotifyAllDrivers(nil, nil)
end)

AddEventHandler('playerDropped', function()
    local source = source

    local rideId = playerRides[source]
    if rideId and rides[rideId] then
        local ride = rides[rideId]

        if rideTimers[rideId] then
            ClearTimeout(rideTimers[rideId])
            rideTimers[rideId] = nil
        end
        rideQueues[rideId] = nil

        if ride.dispatchedTo then
            TriggerClientEvent('taxi-app:client:rideOfferExpired', ride.dispatchedTo, { id = rideId })
        end

        if ride.driverId then
            TriggerClientEvent('taxi-app:client:rideCancelled', ride.driverId, { id = rideId })
            PhoneNotify(ride.driverId, "❌ Course annulée", "Le client a quitté le serveur.")
            driverRides[ride.driverId] = nil
        end

        rides[rideId]       = nil
        playerRides[source] = nil
    end

    rideId = driverRides[source]
    if rideId and rides[rideId] then
        local ride    = rides[rideId]
        ride.status   = 'pending'
        ride.driverId = nil
        TriggerClientEvent('taxi-app:client:rideCancelled', ride.clientId, { id = rideId, requeue = true })
        PhoneNotify(ride.clientId, "❌ Course annulée", "Votre chauffeur a quitté le serveur.")
        driverRides[source] = nil
        NotifyAllDrivers(nil, nil)
    end

    pendingRatings[source] = nil
end)

RegisterNetEvent('taxi-app:server:checkDrivers', function()
    local source = source
    local count  = 0
    for _, playerId in ipairs(GetPlayers()) do
        local src = tonumber(playerId)
        if GetPlayerJob(src) == Config.TaxiJob and not driverRides[src] then
            count = count + 1
        end
    end
    TriggerClientEvent('taxi-app:client:driversCount', source, count)
end)

RegisterNetEvent('taxi-app:server:rateClient', function(rideId, stars)
    local source = source
    if stars < 1 or stars > 5 then return end

    local clientId = pendingRatings[source]
    if not clientId then
        TriggerClientEvent('taxi-app:client:notify', source, "Impossible de noter : course introuvable.")
        return
    end

    UpdateClientRating(clientId, stars)
    pendingRatings[source] = nil

    TriggerClientEvent('taxi-app:client:notify', source,
        "Merci pour votre évaluation ⭐ " .. stars .. "/5")
end)

RegisterNetEvent('taxi-app:server:getMyRating', function()
    local source = source
    GetClientRating(source, function(rating)
        TriggerClientEvent('taxi-app:client:myRating', source, rating)
    end)
end)

RegisterNetEvent('taxi-app:server:getDriverStats', function()
    local source     = source
    local identifier = GetPlayerIdentifier(source, 0) or tostring(source)

    exports.oxmysql:single(
        'SELECT * FROM taxi_driver_stats WHERE identifier = ?',
        { identifier },
        function(row)
            exports.oxmysql:scalar(
                "SELECT average FROM taxi_ratings WHERE identifier = ? AND role = 'driver'",
                { identifier },
                function(avg)
                    TriggerClientEvent('taxi-app:client:driverStats', source, {
                        totalRides  = row and row.total_rides  or 0,
                        totalEarned = row and row.total_earned or 0,
                        todayRides  = row and row.today_rides  or 0,
                        todayEarned = row and row.today_earned or 0,
                        avgRating   = avg or 5.0,
                    })
                end
            )
        end
    )
end)

RegisterNetEvent('taxi-app:server:getRideHistory', function()
    local source     = source
    local identifier = GetPlayerIdentifier(source, 0) or tostring(source)

    exports.oxmysql:execute(
        'SELECT * FROM taxi_ride_history WHERE driver_id = ? ORDER BY created_at DESC LIMIT 10',
        { identifier },
        function(rows)
            local history = {}
            for _, row in ipairs(rows or {}) do
                table.insert(history, {
                    id                = row.id,
                    clientName        = row.client_name,
                    pickupStreet      = row.pickup_street,
                    destinationStreet = row.destination_street,
                    price             = row.price,
                    isNight           = row.is_night,
                    createdAt         = tostring(row.created_at),
                })
            end
            TriggerClientEvent('taxi-app:client:rideHistory', source, { rides = history })
        end
    )
end)


RegisterCommand('taxireset', function(source)
    if source ~= 0 then return end  -- console only
    rides        = {}
    playerRides  = {}
    driverRides  = {}
    rideQueues   = {}
    rideTimers   = {}
    rideCounter  = 0
    print("^2[TAXI] Reset complet des courses^7")
end, true)