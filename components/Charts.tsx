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
export const baseLineOptions = (title: string, unit: string = '') => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 0 },
  plugins: {
    legend: { display: false },
    title: {
      display: true,
      text: title,
      color: '#8090A0',
      font: { family: 'Orbitron', size: 10 },
      padding: { bottom: 8 },
    },
    tooltip: {
      backgroundColor: '#0B1D3A',
      borderColor: '#00FFA630',
      borderWidth: 1,
      titleFont: { family: 'Orbitron', size: 9 },
      bodyFont: { family: 'Inter', size: 10 },
    },
  },
  scales: {
    x: {
      grid: { color: 'rgba(0,255,166,0.04)' },
      ticks: { color: '#405060', font: { size: 8 }, maxRotation: 0, maxTicksLimit: 8 },
    },
    y: {
      grid: { color: 'rgba(0,255,166,0.04)' },
      ticks: { color: '#405060', font: { size: 8 } },
      title: {
        display: !!unit,
        text: unit,
        color: '#405060',
        font: { size: 8 },
      },
    },
  },
})

export const baseBarOptions = (title: string, unit: string = '') => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 100 },
  plugins: {
    legend: { display: false },
    title: {
      display: true,
      text: title,
      color: '#8090A0',
      font: { family: 'Orbitron', size: 10 },
      padding: { bottom: 8 },
    },
    tooltip: {
      backgroundColor: '#0B1D3A',
      borderColor: '#FF7A0030',
      borderWidth: 1,
      titleFont: { family: 'Orbitron', size: 9 },
      bodyFont: { family: 'Inter', size: 10 },
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { color: '#405060', font: { size: 7 }, maxRotation: 0, maxTicksLimit: 12 },
    },
    y: {
      grid: { color: 'rgba(255,122,0,0.04)' },
      ticks: { color: '#405060', font: { size: 8 } },
      title: {
        display: !!unit,
        text: unit,
        color: '#405060',
        font: { size: 8 },
      },
    },
  },
})

// Vibration line chart
export function VibrationChart({ 
  labels, datasets 
}: { 
  labels: string[]
  datasets: { label: string; data: number[]; color: string }[]
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
        ...baseLineOptions('VIBRATION AMPLITUDE', 'm/s²'),
        plugins: {
          ...baseLineOptions('VIBRATION AMPLITUDE', 'm/s²').plugins,
          legend: {
            display: true,
            labels: {
              color: '#6080A0',
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
  labels, data, color = '#FF7A00' 
}: { 
  labels: string[]
  data: number[]
  color?: string
}) {
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
            if (ratio > 0.8) return '#FF3B3B80'
            if (ratio > 0.5) return color + '80'
            return color + '40'
          }),
          borderColor: color + '60',
          borderWidth: 0.5,
        }],
      }}
      options={baseBarOptions('FREQUENCY SPECTRUM (FFT)', 'amplitude')}
    />
  )
}

// Single line chart
export function SingleLineChart({ 
  title, labels, data, color, unit, yMin, yMax 
}: { 
  title: string
  labels: string[]
  data: number[]
  color: string
  unit?: string
  yMin?: number
  yMax?: number
}) {
  const opts: any = {
    ...baseLineOptions(title, unit),
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
          backgroundColor: color + '10',
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

export { Line, Bar }
