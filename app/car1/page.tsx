'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { generateSimulationData, SimulationData } from '@/lib/simulation';
import * as Charts from '@/components/Charts';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ESP32Data {
  time: string;
  vibration1: number;
  vibration2: number;
  vibration3: number;
  vibration4: number;
  temperature: number;
  humidity: number;
  distance: number;
  battery_voltage: number;
  piezo_energy: number;
}

type HealthStatus = 'NOMINAL' | 'WARNING' | 'CRITICAL';
type FaultMode = 'NONE' | 'MOTOR_IMBALANCE' | 'SUSPENSION_FAULT' | 'CHASSIS_CRACK' | 'BATTERY_LOOSE';
type TabId = 'live' | 'vibration' | 'energy' | 'health';

interface Alert {
  id: number;
  time: string;
  message: string;
  severity: 'INFO' | 'WARN' | 'CRIT';
}

// ─── Helper: derive health ────────────────────────────────────────────────────
function deriveHealth(d: ESP32Data, fault: FaultMode): HealthStatus {
  const maxVib = Math.max(d.vibration1, d.vibration2, d.vibration3, d.vibration4);
  if (fault === 'CHASSIS_CRACK' || d.battery_voltage < 10.5 || maxVib > 6) return 'CRITICAL';
  if (fault !== 'NONE' || maxVib > 3.5 || d.temperature > 38 || d.battery_voltage < 11.5) return 'WARNING';
  return 'NOMINAL';
}

// ─── Helper: inject fault into ESP32-format data ──────────────────────────────
function injectFault(d: ESP32Data, fault: FaultMode): ESP32Data {
  const out = { ...d };
  if (fault === 'MOTOR_IMBALANCE') {
    out.vibration1 *= 2.4 + Math.random() * 0.6;
    out.vibration2 *= 1.8 + Math.random() * 0.4;
    out.temperature += 5 + Math.random() * 3;
  } else if (fault === 'SUSPENSION_FAULT') {
    out.vibration3 *= 2.7 + Math.random() * 0.8;
    out.vibration4 *= 2.1 + Math.random() * 0.5;
    out.piezo_energy *= 1.6;
  } else if (fault === 'CHASSIS_CRACK') {
    out.vibration1 *= 1.4;
    out.vibration2 *= 1.4;
    out.vibration3 *= 1.4;
    out.vibration4 *= 1.4;
    out.battery_voltage -= 0.4 + Math.random() * 0.2;
    out.piezo_energy *= 0.85;
  } else if (fault === 'BATTERY_LOOSE') {
    out.battery_voltage -= 1.2 + Math.random() * 0.4;
    out.vibration4 *= 1.9 + Math.random() * 0.3;
  }
  // clamp
  out.battery_voltage = Math.max(9.0, Math.min(14.0, out.battery_voltage));
  out.temperature = Math.max(20, Math.min(85, out.temperature));
  return out;
}

// ─── Simulate ESP32-style data from physics model ────────────────────────────
// Battery state lives outside this function so it persists across calls.
// Piezo formula: E = K * sqrt(v1² + v2² + v3² + v4²)  K=0.18  [mJ]
//   Based on: V = d33 * F / Cp, P = V² / 2R, d33=580 pC/N, Cp=45 nF, R=220 kΩ
function simToESP32(s: SimulationData, battOverride?: number): ESP32Data {
  const v1 = s.vibration1, v2 = s.vibration2, v3 = s.vibration3, v4 = s.vibration4;
  const piezo = 0.18 * Math.sqrt(v1 * v1 + v2 * v2 + v3 * v3 + v4 * v4);
  return {
    time: new Date().toISOString(),
    vibration1: v1,
    vibration2: v2,
    vibration3: v3,
    vibration4: v4,
    temperature: s.temperature,
    humidity: s.humidity,
    distance: s.distance,
    battery_voltage: battOverride ?? s.battery_voltage,
    piezo_energy: piezo,
  };
}

