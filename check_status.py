#!/usr/bin/env python3
"""STRIVE-EV System Status Checker"""

import requests
import json
import time

def get_status():
    """Check status of all STRIVE-EV components"""
    print("=" * 70)
    print("STRIVE-EV SYSTEM STATUS REPORT")
    print("=" * 70)

    # Backend Health Check
    try:
        r = requests.get("http://localhost:5000/api/health", timeout=3)
        if r.status_code == 200:
            data = r.json()
            print("[OK] Backend Server: ONLINE")
            print(f"   • URL: http://localhost:5000")
            print(f"   • Status: {data['status']}")
            print(f"   • MongoDB: {data['mongodb'].upper()}")
            print(f"   • Last Check: {data['time']}")
        else:
            print("[ERROR] Backend Server: ERROR (HTTP {})".format(r.status_code))
    except Exception as e:
        print(f"[ERROR] Backend Server: OFFLINE ({e})")

    print()

    # Frontend Health Check
    try:
        r = requests.get("http://localhost:3000/", timeout=3)
        if r.status_code == 200:
            print("[OK] Frontend Server: ONLINE")
            print("   • URL: http://localhost:3000")
            print("   • Dashboard: http://localhost:3000/car1")
            print("   • Framework: Next.js")
        else:
            print("[ERROR] Frontend Server: ERROR (HTTP {})".format(r.status_code))
    except Exception as e:
        print(f"[ERROR] Frontend Server: OFFLINE ({e})")

    print()

    # Database Data Check
    try:
        r = requests.get("http://localhost:5000/api/car1/latest?limit=5", timeout=5)
        if r.status_code == 200:
            data = r.json()
            if data['success'] and data['data']:
                print("[OK] MongoDB Data: AVAILABLE")
                print(f"   • Total Records: {len(data['data'])} (last 5 shown)")
                latest = data['data'][-1]
                print(f"   • Latest Record:")
                print(f"     - Time: {latest['createdAt']}")
                print(f"     - V1: {latest['vibration1']}g, V2: {latest['vibration2']}g")
                print(f"     - Energy: {latest['piezo_energy']}mJ")
                print(f"     - Battery: {latest['battery_voltage']}V")
                print(f"     - Health: {latest['health_status']}")
            else:
                print("[WARN] MongoDB Data: NO RECORDS")
        else:
            print("[ERROR] MongoDB Data: ERROR")
    except Exception as e:
        print(f"[ERROR] MongoDB Data: UNAVAILABLE ({e})")

    print()
    print("=" * 70)
    print("ESP32 INTEGRATION READY")
    print("=" * 70)
    print("Your ESP32 should connect to:")
    print(f"• WiFi: ZORO (password: zoro1111)")
    print(f"• Server: http://10.181.105.133:5000/api/car1/data")
    print(f"• Pins: ENA=27, IN1=25, IN2=26, IN3=14, IN4=12, ENB=33")
    print(f"• LCD: SDA=21, SCL=22 (I2C address 0x27)")
    print(f"• Vibration: VIB1=35, VIB2=34")
    print()
    print("VIEW LIVE DATA:")
    print("• Dashboard: http://localhost:3000/car1")
    print("• API Health: http://localhost:5000/api/health")
    print("• Latest Data: http://localhost:5000/api/car1/latest")
    print()
    print("TEST ESP32 SIMULATION:")
    print("• python simulate_esp32.py")
    print("=" * 70)

if __name__ == "__main__":
    get_status()