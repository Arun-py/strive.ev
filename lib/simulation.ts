/**
 * STRIVE-EV Simulation Data Generator
 * Based on research from:
 * - Wang et al. Quarter-Car Suspension Harvesting (2.84W theoretical, 0.33V experimental)
 * - Al-Yafeai et al. Half-Car Model (+77% voltage, +57% power)
 * - Hendrowati et al. Multilayer PZT Stack (7.2x improvement)
 * - Omidi (2023) Vibration-based SHM using ML
 * - wevj-17-00092 Magnetic PVDF Harvesting
 * - PT Lab Report: PZT d33=580pC/N, Force 100-1000N, Freq 5-500Hz, Output 0.5-20V
 */

export type VehicleCondition = 'NORMAL' | 'MOTOR_IMBALANCE' | 'SUSPENSION_FAULT' | 'CHASSIS_CRACK' | 'BATTERY_LOOSE' | 'AIRBAG_ERROR' | 'POOR_MOTOR' | 'SUSPENSION_SUBOPTIMAL'

export interface SimulationData {
  timestamp: string
  time: number  // seconds elapsed

  // Vibration sensors (m/s² RMS) - typical EV chassis ranges from report
  vibration1: number  // Motor mount (dominant freq 20-80 Hz)
  vibration2: number  // Chassis center 
  vibration3: number  // Suspension point
  vibration4: number  // Battery mount

  // Frequency analysis (Hz)
  motor_freq: number      // Motor fundamental frequency
  suspension_freq: number // Suspension natural freq ~5-15 Hz
  chassis_freq: number    // Chassis natural freq ~30-80 Hz

  // Piezoelectric output (from PZT d33=580 pC/N, Force 100-1000N)
  piezo_voltage: number      // V, range 0.5-20V
  piezo_charge: number       // nC, Q = d * F
  energy_harvested: number   // mJ, per cycle
  power_output: number       // mW

  // Vehicle / Structural
  speed: number              // km/h
  temperature: number        // °C ambient
  battery_voltage: number    // V (11.1-12.6V for 3S LiPo rover)
  chassis_stress: number     // MPa (estimated)
  structural_integrity: number  // 0-100%

  // Environmental
  humidity: number           // %
  distance: number           // cm (obstacle sensor)

  // Health indicators
  health_status: 'NORMAL' | 'WARNING' | 'CRITICAL'
  condition: VehicleCondition
  fault_flags: { [key: string]: boolean }

  // User-friendly interpreted values
  motor_health: string
  suspension_health: string
  chassis_health: string
  battery_health: string
  energy_status: string
}

// ─── Physics constants from PT Lab Report ───────────────────────────────────
const PZT_D33 = 580e-12       // C/N  (580 pC/N for PZT ceramic)
const PIEZO_CAPACITANCE = 100e-9  // F  (typical PZT disc)
const LOAD_RESISTANCE = 100e3     // Ω  (optimal load for max power)
const MAX_FORCE = 1000            // N  (max vehicle suspension force)
const MIN_FORCE = 100             // N  (minimum)

// From Wang et al.: suspension produces ~2.84W theoretical
// Half-car model: +57% power improvement
// Multilayer stack: 7.2x improvement factor

// ─── Natural frequency model f = (1/2π) * √(k/m) ────────────────────────────
function naturalFreq(k: number, m: number): number {
  return (1 / (2 * Math.PI)) * Math.sqrt(k / m)
}

// Vehicle structural parameters
const chassisParams = {
  k_normal:     2.5e6,   // N/m stiffness (healthy chassis)
  k_cracked:    1.8e6,   // N/m (cracked, ~28% reduction)
  m_chassis:    280,     // kg (EV chassis mass)
  k_suspension: 18000,   // N/m (suspension spring)
  m_wheel:      35,      // kg (wheel + axle mass)
}

// f_chassis_normal = (1/2π)*√(2.5e6/280) ≈ 15 Hz
// f_suspension_normal = (1/2π)*√(18000/35) ≈ 3.6 Hz (scaled to vehicle)

