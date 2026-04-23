fx_version 'cerulean'
game "gta5"
lua54 "yes"

author "17movement.net"
description "External App Boilerplate for 17mov's Phone"
version "1.0.0"

client_scripts {
    "client/core.lua",
    "client/main.lua",
}

shared_scripts {
    "configs/config.lua",
    "shared/locale.lua",
    "locale/*.lua",
    "shared/core.lua",
}

server_scripts {
    "configs/config.lua",
    "server/main.lua",   -- ← à ajouter si absent
}
-- ui_page "http://localhost:1717"
ui_page "web/build/index.html"

files {
    "web/build/**.*",
    "web/build/**/**.*",
    "web/build/**/**/**.*",
}