// ─── Metric Card ──────────────────────────────────────────────────────────────
function MetricCard({
  label, value, unit, icon, color = 'green', trend = 0,
}: {
  label: string; value: string | number; unit: string; icon: string;
  color?: 'green' | 'orange' | 'red' | 'blue'; trend?: number;
}) {
  const colorMap = {
    green: 'border-ev-green/30 text-ev-green',
    orange: 'border-ev-orange/30 text-ev-orange',
    red: 'border-red-500/30 text-red-400',
    blue: 'border-blue-400/30 text-blue-400',
  };
  return (
    <motion.div
      className={`glass-card p-4 border ${colorMap[color]}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="flex items-start justify-between mb-2">
        <span className="text-2xl">{icon}</span>
        {trend !== 0 && (
          <span className={`text-xs font-mono ${trend > 0 ? 'text-red-400' : 'text-ev-green'}`}>
            {trend > 0 ? '▲' : '▼'} {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
      <div className={`text-2xl font-bold font-orbitron ${colorMap[color].split(' ')[1]}`}>
        {typeof value === 'number' ? value.toFixed(2) : value}
        <span className="text-xs ml-1 opacity-70 font-sans">{unit}</span>
      </div>
      <div className="text-xs text-gray-400 mt-1 font-mono uppercase tracking-wider">{label}</div>
    </motion.div>
  );
}

// ─── Health Badge ─────────────────────────────────────────────────────────────
function HealthBadge({ status }: { status: HealthStatus }) {
  const config: Record<HealthStatus, { bg: string; text: string; icon: string; pulse: string }> = {
    NOMINAL:  { bg: 'bg-ev-green/10 border-ev-green/50',   text: 'text-ev-green',  icon: '●', pulse: 'animate-pulse' },
    WARNING:  { bg: 'bg-ev-orange/10 border-ev-orange/50', text: 'text-ev-orange', icon: '◆', pulse: 'animate-pulse' },
    CRITICAL: { bg: 'bg-red-500/10 border-red-500/50',     text: 'text-red-400',   icon: '▲', pulse: 'animate-bounce' },
  };
  const c = config[status];
  return (
    <div className={`inline-flex items-center gap-3 px-6 py-3 rounded-full border ${c.bg}`}>
      <span className={`text-xl ${c.text} ${c.pulse}`}>{c.icon}</span>
      <div>
        <div className={`text-xs font-mono uppercase tracking-widest opacity-70 ${c.text}`}>AI HEALTH STATUS</div>
        <div className={`text-xl font-bold font-orbitron ${c.text}`}>{status}</div>
      </div>
    </div>
  );
}

// ─── Connection Indicator ─────────────────────────────────────────────────────
function ConnectionBadge({ connected }: { connected: boolean }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono
      ${connected ? 'bg-ev-green/10 border border-ev-green/30 text-ev-green' : 'bg-red-500/10 border border-red-500/30 text-red-400'}`}>
      <span className={`w-2 h-2 rounded-full ${connected ? 'bg-ev-green animate-pulse' : 'bg-red-500'}`} />
      {connected ? 'ESP32 LIVE' : 'SIMULATION MODE'}
    </div>
  );
}

// ─── Vibration Bar ────────────────────────────────────────────────────────────
function VibrationBar({ label, value, max = 8 }: { label: string; value: number; max?: number }) {
  const pct = Math.min((value / max) * 100, 100);
  const color = pct > 75 ? '#FF4444' : pct > 50 ? '#FF7A00' : '#00FFA6';
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs font-mono">
        <span className="text-gray-400">{label}</span>
        <span style={{ color }}>{value.toFixed(3)} g</span>
      </div>
      <div className="h-2 bg-space-dark rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${color}88, ${color})` }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>
    </div>
  );
}

// ─── Battery Capacity Gauge ───────────────────────────────────────────────────
function BatteryCapacityGauge({
  voltage, isCharging,
}: { voltage: number; isCharging: boolean }) {
  // Map 9 V → 0 %, 12.6 V → 100 %
  const pct = Math.max(0, Math.min(100, ((voltage - 9) / 3.6) * 100));
  const color = pct < 20 ? '#FF4444' : pct < 45 ? '#FF7A00' : '#00FFA6';
  const circumference = 2 * Math.PI * 38;
  const dashOffset = circumference * (1 - pct / 100);
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="38" fill="none" stroke="#1a2a1a" strokeWidth="8" />
        <circle cx="50" cy="50" r="38" fill="none"
          stroke={color} strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
          style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.4s ease' }}
        />
        <text x="50" y="44" textAnchor="middle" fill={color}
          fontSize="14" fontFamily="monospace" fontWeight="bold">{pct.toFixed(0)}%</text>
        <text x="50" y="56" textAnchor="middle" fill="#888"
          fontSize="7" fontFamily="monospace">{voltage.toFixed(2)}V</text>
        {isCharging && (
          <text x="50" y="68" textAnchor="middle" fill="#FFD700"
            fontSize="9" fontFamily="monospace">⚡ CHG</text>
        )}
      </svg>
      <div className="text-xs font-mono text-gray-400 uppercase tracking-widest">BATT CAPACITY</div>
    </div>
  );
}