// ─── Noise generation ────────────────────────────────────────────────────────
function gaussianNoise(mean: number, stdDev: number): number {
  const u1 = Math.random()
  const u2 = Math.random()
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
  return mean + z * stdDev
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val))
}

// ─── Condition profiles ───────────────────────────────────────────────────────
const conditionProfiles: Record<VehicleCondition, {
  vib1_base: number; vib2_base: number; vib3_base: number; vib4_base: number;
  motor_freq_base: number; motor_freq_spread: number;
  suspension_stiffness: number;
  chassis_stiffness: number;
  speed_range: [number, number];
  force_multiplier: number;
  health: 'NORMAL' | 'WARNING' | 'CRITICAL';
  note: string;
}> = {
  NORMAL: {
    vib1_base: 1.2, vib2_base: 0.8, vib3_base: 1.5, vib4_base: 0.6,
    motor_freq_base: 45, motor_freq_spread: 2,
    suspension_stiffness: 18000, chassis_stiffness: 2.5e6,
    speed_range: [30, 80], force_multiplier: 1.0,
    health: 'NORMAL', note: 'Nominal operation'
  },
  POOR_MOTOR: {
    // Motor degraded: higher vibration at motor mount, shifted frequency
    // Ref: Omidi (2023) modal analysis detects stiffness change
    vib1_base: 3.8, vib2_base: 1.6, vib3_base: 1.4, vib4_base: 1.1,
    motor_freq_base: 38, motor_freq_spread: 8,  // wider spread = harmonic distortion
    suspension_stiffness: 18000, chassis_stiffness: 2.5e6,
    speed_range: [20, 60], force_multiplier: 1.8,
    health: 'WARNING', note: 'Motor degradation: bearing wear, increased harmonics'
  },
  MOTOR_IMBALANCE: {
    // Motor imbalance: dramatic vibration at 1x and 2x running speed
    // Ref: typical EV motor imbalance at 30-60 Hz
    vib1_base: 6.5, vib2_base: 2.8, vib3_base: 1.8, vib4_base: 1.4,
    motor_freq_base: 52, motor_freq_spread: 15,
    suspension_stiffness: 18000, chassis_stiffness: 2.5e6,
    speed_range: [10, 70], force_multiplier: 2.5,
    health: 'CRITICAL', note: 'Motor imbalance: rotor eccentricity detected'
  },
  SUSPENSION_SUBOPTIMAL: {
    // Suspension not optimal: increased low-freq content, poor damping
    // Ref: Al-Yafeai half-car model shows suspension parameter sensitivity
    vib1_base: 1.4, vib2_base: 1.5, vib3_base: 4.2, vib4_base: 1.2,
    motor_freq_base: 45, motor_freq_spread: 3,
    suspension_stiffness: 14000,   // 22% reduction from nominal
    chassis_stiffness: 2.5e6,
    speed_range: [20, 70], force_multiplier: 1.4,
    health: 'WARNING', note: 'Suspension suboptimal: reduced damping coefficient'
  },
  SUSPENSION_FAULT: {
    // Full suspension failure: very high low-freq vibration
    // Ref: Natural freq shift: f = (1/2π)√(14000/35) vs (1/2π)√(18000/35)
    vib1_base: 2.1, vib2_base: 2.4, vib3_base: 8.6, vib4_base: 2.2,
    motor_freq_base: 45, motor_freq_spread: 4,
    suspension_stiffness: 8000,    // 55% reduction - severe damage
    chassis_stiffness: 2.5e6,
    speed_range: [10, 50], force_multiplier: 2.2,
    health: 'CRITICAL', note: 'Suspension failure: spring stiffness -55%'
  },
  CHASSIS_CRACK: {
    // Chassis crack: natural frequency drops (stiffness reduction)
    // Ref: Omidi (2023) - frequency shift analysis for damage detection
    // f_cracked = (1/2π)√(1.8e6/280) ≈ 12.7 Hz vs 15 Hz normal
    vib1_base: 1.6, vib2_base: 3.5, vib3_base: 2.1, vib4_base: 1.8,
    motor_freq_base: 45, motor_freq_spread: 3,
    suspension_stiffness: 18000, chassis_stiffness: 1.8e6,   // -28% stiffness
    speed_range: [15, 60], force_multiplier: 1.6,
    health: 'CRITICAL', note: 'Chassis crack: structural stiffness -28%'
  },
  BATTERY_LOOSE: {
    // Battery mount looseness: high vibration at battery mount, resonance effects
    vib1_base: 1.3, vib2_base: 1.1, vib3_base: 1.4, vib4_base: 5.8,
    motor_freq_base: 45, motor_freq_spread: 3,
    suspension_stiffness: 18000, chassis_stiffness: 2.5e6,
    speed_range: [20, 75], force_multiplier: 1.3,
    health: 'WARNING', note: 'Battery mount loose: fastener torque insufficient'
  },
  AIRBAG_ERROR: {
    // Airbag deployment error / crash detection: spike event
    // Simulates sudden impulse detected across all sensors
    vib1_base: 12.0, vib2_base: 9.5, vib3_base: 10.2, vib4_base: 8.8,
    motor_freq_base: 45, motor_freq_spread: 20,
    suspension_stiffness: 18000, chassis_stiffness: 2.5e6,
    speed_range: [0, 50], force_multiplier: 5.0,
    health: 'CRITICAL', note: 'Airbag deployment error / impact event detected'
  }
}

