#!/usr/bin/env python3
"""
Quick Health Check - Simple ML Demo
Run this to see instant vehicle health analysis
"""

from health_monitor import VehicleHealthMonitor
import time

def quick_demo():
    """Quick demonstration of ML health analysis"""

    print("="*60)
    print("STRIVE-EV QUICK HEALTH CHECK")
    print("="*60)

    # Initialize the ML monitor
    monitor = VehicleHealthMonitor()

    # Get and analyze latest data
    df = monitor.fetch_latest_data(limit=50)
    df = monitor.preprocess_data(df)

    if df is None:
        print("[ERROR] No data available. Start the ESP32 simulator first:")
        print("   python simulate_esp32.py")
        return

    print(f"[INFO] Analyzing {len(df)} data points...")

    # Quick health analysis
    health = monitor.analyze_structural_health(df)
    anomalies = monitor.detect_anomalies(df)

    # Simple status display
    print(f"\nHEALTH STATUS: {health['status']}")
    print(f"   Score: {health['score']}/100")

    if health['status'] == 'CRITICAL':
        print("   [URGENT] ATTENTION NEEDED!")
    elif health['status'] == 'WARNING':
        print("   [WARN] Monitor closely")
    else:
        print("   [OK] Operating normally")

    # Key issues
    if health['details']:
        print(f"\nTOP ISSUES:")
        for i, issue in enumerate(health['details'][:3], 1):
            print(f"   {i}. {issue}")

    # ML insights
    if not anomalies['normal_operation']:
        print(f"\nML DETECTION:")
        print(f"   • {len(anomalies['anomalies'])} anomalies found")
        print(f"   • {anomalies.get('anomaly_rate', 0)}% anomaly rate")

    # Current readings
    latest = df.iloc[-1]
    print(f"\nCURRENT READINGS:")
    print(f"   • Vibration: {latest['vibration1']:.1f}g, {latest['vibration2']:.1f}g")
    print(f"   • Battery: {latest['battery_voltage']:.1f}V")
    print(f"   • Energy: {latest['piezo_energy']:.2f}mJ")
    print(f"   • Temperature: {latest['temperature']:.0f}°C")

    print(f"\nRECOMMENDATION:")
    if health['score'] < 60:
        print("   Schedule immediate inspection")
    elif health['score'] < 80:
        print("   Plan routine maintenance")
    else:
        print("   Continue normal operation")

    print("="*60)

if __name__ == "__main__":
    quick_demo()