// ─── EV Chassis Live Stress Overlay ──────────────────────────────────────────
// Sensor layout (matches L298N motor corners):
//   VIB1 = Front-Left   VIB2 = Front-Right
//   VIB3 = Rear-Left    VIB4 = Rear-Right
function ChassisLiveView({
  fault, data, isCharging,
}: { fault: FaultMode; data: ESP32Data | null; isCharging?: boolean }) {
  if (!data) return null;
  const maxVib = Math.max(data.vibration1, data.vibration2, data.vibration3, data.vibration4);
  const stress = Math.min(maxVib / 8, 1);

  // [id, label, cx, cy, radius, vib value, fault affected?]
  const zones: [string, string, number, number, number, number, boolean][] = [
    ['fl', 'FL', 110, 60,  26, data.vibration1, fault === 'MOTOR_IMBALANCE'],
    ['fr', 'FR', 330, 60,  26, data.vibration2, fault === 'MOTOR_IMBALANCE'],
    ['rl', 'RL', 110, 130, 26, data.vibration3, fault === 'SUSPENSION_FAULT'],
    ['rr', 'RR', 330, 130, 26, data.vibration4, fault === 'SUSPENSION_FAULT' || fault === 'BATTERY_LOOSE'],
  ];

  const battPct = Math.max(0, Math.min(1, (data.battery_voltage - 9) / 3.6));
  const battW   = Math.max(0, battPct * 100);
  const battCol = data.battery_voltage < 11 ? '#FF4444' : data.battery_voltage < 12 ? '#FF7A00' : '#00FFA6';

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs font-mono text-ev-green uppercase tracking-widest">
          ◉ LIVE CHASSIS STRESS MAP
        </div>
        <BatteryCapacityGauge voltage={data.battery_voltage} isCharging={!!isCharging} />
      </div>
      <svg viewBox="0 0 460 200" className="w-full" style={{ maxHeight: 200 }}>

        {/* ── FRONT / REAR direction labels ── */}
        <text x="8" y="68"  fill="#00FFA688" fontSize="8" fontFamily="monospace" fontWeight="bold">FRONT</text>
        <text x="8" y="138" fill="#00FFA688" fontSize="8" fontFamily="monospace" fontWeight="bold">REAR</text>
        <line x1="6" y1="72"  x2="6" y2="128" stroke="#00FFA633" strokeWidth="1" />
        <polygon points="6,72 3,80 9,80" fill="#00FFA644" />

        {/* ── chassis body ── */}
        <rect x="60"  y="30"  width="340" height="145" rx="22" ry="22"
          fill="none" stroke="#00FFA622" strokeWidth="1.5" />
        <rect x="80"  y="48"  width="300" height="109" rx="12" ry="12"
          fill={`rgba(0,255,166,${0.02 + stress * 0.06})`}
          stroke="#00FFA633" strokeWidth="1" />

        {/* ── axle lines ── */}
        <line x1="80"  y1="60"  x2="220" y2="60"  stroke="#00FFA618" strokeWidth="1.5" strokeDasharray="4 3" />
        <line x1="220" y1="60"  x2="370" y2="60"  stroke="#00FFA618" strokeWidth="1.5" strokeDasharray="4 3" />
        <line x1="80"  y1="130" x2="370" y2="130" stroke="#00FFA618" strokeWidth="1.5" strokeDasharray="4 3" />

        {/* ── chassis crack overlay ── */}
        {fault === 'CHASSIS_CRACK' && (
          <motion.path d="M 175 48 L 210 157" stroke="#FF4444" strokeWidth="2.5"
            strokeDasharray="4 3" opacity="0.9"
            animate={{ opacity: [0.9, 0.3, 0.9] }}
            transition={{ duration: 0.6, repeat: Infinity }} />
        )}

        {/* ── battery bar (center spine) ── */}
        <rect x="170" y="84"  width="120" height="16" rx="4" fill="#00FFA610" stroke="#00FFA633" strokeWidth="1" />
        <rect x="172" y="86"  width={battW} height="12"     rx="3" fill={battCol} opacity="0.75"
          style={{ transition: 'width 0.6s ease' }} />
        <text x="230" y="96" textAnchor="middle" fill="#ccc" fontSize="7" fontFamily="monospace">
          {data.battery_voltage.toFixed(2)} V  {(battPct * 100).toFixed(0)}%
        </text>
        {isCharging && (
          <text x="228" y="79" textAnchor="middle" fill="#FFD700" fontSize="8" fontFamily="monospace">⚡</text>
        )}

        {/* ── sensor zones ── */}
        {zones.map(([id, label, cx, cy, r, vib, affected]) => {
          const pct   = Math.min(vib / 8, 1);
          const color = affected ? '#FF4444' : pct > 0.625 ? '#FF4444' : pct > 0.375 ? '#FF7A00' : '#00FFA6';
          return (
            <g key={id}>
              {/* pulsing ring */}
              <motion.circle cx={cx} cy={cy} r={r}
                fill={`${color}18`} stroke={color} strokeWidth="1.8"
                animate={{ r: [r, r + pct * 8, r] }}
                transition={{ duration: 0.5, repeat: Infinity, ease: 'easeInOut' }} />
              {/* sensor label (FL / FR / RL / RR) */}
              <text x={cx} y={cy - 4} textAnchor="middle"
                fill={color} fontSize="9" fontFamily="monospace" fontWeight="bold">
                {label}
              </text>
              {/* g-value */}
              <text x={cx} y={cy + 8} textAnchor="middle"
                fill={color} fontSize="7.5" fontFamily="monospace">
                {vib.toFixed(2)}g
              </text>
              {/* corner wheel rectangle */}
              <rect x={cx - r - 8} y={cy - 6} width="8" height="12" rx="2"
                fill={`${color}30`} stroke={color} strokeWidth="1" />
              <rect x={cx + r}     y={cy - 6} width="8" height="12" rx="2"
                fill={`${color}30`} stroke={color} strokeWidth="1" />
            </g>
          );
        })}

        {/* ── temp readout ── */}
        <text x="452" y="100" textAnchor="end"
          fill={data.temperature > 38 ? '#FF4444' : '#00FFA6'}
          fontSize="9" fontFamily="monospace">
          {data.temperature.toFixed(1)}°C
        </text>
        <text x="452" y="110" textAnchor="end" fill="#666" fontSize="7" fontFamily="monospace">TEMP</text>

        {/* ── corner wheel outlines ── */}
        {([[80,48],[370,48],[80,148],[370,148]] as [number,number][]).map(([wx,wy],i) => (
          <rect key={i} x={wx-14} y={wy-12} width="14" height="24" rx="4"
            fill="#ffffff08" stroke="#00FFA622" strokeWidth="1" />
        ))}
      </svg>
    </div>
  );
}

