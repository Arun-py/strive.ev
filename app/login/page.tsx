'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'

const accounts = [
  {
    email: 'simulation@strive.ev',
    password: 'strive2024',
    role: 'Simulation Environment',
    icon: '🧪',
    color: '#00FFA6',
    redirect: '/simulation',
    description: 'Access physics-based vibration simulation environment with fault injection and structural health analysis.',
    features: ['Synthetic vibration models', 'Fault injection panel', 'FFT spectrum analysis', 'SHM visualization'],
  },
  {
    email: 'car1@strive.ev',
    password: 'rover2024',
    role: 'IoT Rover Telemetry',
    icon: '📡',
    color: '#FF7A00',
    redirect: '/car1',
    description: 'Live data from ESP32-based prototype rover. MongoDB Atlas real-time stream via WebSocket.',
    features: ['ESP32 sensor stream', 'MongoDB real-time feed', 'Live vibration plots', 'AI health monitor'],
  },
]

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null)

  const handlePreset = (idx: number) => {
    const acct = accounts[idx]
    setEmail(acct.email)
    setPassword(acct.password)
    setSelectedPreset(idx)
    setError('')
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    await new Promise(r => setTimeout(r, 900))

    const acct = accounts.find(a => a.email === email && a.password === password)
    if (acct) {
      if (typeof window !== 'undefined') {
        localStorage.setItem('strive_user', JSON.stringify({ email: acct.email, role: acct.role }))
      }
      router.push(acct.redirect)
    } else {
      setError('Invalid credentials. Use the access cards below.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 pt-20 pb-12">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-10"
      >
        <div className="heading-orbitron text-[#00FFA6] text-xs tracking-widest mb-2 opacity-70">
          RESEARCH ACCESS PORTAL
        </div>
        <h1 className="heading-orbitron text-3xl font-bold text-white mb-2">
          STRIVE-EV LOGIN
        </h1>
        <p className="text-[#6080A0] text-sm font-inter">Authenticate to access your dashboard environment</p>
      </motion.div>

      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* Login form */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card p-8"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-2 h-2 rounded-full bg-[#00FFA6] animate-pulse" />
            <span className="heading-orbitron text-[#00FFA6] text-xs tracking-widest">SECURE LOGIN</span>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-[#6080A0] text-xs font-inter mb-2 tracking-widest uppercase">
                Research Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setError('') }}
                placeholder="user@strive.ev"
                className="w-full bg-[#060F1F] border border-[#1A3A5C] rounded-lg px-4 py-3 text-white text-sm font-inter focus:outline-none focus:border-[#00FFA6] transition-colors"
                required
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-[#6080A0] text-xs font-inter mb-2 tracking-widest uppercase">
                Access Code
              </label>
              <input
                type="password"
                value={password}
                onChange={e => { setPassword(e.target.value); setError('') }}
                placeholder="••••••••"
                className="w-full bg-[#060F1F] border border-[#1A3A5C] rounded-lg px-4 py-3 text-white text-sm font-inter focus:outline-none focus:border-[#00FFA6] transition-colors"
                required
              />
            </div>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-[#FF3B3B] text-xs font-inter bg-[#FF3B3B10] border border-[#FF3B3B30] rounded-lg px-3 py-2"
                >
                  ⚠ {error}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit */}
            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-3 rounded-lg heading-orbitron text-xs tracking-widest font-bold text-[#060F1F] transition-all disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #00FFA6, #00CC85)' }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    className="w-4 h-4 border-2 border-[#060F1F] border-t-transparent rounded-full"
                  />
                  AUTHENTICATING...
                </span>
              ) : '→ AUTHENTICATE & ACCESS DASHBOARD'}
            </motion.button>
          </form>

          {/* Info */}
          <div className="mt-6 p-4 rounded-lg bg-[#00FFA608] border border-[#00FFA620]">
            <div className="text-[#00FFA6] text-[10px] heading-orbitron tracking-widest mb-2">DEMO CREDENTIALS</div>
            <div className="space-y-1.5">
              <div className="text-[#6080A0] text-xs font-inter">
                <span className="text-[#8090A0]">simulation@strive.ev</span> / strive2024
              </div>
              <div className="text-[#6080A0] text-xs font-inter">
                <span className="text-[#8090A0]">car1@strive.ev</span> / rover2024
              </div>
            </div>
          </div>
        </motion.div>

        {/* Access cards */}
        <div className="space-y-4">
          {accounts.map((acct, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + i * 0.1 }}
              onClick={() => handlePreset(i)}
              className="login-card glass-card p-5 cursor-pointer"
              style={{
                borderColor: selectedPreset === i ? `${acct.color}60` : `${acct.color}20`,
                boxShadow: selectedPreset === i ? `0 0 20px ${acct.color}20` : 'none',
              }}
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl">{acct.icon}</span>
                <div>
                  <div className="heading-orbitron text-xs font-bold" style={{ color: acct.color }}>
                    {acct.role}
                  </div>
                  <div className="text-[#506070] text-[10px] font-inter">{acct.email}</div>
                </div>
                {selectedPreset === i && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="ml-auto w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-[#060F1F]"
                    style={{ background: acct.color }}
                  >
                    ✓
                  </motion.div>
                )}
              </div>
              <p className="text-[#6080A0] text-xs font-inter mb-3">{acct.description}</p>
              <div className="grid grid-cols-2 gap-1.5">
                {acct.features.map((f, fi) => (
                  <div key={fi} className="flex items-center gap-1.5 text-[10px] text-[#506070] font-inter">
                    <div className="w-1 h-1 rounded-full shrink-0" style={{ background: acct.color }} />
                    {f}
                  </div>
                ))}
              </div>
              <div className="mt-3 text-[10px] heading-orbitron tracking-widest text-center py-1 rounded"
                style={{ background: `${acct.color}10`, color: acct.color }}>
                CLICK TO AUTO-FILL
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}