// ─── Main data generator ─────────────────────────────────────────────────────
let simulationTime = 0
let currentCondition: VehicleCondition = 'NORMAL'

export function setSimulationCondition(condition: VehicleCondition) {
  currentCondition = condition
}

export function generateSimulationData(
  condition: VehicleCondition = currentCondition,
  timeStep: number = 0.1
): SimulationData {
  simulationTime += timeStep
  const t = simulationTime
  const profile = conditionProfiles[condition]

  // Speed
  const [sMin, sMax] = profile.speed_range
  const speed = gaussianNoise((sMin + sMax) / 2, (sMax - sMin) / 6)
  const speedClamped = clamp(speed, sMin, sMax)

  // Vibration amplitudes (m/s² RMS)
  // Include sinusoidal component at motor/suspension frequencies + noise
  const sinMotor = Math.sin(2 * Math.PI * profile.motor_freq_base * t)
  const sinSusp = Math.sin(2 * Math.PI * 8 * t + 0.5)  // ~8 Hz suspension

  const vib1 = clamp(
    profile.vib1_base * Math.abs(sinMotor) + gaussianNoise(0, profile.vib1_base * 0.15) +
    0.3 * speed / 60,
    0.1, 20
  )
  const vib2 = clamp(
    profile.vib2_base * (0.7 + 0.3 * Math.abs(sinMotor)) + gaussianNoise(0, profile.vib2_base * 0.2),
    0.1, 20
  )
  const vib3 = clamp(
    profile.vib3_base * Math.abs(sinSusp) + gaussianNoise(0, profile.vib3_base * 0.2) +
    0.5 * speed / 60,
    0.1, 20
  )
  const vib4 = clamp(
    profile.vib4_base * (0.8 + 0.2 * Math.abs(sinMotor + sinSusp)) + gaussianNoise(0, profile.vib4_base * 0.15),
    0.1, 20
  )

  // Modal analysis: Natural frequencies (f = 1/(2π) * √(k/m))
  const motorFreq = clamp(
    gaussianNoise(profile.motor_freq_base, profile.motor_freq_spread),
    5, 200
  )
  const suspFreq = clamp(
    naturalFreq(profile.suspension_stiffness, chassisParams.m_wheel) + gaussianNoise(0, 0.5),
    1, 30
  )
  const chassisFreq = clamp(
    naturalFreq(profile.chassis_stiffness, chassisParams.m_chassis) + gaussianNoise(0, 0.3),
    8, 40
  )

  // Piezoelectric calculations (PT Lab Report equations)
  // Force = mass * vib_amplitude * 2π * freq (simplified)
  const avgVib = (vib1 + vib2 + vib3 + vib4) / 4
  const force = clamp(
    gaussianNoise(avgVib * 80 * profile.force_multiplier, 20),
    MIN_FORCE, MAX_FORCE
  )

  // Q = d33 * F  (charge in Coulombs)
  const charge_C = PZT_D33 * force
  const charge_nC = charge_C * 1e9  // nC

  // V = Q / C  (open-circuit voltage)
  const piezo_voltage = clamp(charge_C / PIEZO_CAPACITANCE, 0.5, 20)

  // Power = V² / (2 * R)  (matched load)
  const power_mW = clamp((piezo_voltage ** 2 / (2 * LOAD_RESISTANCE)) * 1000, 0.01, 50)

  // Energy per cycle E = 0.5 * C * V²
  const energy_mJ = clamp(0.5 * PIEZO_CAPACITANCE * piezo_voltage ** 2 * 1000, 0.001, 10)

  // Chassis stress estimation (MPa) σ = E * ε, for typical HSLA steel
  // Vibrational stress ≈ 0.1 * Young's Modulus * strain
  const chassisStress = clamp(
    avgVib * 8.5 + gaussianNoise(12, 3),
    5, 120
  )

  // Structural integrity (based on frequency deviation from nominal)
  const f_nominal_chassis = naturalFreq(chassisParams.k_normal, chassisParams.m_chassis)
  const freqDrop = Math.max(0, (f_nominal_chassis - chassisFreq) / f_nominal_chassis)
  const integrityBase = 100 - freqDrop * 200 - (condition === 'CHASSIS_CRACK' ? 25 : 0)
  const structural_integrity = clamp(integrityBase + gaussianNoise(0, 2), 0, 100)

  // Battery voltage (3S LiPo: 9.6-12.6V, nominal 11.1V)
  const batteryVoltage = clamp(
    gaussianNoise(11.3, 0.3) - (condition === 'BATTERY_LOOSE' ? 0.6 : 0),
    9.0, 12.6
  )

  // Temperature
  const baseTemp = 28 + (speed / 10) + (condition === 'MOTOR_IMBALANCE' ? 8 : 0)
  const temperature = clamp(gaussianNoise(baseTemp, 2), 20, 65)

  // Humidity
  const humidity = clamp(gaussianNoise(60, 8), 40, 95)

  // Obstacle distance
  const distance = clamp(gaussianNoise(50, 20), 5, 200)

  // Health assessment logic
  let health_status: 'NORMAL' | 'WARNING' | 'CRITICAL' = profile.health
  
  // Override based on sensor thresholds
  if (avgVib > 8 || chassisStress > 80 || structural_integrity < 50) {
    health_status = 'CRITICAL'
  } else if (avgVib > 3.5 || chassisStress > 40 || structural_integrity < 75) {
    health_status = 'WARNING'
  }

  // Human-readable labels
  const motorVibs = vib1
  const motorHealthLabel = (() => {
    if (condition === 'POOR_MOTOR') return '⚠ DEGRADED – Bearing Wear Detected'
    if (condition === 'MOTOR_IMBALANCE') return '🔴 IMBALANCED – Rotor Eccentricity'
    if (motorVibs > 5) return '🔴 CRITICAL – Replace Immediately'
    if (motorVibs > 2.5) return '⚠ ELEVATED – Monitor Closely'
    return '✅ HEALTHY – Within Spec'
  })()

  const suspVibs = vib3
  const suspensionHealthLabel = (() => {
    if (condition === 'SUSPENSION_FAULT') return '🔴 FAILED – Immediate Service'
    if (condition === 'SUSPENSION_SUBOPTIMAL') return '⚠ SUBOPTIMAL – Damping Reduced'
    if (suspVibs > 7) return '🔴 CRITICAL – Suspension Failure'
    if (suspVibs > 3) return '⚠ WARNING – Degraded Response'
    return '✅ OPTIMAL – Normal Damping'
  })()

  const chassisHealthLabel = (() => {
    if (condition === 'CHASSIS_CRACK') return `🔴 CRACK DETECTED – f=${chassisFreq.toFixed(1)}Hz (nominal ${f_nominal_chassis.toFixed(1)}Hz)`
    if (structural_integrity < 60) return '🔴 COMPROMISED – Structural Damage'
    if (structural_integrity < 80) return '⚠ MONITOR – Minor Anomaly'
    return '✅ INTACT – No Damage Detected'
  })()

  const batteryHealthLabel = (() => {
    if (condition === 'BATTERY_LOOSE') return '⚠ LOOSE MOUNT – Connection Unstable'
    if (batteryVoltage < 10.0) return '🔴 LOW VOLTAGE – Charge Immediately'
    if (batteryVoltage < 10.8) return '⚠ LOW – Below Optimal Range'
    return '✅ NOMINAL – ' + batteryVoltage.toFixed(1) + 'V'
  })()

  const energyStatusLabel = (() => {
    if (energy_mJ > 5) return `⚡ HIGH HARVEST – ${energy_mJ.toFixed(2)} mJ/cycle`
    if (energy_mJ > 1) return `✅ ACTIVE – ${energy_mJ.toFixed(2)} mJ/cycle`
    return `📉 LOW – ${energy_mJ.toFixed(3)} mJ/cycle`
  })()

  return {
    timestamp: new Date().toISOString(),
    time: simulationTime,
    vibration1: parseFloat(vib1.toFixed(3)),
    vibration2: parseFloat(vib2.toFixed(3)),
    vibration3: parseFloat(vib3.toFixed(3)),
    vibration4: parseFloat(vib4.toFixed(3)),
    motor_freq: parseFloat(motorFreq.toFixed(2)),
    suspension_freq: parseFloat(suspFreq.toFixed(2)),
    chassis_freq: parseFloat(chassisFreq.toFixed(2)),
    piezo_voltage: parseFloat(piezo_voltage.toFixed(3)),
    piezo_charge: parseFloat(charge_nC.toFixed(4)),
    energy_harvested: parseFloat(energy_mJ.toFixed(4)),
    power_output: parseFloat(power_mW.toFixed(4)),
    speed: parseFloat(speedClamped.toFixed(1)),
    temperature: parseFloat(temperature.toFixed(1)),
    battery_voltage: parseFloat(batteryVoltage.toFixed(2)),
    chassis_stress: parseFloat(chassisStress.toFixed(2)),
    structural_integrity: parseFloat(structural_integrity.toFixed(1)),
    humidity: parseFloat(humidity.toFixed(1)),
    distance: parseFloat(distance.toFixed(1)),
    health_status,
    condition,
    fault_flags: {
      motor_imbalance: condition === 'MOTOR_IMBALANCE' || condition === 'POOR_MOTOR',
      suspension_fault: condition === 'SUSPENSION_FAULT' || condition === 'SUSPENSION_SUBOPTIMAL',
      chassis_crack: condition === 'CHASSIS_CRACK',
      battery_loose: condition === 'BATTERY_LOOSE',
      airbag_error: condition === 'AIRBAG_ERROR',
      overheat: temperature > 55,
      low_battery: batteryVoltage < 10.5,
    },
    motor_health: motorHealthLabel,
    suspension_health: suspensionHealthLabel,
    chassis_health: chassisHealthLabel,
    battery_health: batteryHealthLabel,
    energy_status: energyStatusLabel,
  }
}

