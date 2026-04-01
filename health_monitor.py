#!/usr/bin/env python3
"""
STRIVE-EV Health Monitoring System
Real-time ML-based vehicle health analysis using vibration data
"""

import requests
import numpy as np
import pandas as pd
import time
import json
from datetime import datetime, timedelta
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
import warnings
warnings.filterwarnings('ignore')

class VehicleHealthMonitor:
    """Vehicle health monitoring system using machine learning"""

    def __init__(self, api_url="http://localhost:5000"):
        """Initialize the health monitor"""
        self.api_url = api_url
        self.scaler = StandardScaler()
        self.anomaly_detector = IsolationForest(contamination=0.1, random_state=42)
        self.is_trained = False

        # Health thresholds based on automotive industry standards
        self.thresholds = {
            'vibration_critical': 5.0,    # g (acceleration)
            'vibration_warning': 2.5,     # g
            'battery_critical': 11.0,     # V
            'battery_warning': 11.5,      # V
            'temp_critical': 85.0,        # °C
            'temp_warning': 65.0,         # °C
            'energy_efficiency': 0.3      # mJ minimum expected
        }

        print("Vehicle Health Monitor initialized")
        print("Ready to analyze STRIVE-EV data")

    def fetch_latest_data(self, limit=50):
        """Fetch latest sensor data from API"""
        try:
            response = requests.get(f"{self.api_url}/api/car1/latest?limit={limit}", timeout=5)
            if response.status_code == 200:
                data = response.json()
                if data['success'] and data['data']:
                    return pd.DataFrame(data['data'])
            return None
        except Exception as e:
            print(f"Error fetching data: {e}")
            return None

    def preprocess_data(self, df):
        """Clean and prepare data for analysis"""
        if df is None or df.empty:
            return None

        # Convert timestamp
        df['timestamp'] = pd.to_datetime(df['createdAt'])

        # Calculate derived features
        df['vibration_total'] = (df['vibration1']**2 + df['vibration2']**2 +
                               df['vibration3']**2 + df['vibration4']**2)**0.5
        df['vibration_imbalance'] = np.abs(df['vibration1'] - df['vibration2'])
        df['energy_efficiency'] = df['piezo_energy'] / (df['vibration_total'] + 0.001)

        # Rolling averages for trend analysis
        df = df.sort_values('timestamp').reset_index(drop=True)
        df['vibration_trend'] = df['vibration_total'].rolling(window=5, min_periods=1).mean()
        df['battery_trend'] = df['battery_voltage'].rolling(window=5, min_periods=1).mean()

        return df

    def analyze_structural_health(self, df):
        """Analyze structural health based on vibration patterns"""
        if df is None or len(df) < 5:
            return {"status": "INSUFFICIENT_DATA", "confidence": 0.0, "details": []}

        latest = df.iloc[-1]
        recent = df.tail(10)

        health_score = 100.0  # Start with perfect health
        issues = []

        # 1. Vibration Analysis
        max_vibration = recent['vibration_total'].max()
        avg_vibration = recent['vibration_total'].mean()
        vibration_std = recent['vibration_total'].std()

        if max_vibration > self.thresholds['vibration_critical']:
            health_score -= 30
            issues.append(f"CRITICAL: Peak vibration {max_vibration:.2f}g exceeds safe limit")
        elif max_vibration > self.thresholds['vibration_warning']:
            health_score -= 15
            issues.append(f"WARNING: High vibration detected {max_vibration:.2f}g")

        # 2. Vibration Pattern Analysis
        if vibration_std > 0.5:
            health_score -= 10
            issues.append(f"Unstable vibration pattern (std: {vibration_std:.2f})")

        # 3. Imbalance Detection
        max_imbalance = recent['vibration_imbalance'].max()
        if max_imbalance > 1.0:
            health_score -= 20
            issues.append(f"Motor imbalance detected: {max_imbalance:.2f}g difference")

        # 4. Battery Health
        battery_voltage = latest['battery_voltage']
        if battery_voltage < self.thresholds['battery_critical']:
            health_score -= 25
            issues.append(f"CRITICAL: Battery voltage low {battery_voltage:.2f}V")
        elif battery_voltage < self.thresholds['battery_warning']:
            health_score -= 10
            issues.append(f"Battery voltage declining {battery_voltage:.2f}V")

        # 5. Energy Efficiency
        efficiency = recent['energy_efficiency'].mean()
        if efficiency < self.thresholds['energy_efficiency']:
            health_score -= 15
            issues.append(f"Low energy harvesting efficiency: {efficiency:.3f}mJ/g")

        # 6. Temperature Check
        temperature = latest['temperature']
        if temperature > self.thresholds['temp_critical']:
            health_score -= 20
            issues.append(f"CRITICAL: Overheating {temperature:.1f}°C")
        elif temperature > self.thresholds['temp_warning']:
            health_score -= 10
            issues.append(f"High temperature: {temperature:.1f}°C")

        # Determine overall status
        health_score = max(0, min(100, health_score))

        if health_score >= 85:
            status = "EXCELLENT"
        elif health_score >= 70:
            status = "GOOD"
        elif health_score >= 50:
            status = "WARNING"
        else:
            status = "CRITICAL"

        return {
            "status": status,
            "score": round(health_score, 1),
            "confidence": min(100, len(df) * 2),  # Confidence based on data points
            "details": issues,
            "metrics": {
                "max_vibration": round(max_vibration, 2),
                "avg_vibration": round(avg_vibration, 2),
                "imbalance": round(max_imbalance, 2),
                "battery_health": round((battery_voltage / 12.0) * 100, 1),
                "energy_efficiency": round(efficiency, 3),
                "temperature": round(temperature, 1)
            }
        }

    def detect_anomalies(self, df):
        """Use ML to detect unusual patterns"""
        if df is None or len(df) < 10:
            return {"anomalies": [], "normal_operation": True}

        # Prepare features for anomaly detection
        features = ['vibration1', 'vibration2', 'vibration3', 'vibration4',
                   'battery_voltage', 'temperature', 'piezo_energy']

        X = df[features].dropna()
        if len(X) < 10:
            return {"anomalies": [], "normal_operation": True}

        # Train if not already trained
        if not self.is_trained and len(X) >= 20:
            X_scaled = self.scaler.fit_transform(X)
            self.anomaly_detector.fit(X_scaled)
            self.is_trained = True
            print("ML anomaly detector trained on historical data")

        if self.is_trained:
            X_scaled = self.scaler.transform(X)
            anomaly_scores = self.anomaly_detector.decision_function(X_scaled)
            anomalies = self.anomaly_detector.predict(X_scaled)

            # Find anomalous points
            anomaly_indices = np.where(anomalies == -1)[0]
            anomaly_details = []

            for idx in anomaly_indices[-5:]:  # Last 5 anomalies
                row = df.iloc[idx + (len(df) - len(X))]  # Adjust index
                anomaly_details.append({
                    "timestamp": row['createdAt'],
                    "score": round(anomaly_scores[idx], 3),
                    "vibrations": [row['vibration1'], row['vibration2'],
                                 row['vibration3'], row['vibration4']],
                    "severity": "HIGH" if anomaly_scores[idx] < -0.5 else "MEDIUM"
                })

            return {
                "anomalies": anomaly_details,
                "normal_operation": len(anomaly_indices) == 0,
                "anomaly_rate": round(len(anomaly_indices) / len(X) * 100, 1)
            }

        return {"anomalies": [], "normal_operation": True, "note": "Training in progress"}

    def predict_maintenance(self, df):
        """Predict when maintenance might be needed"""
        if df is None or len(df) < 20:
            return {"prediction": "Insufficient data for prediction", "days_until": None}

        # Analyze trends
        recent_20 = df.tail(20)
        vibration_trend = np.polyfit(range(len(recent_20)), recent_20['vibration_total'], 1)[0]
        battery_trend = np.polyfit(range(len(recent_20)), recent_20['battery_voltage'], 1)[0]

        maintenance_factors = []
        days_until = float('inf')

        # Vibration trend analysis
        if vibration_trend > 0.05:  # Increasing vibration
            vibration_days = (self.thresholds['vibration_warning'] - recent_20['vibration_total'].iloc[-1]) / vibration_trend
            if vibration_days > 0:
                days_until = min(days_until, vibration_days)
                maintenance_factors.append(f"Vibration increasing by {vibration_trend:.3f}g/day")

        # Battery degradation analysis
        if battery_trend < -0.01:  # Decreasing battery voltage
            battery_days = (recent_20['battery_voltage'].iloc[-1] - self.thresholds['battery_warning']) / abs(battery_trend)
            if battery_days > 0:
                days_until = min(days_until, battery_days)
                maintenance_factors.append(f"Battery degrading by {abs(battery_trend):.3f}V/day")

        if days_until == float('inf'):
            prediction = "No immediate maintenance required"
            days_until = None
        elif days_until < 7:
            prediction = "URGENT: Maintenance needed within a week"
        elif days_until < 30:
            prediction = f"Maintenance recommended within {int(days_until)} days"
        else:
            prediction = "System stable, routine maintenance schedule OK"

        return {
            "prediction": prediction,
            "days_until": int(days_until) if days_until != float('inf') and days_until is not None else None,
            "factors": maintenance_factors
        }

    def generate_report(self):
        """Generate comprehensive health report"""
        print("\n" + "="*70)
        print("STRIVE-EV HEALTH ANALYSIS REPORT")
        print("="*70)
        print(f"Analysis Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

        # Fetch and process data
        df = self.fetch_latest_data(limit=100)
        df = self.preprocess_data(df)

        if df is None or df.empty:
            print("[ERROR] No data available for analysis")
            return

        print(f"Data Points Analyzed: {len(df)}")
        print(f"Time Range: {df['timestamp'].min()} to {df['timestamp'].max()}")

        # Structural Health Analysis
        health = self.analyze_structural_health(df)
        print(f"\nSTRUCTURAL HEALTH: {health['status']}")
        print(f"Health Score: {health['score']}/100 (Confidence: {health['confidence']}%)")

        if health['details']:
            print("Issues Detected:")
            for issue in health['details']:
                print(f"  • {issue}")

        print(f"\nKey Metrics:")
        for metric, value in health['metrics'].items():
            print(f"  • {metric.replace('_', ' ').title()}: {value}")

        # Anomaly Detection
        anomalies = self.detect_anomalies(df)
        print(f"\nANOMALY DETECTION:")
        if anomalies['normal_operation']:
            print("[OK] Normal operation patterns detected")
        else:
            print(f"[ALERT] {len(anomalies['anomalies'])} anomalies detected")
            print(f"Anomaly Rate: {anomalies.get('anomaly_rate', 0)}%")

            for anomaly in anomalies['anomalies'][-3:]:  # Show last 3
                print(f"  • {anomaly['timestamp']}: {anomaly['severity']} severity")

        # Maintenance Prediction
        maintenance = self.predict_maintenance(df)
        print(f"\nMAINTENANCE PREDICTION:")
        print(f"Status: {maintenance['prediction']}")
        if maintenance['days_until']:
            print(f"Estimated Days: {maintenance['days_until']}")
        if maintenance['factors']:
            print("Factors:")
            for factor in maintenance['factors']:
                print(f"  • {factor}")

        # Recommendations
        print(f"\nRECOMMENDATIONS:")
        if health['score'] < 60:
            print("  • IMMEDIATE inspection of suspension and motor mounts")
            print("  • Check for loose connections and worn components")
        elif health['score'] < 80:
            print("  • Schedule routine maintenance check")
            print("  • Monitor vibration levels closely")
        else:
            print("  • Continue normal operation")
            print("  • Maintain regular inspection schedule")

        print("="*70)

        return {
            "health": health,
            "anomalies": anomalies,
            "maintenance": maintenance,
            "timestamp": datetime.now().isoformat()
        }

    def monitor_continuously(self, interval=30):
        """Continuously monitor vehicle health"""
        print(f"\nStarting continuous monitoring (every {interval} seconds)")
        print("Press Ctrl+C to stop")

        try:
            while True:
                self.generate_report()
                print(f"\nNext analysis in {interval} seconds...")
                time.sleep(interval)
        except KeyboardInterrupt:
            print("\nMonitoring stopped by user")


def main():
    """Main function to run health monitoring"""
    monitor = VehicleHealthMonitor()

    # Generate initial report
    monitor.generate_report()

    # Ask user if they want continuous monitoring
    choice = input("\nRun continuous monitoring? (y/n): ").lower()
    if choice == 'y':
        monitor.monitor_continuously(interval=30)
    else:
        print("Single analysis complete. Run again anytime!")


if __name__ == "__main__":
    main()