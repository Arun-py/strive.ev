'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import dynamic from 'next/dynamic'
import {
  generateSimulationData,
  generateFrequencySpectrum,
  setSimulationCondition,
  vehicleConditions,
  conditionDescriptions,
  type VehicleCondition,
  type SimulationData,
} from '@/lib/simulation'

const Charts = dynamic(() => import('@/components/Charts'), { ssr: false })

const MAX_HISTORY = 60

// EV Chassis Stress Visualization
function ChassisHeatmap({ data }: { data: SimulationData }) {
  const getColor = (stress: number) => {
    if (stress > 70) return '#FF3B3B'
    if (stress > 40) return '#FFD600'
    return '#00FFA6'
  }

  const zones = [
    { id: 'motor', label: 'Motor Mount', x: 20, y: 35, value: data.vibration1 * 12 },
    { id: 'front_susp', label: 'Front Susp.', x: 5, y: 70, value: data.vibration3 * 9 },
    { id: 'chassis', label: 'Chassis Center', x: 50, y: 50, value: data.chassis_stress },
    { id: 'rear_susp', label: 'Rear Susp.', x: 85, y: 70, value: data.vibration3 * 8 },
    { id: 'battery', label: 'Battery', x: 50, y: 80, value: data.vibration4 * 10 },
    { id: 'front_axle', label: 'Front Axle', x: 15, y: 85, value: data.vibration2 * 7 },
  ]

  return (
    <div className="relative w-full" style={{ paddingBottom: '45%' }}>
      {/* EV outline SVG */}
      <svg
        viewBox="0 0 300 140"
        className="absolute inset-0 w-full h-full"
        style={{ background: 'rgba(6,15,31,0.8)', borderRadius: 8 }}
      >
        {/* Chassis outline */}
        <path
          d="M30 90 L30 70 Q35 40 80 35 L220 35 Q265 37 270 70 L270 90 Q265 100 250 100 L50 100 Q35 100 30 90Z"
          fill="#0B1D3A"
          stroke="rgba(0,255,166,0.2)"
          strokeWidth="1"
        />
        {/* Body */}
        <path
          d="M60 35 Q80 15 110 12 H190 Q230 12 245 35Z"
          fill="#071428"
          stroke="rgba(0,255,166,0.15)"
          strokeWidth="0.8"
        />
        {/* Wheels */}
        <circle cx="70" cy="108" r="14" fill="#060F1F" stroke="rgba(0,255,166,0.2)" strokeWidth="1"/>
        <circle cx="230" cy="108" r="14" fill="#060F1F" stroke="rgba(0,255,166,0.2)" strokeWidth="1"/>

        {/* Stress zones */}
        {zones.map(zone => {
          const stress = Math.min(100, zone.value)
          const color = getColor(stress)
          const radius = 8 + stress * 0.1
          return (
            <g key={zone.id}>
              <circle
                cx={zone.x * 3}
                cy={zone.y * 1.35}
                r={radius}
                fill={color + '30'}
                stroke={color}
                strokeWidth="1"
              >
                <animate attributeName="r" values={`${radius};${radius + 3};${radius}`} dur="2s" repeatCount="indefinite"/>
              </circle>
              <text
                x={zone.x * 3}
                y={zone.y * 1.35 + 3}
                textAnchor="middle"
                fill={color}
                fontSize="6"
                fontFamily="Orbitron,monospace"
              >
                {stress.toFixed(0)}
              </text>
            </g>
          )
        })}

        {/* Label */}
        <text x="150" y="135" textAnchor="middle" fill="#405060" fontSize="7" fontFamily="Orbitron,monospace">
          CHASSIS STRUCTURAL HEALTH MAP (MPa)
        </text>
      </svg>
    </div>
  )
}