// Generate frequency spectrum data for FFT visualization
export function generateFrequencySpectrum(condition: VehicleCondition, numPoints: number = 64): number[] {
  const profile = conditionProfiles[condition]
  const spectrum: number[] = []

  for (let i = 0; i < numPoints; i++) {
    const freq = (i / numPoints) * 200  // 0-200 Hz range
    let amplitude = 0

    // Motor fundamental frequency peak
    const motorPeak = Math.exp(-((freq - profile.motor_freq_base) ** 2) / (2 * (profile.motor_freq_spread ** 2))) * 10
    amplitude += motorPeak

    // Motor harmonics
    amplitude += Math.exp(-((freq - profile.motor_freq_base * 2) ** 2) / 50) * 4
    amplitude += Math.exp(-((freq - profile.motor_freq_base * 3) ** 2) / 80) * 2

    // Suspension freq peak (~3-12 Hz)
    const suspNatFreq = naturalFreq(profile.suspension_stiffness, chassisParams.m_wheel)
    amplitude += Math.exp(-((freq - suspNatFreq) ** 2) / 8) * 6

    // Chassis structural frequency
    const chassisNatFreq = naturalFreq(profile.chassis_stiffness, chassisParams.m_chassis)
    amplitude += Math.exp(-((freq - chassisNatFreq) ** 2) / 5) * 8

    // Background noise floor
    amplitude += gaussianNoise(0.3, 0.1)

    // Condition-specific extra peaks
    if (condition === 'CHASSIS_CRACK') {
      // Additional peak at crack resonance (sub-harmonic of chassis freq)
      amplitude += Math.exp(-((freq - chassisNatFreq * 0.7) ** 2) / 3) * 5
    }
    if (condition === 'AIRBAG_ERROR') {
      amplitude += Math.random() * 15  // broadband energy from impact
    }

    spectrum.push(Math.max(0, parseFloat(amplitude.toFixed(3))))
  }

  return spectrum
}

