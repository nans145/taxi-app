local currentRide       = nil
local destinationBlip   = nil
local pickupBlip        = nil


-- ==========================================
-- ENREGISTREMENT APP
-- ==========================================

function RegisterApp()
    local resourceName = GetCurrentResourceName()
    local url = GetResourceMetadata(resourceName, "ui_page", 0)

    exports['17mov_Phone']:AddApplication({
        name        = Config.AppName,
        label       = "Taxi",
        description = "Commandez ou proposez des courses.",
        ui          = url:find("http") and url or ("https://cfx-nui-%s/%s"):format(resourceName, url),
        icon        = url:find("http") and ("%s/icon.svg"):format(url) or
                      ("https://cfx-nui-%s//web/build/icon.svg"):format(resourceName),
        iconBackground = {
            angle  = 135,
            colors = { '#F5C518', '#E6A800' },
        },
        default      = false,
        preInstalled = true,
        resourceName = resourceName,
        rating       = 4.8,
    })
end

CreateThread(function()
    if GetResourceState("17mov_Phone") == "started" then
        RegisterApp()
    end
end)

RegisterNetEvent("17mov_Phone:Client:Ready", function()
    RegisterApp()
end)

if Config.DevMode then
    AddEventHandler('onResourceStop', function(resourceName)
        if resourceName == GetCurrentResourceName() then
            exports['17mov_Phone']:RemoveApplication({
                name         = Config.AppName,
                resourceName = resourceName,
            })
            RemoveBlips()
        end
    end)
end


-- ==========================================
-- HELPERS
-- ==========================================

function GetPlayerJob()
    if GetResourceState('es_extended') == 'started' then
        local ESX        = exports['es_extended']:getSharedObject()
        local playerData = ESX.GetPlayerData()
        if playerData and playerData.job and playerData.job.name then
            return playerData.job.name
        end
    end
    return "unemployed"
end

function IsDriver()
    return GetPlayerJob() == Config.TaxiJob
end

function GetStreetName(coords)
    local streetHash, _ = GetStreetNameAtCoord(coords.x, coords.y, coords.z)
    return GetStreetNameFromHashKey(streetHash)
end

function RemoveBlips()
    if destinationBlip then RemoveBlip(destinationBlip); destinationBlip = nil end
    if pickupBlip      then RemoveBlip(pickupBlip);      pickupBlip      = nil end
end

function SetBlip(coords, sprite, color, label)
    local blip = AddBlipForCoord(coords.x, coords.y, coords.z)
    SetBlipSprite(blip, sprite)
    SetBlipColour(blip, color)
    SetBlipScale(blip, 1.0)
    SetBlipRoute(blip, true)
    SetBlipRouteColour(blip, color)
    BeginTextCommandSetBlipName("STRING")
    AddTextComponentString(label)
    EndTextCommandSetBlipName(blip)
    return blip
end


-- ==========================================
-- Refresh du compteur quand un taxi change de job
-- ==========================================

RegisterNetEvent('taxi-app:client:driversCountChanged', function()
    TriggerServerEvent('taxi-app:server:checkDrivers')
end)

-- ESX : se déclenche quand le job change
AddEventHandler('esx:setPlayerData', function(key, value)
    if key == 'job' then
        Core.SendNuiMessage('Taxi:RefreshState', {})
        -- Recalcule aussi le compteur immédiatement
        TriggerServerEvent('taxi-app:server:checkDrivers')
    end
end)


-- ==========================================
-- NUI CALLBACKS
-- ==========================================


RegisterNetEvent('taxi-app:client:rideOffer', function(data)
    Core.SendNuiMessage('Taxi:RideOffer', data)   -- ← envoie au DriverView
end)

-- Offre expirée (timeout ou client annulé)
RegisterNetEvent('taxi-app:client:rideOfferExpired', function(data)
    Core.SendNuiMessage('Taxi:RideOfferExpired', data)
end)


RegisterNUICallback('Taxi:RateClient', function(data, cb)
    TriggerServerEvent('taxi-app:server:rateClient', data.rideId, data.stars)
    cb({ ok = true })
end)

