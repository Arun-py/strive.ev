'use client'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  RadialLinearScale,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { Line, Bar } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  RadialLinearScale,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

ChartJS.defaults.color = '#6080A0'
ChartJS.defaults.borderColor = 'rgba(0,255,166,0.06)'

// Base chart options
export const baseLineOptions = (title: string, unit: string = '', lm = false) => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 0 },
  plugins: {
    legend: { display: false },
    title: {
      display: true,
      text: title,
      color: lm ? '#374151' : '#8090A0',
      font: { family: 'Orbitron', size: 10 },
      padding: { bottom: 8 },
    },
    tooltip: {
      backgroundColor: lm ? '#1E293B' : '#0B1D3A',
      borderColor: lm ? '#CBD5E1' : '#00FFA630',
      borderWidth: 1,
      titleFont: { family: 'Orbitron', size: 9 },
      bodyFont: { family: 'Inter', size: 10 },
    },
  },
  scales: {
    x: {
      grid: { color: lm ? '#F1F5F9' : 'rgba(0,255,166,0.04)' },
      ticks: { color: lm ? '#6B7280' : '#405060', font: { size: 8 }, maxRotation: 0, maxTicksLimit: 8 },
    },
    y: {
      grid: { color: lm ? '#F1F5F9' : 'rgba(0,255,166,0.04)' },
      ticks: { color: lm ? '#6B7280' : '#405060', font: { size: 8 } },
      title: {
        display: !!unit,
        text: unit,
        color: lm ? '#6B7280' : '#405060',
        font: { size: 8 },
      },
    },
  },
})

export const baseBarOptions = (title: string, unit: string = '', lm = false) => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 100 },
  plugins: {
    legend: { display: false },
    title: {
      display: true,
      text: title,
      color: lm ? '#374151' : '#8090A0',
      font: { family: 'Orbitron', size: 10 },
      padding: { bottom: 8 },
    },
    tooltip: {
      backgroundColor: lm ? '#1E293B' : '#0B1D3A',
      borderColor: lm ? '#CBD5E1' : '#FF7A0030',
      borderWidth: 1,
      titleFont: { family: 'Orbitron', size: 9 },
      bodyFont: { family: 'Inter', size: 10 },
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { color: lm ? '#6B7280' : '#405060', font: { size: 7 }, maxRotation: 0, maxTicksLimit: 12 },
    },
    y: {
      grid: { color: lm ? '#F1F5F9' : 'rgba(255,122,0,0.04)' },
      ticks: { color: lm ? '#6B7280' : '#405060', font: { size: 8 } },
      title: {
        display: !!unit,
        text: unit,
        color: lm ? '#6B7280' : '#405060',
        font: { size: 8 },
      },
    },
  },
})

// Vibration line chart
export function VibrationChart({ 
  labels, datasets, lightMode = false
}: { 
  labels: string[]
  datasets: { label: string; data: number[]; color: string }[]
  lightMode?: boolean
}) {
  return (
    <Line
      data={{
        labels,
        datasets: datasets.map(d => ({
          label: d.label,
          data: d.data,
          borderColor: d.color,
          backgroundColor: d.color + '15',
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0.4,
          fill: true,
        })),
      }}
      options={{
        ...baseLineOptions('VIBRATION AMPLITUDE', 'm/s²', lightMode),
        plugins: {
          ...baseLineOptions('VIBRATION AMPLITUDE', 'm/s²', lightMode).plugins,
          legend: {
            display: true,
            labels: {
              color: lightMode ? '#475569' : '#6080A0',
              font: { size: 9, family: 'Orbitron' },
              boxWidth: 12,
            },
          },
        },
      }}
    />
  )
}

// Frequency spectrum bar chart
export function FrequencyChart({ 
  labels, data, color = '#FF7A00', lightMode = false
}: { 
  labels: string[]
  data: number[]
  color?: string
  lightMode?: boolean
}) {
  const barColor = lightMode ? '#EA580C' : color
  return (
    <Bar
      data={{
        labels,
        datasets: [{
          label: 'Amplitude',
          data,
          backgroundColor: labels.map((_, i) => {
            const val = data[i] || 0
            const maxVal = Math.max(...data)
            const ratio = val / maxVal
            if (ratio > 0.8) return lightMode ? '#EF444480' : '#FF3B3B80'
            if (ratio > 0.5) return barColor + '90'
            return barColor + '50'
          }),
          borderColor: barColor + '80',
          borderWidth: 0.5,
        }],
      }}
      options={baseBarOptions('FREQUENCY SPECTRUM (FFT)', 'amplitude', lightMode)}
    />
  )
}