// Human-readable condition explanations
export const conditionDescriptions: Record<VehicleCondition, {
  title: string
  description: string
  indicators: string[]
  recommendation: string
  severity: 'info' | 'warning' | 'critical'
}> = {
  NORMAL: {
    title: 'Normal Operation',
    description: 'All systems operating within nominal parameters. Vibration levels and structural frequencies are within expected ranges.',
    indicators: ['Motor vibration: 0.8–2.0 m/s²', 'Suspension freq: 3.5–4.0 Hz', 'Chassis integrity: >90%'],
    recommendation: 'Continue normal operation. Schedule next inspection per maintenance calendar.',
    severity: 'info'
  },
  POOR_MOTOR: {
    title: 'Motor Health Poor',
    description: 'Motor shows signs of bearing wear or degradation. Fundamental frequency shifted lower with increased harmonic content, indicating rotor dynamics change.',
    indicators: ['Motor vibration elevated: 3–4.5 m/s²', 'Frequency spread ±8 Hz', 'Harmonic distortion present'],
    recommendation: 'Reduce operating speed. Schedule motor inspection within 500 km. Check bearing lubrication.',
    severity: 'warning'
  },
  MOTOR_IMBALANCE: {
    title: 'Motor Rotor Imbalance',
    description: 'Severe motor imbalance detected. High 1× and 2× running speed vibrations indicate rotor eccentricity exceeding ISO 10816 threshold of 4.5 mm/s RMS.',
    indicators: ['Motor vibration: 5–8 m/s² CRITICAL', 'Strong 1x and 2x harmonic peaks', 'ISO 10816 Zone D exceeded'],
    recommendation: 'STOP VEHICLE OPERATION. Motor rebalancing required immediately. Risk of bearing failure within hours.',
    severity: 'critical'
  },
  SUSPENSION_SUBOPTIMAL: {
    title: 'Suspension Suboptimal',
    description: 'Suspension damping coefficient reduced. Natural frequency shifted from 3.6 Hz to ~3.1 Hz, indicating spring stiffness reduction of ~22%.',
    indicators: ['Suspension vib: 3–5 m/s²', 'Susp. natural freq: ~3.1 Hz (normal: 3.6 Hz)', 'Ride comfort degraded'],
    recommendation: 'Inspect suspension springs and shock absorbers. Check for oil leaks. Service within 1 week.',
    severity: 'warning'
  },
  SUSPENSION_FAULT: {
    title: 'Suspension Failure',
    description: 'Critical suspension failure. Spring stiffness reduced by 55%, causing natural frequency drop to ~2.3 Hz. Risk of complete loss of wheel contact.',
    indicators: ['Suspension vib: 7–10 m/s² CRITICAL', 'Susp. natural freq: ~2.3 Hz (normal: 3.6 Hz)', 'Stiffness -55%'],
    recommendation: 'IMMEDIATE STOP REQUIRED. Do not operate vehicle. Suspension assembly replacement needed.',
    severity: 'critical'
  },
  CHASSIS_CRACK: {
    title: 'Chassis Crack Detected',
    description: 'Structural crack detected via frequency shift analysis. Chassis natural frequency dropped from 15 Hz to ~12.7 Hz, corresponding to 28% stiffness loss per Omidi (2023) model.',
    indicators: [
      'Chassis freq: ~12.7 Hz (normal: ~15 Hz)',
      'Stiffness reduction: -28%',
      'Structural integrity: <65%',
      'Crack sub-harmonic peak visible in FFT'
    ],
    recommendation: 'CRITICAL: Stop vehicle. Full structural inspection required. Weld repair or chassis replacement.',
    severity: 'critical'
  },
  BATTERY_LOOSE: {
    title: 'Battery Mount Loose',
    description: 'Battery mounting fasteners show looseness. Resonant vibration at battery mount exceeds 4× other locations, indicating loss of proper torque (recommended 25 Nm).',
    indicators: ['Battery mount vib: 4–7 m/s²', 'Battery voltage drops: ±0.6V', 'Connector intermittency risk'],
    recommendation: 'Inspect and re-torque battery mount fasteners to 25 Nm. Check connector integrity.',
    severity: 'warning'
  },
  AIRBAG_ERROR: {
    title: 'Impact / Airbag Deployment Error',
    description: 'Broadband impact event detected across all sensors simultaneously. Pattern consistent with frontal or side collision event. Airbag deployment circuit error detected.',
    indicators: ['All channels: >8 m/s² simultaneously', 'Broadband frequency content 0–200 Hz', 'Impulse duration < 50 ms'],
    recommendation: 'EMERGENCY STOP. Safety inspection required. Check airbag controller, occupant safety systems.',
    severity: 'critical'
  }
}

