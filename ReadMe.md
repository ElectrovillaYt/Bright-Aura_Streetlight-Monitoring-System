
# Bright-Aura streetlight monitoring — LoRaWAN + Next.js 🔆🚦

**Bright Aura** is a multi-part project that provides an end-to-end solution for monitoring and managing streetlights using LoRaWAN devices, an ESP8266 gateway, a Node/Express backend, scheduled maintenance logic, and a Next.js frontend dashboard.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Architecture](#architecture)
- [Repository Structure](#repository-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Environment Variables](#environment-variables)
  - [Run each module](#run-each-module)
- [Hardware (LoRa/ESP)](#hardware-loraesp)
- [Scheduler](#scheduler)
- [Development tips & notes](#development-tips--notes)
- [Contributing](#contributing)

## Project Overview

This repository contains components for a Streetlight Monitoring system:

- Frontend: A Next.js app providing a public portal and protected admin/partner dashboard with an interactive map and management UI.
- Backend: A lightweight Express.js service that accepts gateway POSTs and serves GeoJSON data to the dashboard.
- Scheduler: A Node script that runs checks and automates complaint resolution workflows.
- Hardware: Arduino/ESP8266 code for LoRa node transmitters and a gateway that aggregates chain data and forwards it to the server.

---

## Architecture 🔧

- LoRa nodes (Arduino) send status payloads to the LoRa Gateway.
- ESP8266 Gateway collects chain data, formats GeoJSON and calls the server API (`/api/data`) with auth header and location header.
- Server (Next.js API or Express backend) stores GeoJSON in Firestore and returns current location data.
- Frontend (Next.js) fetches data and displays it in the protected dashboard map. The Scheduler runs periodic jobs to reconcile complaints and update statuses.

---

## Repository Structure 📁

- `Next.js_App/` — Frontend app (Next.js 13+). Key files: `app/`, `components/`, `utils/`.
- `Express.js_Backend/` — Middleware endpoints for ESP8266 Gateway requests (port 4000 - dev server). Key files: `index.js`, `utils/firebase.js`.
- `scheduler/` — Scheduled background tasks (uses `firebase-admin` + `node-cron`) via Github Actions.
- `Hardware/` — Embedded code for `ArduinoTransmitterCode/` and `ESP8266-GatewayCode/` (PlatformIO / Arduino sketches).

---

## Getting Started

### Prerequisites

- Node.js (v18+ recommended)
- npm or pnpm
- PlatformIO or Arduino IDE for hardware
- A Firebase project (Firestore & Auth) with a service account for server-side operations

### Environment files (.env.example)

I found the following `.env.example` templates in the repository. Copy the appropriate file, replace the placeholder values, and keep secrets out of source control.

- `Next.js_App/.env.example` — Frontend (put values in `Next.js_App/.env.local`):
  - Client config: all `NEXT_PUBLIC_*` keys (Firebase, Geoapify, MapTiler, Map host URL).
  - Server/admin: `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (used by server/admin utilities in `utils/firebaseAdmin.js`).
  - Usage: `cp Next.js_App/.env.example Next.js_App/.env.local` (or create `.env.local` and paste values).

- `Express.js_Backend/.env.example` — Express backend (put values in `Express.js_Backend/.env`):
  - Keys: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_DATABASE_URL`.
  - Optional: `PORT` and `GATEWAY_AUTH_KEY` for simple gateway auth.
  - Usage: `cp Express.js_Backend/.env.example Express.js_Backend/.env`.

- `scheduler/.env.example` — Scheduler (put values in `scheduler/.env` or provide them to your host):
  - Same Firebase admin credentials as the backend.
  - Optional: `CRON_SCHEDULE` if you run it in a scheduler (example: `@hourly`).

- `Hardware/ESP8266-GatewayCode/.env.example` — ESP8266 gateway (Wi‑Fi + server + LoRa params):
  - Keys: `SSID`, `PASSWORD`, `DEVICE_NAME`, `SERVER_URL`, `GATEWAY_KEY`, `COUNTRY`, `STATE`, `PLACE` and LoRa settings.
  - Note: current gateway code hard-codes many values — replace values in code or move to a header/config before production.

- `Hardware/ArduinoTransmitterCode/.env.example` — Arduino node (LoRa params):
  - Keys: `LORA_NETWORK_ID`, `LORA_BAND`, `LORA_CPIN`, `moduleAddr`.
  - Note: current node code hard-codes values — update code accordingly if you plan to use `.env` style config.

Important notes
- When storing service-account private keys in environment variables, keep the `\n` newline escapes if you store the key on a single line (example shown in `.env.example`).
- For devices, the gateway and node code currently include hard-coded values; treat the `.env.example` files as documentation!

### Run each module (Dev server)

1) Frontend (Next.js)

```bash
cd Next.js_App
npm install
npm run dev
# App runs at http://localhost:3000
```

2) Express backend (optional, port 4000)

```bash
cd Express.js_Backend
npm install
node index.js
# Server listens on port 4000
```

3) Scheduler (run manually or with a process manager / cron)

```bash
cd scheduler
npm install
node index.js   # or run your cron wrapper that imports scheduler/index.js
```

4) Hardware

- Compile and flash code in `Hardware/ArduinoTransmitterCode` and `Hardware/ESP8266-GatewayCode` using PlatformIO or Arduino IDE (Make sure all libraries are installed!).
- Update Gateway `ServerUrl` and `key` constants in `ESP8266-GatewayCode/src/main.cpp` to point to your (Express-js app) deployed on server, with it's endpoint url and auth key.
- for debugging set debugMode = true;
---

## Contributing ✨

Contributions welcome! Please open issues for bugs and feature requests, and send PRs for fixes and improvements. Provide clear test instructions and include environment variable expectations in PR descriptions.

---
