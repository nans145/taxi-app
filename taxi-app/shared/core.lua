Core = {
    ResourceName = GetCurrentResourceName()
}

Core.Print = function(...)
    local payload = table.pack(...)

    print("^5[" .. Core.ResourceName .. "] ^7" .. table.concat(payload, " ") .. "^0")
end

Core.Debug = function(...)
    if not Config.Debug then return end

    local payload = table.pack(...)

    print("^5[DEBUG MODE] ^5" .. table.concat(payload, " ") .. "^0")
end

Core.Error = function(...)
    local payload = table.pack(...)

    print("^5[ERROR] ^1" .. table.concat(payload, " ") .. "^0")
end

Core.GetLanguage = function(lang)
    if not lang or lang == "" then
        lang = Config.Lang or "en"
    end

    return Locale[lang] or {}
end

Core.GetLanguages = function()
    local languages = {}

    for lang, v in pairs(Locale) do
        languages[lang] = v["Language"] or lang
    end

    return languages
end

Core.SendNuiMessage = function(action, payload)
    SendNuiMessage(json.encode({ action = action, payload = payload }))
end