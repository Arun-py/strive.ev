#!/bin/bash
# ESP32 Data Simulator - sends realistic vibration data to test the system

echo "🤖 ESP32 Data Simulator - STRIVE-EV Testing"
echo "Sending data to: http://localhost:5000/api/car1/data"
echo "View dashboard at: http://localhost:3000/car1"
echo ""

# Simulate circular motion vibration patterns
for i in {1..20}; do
  # Simulate forward motion (lower vibration)
  if [ $((i % 3)) -eq 0 ]; then
    v1=$(echo "scale=2; 0.8 + $RANDOM/32768*0.6" | bc)  # 0.8-1.4g
    v2=$(echo "scale=2; 0.5 + $RANDOM/32768*0.4" | bc)  # 0.5-0.9g
    mode="FORWARD"
  else
    # Simulate turn (higher vibration)
    v1=$(echo "scale=2; 1.8 + $RANDOM/32768*1.0" | bc)  # 1.8-2.8g
    v2=$(echo "scale=2; 1.2 + $RANDOM/32768*0.8" | bc)  # 1.2-2.0g
    mode="TURN_LEFT"
  fi

  v3=$(echo "scale=2; 0.1 + $RANDOM/32768*0.2" | bc)   # Small rear values
  v4=$(echo "scale=2; 0.1 + $RANDOM/32768*0.2" | bc)

  # Calculate piezo energy: E = 0.18 * sqrt(v1² + v2²)
  energy=$(echo "scale=3; 0.18 * sqrt($v1*$v1 + $v2*$v2)" | bc)

  # Battery voltage varies slightly
  battery=$(echo "scale=2; 12.0 + $RANDOM/32768*0.3" | bc)

  # Temperature varies
  temp=$(echo "scale=1; 28.0 + $RANDOM/32768*2.0" | bc)

  # Health status based on vibration
  avg_vib=$(echo "scale=2; ($v1 + $v2) / 2" | bc)
  if (( $(echo "$avg_vib > 2.0" | bc -l) )); then
    health="WARNING"
  else
    health="NORMAL"
  fi

  timestamp=$(date +%s)

  # JSON payload
  payload="{
    \"time\": \"$timestamp\",
    \"vibration1\": $v1,
    \"vibration2\": $v2,
    \"vibration3\": $v3,
    \"vibration4\": $v4,
    \"piezo_energy\": $energy,
    \"battery_voltage\": $battery,
    \"temperature\": $temp,
    \"humidity\": 55,
    \"distance\": 50,
    \"health_status\": \"$health\",
    \"source\": \"esp32\"
  }"

  # Send to backend
  response=$(curl -s -X POST http://localhost:5000/api/car1/data \
    -H "Content-Type: application/json" \
    -d "$payload")

  if echo "$response" | grep -q '"success":true'; then
    echo "[$i/20] $mode: V1=${v1}g V2=${v2}g E=${energy}mJ Batt=${battery}V [$health] ✓"
  else
    echo "[$i/20] ❌ Failed: $response"
  fi

  sleep 1
done

echo ""
echo "🎯 Data simulation complete!"
echo "   • Check MongoDB Atlas: 20 new records"
echo "   • View live dashboard: http://localhost:3000/car1"
echo "   • API health check: http://localhost:5000/api/health"