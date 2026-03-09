const express = require('express')
const http = require('http')
const WebSocket = require('ws')
const cors = require('cors')
const mongoose = require('mongoose')
require('dotenv').config()

const app = express()
const server = http.createServer(app)
const wss = new WebSocket.Server({ server })

app.use(cors({ origin: '*' }))
app.use(express.json())

// ─── MongoDB Connection ───────────────────────────────────────────────────────
const MONGODB_URI = process.env.MONGODB_URI || 
  'mongodb+srv://Arun_db_user:fxkHhBcrdedLUBZu@cluster0.alzouxa.mongodb.net/strive-ev?retryWrites=true&w=majority&appName=Cluster0'

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB Atlas connected'))
  .catch(err => console.error('❌ MongoDB error:', err.message))

// ─── Schema & Model ───────────────────────────────────────────────────────────
const SensorDataSchema = new mongoose.Schema({
  time: { type: String, default: () => new Date().toISOString() },
  vibration1: Number,
  vibration2: Number,
  vibration3: Number,
  vibration4: Number,
  temperature: Number,
  humidity: Number,
  distance: Number,
  battery_voltage: Number,
  piezo_energy: Number,
  piezo_voltage: Number,
  motor_freq: Number,
  speed: Number,
  health_status: { type: String, enum: ['NORMAL', 'WARNING', 'CRITICAL'], default: 'NORMAL' },
  condition: { type: String, default: 'NORMAL' },
  source: { type: String, enum: ['esp32', 'simulation'], default: 'esp32' },
}, { timestamps: true })

const SensorData = mongoose.model('SensorData', SensorDataSchema)

// ─── REST API Routes ──────────────────────────────────────────────────────────

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'STRIVE-EV Backend Online', 
    time: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  })
})

// Get latest N readings from car1 (ESP32 data)
app.get('/api/car1/latest', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50
    const data = await SensorData.find({ source: 'esp32' })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()
    res.json({ success: true, data: data.reverse() })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// Post new sensor reading (from ESP32)
app.post('/api/car1/data', async (req, res) => {
  try {
    const doc = new SensorData({ ...req.body, source: 'esp32' })
    await doc.save()
    
    // Broadcast to all WebSocket clients
    const payload = JSON.stringify({ type: 'car1_data', data: doc.toObject() })
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload)
      }
    })
    
    res.json({ success: true, id: doc._id })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// Get historical data for charts (last 100 points)
app.get('/api/car1/history', async (req, res) => {
  try {
    const data = await SensorData.find({ source: 'esp32' })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean()
    res.json({ success: true, data: data.reverse() })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// Get simulation history
app.get('/api/simulation/history', async (req, res) => {
  try {
    const data = await SensorData.find({ source: 'simulation' })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean()
    res.json({ success: true, data: data.reverse() })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// Save simulation snapshot
app.post('/api/simulation/save', async (req, res) => {
  try {
    const doc = new SensorData({ ...req.body, source: 'simulation' })
    await doc.save()
    res.json({ success: true, id: doc._id })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// ─── WebSocket Handler ────────────────────────────────────────────────────────
wss.on('connection', (ws) => {
  console.log('🔌 WebSocket client connected')
  
  ws.send(JSON.stringify({ 
    type: 'welcome', 
    message: 'STRIVE-EV Real-Time Stream Connected',
    timestamp: new Date().toISOString()
  }))

  ws.on('message', async (raw) => {
    try {
      const msg = JSON.parse(raw.toString())
      
      if (msg.type === 'esp32_data') {
        // Store incoming ESP32 data
        const doc = new SensorData({ ...msg.data, source: 'esp32' })
        await doc.save()
        
        // Broadcast to all other clients
        const payload = JSON.stringify({ type: 'car1_update', data: doc.toObject() })
        wss.clients.forEach(client => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(payload)
          }
        })
      }
    } catch (err) {
      console.error('WS message error:', err.message)
    }
  })

  ws.on('close', () => console.log('🔌 WebSocket client disconnected'))
  ws.on('error', (err) => console.error('WS error:', err.message))
})

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000

server.listen(PORT, () => {
  console.log(`🚀 STRIVE-EV Backend running on http://localhost:${PORT}`)
  console.log(`🔌 WebSocket server ready on ws://localhost:${PORT}`)
  console.log(`📊 API endpoints:`)
  console.log(`   GET  /api/health`)
  console.log(`   GET  /api/car1/latest`)
  console.log(`   POST /api/car1/data`)
  console.log(`   GET  /api/car1/history`)
  console.log(`   GET  /api/simulation/history`)
  console.log(`   POST /api/simulation/save`)
})

module.exports = { app, server, SensorData }