// Export condition list for UI
export const vehicleConditions: { value: VehicleCondition; label: string; color: string }[] = [
  { value: 'NORMAL', label: 'Normal Operation', color: '#00FFA6' },
  { value: 'POOR_MOTOR', label: 'Poor Motor Health', color: '#FFD600' },
  { value: 'MOTOR_IMBALANCE', label: 'Motor Imbalance', color: '#FF3B3B' },
  { value: 'SUSPENSION_SUBOPTIMAL', label: 'Suspension Suboptimal', color: '#FFD600' },
  { value: 'SUSPENSION_FAULT', label: 'Suspension Fault', color: '#FF3B3B' },
  { value: 'CHASSIS_CRACK', label: 'Chassis Crack', color: '#FF3B3B' },
  { value: 'BATTERY_LOOSE', label: 'Battery Mount Loose', color: '#FFD600' },
  { value: 'AIRBAG_ERROR', label: 'Airbag / Impact Event', color: '#FF3B3B' },
]

// ─── IEPE Standard Gain Stages ───────────────────────────────────────────────
// Per IEC 61672 / ISO 5348 IEPE (Integrated Electronics PiezoElectric) standard
// Charge amplifier feedback capacitor sets gain: V_out = Q / C_f

export interface IEPEGainSpec {
  gain: number                  // multiplier: 1, 10, 100
  label: string                 // display label
  sensitivity_mV_g: number      // mV per g  (g = 9.81 m/s²)
  sensitivity_mV_ms2: number    // mV per m/s²
  range_g: number               // ±g full-scale range
  range_ms2: number             // ±m/s² full-scale range
  noise_floor_ug_rthz: number   // µg/√Hz noise spectral density
  resolution_mg: number         // mg (milli-g) minimum detectable
  freq_lo_hz: number            // lower -3 dB cut-off Hz
  freq_hi_khz: number           // upper -3 dB cut-off kHz
  supply_current_mA: number     // constant current excitation mA
  bias_voltage_V: number        // DC bias voltage at output V
  output_impedance_ohm: number  // output impedance Ω
  dynamic_range_dB: number      // dynamic range dB
  cf_pF: number                 // feedback capacitor pF (charge amp)
  rf_GOhm: number               // feedback resistor GΩ  (charge amp)
  typical_use: string           // application note
}

