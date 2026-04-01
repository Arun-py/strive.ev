#!/usr/bin/env python3
"""ESP32 Data Simulator for STRIVE-EV Testing"""

import requests
import time
import random
import math
import json

BASE_URL = "http://localhost:5000"
DASHBOARD_URL = "http://localhost:3000/car1"

def simulate_esp32_data():
    """Simulate ESP32 circular motion with realistic vibration patterns"""

    print("[SIM] ESP32 Data Simulator - STRIVE-EV Testing")
    print(f"Sending data to: {BASE_URL}/api/car1/data")
    print(f"View dashboard at: {DASHBOARD_URL}")
    print("")

    for i in range(1, 21):  # Send 20 data points
        # Simulate circular motion pattern
        # Forward motion: lower vibration
        # Turn: higher vibration
        if i % 3 == 0:
            # Forward motion
            v1 = round(0.8 + random.random() * 0.6, 2)  # 0.8-1.4g
            v2 = round(0.5 + random.random() * 0.4, 2)  # 0.5-0.9g
            mode = "FORWARD"
        else:
            # Turn left (higher vibration)
            v1 = round(1.8 + random.random() * 1.0, 2)  # 1.8-2.8g
            v2 = round(1.2 + random.random() * 0.8, 2)  # 1.2-2.0g
            mode = "TURN_LEFT"

        # Rear sensors (minimal for front-wheel drive)
        v3 = round(0.1 + random.random() * 0.2, 2)
        v4 = round(0.1 + random.random() * 0.2, 2)

        # Piezo energy calculation: E = 0.18 * sqrt(v1² + v2²)
        energy = round(0.18 * math.sqrt(v1*v1 + v2*v2), 3)

        # Battery voltage (12.0-12.3V range)
        battery = round(12.0 + random.random() * 0.3, 2)

        # Temperature varies slightly
        temp = round(28.0 + random.random() * 2.0, 1)

        # Health status based on average vibration
        avg_vib = (v1 + v2) / 2
        health = "WARNING" if avg_vib > 2.0 else "NORMAL"

        # Current timestamp
        timestamp = str(int(time.time()))

        # JSON payload matching ESP32 format
        payload = {
            "time": timestamp,
            "vibration1": v1,
            "vibration2": v2,
            "vibration3": v3,
            "vibration4": v4,
            "piezo_energy": energy,
            "battery_voltage": battery,
            "temperature": temp,
            "humidity": 55,
            "distance": 50,
            "health_status": health,
            "source": "esp32"
        }

        try:
            # Send POST request to backend
            response = requests.post(
                f"{BASE_URL}/api/car1/data",
                json=payload,
                timeout=5
            )

            if response.status_code == 200 and response.json().get("success"):
                print(f"[{i:2d}/20] {mode:8s}: V1={v1}g V2={v2}g E={energy}mJ Batt={battery}V [{health}] OK")
            else:
                print(f"[{i:2d}/20] ERROR HTTP {response.status_code}: {response.text[:50]}")

        except requests.exceptions.RequestException as e:
            print(f"[{i:2d}/20] ERROR Failed: {e}")

        time.sleep(1)  # Wait 1 second between readings

    print("\n[SIM] Data simulation complete!")
    print("   • Check MongoDB Atlas: 20 new records added")
    print(f"   • View live dashboard: {DASHBOARD_URL}")
    print(f"   • API health check: {BASE_URL}/api/health")
    print(f"   • Get latest data: {BASE_URL}/api/car1/latest")

if __name__ == "__main__":
    simulate_esp32_data()