// Metric card
function MetricCard({ 
  label, value, unit, color, icon, delta 
}: { 
  label: string; value: string; unit: string; color: string; icon: string; delta?: number 
}) {
  return (
    <div className="glass-card p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{icon}</span>
        <span className="text-[#506070] text-[9px] heading-orbitron tracking-widest uppercase flex-1">{label}</span>
        {delta !== undefined && (
          <span className={`text-[9px] font-mono ${delta > 0 ? 'text-[#FF3B3B]' : 'text-[#00FFA6]'}`}>
            {delta > 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(2)}
          </span>
        )}
      </div>
      <AnimatePresence mode="popLayout">
        <motion.div
          key={value}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="heading-orbitron text-lg font-bold"
          style={{ color }}
        >
          {value} <span className="text-[10px] text-[#405060] font-normal">{unit}</span>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

export default function SimulationPage() {
  const [condition, setCondition] = useState<VehicleCondition>('NORMAL')
  const [data, setData] = useState<SimulationData | null>(null)
  const [history, setHistory] = useState<SimulationData[]>([])
  const [freqSpectrum, setFreqSpectrum] = useState<number[]>([])
  const [isRunning, setIsRunning] = useState(true)
  const [isClient, setIsClient] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [ChartsComponent, setChartsComponent] = useState<typeof import('@/components/Charts') | null>(null)

  useEffect(() => {
    setIsClient(true)
    import('@/components/Charts').then(m => setChartsComponent(m as typeof import('@/components/Charts')))
  }, [])

  const tick = useCallback(() => {
    const newData = generateSimulationData(condition)
    setData(newData)
    setHistory(prev => {
      const next = [...prev, newData]
      return next.length > MAX_HISTORY ? next.slice(-MAX_HISTORY) : next
    })
    setFreqSpectrum(generateFrequencySpectrum(condition))
  }, [condition])

  useEffect(() => {
    setSimulationCondition(condition)
    if (isRunning) {
      tick()
      intervalRef.current = setInterval(tick, 500)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [condition, isRunning, tick])

  const togglePause = () => {
    setIsRunning(prev => {
      if (!prev) tick()
      return !prev
    })
  }

  const timeLabels = history.map((_, i) => `${(i * 0.5).toFixed(1)}s`)
  const freqLabels = Array.from({ length: 64 }, (_, i) => `${((i / 64) * 200).toFixed(0)}`)

  const condDesc = condition ? conditionDescriptions[condition] : null

  return (
    <div className="min-h-screen pt-20 pb-12 px-4">
      {/* Header */}
      <div className="max-w-screen-xl mx-auto">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full animate-pulse"
                style={{ background: isRunning ? '#00FFA6' : '#FF7A00', boxShadow: `0 0 8px ${isRunning ? '#00FFA6' : '#FF7A00'}` }} />
              <span className="heading-orbitron text-[10px] tracking-widest"
                style={{ color: isRunning ? '#00FFA6' : '#FF7A00' }}>
                {isRunning ? 'SIMULATION RUNNING' : 'SIMULATION PAUSED'}
              </span>
            </div>
            <h1 className="heading-orbitron text-xl font-bold text-white">SIMULATION DASHBOARD</h1>
            <div className="text-[#506070] text-xs font-inter">simulation@strive.ev · Physics-based EV vibration model</div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={togglePause}
              className="px-5 py-2 rounded-lg heading-orbitron text-xs tracking-widest transition-all"
              style={{
                background: isRunning ? 'rgba(255,214,0,0.1)' : 'rgba(0,255,166,0.1)',
                border: isRunning ? '1px solid #FFD60040' : '1px solid #00FFA640',
                color: isRunning ? '#FFD600' : '#00FFA6',
              }}
            >
              {isRunning ? '⏸ PAUSE' : '▶ RESUME'}
            </button>
          </div>
        </div>

        {/* Condition selector */}
        <div className="flex flex-wrap gap-2 mb-6">
          {vehicleConditions.map(c => (
            <motion.button
              key={c.value}
              onClick={() => setCondition(c.value)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`px-4 py-2 rounded-lg heading-orbitron text-[9px] tracking-wider transition-all ${
                condition === c.value ? 'font-bold' : 'opacity-60'
              }`}
              style={{
                background: condition === c.value ? `${c.color}20` : 'rgba(13,35,71,0.5)',
                border: `1px solid ${condition === c.value ? c.color + '60' : '#1A3A5C'}`,
                color: condition === c.value ? c.color : '#6080A0',
                boxShadow: condition === c.value ? `0 0 12px ${c.color}25` : 'none'
              }}
            >
              {c.label.toUpperCase()}
            </motion.button>
          ))}
        </div>

        {/* Condition info banner */}
        <AnimatePresence mode="wait">
          {condDesc && (
            <motion.div
              key={condition}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`p-4 rounded-lg mb-6 ${
                condDesc.severity === 'critical' ? 'bg-[#FF3B3B08] border border-[#FF3B3B30]' :
                condDesc.severity === 'warning' ? 'bg-[#FFD60008] border border-[#FFD60030]' :
                'bg-[#00FFA608] border border-[#00FFA630]'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`text-sm font-bold heading-orbitron ${
                  condDesc.severity === 'critical' ? 'text-[#FF3B3B]' :
                  condDesc.severity === 'warning' ? 'text-[#FFD600]' : 'text-[#00FFA6]'
                }`}>
                  {condDesc.severity === 'critical' ? '🔴' : condDesc.severity === 'warning' ? '⚠' : 'ℹ'} {condDesc.title}
                </div>
                <div className="text-[#6080A0] text-xs font-inter flex-1">{condDesc.description}</div>
              </div>
              <div className="mt-3 flex flex-wrap gap-3">
                {condDesc.indicators.map((ind, i) => (
                  <span key={i} className="text-[10px] font-mono text-[#506070]">{ind}</span>
                ))}
              </div>
              <div className="mt-2 text-xs font-inter" style={{
                color: condDesc.severity === 'critical' ? '#FF3B3B' :
                       condDesc.severity === 'warning' ? '#FFD600' : '#00FFA6'
              }}>
                💡 {condDesc.recommendation}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Live metrics row */}
        {data && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
            <MetricCard label="Motor Vib" value={data.vibration1.toFixed(2)} unit="m/s²" color="#00FFA6" icon="⚙️"/>
            <MetricCard label="Chassis" value={data.vibration2.toFixed(2)} unit="m/s²" color="#0099FF" icon="🏗"/>
            <MetricCard label="Susp. Vib" value={data.vibration3.toFixed(2)} unit="m/s²" color={data.vibration3 > 4 ? '#FF3B3B' : '#FFD600'} icon="🔩"/>
            <MetricCard label="Battery Mt." value={data.vibration4.toFixed(2)} unit="m/s²" color="#FF7A00" icon="🔋"/>
            <MetricCard label="Piezo V" value={data.piezo_voltage.toFixed(2)} unit="V" color="#AA44FF" icon="⚡"/>
            <MetricCard label="Energy" value={data.energy_harvested.toFixed(3)} unit="mJ" color="#00FFA6" icon="💡"/>
            <MetricCard label="Motor Freq" value={data.motor_freq.toFixed(1)} unit="Hz" color="#FF7A00" icon="📡"/>
            <MetricCard label="Chassis Freq" value={data.chassis_freq.toFixed(1)} unit="Hz" color={data.chassis_freq < 13 ? '#FF3B3B' : '#00FFA6'} icon="📊"/>
            <MetricCard label="Speed" value={data.speed.toFixed(0)} unit="km/h" color="#0099FF" icon="🚗"/>
            <MetricCard label="Stress" value={data.chassis_stress.toFixed(1)} unit="MPa" color={data.chassis_stress > 70 ? '#FF3B3B' : '#FF7A00'} icon="🔬"/>
            <MetricCard label="Battery" value={data.battery_voltage.toFixed(1)} unit="V" color={data.battery_voltage < 10.5 ? '#FF3B3B' : '#00FFA6'} icon="🔌"/>
            <MetricCard label="Integrity" value={data.structural_integrity.toFixed(0)} unit="%" color={data.structural_integrity < 65 ? '#FF3B3B' : data.structural_integrity < 80 ? '#FFD600' : '#00FFA6'} icon="🛡"/>
          </div>
        )}

        {/* Health status */}
        {data && (
          <div className={`p-3 rounded-lg flex flex-wrap items-center gap-4 mb-6 ${
            data.health_status === 'NORMAL' ? 'bg-[#00FFA606] border border-[#00FFA620]' :
            data.health_status === 'WARNING' ? 'bg-[#FFD60006] border border-[#FFD60020]' :
            'bg-[#FF3B3B06] border border-[#FF3B3B20]'
          }`}>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{
                background: data.health_status === 'NORMAL' ? '#00FFA6' : data.health_status === 'WARNING' ? '#FFD600' : '#FF3B3B',
                boxShadow: `0 0 8px ${data.health_status === 'NORMAL' ? '#00FFA6' : data.health_status === 'WARNING' ? '#FFD600' : '#FF3B3B'}`
              }}/>
              <span className="heading-orbitron text-xs font-bold" style={{
                color: data.health_status === 'NORMAL' ? '#00FFA6' : data.health_status === 'WARNING' ? '#FFD600' : '#FF3B3B'
              }}>
                {data.health_status}
              </span>
            </div>
            <div className="text-[10px] font-inter text-[#6080A0]">{data.motor_health}</div>
            <div className="text-[10px] font-inter text-[#6080A0]">{data.suspension_health}</div>
            <div className="text-[10px] font-inter text-[#6080A0]">{data.chassis_health}</div>
            <div className="text-[10px] font-inter text-[#6080A0]">{data.battery_health}</div>
            <div className="text-[10px] font-inter text-[#6080A0]">{data.energy_status}</div>
          </div>
        )}

        {/* Charts grid */}
        {isClient && ChartsComponent && history.length > 2 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
            {/* Vibration amplitude */}
            <div className="chart-container md:col-span-2" style={{ height: 200 }}>
              <ChartsComponent.VibrationChart
                labels={timeLabels}
                datasets={[
                  { label: 'V1-Motor', data: history.map(d => d.vibration1), color: '#00FFA6' },
                  { label: 'V2-Chassis', data: history.map(d => d.vibration2), color: '#0099FF' },
                  { label: 'V3-Susp', data: history.map(d => d.vibration3), color: '#FFD600' },
                  { label: 'V4-Batt', data: history.map(d => d.vibration4), color: '#FF7A00' },
                ]}
              />
            </div>

            {/* Frequency spectrum */}
            <div className="chart-container" style={{ height: 200 }}>
              <ChartsComponent.FrequencyChart
                labels={freqLabels}
                data={freqSpectrum}
                color="#FF7A00"
              />
            </div>

            {/* Piezo voltage */}
            <div className="chart-container" style={{ height: 200 }}>
              <ChartsComponent.SingleLineChart
                title="PIEZO VOLTAGE OUTPUT"
                labels={timeLabels}
                data={history.map(d => d.piezo_voltage)}
                color="#AA44FF"
                unit="V"
                yMin={0}
                yMax={20}
              />
            </div>

            {/* Energy harvested */}
            <div className="chart-container" style={{ height: 200 }}>
              <ChartsComponent.SingleLineChart
                title="ENERGY HARVESTED"
                labels={timeLabels}
                data={history.map(d => d.energy_harvested)}
                color="#00FFA6"
                unit="mJ"
                yMin={0}
              />
            </div>

            {/* Structural integrity */}
            <div className="chart-container" style={{ height: 200 }}>
              <ChartsComponent.SingleLineChart
                title="STRUCTURAL INTEGRITY"
                labels={timeLabels}
                data={history.map(d => d.structural_integrity)}
                color={data?.structural_integrity && data.structural_integrity < 65 ? '#FF3B3B' :
                       data?.structural_integrity && data.structural_integrity < 80 ? '#FFD600' : '#00FFA6'}
                unit="%"
                yMin={0}
                yMax={100}
              />
            </div>
          </div>
        )}

        {/* Chassis heat map */}
        {data && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="dashboard-panel p-4">
              <div className="heading-orbitron text-[#00FFA6] text-[10px] tracking-widest mb-3">
                EV CHASSIS STRUCTURAL HEALTH MAP
              </div>
              <ChassisHeatmap data={data} />
              <div className="flex gap-3 mt-3">
                {[['#00FFA6', '< 40 MPa SAFE'], ['#FFD600', '40-70 MPa CAUTION'], ['#FF3B3B', '> 70 MPa CRITICAL']].map(([c, l]) => (
                  <div key={l} className="flex items-center gap-1.5 text-[9px] font-inter text-[#6080A0]">
                    <div className="w-2 h-2 rounded-full" style={{ background: c }} />
                    {l}
                  </div>
                ))}
              </div>
            </div>

            {/* Fault details panel */}
            {data && (
              <div className="dashboard-panel p-4">
                <div className="heading-orbitron text-[#FF7A00] text-[10px] tracking-widest mb-3">
                  FAULT FLAG STATUS
                </div>
                <div className="space-y-2">
                  {Object.entries(data.fault_flags).map(([flag, active]) => (
                    <div key={flag} className="flex items-center justify-between p-2 rounded"
                      style={{ background: active ? 'rgba(255,59,59,0.06)' : 'rgba(0,255,166,0.03)' }}>
                      <span className="text-[10px] font-mono text-[#6080A0] uppercase tracking-wider">
                        {flag.replace(/_/g, ' ')}
                      </span>
                      <div className={`flex items-center gap-1.5 heading-orbitron text-[9px] font-bold ${active ? 'text-[#FF3B3B]' : 'text-[#00FFA6]'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-[#FF3B3B] animate-pulse' : 'bg-[#00FFA6]'}`}/>
                        {active ? 'ACTIVE' : 'CLEAR'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Research references */}
        <div className="dashboard-panel p-4">
          <div className="heading-orbitron text-[#6080A0] text-[10px] tracking-widest mb-3">
            SIMULATION MODEL REFERENCES
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px] font-inter text-[#405060]">
            {[
              'Wang et al. (2015): Suspension force 100–1000 N → V = 0.5–20V | PZT d33 = 580 pC/N',
              'Al-Yafeai et al. (2020): Half-car model +77% voltage, +57% power improvement',
              'Hendrowati et al. (2012): Multilayer PZT stack ×7.2 power improvement',
              'Omidi (2023): f = (1/2π)√(k/m) — Chassis crack: f drops from 15 → 12.7 Hz',
              'Li et al. (2026): NdFeB N40 magnets broaden frequency response (wevj-17-00092)',
              'ISRO IPRC (2024): IEPE-compatible charge-to-voltage converter (RES-IPRC-2024-002)',
            ].map((ref, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-[#00FFA640]">•</span>
                <span>{ref}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
