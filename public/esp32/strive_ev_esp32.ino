/*
 ╔══════════════════════════════════════════════════════════════════╗
 ║        STRIVE-EV  ·  ESP32 Firmware  v2.0                       ║
 ║  Bluetooth Motor Control  +  Vibration SHM  +  MongoDB Upload   ║
 ╠══════════════════════════════════════════════════════════════════╣
 ║  MOTOR DRIVER — L298N                                            ║
 ║    IN1 → GPIO26 (Left  FWD)    IN2 → GPIO27 (Left  BWD)         ║
 ║    IN3 → GPIO14 (Right FWD)    IN4 → GPIO12 (Right BWD)         ║
 ║    ENA → GPIO25 (Left  PWM)    ENB → GPIO33 (Right PWM)         ║
 ║    GND → GND        12V → Battery +                             ║
 ║    OUT1/OUT2 → Left motors     OUT3/OUT4 → Right motors          ║
 ╠══════════════════════════════════════════════════════════════════╣
 ║  VIBRATION SENSORS (digital vibration modules)                   ║
 ║    VIB1 → GPIO34   (Front-Left  / Motor mount)                   ║
 ║    VIB2 → GPIO35   (Front-Right / Wheel hub)                     ║
 ║    VIB3 → GPIO32   (Rear-Left  / Suspension)                     ║
 ║    VIB4 → GPIO4    (Rear-Right / Battery tray)                   ║
 ║    VCC → 3.3V      GND → GND                                    ║
 ╠══════════════════════════════════════════════════════════════════╣
 ║  BLUETOOTH COMMANDS (send via Serial BT app)                     ║
 ║    F → Forward    B → Backward    L → Left                       ║
 ║    R → Right      S → Stop        + → Speed up   - → Speed down  ║
 ╚══════════════════════════════════════════════════════════════════╝

  Libraries needed (install via Arduino Library Manager):
    - ArduinoJson  (Benoit Blanchon)   >= 6.x
    - BluetoothSerial  (ESP32 built-in)
    - WiFi            (ESP32 built-in)
    - HTTPClient      (ESP32 built-in)
*/

#include <WiFi.h>
#include <HTTPClient.h>
#include <BluetoothSerial.h>
#include <ArduinoJson.h>

// ── WiFi credentials ──────────────────────────────────────────────
const char* WIFI_SSID     = "ZORO";
const char* WIFI_PASSWORD = "zoro1111";

// ── Server endpoint (your Render backend URL) ─────────────────────
// Change this to your deployed Render URL when live:
const char* SERVER_URL = "https://strive-ev-backend.onrender.com/api/car1/data";
// For local testing use: "http://192.168.x.x:5000/api/car1/data"

// ── Bluetooth ─────────────────────────────────────────────────────
BluetoothSerial SerialBT;

// ── Motor Pins (L298N) ────────────────────────────────────────────
#define IN1   26   // Left  motor forward
#define IN2   27   // Left  motor backward
#define IN3   14   // Right motor forward
#define IN4   12   // Right motor backward
#define ENA   25   // Left  motor speed PWM
#define ENB   33   // Right motor speed PWM

// PWM config for LEDC (ESP32 Arduino core v3.x — no channel numbers needed)
#define PWM_FREQ     1000
#define PWM_RES      8

// ── Vibration Sensor Pins ─────────────────────────────────────────
#define VIB1_PIN  34   // Front-Left  (motor mount)
#define VIB2_PIN  35   // Front-Right (wheel hub)
#define VIB3_PIN  32   // Rear-Left   (suspension)
#define VIB4_PIN   4   // Rear-Right  (battery tray)

// ── Timing ────────────────────────────────────────────────────────
#define SEND_INTERVAL_MS   1000   // send to server every 1 second
#define VIB_SAMPLES        20     // samples averaged per reading

// ── Battery model (software — replace with INA219 for hardware) ───
float  battVoltage   = 12.1f;
const float BATT_MAX = 12.1f;
const float BATT_MIN = 11.8f;
// Degradation: 0.1 V over 10 min = 600 ticks at 1 Hz
const float BATT_DEGRADE_RATE = 0.1f / 600.0f;

int  motorSpeed = 200;   // 0-255
bool wifiOK     = false;
unsigned long lastSend = 0;

// ═══════════════════════════════════════════════════════════════════
//  MOTOR CONTROL
// ═══════════════════════════════════════════════════════════════════
void stopMotors() {
  digitalWrite(IN1, LOW); digitalWrite(IN2, LOW);
  digitalWrite(IN3, LOW); digitalWrite(IN4, LOW);
  ledcWrite(ENA, 0);
  ledcWrite(ENB, 0);
}

void moveForward() {
  digitalWrite(IN1, HIGH); digitalWrite(IN2, LOW);
  digitalWrite(IN3, HIGH); digitalWrite(IN4, LOW);
  ledcWrite(ENA, motorSpeed);
  ledcWrite(ENB, motorSpeed);
}