export const IEPE_GAIN_STAGES: IEPEGainSpec[] = [
  {
    gain: 1,
    label: '×1  (High-Range / Shock)',
    sensitivity_mV_g:    1.0,
    sensitivity_mV_ms2:  0.102,
    range_g:             500,
    range_ms2:           4905,
    noise_floor_ug_rthz: 150,
    resolution_mg:       0.50,
    freq_lo_hz:          1.0,
    freq_hi_khz:         10.0,
    supply_current_mA:   4.0,
    bias_voltage_V:      12.0,
    output_impedance_ohm: 100,
    dynamic_range_dB:    80,
    cf_pF:               100,
    rf_GOhm:             10,
    typical_use: 'High-shock, drop/crash events, turbine blades',
  },
  {
    gain: 10,
    label: '×10  (Mid-Range / General)',
    sensitivity_mV_g:    10.0,
    sensitivity_mV_ms2:  1.019,
    range_g:             50,
    range_ms2:           490.5,
    noise_floor_ug_rthz: 15,
    resolution_mg:       0.05,
    freq_lo_hz:          0.5,
    freq_hi_khz:         8.0,
    supply_current_mA:   4.0,
    bias_voltage_V:      12.0,
    output_impedance_ohm: 100,
    dynamic_range_dB:    80,
    cf_pF:               10,
    rf_GOhm:             10,
    typical_use: 'General vehicle NVH, motor mounts, chassis (EV primary range)',
  },
  {
    gain: 100,
    label: '×100  (High-Sensitivity / Low-Level)',
    sensitivity_mV_g:    100.0,
    sensitivity_mV_ms2:  10.19,
    range_g:             5,
    range_ms2:           49.05,
    noise_floor_ug_rthz: 1.5,
    resolution_mg:       0.005,
    freq_lo_hz:          0.1,
    freq_hi_khz:         5.0,
    supply_current_mA:   4.0,
    bias_voltage_V:      12.0,
    output_impedance_ohm: 100,
    dynamic_range_dB:    80,
    cf_pF:               1,
    rf_GOhm:             10,
    typical_use: 'Low-level structural, tyre noise, battery pack micro-vibration',
  },
]

