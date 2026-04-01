/*
 * STRIVE-EV ESP32 Main Controller
 * Features:
 * - Bluetooth App Control for Movement
 * - 4 Vibration Sensors (Piezoelectric)
 * - Voltage Sensor
 * - Motor Control (L298N)
 * - Ultrasonic Distance Sensor
 * - I2C LCD Display
 * - WiFi + HTTP for Real-time Dashboard Updates
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <BluetoothSerial.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <ArduinoJson.h>

// ═══════════════════════════════════════════════════════════════════════════════
// PIN DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

// Vibration Sensors (Piezoelectric)
#define VIB_SENSOR_1 33
#define VIB_SENSOR_2 32
#define VIB_SENSOR_3 34
#define VIB_SENSOR_4 4

// Voltage Sensor
#define VOLTAGE_SENSOR 5

// Motor Driver (L298N)
#define MOTOR_IN1 26
#define MOTOR_IN2 27
#define MOTOR_IN3 14
#define MOTOR_IN4 12
#define MOTOR_ENA 25  // Left PWM
#define MOTOR_ENB 33  // Right PWM (Note: shares pin with VIB_SENSOR_1)

// Ultrasonic Sensor (HC-SR04)
#define ULTRASONIC_TRIG 15
#define ULTRASONIC_ECHO 2

// I2C LCD (20x4)
#define LCD_SDA 21
#define LCD_SCL 22

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

// WiFi Credentials
const char* WIFI_SSID = "ZORO";
const char* WIFI_PASSWORD = "zoro1111";

// Server Configuration
const char* SERVER_URL = "https://strive-ev.vercel.app/api/car1/data";

// Thresholds
const float VIBRATION_CHARGING_THRESHOLD = 500.0;  // ADC value threshold for "charging"
const float VOLTAGE_MULTIPLIER = 0.00489;          // ADC to voltage conversion (3.3V / 4095 * voltage divider)
const int MOTOR_SPEED = 200;                       // PWM speed (0-255)

// Update intervals (ms)
const unsigned long SENSOR_READ_INTERVAL = 100;
const unsigned long SERVER_UPDATE_INTERVAL = 1000;
const unsigned long LCD_UPDATE_INTERVAL = 500;

// ═══════════════════════════════════════════════════════════════════════════════
// GLOBAL OBJECTS
// ═══════════════════════════════════════════════════════════════════════════════

BluetoothSerial SerialBT;
LiquidCrystal_I2C lcd(0x27, 20, 4);  // Address 0x27, 20 cols, 4 rows

// ═══════════════════════════════════════════════════════════════════════════════
// SENSOR DATA STRUCTURE
// ═══════════════════════════════════════════════════════════════════════════════

struct SensorData {
  float vibration1;
  float vibration2;
  float vibration3;
  float vibration4;
  float piezoVoltage;
  float piezoEnergy;
  float batteryVoltage;
  float distance;
  bool isCharging;
  String healthStatus;
  String condition;
} sensorData;

// ═══════════════════════════════════════════════════════════════════════════════
// TIMING VARIABLES
// ═══════════════════════════════════════════════════════════════════════════════

unsigned long lastSensorRead = 0;
unsigned long lastServerUpdate = 0;
unsigned long lastLCDUpdate = 0;

// Motor state
char currentDirection = 'S';  // S=Stop, F=Forward, B=Backward, L=Left, R=Right

// ═══════════════════════════════════════════════════════════════════════════════
// SETUP
// ═══════════════════════════════════════════════════════════════════════════════

void setup() {
  Serial.begin(115200);
  Serial.println("\n╔════════════════════════════════════════════╗");
  Serial.println("║       STRIVE-EV ESP32 Controller           ║");
  Serial.println("╚════════════════════════════════════════════╝");

  // Initialize I2C
  Wire.begin(LCD_SDA, LCD_SCL);

  // Initialize LCD
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("   STRIVE-EV v1.0   ");
  lcd.setCursor(0, 1);
  lcd.print("   Initializing...  ");

  // Initialize Bluetooth
  SerialBT.begin("STRIVE-EV");
  Serial.println("✓ Bluetooth initialized: STRIVE-EV");

  // Initialize pins
  initializePins();

  // Connect to WiFi
  connectWiFi();

  // Initialize sensor data
  memset(&sensorData, 0, sizeof(sensorData));
  sensorData.healthStatus = "NORMAL";
  sensorData.condition = "IDLE";

  // Update LCD
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("STRIVE-EV  READY");
  lcd.setCursor(0, 1);
  lcd.print("BT: STRIVE-EV");
  lcd.setCursor(0, 2);
  lcd.print("WiFi: Connected");
  lcd.setCursor(0, 3);
  lcd.print("Status: IDLE");

  Serial.println("\n✓ System ready!");
}

// ═══════════════════════════════════════════════════════════════════════════════
// INITIALIZATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

void initializePins() {
  // Vibration sensors (analog input)
  pinMode(VIB_SENSOR_1, INPUT);
  pinMode(VIB_SENSOR_2, INPUT);
  pinMode(VIB_SENSOR_3, INPUT);
  pinMode(VIB_SENSOR_4, INPUT);

  // Voltage sensor (analog input)
  pinMode(VOLTAGE_SENSOR, INPUT);

  // Motor pins (output)
  pinMode(MOTOR_IN1, OUTPUT);
  pinMode(MOTOR_IN2, OUTPUT);
  pinMode(MOTOR_IN3, OUTPUT);
  pinMode(MOTOR_IN4, OUTPUT);
  pinMode(MOTOR_ENA, OUTPUT);
  pinMode(MOTOR_ENB, OUTPUT);

  // Ultrasonic sensor
  pinMode(ULTRASONIC_TRIG, OUTPUT);
  pinMode(ULTRASONIC_ECHO, INPUT);

  // Set initial motor state (stopped)
  stopMotors();

  Serial.println("✓ GPIO pins initialized");
}

void connectWiFi() {
  Serial.print("Connecting to WiFi: ");
  Serial.println(WIFI_SSID);

  lcd.setCursor(0, 2);
  lcd.print("WiFi: Connecting... ");

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✓ WiFi connected!");
    Serial.print("  IP: ");
    Serial.println(WiFi.localIP());

    lcd.setCursor(0, 2);
    lcd.print("WiFi: ");
    lcd.print(WiFi.localIP());
  } else {
    Serial.println("\n✗ WiFi connection failed!");
    lcd.setCursor(0, 2);
    lcd.print("WiFi: FAILED       ");
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN LOOP
// ═══════════════════════════════════════════════════════════════════════════════

void loop() {
  unsigned long currentMillis = millis();

  // Handle Bluetooth commands
  handleBluetooth();

  // Read sensors at regular intervals
  if (currentMillis - lastSensorRead >= SENSOR_READ_INTERVAL) {
    readAllSensors();
    lastSensorRead = currentMillis;
  }

  // Update LCD display
  if (currentMillis - lastLCDUpdate >= LCD_UPDATE_INTERVAL) {
    updateLCD();
    lastLCDUpdate = currentMillis;
  }

  // Send data to server
  if (currentMillis - lastServerUpdate >= SERVER_UPDATE_INTERVAL) {
    sendDataToServer();
    lastServerUpdate = currentMillis;
  }

  // Check WiFi connection and reconnect if needed
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi disconnected. Reconnecting...");
    connectWiFi();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// BLUETOOTH HANDLING
// ═══════════════════════════════════════════════════════════════════════════════

void handleBluetooth() {
  if (SerialBT.available()) {
    char command = SerialBT.read();
    processCommand(command);
  }
}

void processCommand(char cmd) {
  Serial.print("BT Command: ");
  Serial.println(cmd);

  switch (cmd) {
    case 'F':  // Forward
    case 'f':
      moveForward();
      currentDirection = 'F';
      sensorData.condition = "MOVING-FWD";
      break;

    case 'B':  // Backward
    case 'b':
      moveBackward();
      currentDirection = 'B';
      sensorData.condition = "MOVING-BWD";
      break;

    case 'L':  // Left
    case 'l':
      turnLeft();
      currentDirection = 'L';
      sensorData.condition = "TURNING-L";
      break;

    case 'R':  // Right
    case 'r':
      turnRight();
      currentDirection = 'R';
      sensorData.condition = "TURNING-R";
      break;

    case 'S':  // Stop
    case 's':
      stopMotors();
      currentDirection = 'S';
      sensorData.condition = "STOPPED";
      break;

    case '1':  // Speed 1 (slow)
      setMotorSpeed(100);
      break;

    case '2':  // Speed 2 (medium)
      setMotorSpeed(180);
      break;

    case '3':  // Speed 3 (fast)
      setMotorSpeed(255);
      break;

    default:
      break;
  }

  // Echo back to Bluetooth app
  SerialBT.print("CMD:");
  SerialBT.println(cmd);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MOTOR CONTROL FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

void moveForward() {
  digitalWrite(MOTOR_IN1, HIGH);
  digitalWrite(MOTOR_IN2, LOW);
  digitalWrite(MOTOR_IN3, HIGH);
  digitalWrite(MOTOR_IN4, LOW);
  analogWrite(MOTOR_ENA, MOTOR_SPEED);
  analogWrite(MOTOR_ENB, MOTOR_SPEED);
  Serial.println("→ Moving Forward");
}

void moveBackward() {
  digitalWrite(MOTOR_IN1, LOW);
  digitalWrite(MOTOR_IN2, HIGH);
  digitalWrite(MOTOR_IN3, LOW);
  digitalWrite(MOTOR_IN4, HIGH);
  analogWrite(MOTOR_ENA, MOTOR_SPEED);
  analogWrite(MOTOR_ENB, MOTOR_SPEED);
  Serial.println("→ Moving Backward");
}

void turnLeft() {
  digitalWrite(MOTOR_IN1, LOW);
  digitalWrite(MOTOR_IN2, HIGH);
  digitalWrite(MOTOR_IN3, HIGH);
  digitalWrite(MOTOR_IN4, LOW);
  analogWrite(MOTOR_ENA, MOTOR_SPEED);
  analogWrite(MOTOR_ENB, MOTOR_SPEED);
  Serial.println("→ Turning Left");
}

void turnRight() {
  digitalWrite(MOTOR_IN1, HIGH);
  digitalWrite(MOTOR_IN2, LOW);
  digitalWrite(MOTOR_IN3, LOW);
  digitalWrite(MOTOR_IN4, HIGH);
  analogWrite(MOTOR_ENA, MOTOR_SPEED);
  analogWrite(MOTOR_ENB, MOTOR_SPEED);
  Serial.println("→ Turning Right");
}

void stopMotors() {
  digitalWrite(MOTOR_IN1, LOW);
  digitalWrite(MOTOR_IN2, LOW);
  digitalWrite(MOTOR_IN3, LOW);
  digitalWrite(MOTOR_IN4, LOW);
  analogWrite(MOTOR_ENA, 0);
  analogWrite(MOTOR_ENB, 0);
  Serial.println("→ Motors Stopped");
}

void setMotorSpeed(int speed) {
  analogWrite(MOTOR_ENA, speed);
  analogWrite(MOTOR_ENB, speed);
  Serial.print("→ Speed set to: ");
  Serial.println(speed);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SENSOR READING FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

void readAllSensors() {
  // Read vibration sensors (piezoelectric)
  sensorData.vibration1 = analogRead(VIB_SENSOR_1);
  sensorData.vibration2 = analogRead(VIB_SENSOR_2);
  sensorData.vibration3 = analogRead(VIB_SENSOR_3);
  sensorData.vibration4 = analogRead(VIB_SENSOR_4);

  // Read voltage sensor
  int voltageRaw = analogRead(VOLTAGE_SENSOR);
  sensorData.batteryVoltage = voltageRaw * VOLTAGE_MULTIPLIER * 5.0;  // With voltage divider

  // Calculate piezo voltage and energy
  float avgVibration = (sensorData.vibration1 + sensorData.vibration2 + 
                        sensorData.vibration3 + sensorData.vibration4) / 4.0;
  sensorData.piezoVoltage = avgVibration * 0.00322;  // Convert to voltage
  sensorData.piezoEnergy = sensorData.piezoVoltage * sensorData.piezoVoltage / 1000.0;  // P = V²/R

  // Read ultrasonic distance
  sensorData.distance = readUltrasonicDistance();

  // Determine charging status
  float maxVibration = max(max(sensorData.vibration1, sensorData.vibration2),
                           max(sensorData.vibration3, sensorData.vibration4));
  sensorData.isCharging = (maxVibration > VIBRATION_CHARGING_THRESHOLD);

  // Update condition if charging
  if (sensorData.isCharging && currentDirection == 'S') {
    sensorData.condition = "CHARGING";
  }

  // Determine health status
  updateHealthStatus();
}

float readUltrasonicDistance() {
  digitalWrite(ULTRASONIC_TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(ULTRASONIC_TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(ULTRASONIC_TRIG, LOW);

  long duration = pulseIn(ULTRASONIC_ECHO, HIGH, 30000);  // 30ms timeout
  float distance = (duration * 0.0343) / 2.0;  // Speed of sound = 343 m/s

  if (distance < 2 || distance > 400) {
    return -1;  // Out of range
  }
  return distance;
}

void updateHealthStatus() {
  float totalVibration = sensorData.vibration1 + sensorData.vibration2 +
                         sensorData.vibration3 + sensorData.vibration4;

  if (totalVibration > 3000 || sensorData.batteryVoltage < 10.0) {
    sensorData.healthStatus = "CRITICAL";
  } else if (totalVibration > 2000 || sensorData.batteryVoltage < 11.0) {
    sensorData.healthStatus = "WARNING";
  } else {
    sensorData.healthStatus = "NORMAL";
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// LCD DISPLAY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

void updateLCD() {
  // Row 0: Status and direction
  lcd.setCursor(0, 0);
  lcd.print("STRIVE-EV  DIR:");
  lcd.print(currentDirection);
  lcd.print("   ");

  // Row 1: Vibration summary
  lcd.setCursor(0, 1);
  float avgVib = (sensorData.vibration1 + sensorData.vibration2 +
                  sensorData.vibration3 + sensorData.vibration4) / 4.0;
  lcd.print("VIB:");
  lcd.print((int)avgVib);
  lcd.print(" V:");
  lcd.print(sensorData.batteryVoltage, 1);
  lcd.print("V   ");

  // Row 2: Distance and piezo
  lcd.setCursor(0, 2);
  lcd.print("DST:");
  if (sensorData.distance > 0) {
    lcd.print((int)sensorData.distance);
    lcd.print("cm ");
  } else {
    lcd.print("--- ");
  }
  lcd.print("PE:");
  lcd.print(sensorData.piezoEnergy, 2);
  lcd.print("   ");

  // Row 3: Charging status
  lcd.setCursor(0, 3);
  if (sensorData.isCharging) {
    lcd.print(">>> CHARGING <<<    ");
  } else {
    lcd.print("Status: ");
    lcd.print(sensorData.condition);
    lcd.print("       ");
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVER COMMUNICATION
// ═══════════════════════════════════════════════════════════════════════════════

void sendDataToServer() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("✗ WiFi not connected, skipping server update");
    return;
  }

  HTTPClient http;
  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");

  // Build JSON payload
  StaticJsonDocument<512> doc;
  doc["vibration1"] = sensorData.vibration1;
  doc["vibration2"] = sensorData.vibration2;
  doc["vibration3"] = sensorData.vibration3;
  doc["vibration4"] = sensorData.vibration4;
  doc["piezo_voltage"] = sensorData.piezoVoltage;
  doc["piezo_energy"] = sensorData.piezoEnergy;
  doc["battery_voltage"] = sensorData.batteryVoltage;
  doc["distance"] = sensorData.distance;
  doc["health_status"] = sensorData.healthStatus;
  doc["condition"] = sensorData.condition;
  doc["is_charging"] = sensorData.isCharging;
  doc["motor_direction"] = String(currentDirection);

  String jsonPayload;
  serializeJson(doc, jsonPayload);

  // Send POST request
  int httpResponseCode = http.POST(jsonPayload);

  if (httpResponseCode > 0) {
    Serial.print("→ Server response: ");
    Serial.println(httpResponseCode);
  } else {
    Serial.print("✗ Server error: ");
    Serial.println(http.errorToString(httpResponseCode));
  }

  http.end();
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEBUG FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

void printSensorDebug() {
  Serial.println("\n--- SENSOR DATA ---");
  Serial.print("Vib1: "); Serial.print(sensorData.vibration1);
  Serial.print(" | Vib2: "); Serial.print(sensorData.vibration2);
  Serial.print(" | Vib3: "); Serial.print(sensorData.vibration3);
  Serial.print(" | Vib4: "); Serial.println(sensorData.vibration4);
  Serial.print("Piezo V: "); Serial.print(sensorData.piezoVoltage);
  Serial.print(" | Energy: "); Serial.println(sensorData.piezoEnergy);
  Serial.print("Battery: "); Serial.print(sensorData.batteryVoltage);
  Serial.print("V | Distance: "); Serial.print(sensorData.distance);
  Serial.println(" cm");
  Serial.print("Charging: "); Serial.print(sensorData.isCharging ? "YES" : "NO");
  Serial.print(" | Health: "); Serial.println(sensorData.healthStatus);
  Serial.println("-------------------\n");
}
