'use client'
import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { generateSimulationData } from '@/lib/simulation'
import type { SimulationData } from '@/lib/simulation'

// ─── Vibration Wave ───────────────────────────────────────────────────────────
function VibrationWave({ amplitude = 1, color = '#00FFA6' }: { amplitude?: number; color?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef<number>(0)
  const timeRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.beginPath()
      ctx.strokeStyle = color
      ctx.lineWidth = 1.5
      ctx.shadowColor = color
      ctx.shadowBlur = 6
      for (let x = 0; x < canvas.width; x++) {
        const t = timeRef.current
        const y = canvas.height / 2 +
          Math.sin((x / canvas.width) * Math.PI * 6 + t) * amplitude * 18 +
          Math.sin((x / canvas.width) * Math.PI * 12 + t * 1.7) * amplitude * 8
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
      }
      ctx.stroke()
      timeRef.current += 0.07
      frameRef.current = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(frameRef.current)
  }, [amplitude, color])
  return <canvas ref={canvasRef} width={300} height={60} className="w-full" />
}

// ─── System Architecture ──────────────────────────────────────────────────────
function SystemDiagram() {
  const nodes = [
    { id: 'v', label: 'Vibration Input',   sub: '5\u2013500 Hz, 100\u20131000 N',          color: '#00FFA6' },
    { id: 'p', label: 'PZT Sensors',       sub: 'Q = d\u2083\u2083 \u00d7 F',              color: '#0088FF' },
    { id: 'h', label: 'Energy Harvesting', sub: 'Rectifier \u2192 DC\u2013DC',               color: '#FF7A00' },
    { id: 's', label: 'Supercapacitor',    sub: 'Buffer 0.5\u20132.1 mJ/cycle',               color: '#FFD600' },
    { id: 'b', label: 'Battery',           sub: '3S LiPo, 9.6\u201312.6 V',                  color: '#00FFA6' },
    { id: 'i', label: 'IoT Telemetry',    sub: 'ESP32 \u2192 MongoDB \u2192 Dashboard',     color: '#AA44FF' },
  ]
  const [active, setActive] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setActive(p => (p + 1) % nodes.length), 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="flex flex-col items-center w-full max-w-xs mx-auto">
      {nodes.map((node, i) => (
        <div key={node.id} className="flex flex-col items-center w-full">
          <motion.div className="glass-card p-3 w-full text-center"
            animate={{ borderColor: i === active ? node.color : 'rgba(0,255,166,0.12)', boxShadow: i === active ? `0 0 18px ${node.color}40` : 'none' }}
            transition={{ duration: 0.3 }}
            style={{ border: '1px solid rgba(0,255,166,0.12)', borderRadius: 10 }}>
            <div className="heading-orbitron text-xs font-bold mb-0.5" style={{ color: node.color }}>{node.label}</div>
            <div className="text-[10px] text-[#6080A0] font-inter leading-snug">{node.sub}</div>
          </motion.div>
          {i < nodes.length - 1 && (
            <div className="flex flex-col items-center py-0.5">
              {[0,1,2].map(j => (
                <motion.div key={j} className="w-0.5 h-1.5 rounded-full mb-0.5"
                  animate={{ backgroundColor: i < active ? nodes[i].color : '#1a2840', opacity: i < active ? [0.4,1,0.4] : 0.3 }}
                  transition={{ duration: 0.7, delay: j * 0.1, repeat: Infinity }} />
              ))}
              <motion.div className="text-[10px]" animate={{ color: i < active ? '#00FFA6' : '#304050' }}>&#x2193;</motion.div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Data Card ────────────────────────────────────────────────────────────────
function DataCard({ label, value, unit, color, icon, vibAmp, status }: {
  label: string; value: string; unit: string; color: string; icon: string; vibAmp?: number; status?: string
}) {
  return (
    <motion.div className="glass-card p-3 sm:p-4 relative overflow-hidden" whileHover={{ scale: 1.03 }}
      style={{ border: `1px solid ${color}25` }}>
      <div className="absolute top-0 right-0 w-16 h-16 rounded-full opacity-5" style={{ background: color, filter: 'blur(18px)' }} />
      <div className="flex items-start justify-between mb-1.5">
        <div className="text-lg">{icon}</div>
        {status && (
          <div className={`text-[8px] heading-orbitron px-1.5 py-0.5 rounded-full ${
            status === 'NORMAL' ? 'bg-[#00FFA620] text-[#00FFA6]' :
            status === 'WARNING' ? 'bg-[#FFD60020] text-[#FFD600]' : 'bg-[#FF3B3B20] text-[#FF3B3B]'
          }`}>{status}</div>
        )}
      </div>
      <div className="text-[9px] text-[#607080] font-inter uppercase tracking-widest mb-1">{label}</div>
      <div className="flex items-baseline gap-1">
        <AnimatePresence mode="popLayout">
          <motion.div key={value} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
            className="heading-orbitron text-lg font-bold" style={{ color }}>{value}</motion.div>
        </AnimatePresence>
        <div className="text-[9px] text-[#506070] font-inter">{unit}</div>
      </div>
      {vibAmp !== undefined && <div className="mt-2 opacity-60"><VibrationWave amplitude={vibAmp} color={color} /></div>}
    </motion.div>
  )
}

// ─── Circular Dashboard Button ────────────────────────────────────────────────
function CircleBtn({ href, label, sublabel, icon, color, delay = 0 }: {
  href: string; label: string; sublabel: string; icon: string; color: string; delay?: number
}) {
  return (
    <Link href={href}>
      <motion.div className="relative flex flex-col items-center justify-center cursor-pointer select-none group"
        initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }}
        transition={{ delay, type: 'spring', stiffness: 110 }}
        whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.93 }}
        style={{ width: 150, height: 150 }}>
        {/* Outer pulse ring */}
        <motion.div className="absolute inset-0 rounded-full"
          style={{ border: `1.5px solid ${color}35` }}
          animate={{ scale: [1, 1.14, 1], opacity: [0.5, 0.15, 0.5] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut', delay }} />
        {/* Slowly rotating ring */}
        <motion.div className="absolute inset-4 rounded-full"
          style={{ border: `1px solid ${color}55` }}
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 14, repeat: Infinity, ease: 'linear' }} />
        {/* Reverse dashed ring */}
        <motion.div className="absolute inset-8 rounded-full"
          style={{ border: `1.5px dashed ${color}45` }}
          animate={{ rotate: [0, -360] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'linear' }} />
        {/* Core */}
        <div className="absolute inset-12 rounded-full flex flex-col items-center justify-center z-10 transition-all duration-300 group-hover:inset-10"
          style={{ background: `radial-gradient(circle, ${color}25, ${color}08)`, border: `2px solid ${color}`, boxShadow: `0 0 22px ${color}45, inset 0 0 18px ${color}15` }}>
          <span className="text-xl leading-none">{icon}</span>
          <span className="heading-orbitron text-[9px] font-bold mt-0.5 tracking-widest" style={{ color }}>{label}</span>
        </div>
        {/* Label below */}
        <div className="absolute -bottom-6 text-center w-36">
          <div className="text-[10px] font-inter text-[#8090A0] tracking-wide">{sublabel}</div>
        </div>
      </motion.div>
    </Link>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function HomePage() {
  const [liveData, setLiveData] = useState<SimulationData | null>(null)
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
    setLiveData(generateSimulationData('NORMAL'))
    const id = setInterval(() => setLiveData(generateSimulationData('NORMAL')), 2000)
    return () => clearInterval(id)
  }, [])

  const cards = liveData ? [
    { label: 'Motor Vibration',  value: liveData.vibration1.toFixed(2),     unit: 'm/s²', color: '#00FFA6', icon: '⚙️', vibAmp: liveData.vibration1 / 3, status: liveData.vibration1 > 3 ? 'WARNING' : 'NORMAL' },
    { label: 'Chassis Stress',   value: liveData.chassis_stress.toFixed(1), unit: 'MPa',       color: '#FF7A00', icon: '🏗️', vibAmp: liveData.chassis_stress / 40, status: liveData.chassis_stress > 60 ? 'WARNING' : 'NORMAL' },
    { label: 'Battery Vib',      value: liveData.vibration4.toFixed(2),     unit: 'm/s²', color: '#FFD600', icon: '🔋',  vibAmp: liveData.vibration4 / 3, status: liveData.vibration4 > 3 ? 'WARNING' : 'NORMAL' },
    { label: 'Energy Harvested', value: liveData.energy_harvested.toFixed(3),unit: 'mJ',       color: '#00FFA6', icon: '⚡',      vibAmp: 0.6, status: 'NORMAL' },
    { label: 'Vehicle Speed',    value: liveData.speed.toFixed(1),          unit: 'km/h',      color: '#0099FF', icon: '🚗',  status: 'NORMAL' },
    { label: 'Temperature',      value: liveData.temperature.toFixed(1),    unit: '°C',   color: liveData.temperature > 50 ? '#FF3B3B' : '#FF7A00', icon: '🌡️', status: liveData.temperature > 50 ? 'WARNING' : 'NORMAL' },
  ] : []

  return (
    <div className="min-h-screen">

      {/* HERO */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-4 pt-20 overflow-hidden">

        {/* Video background */}
        <video autoPlay muted loop playsInline
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          style={{ zIndex: 0 }}>
          <source src="/ev-bg.mov" type="video/mp4" />
        </video>

        {/* Dark overlay */}
        <div className="absolute inset-0 pointer-events-none" style={{
          zIndex: 1,
          background: 'linear-gradient(to bottom, rgba(6,15,31,0.80) 0%, rgba(6,15,31,0.70) 50%, rgba(6,15,31,0.93) 100%)',
        }} />

        {/* Scrolling telemetry ticker */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 2, opacity: 0.07 }}>
          {isClient && Array.from({ length: 5 }).map((_, i) => (
            <motion.div key={i}
              className="absolute text-[#00FFA6] heading-orbitron text-[8px] whitespace-nowrap"
              style={{ top: `${12 + i * 16}%`, left: 0 }}
              animate={{ x: ['-100%', '110vw'] }}
              transition={{ duration: 22 + i * 5, repeat: Infinity, ease: 'linear', delay: -i * 5 }}>
              VIB: 2.34 TEMP: 31.2°C FREQ: 48Hz STRESS: 18.4 MPa ENERGY: 1.23 mJ BATT: 11.8V
            </motion.div>
          ))}
        </div>

        {/* Hero content */}
        <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9 }}
          className="relative text-center w-full max-w-4xl mx-auto px-4" style={{ zIndex: 3 }}>

          <h1 className="heading-orbitron font-bold mb-3 leading-tight">
            <span className="block text-5xl sm:text-6xl md:text-7xl tracking-widest glow-text-green" style={{ color: '#00FFA6' }}>
              STRIVE-EV
            </span>
            <span className="block text-base sm:text-lg md:text-xl text-[#6080A0] mt-2 heading-poppins font-light tracking-wide">
              Structural Intelligence &amp; Vibration Energy System
            </span>
            <span className="block text-sm md:text-base text-[#4060A0] mt-1 heading-poppins font-light">for Electric Vehicles</span>
          </h1>

          {/* Tagline */}
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
            className="text-base sm:text-lg md:text-xl font-inter mt-4 mb-10 tracking-wide">
            <span className="text-[#00FFA6] font-semibold">Sense</span>
            <span className="mx-2 text-[#405060]">&bull;</span>
            <span className="text-[#FF7A00] font-semibold">Harvest</span>
            <span className="mx-2 text-[#405060]">&bull;</span>
            <span className="text-white font-semibold">Protect.</span>
          </motion.p>

          {/* Wave indicators */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}
            className="flex justify-center gap-3 sm:gap-4 mb-14">
            {['#00FFA6', '#FF7A00', '#0099FF', '#FFD600'].map((c, i) => (
              <div key={i} className="w-12 sm:w-20"><VibrationWave amplitude={0.4 + i * 0.2} color={c} /></div>
            ))}
          </motion.div>

          {/* Circular dashboard buttons */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }}
            className="flex justify-center items-center gap-16 sm:gap-28 mb-16">
            <CircleBtn href="/simulation" label="SIM" sublabel="Simulation Dashboard" icon="🧪" color="#00FFA6" delay={1.0} />
            <CircleBtn href="/car1"       label="RT"  sublabel="Real-Time IoT Feed"   icon="📡" color="#FF7A00" delay={1.15} />
          </motion.div>

          {/* Research link */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.35 }}>
            <Link href="/research">
              <span className="text-[10px] sm:text-xs text-[#405060] hover:text-[#00FFA6] font-inter transition-colors tracking-widest uppercase cursor-pointer">
                View Research Backings &#x2192;
              </span>
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* PROJECT OVERVIEW */}
      <section className="py-16 sm:py-20 px-4 max-w-7xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="text-center mb-10 sm:mb-14">
          <h2 className="heading-poppins text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-3">Project Overview</h2>
          <div className="w-16 h-0.5 bg-[#00FFA6] mx-auto" />
        </motion.div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 sm:gap-6">
          {[
            { icon: '🔬', title: 'Problem Statement', color: '#00FFA6',
              content: 'Electric vehicles continuously generate mechanical vibrations in suspension systems, chassis, and motor mounts (5\u2013500\u202fHz, 100\u20131000\u202fN). This vibrational energy is wasted as heat through dampers. STRIVE-EV proposes converting this energy through PZT piezoelectric transducers while simultaneously extracting structural health data.' },
            { icon: '\u26a1', title: 'Piezoelectric Harvesting', color: '#FF7A00',
              content: 'Using the direct piezoelectric effect: Q = d\u2083\u2083 \u00d7 F. PZT ceramics generate 0.5\u201320\u202fV output under vehicle forces. Theoretical output ~2.84\u202fW (Wang et al.), with experimental validation at 0.33\u202fV under typical road conditions.' },
            { icon: '🏗️', title: 'Structural Diagnostics', color: '#0099FF',
              content: 'Vibration-based damage detection uses natural frequency shifts: f = (1/2\u03c0)\u221a(k/m). A chassis crack reduces stiffness k by 28\u202f%, shifting the natural frequency from 15\u202fHz to 12.7\u202fHz \u2014 detectable by the onboard SHM system using GMM + Autoencoder (Omidi, 2023).' },
          ].map((item, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ delay: i * 0.15 }} className="glass-card p-5 sm:p-6" style={{ borderColor: `${item.color}25` }}>
              <div className="text-2xl sm:text-3xl mb-3">{item.icon}</div>
              <h3 className="heading-orbitron text-xs sm:text-sm font-bold mb-3" style={{ color: item.color }}>{item.title}</h3>
              <p className="text-[#7090B0] text-xs sm:text-sm font-inter leading-relaxed">{item.content}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* OBJECTIVES */}
      <section className="py-12 sm:py-16 px-4 max-w-5xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="text-center mb-8 sm:mb-10">
          <h2 className="heading-poppins text-2xl sm:text-3xl font-bold text-white mb-3">Project Objectives</h2>
          <div className="w-16 h-0.5 bg-[#FF7A00] mx-auto" />
        </motion.div>
        <div className="space-y-3 sm:space-y-4">
          {[
            'Design a piezoelectric energy harvesting system that converts vehicle vibrations (5\u2013500\u202fHz) into electrical energy using PZT transducers (d\u2083\u2083 = 580\u202fpC/N)',
            'Develop a charge-to-voltage converter circuit \u2014 compatible with IEPE standard, high sensitivity, low noise',
            'Implement dual-path architecture: simultaneous energy harvesting + structural signal extraction from the same PZT element',
            'Develop real-time structural health diagnostics using vibration-based frequency shift analysis (SHM Level 1–3)',
            'Deploy an IoT pipeline: ESP32 \u2192 MongoDB Atlas \u2192 WebSocket \u2192 Dashboard for real-time EV rover telemetry',
          ].map((obj, i) => (
            <motion.div key={i} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
              transition={{ delay: i * 0.08 }} className="flex items-start gap-3 sm:gap-4 glass-card p-3 sm:p-4">
              <div className="flex-shrink-0 w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-xs font-bold heading-orbitron"
                style={{ background: 'rgba(0,255,166,0.1)', border: '1px solid #00FFA640', color: '#00FFA6' }}>
                {(i + 1).toString().padStart(2, '0')}
              </div>
              <p className="text-[#8090A0] text-xs sm:text-sm font-inter leading-relaxed">{obj}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* SYSTEM ARCHITECTURE */}
      <section className="py-12 sm:py-16 px-4">
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
          className="text-center mb-8 sm:mb-10">
          <h2 className="heading-poppins text-2xl sm:text-3xl font-bold text-white mb-3">System Architecture</h2>
          <div className="w-16 h-0.5 bg-[#00FFA6] mx-auto mb-2" />
          <p className="text-[#6080A0] text-sm">Animated signal flow through STRIVE-EV system</p>
        </motion.div>
        <div className="flex justify-center"><SystemDiagram /></div>
      </section>

      {/* LIVE TELEMETRY PREVIEW */}
      <section className="py-12 sm:py-16 px-4 max-w-7xl mx-auto">
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
          className="text-center mb-8 sm:mb-10">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-[#00FFA6] animate-pulse" style={{ boxShadow: '0 0 8px #00FFA6' }} />
            <span className="heading-orbitron text-[#00FFA6] text-[10px] sm:text-xs tracking-widest">LIVE SAMPLE DATA</span>
          </div>
          <h2 className="heading-poppins text-2xl sm:text-3xl font-bold text-white mb-2">Real-Time Telemetry Preview</h2>
          <p className="text-[#6080A0] text-xs sm:text-sm">Updates every 2 seconds &#xb7; Simulated data from STRIVE-EV system</p>
        </motion.div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {cards.map((card, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}>
              <DataCard {...card} />
            </motion.div>
          ))}
        </div>
        {liveData && (
          <motion.div className="mt-5 p-3 sm:p-4 glass-card text-center"
            animate={{ borderColor: liveData.health_status === 'NORMAL' ? '#00FFA640' : liveData.health_status === 'WARNING' ? '#FFD60040' : '#FF3B3B40' }}>
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
              <div className="w-2.5 h-2.5 rounded-full animate-pulse"
                style={{ background: liveData.health_status === 'NORMAL' ? '#00FFA6' : liveData.health_status === 'WARNING' ? '#FFD600' : '#FF3B3B' }} />
              <span className="heading-orbitron text-xs sm:text-sm tracking-widest"
                style={{ color: liveData.health_status === 'NORMAL' ? '#00FFA6' : liveData.health_status === 'WARNING' ? '#FFD600' : '#FF3B3B' }}>
                SYSTEM STATUS: {liveData.health_status}
              </span>
              <span className="text-[#6080A0] text-[10px] sm:text-xs font-inter">
                | Motor: {liveData.motor_freq.toFixed(0)} Hz | Chassis: {liveData.chassis_freq.toFixed(1)} Hz
              </span>
            </div>
          </motion.div>
        )}
      </section>

      {/* FOOTER */}
      <footer className="py-8 px-4 border-t border-[#0D2040] text-center">
        <div className="heading-orbitron text-[#00FFA6] text-xs tracking-widest mb-1">STRIVE-EV</div>
        <div className="text-[#4A5568] text-[10px] sm:text-xs font-inter tracking-widest mb-1">
          Sense &bull; Harvest &bull; Protect.
        </div>
        <div className="text-[#304050] text-[10px] font-inter">
          Piezoelectric Energy Harvesting &amp; Structural Health Analysis for Electric Vehicles
        </div>
        <div className="mt-3 flex justify-center flex-wrap gap-4 text-[#2A3840] text-[10px] font-inter">
          <span>PT Lab &#xa9; 2024&#x2013;2026</span>
          <span>|</span>
          <span>Designed for Research Purposes</span>
        </div>
      </footer>
    </div>
  )
}
