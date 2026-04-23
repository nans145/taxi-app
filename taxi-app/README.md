# 📱 17mov_Phone Custom App Boilerplate

Welcome to the official boilerplate for creating custom applications for 17mov_Phone. This repository provides a complete React + TypeScript environment pre-configured to work seamlessly with the phone ecosystem.

### 🌟 What is 17mov_Phone?

17mov_Phone is the most advanced, high-performance phone script designed for FiveM servers (ESX & QBCore). It redefines in-game communication with features that focus on realism and smooth user experience.

🛒 Get the script here: https://17movement.net/

### 🛠️ What is this Boilerplate?

This repository serves as a starter kit for developers who want to extend the functionality of 17mov_Phone. It allows you to create your own external applications that can be installed on the phone just like the default ones.

This boilerplate includes:
 - React & TypeScript setup optimized for FiveM NUI.
 - Pre-configured Routing to handle app navigation.
 - Custom Hooks: useNuiEvent, useSettings, useLanguage to interact with the phone's core.
 - Native UI Components: Helper functions to trigger the phone's native Camera, Gallery Picker, and Contact Picker.

## 🚀 Getting Started

### 1. Installation
 
Download or clone this repository into your server's resources folder.

Navigate to the web directory and install dependencies:

```
cd web
npm install
```

### 2. Development Mode

To view your changes in real-time in a browser (or game) without rebuilding:
 - Open config.lua and set Config.DevMode = true.
 - Run the development server:
 ```
 npm run dev
 ```

The app will be served at http://localhost:1717.

## 📚 Documentation

For detailed instructions on how to register your app, use internal exports, and interact with the phone's API, please refer to our full documentation:

👉 [LINK](https://docs.17movement.net/phone/building-custom-apps)

Copyright © 2026 17Movement. All rights reserved.