/*
 ╔══════════════════════════════════════════════════════════════════╗
 ║     STRIVE-EV · ESP32 Firmware  v3.1  (Minimal Flash)           ║
 ║     4-Channel Vibration Monitor  +  HC-05 BT Motor RC           ║
 ╠══════════════════════════════════════════════════════════════════╣
 ║  MOTOR DRIVER — L298N                                            ║
 ║    IN1 → GPIO26  IN2 → GPIO27  IN3 → GPIO14  IN4 → GPIO12       ║
 ║    ENA → GPIO25 (Left PWM)     ENB → GPIO33 (Right PWM)         ║
 ╠══════════════════════════════════════════════════════════════════╣
 ║  HC-05 / HC-06 BLUETOOTH MODULE  (replaces built-in BT stack)   ║
 ║    HC-05 TX  →  GPIO16 (Serial2 RX)                             ║
 ║    HC-05 RX  →  GPIO17 (Serial2 TX) via 1kΩ/2kΩ divider        ║
 ║    HC-05 VCC →  5V     HC-05 GND → GND                         ║
 ║    Rename module via AT: AT+NAME=STRIVE-EV  AT+BAUD=4 (9600)    ║
 ╠══════════════════════════════════════════════════════════════════╣
 ║  VIBRATION SENSORS (digital vibration modules)                   ║
 ║    VIB1 → GPIO34  (Motor mount)    VIB2 → GPIO35  (Wheel hub)   ║
 ║    VIB3 → GPIO32  (Suspension)     VIB4 → GPIO4   (Batt tray)   ║
 ║    VCC → 3.3V     GND → GND                                     ║
 ╠══════════════════════════════════════════════════════════════════╣
 ║  BT COMMANDS (any BT Serial app — e.g. Serial Bluetooth Terminal)║
 ║    F/f → Forward      B/b → Backward                            ║
 ║    L/l → Turn Left    R/r → Turn Right    S/s → Stop            ║
 ║    +   → Speed Up     -   → Speed Down                          ║
 ╚══════════════════════════════════════════════════════════════════╝
 NO extra libraries needed — Serial2 is built into ESP32 Arduino core.
 Flash usage: ~5% (vs 133% with BluetoothSerial)
*/

// No #include needed — Serial2 is a built-in HardwareSerial instance
#define SerialBT Serial2      // transparent alias: all BT I/O via HC-05

// ── Motor pins ─────────────────────────────────────────────────────
#define IN1  26
#define IN2  27
#define IN3  14
#define IN4  12
#define ENA  25    // Left  PWM
#define ENB  33    // Right PWM

#define PWM_FREQ  1000
#define PWM_RES   8        // 8-bit → 0-255

// ── Vibration sensor pins ──────────────────────────────────────────
#define VIB1  34   // Motor mount   (input-only pin)
#define VIB2  35   // Wheel hub     (input-only pin)
#define VIB3  32   // Suspension
#define VIB4   4   // Battery tray

// ── Config ────────────────────────────────────────────────────────
#define VIB_SAMPLES      20       // digital reads per sensor per cycle
#define REPORT_INTERVAL 500       // send vib data over BT every 500 ms

int           motorSpeed = 180;   // 0-255, default ~70 %
unsigned long lastReport = 0;

// ══════════════════════════════════════════════════════════════════
//  MOTOR HELPERS
// ══════════════════════════════════════════════════════════════════
void setMotors(bool l_fwd, bool l_bwd, bool r_fwd, bool r_bwd, int spd) {
  digitalWrite(IN1, l_fwd);  digitalWrite(IN2, l_bwd);
  digitalWrite(IN3, r_fwd);  digitalWrite(IN4, r_bwd);
  ledcWrite(ENA, spd);
  ledcWrite(ENB, spd);
}

void stopMotors()    { setMotors(0,0,0,0,0); }
void moveForward()   { setMotors(1,0,1,0,motorSpeed); }
void moveBackward()  { setMotors(0,1,0,1,motorSpeed); }
void turnLeft()      { setMotors(0,1,1,0,motorSpeed); } // pivot
void turnRight()     { setMotors(1,0,0,1,motorSpeed); } // pivot