RegisterNUICallback('Taxi:GetMyRating', function(data, cb)
    TriggerServerEvent('taxi-app:server:getMyRating')
    cb({})
end)

RegisterNUICallback('Taxi:GetState', function(data, cb)
    local isDriver   = false
    local ped        = PlayerPedId()
    local coords     = GetEntityCoords(ped)

    if GetResourceState('es_extended') == 'started' then
        local ESX        = exports['es_extended']:getSharedObject()
        local playerData = ESX.GetPlayerData()
        if playerData and playerData.job then
            isDriver = (playerData.job.name == Config.TaxiJob)
        end
    end

    if isDriver then
        TriggerServerEvent('taxi-app:server:getRides')
    end

    cb({
        isDriver     = isDriver,
        currentRide  = currentRide,
        playerCoords = { x = coords.x, y = coords.y, z = coords.z },
        streetName   = GetStreetName(coords),
    })
end)

RegisterNUICallback('Taxi:RequestRide', function(data, cb)
    local ped    = PlayerPedId()
    local coords = GetEntityCoords(ped)

    TriggerServerEvent('taxi-app:server:requestRide', {
        pickup           = { x = coords.x, y = coords.y, z = coords.z },
        pickupStreet     = GetStreetName(coords),
        destination      = data.destination,
        destinationStreet = data.destinationStreet or "Destination",
    })

    cb({ ok = true })
end)

RegisterNUICallback('Taxi:CancelRide', function(data, cb)
    TriggerServerEvent('taxi-app:server:cancelRide')
    RemoveBlips()
    currentRide = nil
    cb({ ok = true })
end)

RegisterNUICallback('Taxi:AcceptRide', function(data, cb)
    TriggerServerEvent('taxi-app:server:acceptRide', data.rideId)
    cb({ ok = true })
end)

RegisterNUICallback('Taxi:DeclineRide', function(data, cb)
    TriggerServerEvent('taxi-app:server:declineRide', data.rideId)
    cb({ ok = true })
end)

RegisterNUICallback('Taxi:FinishRide', function(data, cb)
    TriggerServerEvent('taxi-app:server:finishRide', data.rideId)
    RemoveBlips()
    currentRide = nil
    cb({ ok = true })
end)

RegisterNUICallback('Taxi:CheckDrivers', function(data, cb)
    TriggerServerEvent('taxi-app:server:checkDrivers')
    cb({})
end)

RegisterNUICallback('Taxi:SetWaypoint', function(data, cb)
    local waypointBlip = GetFirstBlipInfoId(8)
    if DoesBlipExist(waypointBlip) then
        local wpCoords   = GetBlipInfoIdCoord(waypointBlip)
        local streetName = GetStreetName(wpCoords)
        cb({
            ok                = true,
            destination       = { x = wpCoords.x, y = wpCoords.y, z = wpCoords.z },
            destinationStreet = streetName,
        })
    else
        cb({ ok = false, error = "Placez un point GPS sur la carte d'abord !" })
    end
end)

RegisterNUICallback('taxi:ClientPickedUp', function(data, cb)
    TriggerServerEvent('taxi-app:server:clientPickedUp', data.rideId)
    cb({ ok = true })
end)

RegisterNUICallback('Taxi:GetDriverStats', function(data, cb)
    TriggerServerEvent('taxi-app:server:getDriverStats')
    cb({})
end)

RegisterNUICallback('Taxi:GetRideHistory', function(data, cb)
    TriggerServerEvent('taxi-app:server:getRideHistory')
    cb({})
end)


-- ==========================================
-- SERVER EVENTS
-- ==========================================

RegisterNetEvent('taxi-app:client:updateRides', function(rides)
    Core.SendNuiMessage('Taxi:UpdateRides', rides)
end)

RegisterNetEvent('taxi-app:client:myRating', function(rating)
    Core.SendNuiMessage('Taxi:MyRating', { rating = rating })
end)

RegisterNetEvent('taxi-app:client:driversCount', function(count)
    Core.SendNuiMessage('Taxi:DriversCount', { count = count })
end)

RegisterNetEvent('taxi-app:client:driverStats', function(data)
    Core.SendNuiMessage('Taxi:DriverStats', data)
end)