/** Compute live IEPE output quantities for a single acceleration reading */
export interface IEPELiveReading {
  spec: IEPEGainSpec
  accel_ms2: number           // input acceleration m/s²
  accel_g: number             // in g
  output_mV: number           // output voltage mV
  output_V: number            // output voltage V (= bias ± signal)
  saturation_pct: number      // % of full-scale range used
  in_range: boolean           // true if within ±range
  snr_dB: number              // estimated SNR dB at this reading
  charge_pC: number           // charge at sensor output pC (Q = m·d33·a)
}

export function computeIEPEReadings(
  accel_ms2: number,
  pzt_d33_pCperN: number = 580,
  sensor_mass_g: number = 15,   // typical IEPE accelerometer seismic mass
): IEPELiveReading[] {
  const a = Math.abs(accel_ms2)
  const a_g = a / 9.81
  const charge_pC = pzt_d33_pCperN * (sensor_mass_g / 1000) * a   // Q = d33 × F = d33 × m × a

  return IEPE_GAIN_STAGES.map(spec => {
    const output_mV = spec.sensitivity_mV_ms2 * accel_ms2   // signed
    const saturation_pct = Math.min(100, (a / spec.range_ms2) * 100)
    const in_range = a <= spec.range_ms2
    // SNR = 20·log10(signal / noise)
    // noise_floor in µg/√Hz, assume 1 kHz BW → RMS noise ≈ noise_floor × √BW
    const bw = spec.freq_hi_khz * 1000
    const noise_rms_g = (spec.noise_floor_ug_rthz * 1e-6) * Math.sqrt(bw)
    const snr_dB = a_g > 0 ? 20 * Math.log10(a_g / noise_rms_g) : 0

    return {
      spec,
      accel_ms2,
      accel_g: parseFloat((accel_ms2 / 9.81).toFixed(4)),
      output_mV: parseFloat(output_mV.toFixed(3)),
      output_V: parseFloat((spec.bias_voltage_V + output_mV / 1000).toFixed(4)),
      saturation_pct: parseFloat(saturation_pct.toFixed(1)),
      in_range,
      snr_dB: parseFloat(Math.max(0, snr_dB).toFixed(1)),
      charge_pC: parseFloat(charge_pC.toFixed(3)),
    }
  })
}
