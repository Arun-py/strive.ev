# STRIVE-EV

**Structural Intelligence & Vibration Energy System for Electric Vehicles**

> Sense • Harvest • Protect.

---

## Overview

STRIVE-EV is a full-stack research dashboard for real-time piezoelectric energy harvesting and structural health diagnostics of electric vehicles. It integrates physics-accurate simulation with live IoT telemetry from ESP32 hardware.

## Pages

| Route | Description |
|-------|-------------|
| `/` | Home — video background, system overview, live telemetry preview |
| `/login` | Login for simulation or IoT dashboard |
| `/research` | Research backings — 4 tabs with full citations |
| `/simulation` | Physics-based simulation dashboard with 8 fault conditions |
| `/car1` | Real-time IoT dashboard — ESP32 → MongoDB → WebSocket |

## Login Credentials

| Email | Password | Dashboard |
|-------|----------|-----------|
| `simulation@strive.ev` | `strive2024` | Simulation |
| `car1@strive.ev` | `rover2024` | Car-1 Live IoT |

## Tech Stack

- **Frontend**: Next.js 14 (App Router, TypeScript, Tailwind CSS)
- **Animation**: Framer Motion, Chart.js
- **Backend**: Express.js + WebSocket (`ws`)
- **Database**: MongoDB Atlas via Mongoose
- **Hardware**: ESP32 → POST to `/api/car1/data` → WebSocket broadcast

## Setup

```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd server && npm install && cd ..

# Configure environment
cp .env.example .env.local
# Edit .env.local with your MongoDB URI

# Run development (two terminals)
node server/index.js       # Backend — port 5000
npm run dev                # Frontend — port 3000
```

## ESP32 Data Schema

```json
{
  "time": "2026-03-10T10:30:12",
  "vibration1": 2.3,
  "vibration2": 1.8,
  "vibration3": 3.1,
  "vibration4": 0.9,
  "temperature": 29,
  "humidity": 56,
  "distance": 45,
  "battery_voltage": 11.8,
  "piezo_energy": 2.1
}
```

POST to: `http://<backend-ip>:5000/api/car1/data`

## Physics Model

| Parameter | Value | Source |
|-----------|-------|--------|
| d₃₃ (PZT) | 580 pC/N | PDT Lab Report |
| Q = d₃₃ × F | Charge generation | Wang et al. 2018 |
| V = Q/Cₚ | Voltage output | Direct piezo effect |
| P = V²/2R | Power | Standard circuit |
| fₙ = (1/2π)√(k/m) | Natural frequency | SHM theory |

## Background Video

Place `ev-bg.mov` in the `public/` folder. The file is not tracked in git due to size.
Download: [0_Electric_Vehicle_Ev_3840x2160.mov] from the project files.

## License

Research project — not for commercial use.