// Single line chart
export function SingleLineChart({ 
  title, labels, data, color, unit, yMin, yMax, lightMode = false
}: { 
  title: string
  labels: string[]
  data: number[]
  color: string
  unit?: string
  yMin?: number
  yMax?: number
  lightMode?: boolean
}) {
  const opts: any = {
    ...baseLineOptions(title, unit, lightMode),
  }
  if (yMin !== undefined || yMax !== undefined) {
    opts.scales.y.min = yMin
    opts.scales.y.max = yMax
  }

  return (
    <Line
      data={{
        labels,
        datasets: [{
          data,
          borderColor: color,
          backgroundColor: lightMode ? color + '18' : color + '10',
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0.3,
          fill: true,
        }],
      }}
      options={opts}
    />
  )
}

// Voltage vs Frequency chart — peaks at mechanical resonance
export function VoltageFrequencyChart({ resonanceHz = 82, lightMode = false }: { resonanceHz?: number; lightMode?: boolean }) {
  const freqs = Array.from({ length: 80 }, (_, i) => 10 + i * 7)
  const voltages = freqs.map(f => {
    const Q = 18
    const ratio = f / resonanceHz
    const response = 1 / Math.sqrt(Math.pow(1 - ratio * ratio, 2) + Math.pow(ratio / Q, 2))
    return Math.min(20, response * 6.5 + 0.4)
  })
  return (
    <Line
      data={{
        labels: freqs.map(f => `${f}`),
        datasets: [{
          label: 'Voltage (V)',
          data: voltages,
          borderColor: '#AA44FF',
          backgroundColor: 'rgba(170,68,255,0.08)',
          borderWidth: 1.8,
          pointRadius: 0,
          tension: 0.4,
          fill: true,
        }],
      }}
      options={{
        ...baseLineOptions(`VOLTAGE vs FREQUENCY  (res. ≈${resonanceHz} Hz)`, 'V'),
        plugins: {
          legend: { display: false },
          title: {
            display: true,
            text: `VOLTAGE vs FREQUENCY  (res. ≈${resonanceHz} Hz)`,
            color: '#8090A0',
            font: { family: 'Orbitron', size: 10 },
            padding: { bottom: 8 },
          },
          tooltip: {
            backgroundColor: '#0B1D3A',
            borderColor: '#AA44FF30',
            borderWidth: 1,
            titleFont: { family: 'Orbitron', size: 9 },
            bodyFont: { family: 'Inter', size: 10 },
          },
        },
        scales: {
          x: {
            grid: { color: 'rgba(170,68,255,0.05)' },
            ticks: { color: '#405060', font: { size: 8 }, maxTicksLimit: 10 },
            title: { display: true, text: 'Frequency (Hz)', color: '#405060', font: { size: 8 } },
          },
          y: {
            grid: { color: 'rgba(170,68,255,0.05)' },
            ticks: { color: '#405060', font: { size: 8 } },
            title: { display: true, text: 'Voltage (V)', color: '#405060', font: { size: 8 } },
          },
        },
      }}
    />
  )
}

// Power vs Load Resistance — max transfer near 610 kΩ
export function PowerLoadChart({ lightMode = false }: { lightMode?: boolean }) {
  const loads = Array.from({ length: 60 }, (_, i) => 50 + i * 30)   // kΩ  50 – 1820
  const powers = loads.map(R => {
    const Voc = 14.8          // open-circuit voltage (V)
    const Ri  = 610           // internal impedance kΩ
    return (Voc * Voc * R) / Math.pow(R + Ri, 2) * 1000  // µW → scale to readable
  })
  const maxP = Math.max(...powers)
  const scaled = powers.map(p => (p / maxP) * 3.85)   // normalise to ~3.85 mW peak
  const tc = lightMode ? '#6B7280' : '#405060'
  const gc = lightMode ? '#F1F5F9' : 'rgba(255,214,0,0.04)'
  const lineColor = lightMode ? '#D97706' : '#FFD600'
  return (
    <Line
      data={{
        labels: loads.map(r => `${r}`),
        datasets: [{
          label: 'Power (mW)',
          data: scaled,
          borderColor: lineColor,
          backgroundColor: lightMode ? 'rgba(217,119,6,0.08)' : 'rgba(255,214,0,0.07)',
          borderWidth: 1.8,
          pointRadius: 0,
          tension: 0.4,
          fill: true,
        }],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 0 },
        plugins: {
          legend: { display: false },
          title: {
            display: true,
            text: 'POWER OUTPUT vs LOAD RESISTANCE  (peak ≈ 610 kΩ)',
            color: lightMode ? '#374151' : '#8090A0',
            font: { family: 'Orbitron', size: 10 },
            padding: { bottom: 8 },
          },
          tooltip: {
            backgroundColor: lightMode ? '#1E293B' : '#0B1D3A',
            borderColor: lightMode ? '#CBD5E1' : '#FFD60030',
            borderWidth: 1,
            titleFont: { family: 'Orbitron', size: 9 },
            bodyFont: { family: 'Inter', size: 10 },
          },
        },
        scales: {
          x: { grid: { color: gc }, ticks: { color: tc, font: { size: 8 }, maxTicksLimit: 10 }, title: { display: true, text: 'Load Resistance (kΩ)', color: tc, font: { size: 8 } } },
          y: { grid: { color: gc }, ticks: { color: tc, font: { size: 8 } }, title: { display: true, text: 'Power (mW)', color: tc, font: { size: 8 } } },
        },
      }}
    />
  )
}

