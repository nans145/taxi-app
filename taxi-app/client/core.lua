Core.NuiLoaded = false

Core.SendNuiMessage = function(action, payload)
    while not Core.NuiLoaded do
        Wait(100)
    end

    exports['17mov_Phone']:SendAppMessage(
        Config.AppName or "testapp",
        {
            action = action,
            payload = payload,
        }
    )
end

RegisterNUICallback('Core:NuiLoaded', function(data, cb)
    Core.NuiLoaded = true
    Core.SendNuiMessage("Language:Initialize", {
        defaultLang = Config.Lang,
        languages = Core.GetLanguages(),
    })
    Core.SendNuiMessage("Core:AppReady", {})
    cb({})
end)

RegisterNUICallback("Core:GetLanguage", function(body, cb)
    cb(Core.GetLanguage(body.lang))
end)
