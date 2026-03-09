'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'

const navLinks = [
  { href: '/', label: 'HOME' },
  { href: '/research', label: 'RESEARCH BACKINGS' },
  { href: '/login', label: 'LOGIN' },
]


export default function Navbar() {
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [time, setTime] = useState('')

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('en-IN', { hour12: false }))
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-[#060F1F]/95 backdrop-blur-md border-b border-[#00FFA620]' : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3">
          <div className="relative w-9 h-9">
            <div className="absolute inset-0 rounded-full border-2 border-[#00FFA6] animate-spin" style={{ animationDuration: '8s' }} />
            <div className="absolute inset-1 rounded-full border border-[#FF7A00]/50" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-2 h-2 bg-[#00FFA6] rounded-full" style={{ boxShadow: '0 0 8px #00FFA6' }} />
            </div>
          </div>
          <div>
            <div className="heading-orbitron text-[#00FFA6] text-sm font-bold tracking-widest glow-text-green">
              STRIVE-EV
            </div>
            <div className="text-[#8090A0] text-[9px] font-inter tracking-wider">Sense • Harvest • Protect.</div>
          </div>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              <div className={`px-4 py-1.5 rounded-md heading-orbitron text-xs tracking-widest transition-all duration-200 ${
                pathname === link.href
                  ? 'text-[#00FFA6] bg-[#00FFA610] border border-[#00FFA630]'
                  : 'text-[#8090A0] hover:text-[#00FFA6] hover:bg-[#00FFA608]'
              }`}>
                {link.label}
              </div>
            </Link>
          ))}

        </div>

        {/* Right side */}
        <div className="hidden md:flex items-center gap-4">
          <div className="text-[#00FFA6] heading-orbitron text-xs" style={{ textShadow: '0 0 8px #00FFA680' }}>
            {time} IST
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-[#00FFA6] animate-pulse" style={{ boxShadow: '0 0 6px #00FFA6' }} />
            <span className="text-[#00FFA6] text-xs font-inter">LIVE</span>
          </div>
        </div>

        {/* Hamburger */}
        <button
          className="md:hidden text-[#00FFA6] p-2"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <div className="w-5 h-0.5 bg-current mb-1 transition-all" style={{ transform: menuOpen ? 'rotate(45deg) translateY(6px)' : '' }} />
          <div className="w-5 h-0.5 bg-current mb-1 transition-all" style={{ opacity: menuOpen ? 0 : 1 }} />
          <div className="w-5 h-0.5 bg-current transition-all" style={{ transform: menuOpen ? 'rotate(-45deg) translateY(-6px)' : '' }} />
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-[#060F1F]/98 border-b border-[#00FFA620] px-4 pb-4"
          >
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href} onClick={() => setMenuOpen(false)}>
                <div className="py-3 heading-orbitron text-xs text-[#8090A0] hover:text-[#00FFA6] tracking-widest border-b border-[#ffffff08]">
                  {link.label}
                </div>
              </Link>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  )
}