RegisterNetEvent('taxi-app:client:rideHistory', function(data)
    Core.SendNuiMessage('Taxi:RideHistory', data)
end)

RegisterNetEvent('taxi-app:client:showRating', function(data)
    Core.SendNuiMessage('Taxi:ShowRating', {
        rideId     = data.rideId,
        clientName = data.clientName,
    })
end)

RegisterNetEvent('taxi-app:client:newRideNotification', function(data)
    TriggerEvent('17mov_Phone:sendNotification', {
        app     = "MESSAGES",
        title   = "🚨 Nouvelle course !",
        message = "De " .. data.pickupStreet .. " → " .. data.destinationStreet .. " ($" .. data.price .. ")",
    })
    SendNUIMessage({ action = 'playSound', file = 'nouvelle-course.ogg' })
end)

RegisterNetEvent('taxi-app:client:rideFinished', function(data)
    currentRide = nil
    RemoveBlips()
    Core.SendNuiMessage('Taxi:RideFinished', data)

    if IsDriver() then
        Core.SendNuiMessage('Taxi:ShowRating', {
            rideId     = data.id,
            clientName = data.clientName or "Client",
        })
    end
end)

RegisterNetEvent('taxi-app:client:rideAccepted', function(data)
    currentRide = data
    Core.SendNuiMessage('Taxi:RideAccepted', data)
    RemoveBlips()

    if data.driverCoords then
        pickupBlip = SetBlip(
            vector3(data.driverCoords.x, data.driverCoords.y, data.driverCoords.z),
            56, 5, "Votre chauffeur"
        )
    end

    if data.destination then
        destinationBlip = SetBlip(
            vector3(data.destination.x, data.destination.y, data.destination.z),
            38, 2, "Votre destination"
        )
    end

    local driverId = data.driverId
    CreateThread(function()
        while currentRide ~= nil and currentRide.status == 'accepted' do
            Wait(2000)
            if driverId then
                local driverPed = GetPlayerPed(GetPlayerFromServerId(driverId))
                if DoesEntityExist(driverPed) then
                    local coords = GetEntityCoords(driverPed)
                    if DoesBlipExist(pickupBlip) then
                        SetBlipCoords(pickupBlip, coords.x, coords.y, coords.z)
                    end
                end
            end
        end
    end)
end)

RegisterNetEvent('taxi-app:client:rideStarted', function(data)
    currentRide = data
    RemoveBlips()

    if data.destination then
        destinationBlip = SetBlip(
            vector3(data.destination.x, data.destination.y, data.destination.z),
            38, 2, "Votre destination"
        )
    end

    Core.SendNuiMessage('Taxi:RideStarted', data)
end)

RegisterNetEvent('taxi-app:client:rideAssigned', function(data)
    currentRide = data
    Core.SendNuiMessage('Taxi:RideAssigned', data)
    RemoveBlips()

    pickupBlip = SetBlip(
        vector3(data.pickup.x, data.pickup.y, data.pickup.z),
        280, 5, "Prise en charge"
    )
end)

RegisterNetEvent('taxi-app:client:clientPickedUp', function(data)
    currentRide = data
    RemoveBlips()

    destinationBlip = SetBlip(
        vector3(data.destination.x, data.destination.y, data.destination.z),
        38, 2, "Destination"
    )

    Core.SendNuiMessage('Taxi:ClientPickedUp', data)
end)

RegisterNetEvent('taxi-app:client:rideCreated', function(data)
    currentRide = data
    Core.SendNuiMessage('Taxi:RideCreated', data)
end)

RegisterNetEvent('taxi-app:client:rideCancelled', function(data)
    currentRide = nil
    RemoveBlips()
    Core.SendNuiMessage('Taxi:RideCancelled', data)
end)

RegisterNetEvent('taxi-app:client:notify', function(message)
    Core.SendNuiMessage('Taxi:Notify', { message = message })
    TriggerEvent('17mov_Phone:sendNotification', {
        app     = "MESSAGES",
        title   = "🚕 Taxi",
        message = message,
    })
end)