// Output voltage waveform — rectified+boosted VDBC vs raw AC input
export function OutputWaveformChart({ phase = 0, lightMode = false }: { phase?: number; lightMode?: boolean }) {
  const n = 80
  const t = Array.from({ length: n }, (_, i) => i)
  const ac = t.map(i => (8.2 * Math.sin(2 * Math.PI * i / 20 + phase)).toFixed(3)).map(Number)
  const rect = t.map(i => {
    const raw = Math.abs(8.2 * Math.sin(2 * Math.PI * i / 20 + phase))
    return parseFloat((raw * 1.72 + 0.3).toFixed(3))   // boosted by VDBC ~×1.72
  })
  const tc = lightMode ? '#6B7280' : '#405060'
  const gc = lightMode ? '#F1F5F9' : 'rgba(0,255,166,0.04)'
  const acColor = lightMode ? '#2563EB' : '#0099FF'
  const rectColor = lightMode ? '#059669' : '#00FFA6'
  return (
    <Line
      data={{
        labels: t.map(i => `${(i * 0.5).toFixed(1)}`),
        datasets: [
          {
            label: 'AC Input',
            data: ac,
            borderColor: acColor,
            backgroundColor: lightMode ? 'rgba(37,99,235,0.05)' : 'rgba(0,153,255,0.05)',
            borderWidth: 1.5,
            pointRadius: 0,
            tension: 0.4,
            fill: false,
            borderDash: [4, 3],
          },
          {
            label: 'Rectified + Boosted (VDBC)',
            data: rect,
            borderColor: rectColor,
            backgroundColor: lightMode ? 'rgba(5,150,105,0.08)' : 'rgba(0,255,166,0.07)',
            borderWidth: 1.8,
            pointRadius: 0,
            tension: 0.4,
            fill: true,
          },
        ],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 0 },
        plugins: {
          legend: {
            display: true,
            labels: { color: lightMode ? '#475569' : '#6080A0', font: { size: 9, family: 'Orbitron' }, boxWidth: 12 },
          },
          title: {
            display: true,
            text: 'OUTPUT VOLTAGE WAVEFORM (VDBC)',
            color: lightMode ? '#374151' : '#8090A0',
            font: { family: 'Orbitron', size: 10 },
            padding: { bottom: 8 },
          },
          tooltip: {
            backgroundColor: lightMode ? '#1E293B' : '#0B1D3A',
            borderColor: lightMode ? '#CBD5E1' : '#00FFA630',
            borderWidth: 1,
            titleFont: { family: 'Orbitron', size: 9 },
            bodyFont: { family: 'Inter', size: 10 },
          },
        },
        scales: {
          x: { grid: { color: gc }, ticks: { color: tc, font: { size: 8 }, maxTicksLimit: 10 }, title: { display: true, text: 'Time (ms)', color: tc, font: { size: 8 } } },
          y: { grid: { color: gc }, ticks: { color: tc, font: { size: 8 } }, title: { display: true, text: 'Voltage (V)', color: tc, font: { size: 8 } } },
        },
      }}
    />
  )
}

