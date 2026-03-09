import type { Metadata } from 'next'
import './globals.css'
import Navbar from '@/components/Navbar'
import ParticleBackground from '@/components/ParticleBackground'

export const metadata: Metadata = {
  title: 'STRIVE-EV | Sense • Harvest • Protect.',
  description: 'Structural Intelligence & Vibration Energy System for Electric Vehicles — Piezoelectric Energy Harvesting & Structural Health Monitoring',
  icons: {
    icon: '/favicon.ico',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen" style={{ background: 'linear-gradient(135deg, #060F1F 0%, #0B1D3A 50%, #071428 100%)' }}>
        <ParticleBackground />
        <Navbar />
        <main className="relative z-10">
          {children}
        </main>
      </body>
    </html>
  )
}