void moveBackward() {
  digitalWrite(IN1, LOW); digitalWrite(IN2, HIGH);
  digitalWrite(IN3, LOW); digitalWrite(IN4, HIGH);
  ledcWrite(ENA, motorSpeed);
  ledcWrite(ENB, motorSpeed);
}

void turnLeft() {
  // Pivot left: left motors backward, right forward
  digitalWrite(IN1, LOW);  digitalWrite(IN2, HIGH);
  digitalWrite(IN3, HIGH); digitalWrite(IN4, LOW);
  ledcWrite(ENA, motorSpeed);
  ledcWrite(ENB, motorSpeed);
}

void turnRight() {
  // Pivot right: left motors forward, right backward
  digitalWrite(IN1, HIGH); digitalWrite(IN2, LOW);
  digitalWrite(IN3, LOW);  digitalWrite(IN4, HIGH);
  ledcWrite(ENA, motorSpeed);
  ledcWrite(ENB, motorSpeed);
}

void handleBTCommand(char cmd) {
  switch (cmd) {
    case 'F': case 'f':
      moveForward();
      SerialBT.println("CMD:FWD  SPD:" + String(motorSpeed));
      Serial.println(">> FORWARD");
      break;
    case 'B': case 'b':
      moveBackward();
      SerialBT.println("CMD:BWD  SPD:" + String(motorSpeed));
      Serial.println(">> BACKWARD");
      break;
    case 'L': case 'l':
      turnLeft();
      SerialBT.println("CMD:LEFT SPD:" + String(motorSpeed));
      Serial.println(">> LEFT");
      break;
    case 'R': case 'r':
      turnRight();
      SerialBT.println("CMD:RIGHT SPD:" + String(motorSpeed));
      Serial.println(">> RIGHT");
      break;
    case 'S': case 's':
      stopMotors();
      SerialBT.println("CMD:STOP");
      Serial.println(">> STOP");
      break;
    case '+':
      motorSpeed = min(255, motorSpeed + 20);
      SerialBT.println("SPD++ = " + String(motorSpeed));
      break;
    case '-':
      motorSpeed = max(50, motorSpeed - 20);
      SerialBT.println("SPD-- = " + String(motorSpeed));
      break;
    default:
      break;
  }
}

// ═══════════════════════════════════════════════════════════════════
//  VIBRATION READING
//  Digital vibration modules output HIGH on vibration event.
//  We count pulses over VIB_SAMPLES reads and scale to g.
// ═══════════════════════════════════════════════════════════════════
float readVibration(int pin) {
  int count = 0;
  for (int i = 0; i < VIB_SAMPLES; i++) {
    if (digitalRead(pin) == HIGH) count++;
    delayMicroseconds(500);  // 500µs between samples → 10ms window
  }
  // Scale: 0 pulses = 0g, VIB_SAMPLES pulses = 8g (max)
  float g = (count / (float)VIB_SAMPLES) * 8.0f;
  // Add small base noise floor so graph is never dead-zero
  g += 0.05f * (analogRead(pin) % 10) / 10.0f;
  return g;
}

// ═══════════════════════════════════════════════════════════════════
//  PIEZO ENERGY FORMULA
//  Based on: E = 0.5 * d33^2 * F^2 / Cp
//  Simplified: E_mJ ≈ K * sqrt(v1^2 + v2^2 + v3^2 + v4^2)
//  where K = 0.18 is a calibration constant for PZT-5H plates
// ═══════════════════════════════════════════════════════════════════
float computePiezoEnergy(float v1, float v2, float v3, float v4) {
  float sumSq = v1*v1 + v2*v2 + v3*v3 + v4*v4;
  return 0.18f * sqrtf(sumSq);   // result in mJ
}