// ══════════════════════════════════════════════════════════════════
//  BLUETOOTH COMMAND HANDLER
// ══════════════════════════════════════════════════════════════════
void handleBT(char cmd) {
  switch (cmd) {
    case 'F': case 'f':
      moveForward();
      SerialBT.println("FWD spd=" + String(motorSpeed));
      break;
    case 'B': case 'b':
      moveBackward();
      SerialBT.println("BWD spd=" + String(motorSpeed));
      break;
    case 'L': case 'l':
      turnLeft();
      SerialBT.println("LEFT spd=" + String(motorSpeed));
      break;
    case 'R': case 'r':
      turnRight();
      SerialBT.println("RIGHT spd=" + String(motorSpeed));
      break;
    case 'S': case 's':
      stopMotors();
      SerialBT.println("STOP");
      break;
    case '+':
      motorSpeed = min(255, motorSpeed + 20);
      SerialBT.println("SPD+ = " + String(motorSpeed));
      break;
    case '-':
      motorSpeed = max(50,  motorSpeed - 20);
      SerialBT.println("SPD- = " + String(motorSpeed));
      break;
    default: break;
  }
}

// ══════════════════════════════════════════════════════════════════
//  VIBRATION READING
//  Counts HIGH pulses over VIB_SAMPLES reads → scales to 0–8 g
// ══════════════════════════════════════════════════════════════════
float readVib(int pin) {
  int count = 0;
  for (int i = 0; i < VIB_SAMPLES; i++) {
    if (digitalRead(pin) == HIGH) count++;
    delayMicroseconds(500);          // 10 ms total window
  }
  return (count / (float)VIB_SAMPLES) * 8.0f;
}

// ══════════════════════════════════════════════════════════════════
//  SETUP
// ══════════════════════════════════════════════════════════════════
void setup() {
  Serial.begin(115200);
  Serial.println("STRIVE-EV v3.0  BT-RC + VIB");

  // Motor pins
  pinMode(IN1, OUTPUT); pinMode(IN2, OUTPUT);
  pinMode(IN3, OUTPUT); pinMode(IN4, OUTPUT);
  ledcAttach(ENA, PWM_FREQ, PWM_RES);
  ledcAttach(ENB, PWM_FREQ, PWM_RES);
  stopMotors();

  // Vibration pins (GPIO34/35 are hardware input-only; no pinMode needed)
  pinMode(VIB3, INPUT);
  pinMode(VIB4, INPUT);

  // HC-05 on Serial2 (GPIO16=RX, GPIO17=TX), 9600 baud (HC-05 default)
  SerialBT.begin(9600, SERIAL_8N1, 16, 17);
  Serial.println("HC-05 BT ready  ->  pair as: STRIVE-EV");
  Serial.println("Cmds: F B L R S  |  + -  |  VIB report every 500ms");
}

// ══════════════════════════════════════════════════════════════════
//  LOOP
// ══════════════════════════════════════════════════════════════════
void loop() {

  // 1. Handle incoming BT commands instantly
  while (SerialBT.available()) {
    handleBT((char)SerialBT.read());
  }

  // 2. Periodic vibration report via BT
  unsigned long now = millis();
  if (now - lastReport < REPORT_INTERVAL) return;
  lastReport = now;

  float v1 = readVib(VIB1);   // Motor mount
  float v2 = readVib(VIB2);   // Wheel hub
  float v3 = readVib(VIB3);   // Suspension
  float v4 = readVib(VIB4);   // Battery tray

  // Health flag: any sensor above 6 g = WARNING
  const char* flag = (v1>6||v2>6||v3>6||v4>6) ? "WARN" : "OK";

  // Print to USB serial (for debugging)
  Serial.printf("V1=%.2fg V2=%.2fg V3=%.2fg V4=%.2fg [%s]\n",
                v1, v2, v3, v4, flag);

  // Send compact CSV line to phone via BT
  // Format: "VIB:v1,v2,v3,v4,FLAG\n"
  SerialBT.printf("VIB:%.2f,%.2f,%.2f,%.2f,%s\n",
                  v1, v2, v3, v4, flag);
}