// ─── Alert Feed ───────────────────────────────────────────────────────────────
function AlertFeed({ alerts }: { alerts: Alert[] }) {
  return (
    <div className="glass-card p-4 h-full overflow-hidden">
      <div className="text-xs font-mono text-ev-green mb-3 uppercase tracking-widest">
        ⚠ ALERT FEED
      </div>
      <div className="space-y-2 overflow-y-auto" style={{ maxHeight: '220px' }}>
        <AnimatePresence>
          {alerts.slice().reverse().map(a => (
            <motion.div key={a.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className={`flex items-start gap-2 text-xs font-mono p-2 rounded border
                ${a.severity === 'CRIT' ? 'border-red-500/30 bg-red-500/5 text-red-400' :
                  a.severity === 'WARN' ? 'border-ev-orange/30 bg-ev-orange/5 text-ev-orange' :
                  'border-ev-green/20 bg-ev-green/5 text-gray-400'}`}>
              <span className="opacity-50 shrink-0">{new Date(a.time).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false })}</span>
              <span>{a.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Car1Dashboard() {
  const [data, setData] = useState<ESP32Data | null>(null);
  const [history, setHistory] = useState<ESP32Data[]>([]);
  const [health, setHealth] = useState<HealthStatus>('NOMINAL');
  const [activeFault, setActiveFault] = useState<FaultMode>('NONE');
  const [wsConnected, setWsConnected] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [activeTab, setActiveTab] = useState<TabId>('live');
  const [lastUpdate, setLastUpdate] = useState<string>('—');
  const [uptime, setUptime] = useState(0);
  const [totalEnergy, setTotalEnergy] = useState(0);
  const [dataPoints, setDataPoints] = useState(0);
  const [isCharging, setIsCharging] = useState(false);
  const battRef = useRef<number>(12.1);  // simulation battery voltage (persists across ticks)
  const alertIdRef = useRef(0);
  const wsRef = useRef<WebSocket | null>(null);
  const prevFaultRef = useRef<FaultMode>('NONE');

  const addAlert = useCallback((message: string, severity: Alert['severity']) => {
    alertIdRef.current++;
    setAlerts(prev => [...prev.slice(-49), {
      id: alertIdRef.current,
      time: new Date().toISOString(),
      message,
      severity,
    }]);
  }, []);

  // Track fault changes → alert
  useEffect(() => {
    if (activeFault !== prevFaultRef.current) {
      if (activeFault !== 'NONE') {
        addAlert(`FAULT INJECTED: ${activeFault.replace('_', ' ')}`, 'CRIT');
      } else {
        addAlert('All faults cleared — system nominal', 'INFO');
      }
      prevFaultRef.current = activeFault;
    }
  }, [activeFault, addAlert]);

  // WebSocket connection
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: NodeJS.Timeout;

    const connect = () => {
      try {
        ws = new WebSocket('ws://localhost:5000');
        ws.onopen = () => {
          setWsConnected(true);
          addAlert('WebSocket connected to backend server', 'INFO');
        };
        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data);
            if (msg.type === 'esp32_data' && msg.data) {
              const d: ESP32Data = injectFault(msg.data, activeFault);
              processNewData(d);
            }
          } catch { /* ignore */ }
        };
        ws.onerror = () => { ws?.close(); };
        ws.onclose = () => {
          setWsConnected(false);
          reconnectTimer = setTimeout(connect, 4000);
        };
        wsRef.current = ws;
      } catch {
        reconnectTimer = setTimeout(connect, 4000);
      }
    };

    connect();
    return () => {
      clearTimeout(reconnectTimer);
      ws?.close();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const processNewData = useCallback((d: ESP32Data) => {
    setData(d);
    setHistory(prev => [...prev.slice(-119), d]);
    setLastUpdate(new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false }));
    setTotalEnergy(prev => prev + d.piezo_energy * 0.001);
    setDataPoints(prev => prev + 1);

    const h = deriveHealth(d, activeFault);
    setHealth(h);

    const maxVib = Math.max(d.vibration1, d.vibration2, d.vibration3, d.vibration4);
    if (maxVib > 6) addAlert(`HIGH VIBRATION: ${maxVib.toFixed(2)}g detected`, 'CRIT');
    else if (maxVib > 3.5) addAlert(`Elevated vibration: ${maxVib.toFixed(2)}g`, 'WARN');
    if (d.battery_voltage < 10.5) addAlert(`CRITICAL battery: ${d.battery_voltage.toFixed(1)}V`, 'CRIT');
    else if (d.battery_voltage < 11.5) addAlert(`Low battery: ${d.battery_voltage.toFixed(1)}V`, 'WARN');
    if (d.temperature > 45) addAlert(`HIGH TEMP: ${d.temperature.toFixed(1)}°C`, 'CRIT');
    else if (d.temperature > 38) addAlert(`Elevated temperature: ${d.temperature.toFixed(1)}°C`, 'WARN');
    if (d.distance < 15) addAlert(`OBSTACLE CLOSE: ${d.distance.toFixed(0)}cm`, 'WARN');
  }, [activeFault, addAlert]);

  // Simulation fallback — runs when WebSocket is not connected
  // Battery model: degrades 0.1 V over 600 ticks (10 min) at 1 Hz
  //   Charging: if avgVib > 3.5g then piezo current charges battery slightly
  useEffect(() => {
    if (wsConnected) return;
    const DEGRADE_RATE = 0.1 / 600;   // V per tick
    const CHARGE_RATE  = 0.0005;       // V per tick when charging
    const id = setInterval(() => {
      const sim = generateSimulationData(
        activeFault === 'NONE' ? 'NORMAL' :
        activeFault === 'MOTOR_IMBALANCE' ? 'MOTOR_IMBALANCE' :
        activeFault === 'SUSPENSION_FAULT' ? 'SUSPENSION_FAULT' :
        activeFault === 'CHASSIS_CRACK' ? 'CHASSIS_CRACK' : 'BATTERY_LOOSE'
      );
      const avgVib = (sim.vibration1 + sim.vibration2 + sim.vibration3 + sim.vibration4) / 4;
      const charging = avgVib > 3.5;
      setIsCharging(charging);
      if (charging) {
        battRef.current = Math.min(12.1, battRef.current + CHARGE_RATE);
      } else {
        battRef.current = Math.max(11.8, battRef.current - DEGRADE_RATE);
      }
      const d = injectFault(simToESP32(sim, battRef.current), activeFault);
      processNewData(d);
    }, 1000);
    return () => clearInterval(id);
  }, [wsConnected, activeFault, processNewData]);

  // Uptime counter
  useEffect(() => {
    const id = setInterval(() => setUptime(p => p + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const formatUptime = (s: number) => {
    const h = Math.floor(s / 3600).toString().padStart(2, '0');
    const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
    const ss = (s % 60).toString().padStart(2, '0');
    return `${h}:${m}:${ss}`;
  };

  // Chart data
  const timeLabels = history.slice(-60).map((_, i) => `${i}s`);

  // 5-point moving average helper (simulates RPi FFT smoothing in JS)
  const movingAvg = (arr: number[], n = 5) =>
    arr.map((_, i) => {
      const slice = arr.slice(Math.max(0, i - n + 1), i + 1);
      return slice.reduce((a, b) => a + b, 0) / slice.length;
    });

  const raw60 = history.slice(-60);
  const rawV1 = raw60.map(d => d.vibration1);
  const rawV2 = raw60.map(d => d.vibration2);
  const rawV3 = raw60.map(d => d.vibration3);
  const rawV4 = raw60.map(d => d.vibration4);

  const vibrationChartData = {
    labels: timeLabels,
    datasets: [
      // ── raw sensor readings ──
      { label: 'RAW FL (Front-Left)',  data: rawV1, color: '#00FFA6' },
      { label: 'RAW FR (Front-Right)', data: rawV2, color: '#FF7A00' },
      { label: 'RAW RL (Rear-Left)',   data: rawV3, color: '#A78BFA' },
      { label: 'RAW RR (Rear-Right)',  data: rawV4, color: '#60A5FA' },
      // ── processed: 5-pt moving average (simulates RPi FFT envelope in JS) ──
      { label: 'PROC FL avg5',         data: movingAvg(rawV1), color: '#00665544' },
      { label: 'PROC FR avg5',         data: movingAvg(rawV2), color: '#66330044' },
    ],
  };
  const energyChartData = {
    labels: timeLabels,
    datasets: [
      { label: 'Piezo Energy (mJ)', data: history.slice(-60).map(d => d.piezo_energy), borderColor: '#00FFA6', backgroundColor: '#00FFA630', fill: true, tension: 0.4, pointRadius: 0, borderWidth: 2 },
    ],
  };
  const battChartData = {
    labels: timeLabels,
    datasets: [
      { label: 'Battery Voltage (V)', data: history.slice(-60).map(d => d.battery_voltage), borderColor: '#FF7A00', backgroundColor: '#FF7A0020', fill: true, tension: 0.4, pointRadius: 0, borderWidth: 2 },
    ],
  };
  const fftLabels = ['10Hz', '20Hz', '30Hz', '40Hz', '50Hz', '60Hz', '80Hz', '100Hz', '120Hz', '150Hz'];
  const fftData = data ? {
    labels: fftLabels,
    datasets: [{
      label: 'Frequency Amplitude',
      data: fftLabels.map((_, i) => {
        const base = [
          data.vibration1 * 0.9, data.vibration2 * 0.7, data.vibration3 * 0.5,
          data.vibration1 * 0.3, data.vibration2 * 0.2, data.vibration3 * 0.18,
          data.vibration4 * 0.15, data.vibration1 * 0.12, data.vibration2 * 0.1,
          data.vibration3 * 0.08,
        ];
        return base[i] + Math.random() * 0.05;
      }),
      backgroundColor: fftLabels.map((_, i) => {
        if (activeFault === 'MOTOR_IMBALANCE' && i < 3) return '#FF444488';
        if (activeFault === 'SUSPENSION_FAULT' && i >= 2 && i <= 5) return '#FF7A0088';
        return '#00FFA644';
      }),
      borderColor: '#00FFA6',
      borderWidth: 1,
    }],
  } : null;

  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: 'live',      label: 'LIVE DATA',   icon: '📡' },
    { id: 'vibration', label: 'VIBRATION',   icon: '〰' },
    { id: 'energy',    label: 'ENERGY',      icon: '⚡' },
    { id: 'health',    label: 'SHM HEALTH',  icon: '🔬' },
  ];

  const faultBtns: { id: FaultMode; label: string; icon: string; color: string }[] = [
    { id: 'MOTOR_IMBALANCE',  label: 'Motor Imbalance',  icon: '🔧', color: 'border-ev-orange/60 hover:border-ev-orange text-ev-orange' },
    { id: 'SUSPENSION_FAULT', label: 'Suspension Fault', icon: '⚙️', color: 'border-purple-400/60 hover:border-purple-400 text-purple-400' },
    { id: 'CHASSIS_CRACK',    label: 'Chassis Crack',    icon: '⚡', color: 'border-red-500/60 hover:border-red-500 text-red-400' },
    { id: 'BATTERY_LOOSE',    label: 'Battery Loose',    icon: '🔋', color: 'border-yellow-400/60 hover:border-yellow-400 text-yellow-400' },
  ];

  return (
    <div className="min-h-screen bg-space-blue text-white font-poppins pt-16">
      {/* ── Header ── */}
      <div className="bg-space-dark/70 border-b border-ev-green/10 sticky top-16 z-20 backdrop-blur-md">
        <div className="max-w-screen-2xl mx-auto px-4 py-3 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="font-orbitron text-lg font-bold text-ev-green tracking-widest">
                CAR-1 IOT DASHBOARD
              </h1>
              <p className="text-xs text-gray-400 font-mono">
                ESP32 ▸ MongoDB Atlas ▸ WebSocket ▸ Live
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <ConnectionBadge connected={wsConnected} />
            <div className="text-xs font-mono text-gray-400 text-right">
              <div>UPTIME <span className="text-ev-green">{formatUptime(uptime)}</span></div>
              <div>LAST PKT <span className="text-ev-green">{lastUpdate}</span></div>
            </div>
            <div className="text-xs font-mono text-gray-400 text-right">
              <div>PACKETS <span className="text-ev-green">{dataPoints}</span></div>
              <div>∑ ENERGY <span className="text-ev-green">{totalEnergy.toFixed(3)} J</span></div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-4 py-6 space-y-6">

        {/* ── Health + Fault Panel ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="glass-card p-5 flex items-center justify-between flex-wrap gap-4">
            <HealthBadge status={health} />
            <div className="text-xs font-mono text-gray-400 space-y-1">
              <div>Active Fault: <span className={activeFault !== 'NONE' ? 'text-red-400' : 'text-ev-green'}>
                {activeFault === 'NONE' ? 'NONE' : activeFault.replace(/_/g, ' ')}
              </span></div>
              <div>Data Source: <span className="text-ev-green">{wsConnected ? 'ESP32 Hardware' : 'Physics Simulation'}</span></div>
              <div>Sample Rate: <span className="text-ev-green">1 Hz</span></div>
            </div>
          </div>

          <div className="glass-card p-5">
            <div className="text-xs font-mono text-ev-orange mb-3 uppercase tracking-widest">
              ⚡ FAULT SIMULATION PANEL
            </div>
            <div className="grid grid-cols-2 gap-2">
              {faultBtns.map(btn => (
                <button key={btn.id}
                  onClick={() => setActiveFault(prev => prev === btn.id ? 'NONE' : btn.id)}
                  className={`fault-btn text-xs py-2 px-3 border rounded transition-all flex items-center gap-2
                    ${activeFault === btn.id
                      ? `${btn.color.replace('hover:', '')} bg-opacity-20 bg-red-500`
                      : `border-gray-700 text-gray-400 hover:${btn.color}`}`}>
                  <span>{btn.icon}</span>
                  <span>{btn.label}</span>
                  {activeFault === btn.id && <span className="ml-auto text-red-400 animate-pulse">●</span>}
                </button>
              ))}
            </div>
            <button
              onClick={() => setActiveFault('NONE')}
              disabled={activeFault === 'NONE'}
              className="mt-2 w-full text-xs py-2 border border-ev-green/40 text-ev-green rounded hover:bg-ev-green/10 transition-all disabled:opacity-30">
              ✓ CLEAR ALL FAULTS
            </button>
          </div>
        </div>

        {/* ── Live Sensor Metrics ── */}
        {data && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <MetricCard label="Temperature"   value={data.temperature}    unit="°C"   icon="🌡" color={data.temperature > 38 ? 'red' : 'green'} />
            <MetricCard label="Humidity"      value={data.humidity}       unit="%"    icon="💧" color="blue" />
            <MetricCard label="Distance"      value={data.distance}       unit="cm"   icon="📏" color={data.distance < 20 ? 'orange' : 'green'} />
            <MetricCard label="Battery"       value={data.battery_voltage} unit="V"  icon="🔋" color={data.battery_voltage < 11 ? 'red' : data.battery_voltage < 12 ? 'orange' : 'green'} />
            <MetricCard label="Piezo Energy"  value={data.piezo_energy}   unit="mJ"   icon="⚡" color="green" />
          </div>
        )}

        {/* ── Tabs ── */}
        <div className="flex gap-2 flex-wrap">
          {tabs.map(t => (
            <button key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2 text-xs font-mono border rounded transition-all
                ${activeTab === t.id
                  ? 'border-ev-green/60 bg-ev-green/10 text-ev-green'
                  : 'border-gray-700 text-gray-400 hover:border-ev-green/30 hover:text-ev-green'}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* ── Tab Content ── */}
        <AnimatePresence mode="wait">
          {activeTab === 'live' && (
            <motion.div key="live" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Vibration bars */}
              <div className="glass-card p-5 space-y-4">
                <div className="text-xs font-mono text-ev-green uppercase tracking-widest">
                  〰 VIBRATION SENSORS (g)
                </div>
                {data && <>
                  <VibrationBar label="FL — Front-Left  (Motor)"  value={data.vibration1} />
                  <VibrationBar label="FR — Front-Right (Wheel)"  value={data.vibration2} />
                  <VibrationBar label="RL — Rear-Left   (Susp.)"  value={data.vibration3} />
                  <VibrationBar label="RR — Rear-Right  (Batt.)"  value={data.vibration4} />
                </>}
                <div className="pt-2 border-t border-gray-700 text-xs font-mono text-gray-500">
                  d₃₃=580 pC/N · Cₚ=45nF · Source: PDT Lab / ISRO IPRC
                </div>
              </div>

              {/* Chassis view */}
              <div className="lg:col-span-2">
                <ChassisLiveView fault={activeFault} data={data} isCharging={isCharging} />
                {/* env sensors grid */}
                {data && (
                  <div className="grid grid-cols-3 gap-3 mt-3">
                    <div className="glass-card p-3 text-center">
                      <div className="text-2xl font-orbitron font-bold text-ev-green">{data.temperature.toFixed(1)}</div>
                      <div className="text-xs text-gray-400 font-mono">°C TEMP</div>
                    </div>
                    <div className="glass-card p-3 text-center">
                      <div className="text-2xl font-orbitron font-bold text-blue-400">{data.humidity.toFixed(0)}</div>
                      <div className="text-xs text-gray-400 font-mono">% HUMID</div>
                    </div>
                    <div className="glass-card p-3 text-center">
                      <div className={`text-2xl font-orbitron font-bold ${data.distance < 20 ? 'text-red-400' : 'text-ev-orange'}`}>{data.distance.toFixed(0)}</div>
                      <div className="text-xs text-gray-400 font-mono">cm DIST</div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'vibration' && Charts && (
            <motion.div key="vibration" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="glass-card p-4">
                <div className="text-xs font-mono text-ev-green mb-3 uppercase tracking-widest">
                  VIBRATION vs TIME (60s window)
                </div>
                <div className="chart-container">
                  <Charts.VibrationChart labels={vibrationChartData.labels} datasets={vibrationChartData.datasets.map(d => ({ label: d.label, data: d.data, color: d.borderColor }))} />
                </div>
              </div>
              <div className="glass-card p-4">
                <div className="text-xs font-mono text-ev-green mb-3 uppercase tracking-widest">
                  FFT FREQUENCY SPECTRUM
                </div>
                <div className="chart-container">
                  {fftData && <Charts.FrequencyChart labels={fftData.labels} data={fftData.datasets[0].data} />}
                </div>
              </div>
              <div className="glass-card p-4 lg:col-span-2">
                <div className="text-xs font-mono text-ev-green mb-3 uppercase tracking-widest">
                  STRUCTURAL FREQUENCY ANALYSIS — f = (1/2π)√(k/m)
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                  {[
                    { label: 'Motor f', value: data ? (2.8 + data.vibration1 * 0.12).toFixed(2) : '—', unit: 'Hz', note: 'k=3.2×10⁶' },
                    { label: 'Suspension f', value: data ? (18.5 + data.vibration3 * 0.6).toFixed(2) : '—', unit: 'Hz', note: 'k=2.5×10⁶' },
                    { label: 'Chassis f', value: activeFault === 'CHASSIS_CRACK' ? '12.7' : '15.0', unit: 'Hz', note: 'crack→Δf' },
                    { label: 'Battery f', value: data ? (22.1 + data.vibration4 * 0.4).toFixed(2) : '—', unit: 'Hz', note: 'loose mount' },
                  ].map(c => (
                    <div key={c.label} className="glass-card p-3 border border-ev-green/10">
                      <div className="text-xl font-orbitron font-bold text-ev-green">{c.value}</div>
                      <div className="text-xs text-gray-300 font-mono">{c.unit}</div>
                      <div className="text-xs text-ev-green mt-1">{c.label}</div>
                      <div className="text-xs text-gray-500 mt-1">{c.note}</div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'energy' && Charts && (
            <motion.div key="energy" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="glass-card p-4">
                <div className="text-xs font-mono text-ev-green mb-3 uppercase tracking-widest">
                  PIEZOELECTRIC ENERGY HARVESTED (mJ)
                </div>
                <div className="chart-container">
                  <Charts.SingleLineChart title="Energy (mJ)" labels={energyChartData.labels} data={energyChartData.datasets[0].data} color="#00FFA6" />
                </div>
                <div className="mt-2 text-xs font-mono text-gray-400">
                  P = V²/2R · V = d₃₃×F/Cₚ · d₃₃=580pC/N
                </div>
              </div>
              <div className="glass-card p-4">
                <div className="text-xs font-mono text-ev-orange mb-3 uppercase tracking-widest">
                  BATTERY VOLTAGE MONITOR (V)
                </div>
                <div className="chart-container">
                  <Charts.SingleLineChart title="Battery (V)" labels={battChartData.labels} data={battChartData.datasets[0].data} color="#FF7A00" />
                </div>
                <div className="mt-2 text-xs font-mono text-gray-400">
                  NdFeB N40 · Bᵣ=1.2T · COMSOL validated
                </div>
              </div>
              <div className="glass-card p-4 lg:col-span-2">
                <div className="text-xs font-mono text-ev-green mb-3 uppercase tracking-widest">
                  ENERGY HARVESTING SUMMARY
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                  <div className="glass-card p-4 border border-ev-green/20">
                    <div className="text-2xl font-orbitron font-bold text-ev-green">{totalEnergy.toFixed(4)}</div>
                    <div className="text-xs text-gray-400 font-mono">TOTAL ENERGY (J)</div>
                  </div>
                  <div className="glass-card p-4 border border-ev-orange/20">
                    <div className="text-2xl font-orbitron font-bold text-ev-orange">
                      {data ? (data.piezo_energy * 1000).toFixed(1) : '—'}
                    </div>
                    <div className="text-xs text-gray-400 font-mono">CURRENT POWER (µW)</div>
                  </div>
                  <div className="glass-card p-4 border border-blue-400/20">
                    <div className="text-2xl font-orbitron font-bold text-blue-400">
                      {data ? ((data.vibration1 + data.vibration2 + data.vibration3 + data.vibration4) / 4).toFixed(3) : '—'}
                    </div>
                    <div className="text-xs text-gray-400 font-mono">AVG VIBRATION (g)</div>
                  </div>
                  <div className="glass-card p-4 border border-purple-400/20">
                    <div className="text-2xl font-orbitron font-bold text-purple-400">{dataPoints}</div>
                    <div className="text-xs text-gray-400 font-mono">DATA POINTS</div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'health' && (
            <motion.div key="health" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-4">
                {/* Subsystem health cards */}
                {[
                  { label: 'Motor System',     score: data ? Math.max(0, 100 - data.vibration1 * 8): 100, key: 'motor',      fault: activeFault === 'MOTOR_IMBALANCE' },
                  { label: 'Suspension',        score: data ? Math.max(0, 100 - data.vibration3 * 7): 100, key: 'susp',       fault: activeFault === 'SUSPENSION_FAULT' },
                  { label: 'Chassis Integrity', score: activeFault === 'CHASSIS_CRACK' ? 54 : (data ? Math.max(0, 100 - data.vibration2 * 5) : 100), key: 'chassis', fault: activeFault === 'CHASSIS_CRACK' },
                  { label: 'Battery Mount',     score: data ? Math.max(0, 100 - (14 - data.battery_voltage) * 12) : 100, key: 'batt', fault: activeFault === 'BATTERY_LOOSE' },
                ].map(item => {
                  const color = item.fault ? '#FF4444' : item.score < 60 ? '#FF4444' : item.score < 80 ? '#FF7A00' : '#00FFA6';
                  return (
                    <div key={item.key} className="glass-card p-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-mono" style={{ color }}>{item.label}</span>
                        <span className="font-orbitron font-bold text-sm" style={{ color }}>{item.score.toFixed(0)}%</span>
                      </div>
                      <div className="h-3 bg-space-dark rounded-full overflow-hidden">
                        <motion.div className="h-full rounded-full"
                          style={{ background: `linear-gradient(90deg, ${color}66, ${color})` }}
                          animate={{ width: `${item.score}%` }}
                          transition={{ duration: 0.5 }} />
                      </div>
                      {item.fault && (
                        <div className="mt-1 text-xs text-red-400 font-mono animate-pulse">
                          ▲ FAULT ACTIVE — {item.label.toUpperCase()} COMPROMISED
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <AlertFeed alerts={alerts} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── MongoDB Schema Reference ── */}
        <div className="glass-card p-4 border border-gray-700/50">
          <div className="text-xs font-mono text-ev-green mb-3 uppercase tracking-widest">
            ◈ MONGODB DOCUMENT SCHEMA (car1.strive-ev)
          </div>
          <pre className="text-xs font-mono text-gray-400 overflow-x-auto leading-relaxed">{`{
  "time":            "2026-03-10T10:30:12",   // IST timestamp from ESP32
  "vibration1":      2.3,                      // Motor mount (g)
  "vibration2":      1.8,                      // Wheel hub (g)
  "vibration3":      3.1,                      // Suspension arm (g)
  "vibration4":      0.9,                      // Battery tray (g)
  "temperature":     29,                       // °C — DS18B20 / DHT22
  "humidity":        56,                       // % RH — DHT22
  "distance":        45,                       // cm — HC-SR04
  "battery_voltage": 11.8,                     // V — INA219 via ADC
  "piezo_energy":    2.1                        // mJ — harvested per cycle
}`}</pre>
          <div className="mt-2 text-xs font-mono text-gray-500">
            POST endpoint: <span className="text-ev-green">http://localhost:5000/api/car1/data</span>
            &nbsp;·&nbsp; WebSocket: <span className="text-ev-green">ws://localhost:5000</span>
          </div>
        </div>

        {/* ── Research Footer ── */}
        <div className="glass-card p-4 border border-ev-green/10">
          <div className="text-xs font-mono text-ev-green mb-2 uppercase tracking-widest">
            ◈ SCIENTIFIC BASIS
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono text-gray-400">
            <div>
              <span className="text-ev-orange">Piezo Model:</span> Q=d₃₃×F (d₃₃=580 pC/N), V=Q/Cₚ, P=V²/2R<br/>
              <span className="text-gray-500">→ Wang et al. (2018), PDT Lab Report</span>
            </div>
            <div>
              <span className="text-ev-orange">SHM:</span> GMM+Autoencoder, freq shift Δf∝√(Δk/m)<br/>
              <span className="text-gray-500">→ Omidi (2023), Farrar &amp; Worden (2012)</span>
            </div>
            <div>
              <span className="text-ev-orange">Magnetics:</span> NdFeB N40, Bᵣ=1.2T, COMSOL FEM ±7%<br/>
              <span className="text-gray-500">→ Li et al. WEVJ (2024), ISRO IPRC-2024</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