// Noise spectral density — frequency-dependent profile
export function NoiseSpectralDensityChart({ lightMode = false }: { lightMode?: boolean }) {
  const freqs = Array.from({ length: 70 }, (_, i) => 1 + i * 7)
  const noise = freqs.map(f => {
    const flicker = 28 / f          // 1/f flicker noise dominant at low freq
    const thermal = 4.5             // flat thermal noise floor (nV/√Hz)
    const highF   = 0.0004 * f * f // noise rise at high frequencies
    return parseFloat((flicker + thermal + highF).toFixed(3))
  })
  const tc = lightMode ? '#6B7280' : '#405060'
  const gc = lightMode ? '#F1F5F9' : 'rgba(255,122,0,0.04)'
  const lineColor = lightMode ? '#C2410C' : '#FF7A00'
  return (
    <Line
      data={{
        labels: freqs.map(f => `${f}`),
        datasets: [{
          label: 'nV/√Hz',
          data: noise,
          borderColor: lineColor,
          backgroundColor: lightMode ? 'rgba(194,65,12,0.07)' : 'rgba(255,122,0,0.07)',
          borderWidth: 1.8,
          pointRadius: 0,
          tension: 0.3,
          fill: true,
        }],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 0 },
        plugins: {
          legend: { display: false },
          title: {
            display: true,
            text: 'NOISE SPECTRAL DENSITY',
            color: lightMode ? '#374151' : '#8090A0',
            font: { family: 'Orbitron', size: 10 },
            padding: { bottom: 8 },
          },
          tooltip: {
            backgroundColor: lightMode ? '#1E293B' : '#0B1D3A',
            borderColor: lightMode ? '#CBD5E1' : '#FF7A0030',
            borderWidth: 1,
            titleFont: { family: 'Orbitron', size: 9 },
            bodyFont: { family: 'Inter', size: 10 },
          },
        },
        scales: {
          x: { grid: { color: gc }, ticks: { color: tc, font: { size: 8 }, maxTicksLimit: 10 }, title: { display: true, text: 'Frequency (Hz)', color: tc, font: { size: 8 } } },
          y: { grid: { color: gc }, ticks: { color: tc, font: { size: 8 } }, title: { display: true, text: 'nV/√Hz', color: tc, font: { size: 8 } } },
        },
      }}
    />
  )
}

// Charge amplifier output waveform
export function ChargeAmplifierChart({ phase = 0, lightMode = false }: { phase?: number; lightMode?: boolean }) {
  const n = 80
  const t = Array.from({ length: n }, (_, i) => i)
  const signal = t.map(i => {
    const base = 1.4 * Math.sin(2 * Math.PI * i / 18 + phase)
    const h2   = 0.18 * Math.sin(4 * Math.PI * i / 18 + phase)
    const noise = (Math.random() - 0.5) * 0.06
    return parseFloat((base + h2 + noise).toFixed(4))
  })
  const tc = lightMode ? '#6B7280' : '#405060'
  const gc = lightMode ? '#F1F5F9' : 'rgba(255,59,59,0.04)'
  const lineColor = lightMode ? '#DC2626' : '#FF3B3B'
  return (
    <Line
      data={{
        labels: t.map(i => `${(i * 0.5).toFixed(1)}`),
        datasets: [{
          label: 'Amp Output (V)',
          data: signal,
          borderColor: lineColor,
          backgroundColor: lightMode ? 'rgba(220,38,38,0.07)' : 'rgba(255,59,59,0.07)',
          borderWidth: 1.8,
          pointRadius: 0,
          tension: 0.4,
          fill: true,
        }],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 0 },
        plugins: {
          legend: { display: false },
          title: {
            display: true,
            text: 'CHARGE AMPLIFIER OUTPUT WAVEFORM',
            color: lightMode ? '#374151' : '#8090A0',
            font: { family: 'Orbitron', size: 10 },
            padding: { bottom: 8 },
          },
          tooltip: {
            backgroundColor: lightMode ? '#1E293B' : '#0B1D3A',
            borderColor: lightMode ? '#CBD5E1' : '#FF3B3B30',
            borderWidth: 1,
            titleFont: { family: 'Orbitron', size: 9 },
            bodyFont: { family: 'Inter', size: 10 },
          },
        },
        scales: {
          x: { grid: { color: gc }, ticks: { color: tc, font: { size: 8 }, maxTicksLimit: 10 }, title: { display: true, text: 'Time (ms)', color: tc, font: { size: 8 } } },
          y: { grid: { color: gc }, ticks: { color: tc, font: { size: 8 } }, title: { display: true, text: 'Voltage (V)', color: tc, font: { size: 8 } } },
        },
      }}
    />
  )
}

export { Line, Bar }
