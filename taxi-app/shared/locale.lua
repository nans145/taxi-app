Locale = {}

CreateThread(function()
    Wait(1000)

    if not Config.Lang then
        while true do
            Core.Print("You did not set Config.Lang in config.lua!")
            Wait(3000)
        end
    end

    if Locale[Config.Lang] == nil then
        while true do
            Core.Print(("You set Config.Lang to \"%s\", but there is no such language in the locale directory!"):format(Config.Lang))
            Wait(3000)
        end
    end
end)

function _L(key, ...)
    local locale = Locale[Config.Lang or "en"]

    if not locale then
        locale = Locale["en"] or {}
    end

    local translation = locale[key] or "Missing Translation"

    if #table.pack(...) > 0 then
        ---@diagnostic disable-next-line: param-type-mismatch
        translation = string.format(translation, ...)
    end

    return translation
end