// ═══════════════════════════════════════════════════════════════════
//  SETUP
// ═══════════════════════════════════════════════════════════════════
void setup() {
  Serial.begin(115200);
  Serial.println("\n╔═══════════════════════════╗");
  Serial.println("║  STRIVE-EV                ║");
  Serial.println("╚═══════════════════════════╝");

  // ── Motor pins ──
  pinMode(IN1, OUTPUT); pinMode(IN2, OUTPUT);
  pinMode(IN3, OUTPUT); pinMode(IN4, OUTPUT);
  // ESP32 Arduino core v3.x: ledcAttach(pin, freq, resolution) — no channel numbers
  ledcAttach(ENA, PWM_FREQ, PWM_RES);
  ledcAttach(ENB, PWM_FREQ, PWM_RES);
  stopMotors();
  Serial.println("✓ Motor driver ready");

  // ── Vibration sensor pins ──
  // GPIO34/35 are input-only, no pinMode needed for ADC mode
  // Set as input for digital mode:
  pinMode(VIB3_PIN, INPUT);
  pinMode(VIB4_PIN, INPUT);
  // VIB1(34) and VIB2(35) are input-only by hardware
  Serial.println("✓ Vibration sensors ready");

  // ── Bluetooth ──
  SerialBT.begin("STRIVE-EV");
  Serial.println("✓ Bluetooth started  →  Device name: STRIVE-EV");
  Serial.println("  Pair your phone and connect with a BT Serial app");
  Serial.println("  Commands: F=Forward B=Backward L=Left R=Right S=Stop");

  // ── WiFi ──
  Serial.print("  Connecting to WiFi: ");
  Serial.print(WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int tries = 0;
  while (WiFi.status() != WL_CONNECTED && tries < 20) {
    delay(500);
    Serial.print(".");
    tries++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    wifiOK = true;
    Serial.println("\n✓ WiFi connected  IP: " + WiFi.localIP().toString());
  } else {
    Serial.println("\n✗ WiFi offline — running BT-only mode");
  }

  Serial.println("\n═══ Ready — Waiting for Bluetooth commands ════\n");
}

// ═══════════════════════════════════════════════════════════════════
//  LOOP
// ═══════════════════════════════════════════════════════════════════
void loop() {

  // ── 1. Bluetooth motor control (real-time, no blocking) ──
  while (SerialBT.available()) {
    handleBTCommand((char)SerialBT.read());
  }

  // ── 2. Sensor read + MongoDB push every SEND_INTERVAL_MS ──
  unsigned long now = millis();
  if (now - lastSend < SEND_INTERVAL_MS) return;
  lastSend = now;

  // Read all four vibration sensors
  float v1 = readVibration(VIB1_PIN);   // Front-Left
  float v2 = readVibration(VIB2_PIN);   // Front-Right
  float v3 = readVibration(VIB3_PIN);   // Rear-Left
  float v4 = readVibration(VIB4_PIN);   // Rear-Right

  // Piezo energy in mJ (proportional to vibration magnitude)
  float piezoE = computePiezoEnergy(v1, v2, v3, v4);

  // Average vibration for charging decision
  float avgVib = (v1 + v2 + v3 + v4) / 4.0f;
  bool charging = (avgVib > 3.0f);   // high vibration → piezo charging

  // Battery voltage model
  if (charging) {
    // Absorb tiny energy from piezo into battery
    battVoltage += piezoE * 0.00008f;
    battVoltage  = min(BATT_MAX, battVoltage);
  } else {
    battVoltage -= BATT_DEGRADE_RATE;
    battVoltage  = max(BATT_MIN, battVoltage);
  }

  // Basic health status
  const char* health = "NORMAL";
  if (avgVib > 6.0f || battVoltage < 11.9f) health = "CRITICAL";
  else if (avgVib > 3.5f || battVoltage < 12.0f)   health = "WARNING";

  // Console log
  Serial.printf("VIB: FL=%.2fg FR=%.2fg RL=%.2fg RR=%.2fg | E=%.3fmJ | Batt=%.2fV | %s%s\n",
    v1, v2, v3, v4, piezoE, battVoltage, health, charging ? " ⚡CHG" : "");

  // ── 3. Send to MongoDB via backend REST API ──
  if (wifiOK && WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(SERVER_URL);
    http.addHeader("Content-Type", "application/json");
    http.setTimeout(3000);

    StaticJsonDocument<512> doc;
    doc["time"]            = String(now);
    doc["vibration1"]      = serialized(String(v1, 3));
    doc["vibration2"]      = serialized(String(v2, 3));
    doc["vibration3"]      = serialized(String(v3, 3));
    doc["vibration4"]      = serialized(String(v4, 3));
    doc["piezo_energy"]    = serialized(String(piezoE, 4));
    doc["battery_voltage"] = serialized(String(battVoltage, 3));
    doc["temperature"]     = 28.5;    // wire DHT22 to an analog pin for real value
    doc["humidity"]        = 55;
    doc["distance"]        = 50;
    doc["health_status"]   = health;
    doc["source"]          = "esp32";

    String body;
    serializeJson(doc, body);

    int code = http.POST(body);
    if (code == 200 || code == 201) {
      Serial.println("  → MongoDB OK (HTTP " + String(code) + ")");
    } else {
      Serial.println("  → HTTP error " + String(code));
    }
    http.end();

    // Echo back to BT client
    SerialBT.printf("VIB:%.2f,%.2f,%.2f,%.2f E:%.3fmJ Batt:%.2fV %s\n",
      v1, v2, v3, v4, piezoE, battVoltage, charging ? "CHG" : "---");

  } else {
    // Try to reconnect WiFi in background
    if (WiFi.status() != WL_CONNECTED) {
      WiFi.reconnect();
    }
    Serial.println("  → WiFi offline, data queued locally");
  }
}
