import mongoose, { Schema, Document, Model } from 'mongoose'

export interface ISensorData extends Document {
  time: string
  vibration1: number
  vibration2: number
  vibration3: number
  vibration4: number
  temperature?: number
  humidity?: number
  distance: number
  battery_voltage: number
  piezo_energy: number
  piezo_voltage: number
  motor_freq?: number
  speed?: number
  health_status: 'NORMAL' | 'WARNING' | 'CRITICAL'
  condition: string
  source: 'esp32' | 'simulation'
  is_charging?: boolean
  motor_direction?: string
  createdAt: Date
  updatedAt: Date
}

const SensorDataSchema = new Schema<ISensorData>(
  {
    time: { type: String, default: () => new Date().toISOString() },
    vibration1: { type: Number, default: 0 },
    vibration2: { type: Number, default: 0 },
    vibration3: { type: Number, default: 0 },
    vibration4: { type: Number, default: 0 },
    temperature: { type: Number },
    humidity: { type: Number },
    distance: { type: Number, default: 0 },
    battery_voltage: { type: Number, default: 0 },
    piezo_energy: { type: Number, default: 0 },
    piezo_voltage: { type: Number, default: 0 },
    motor_freq: { type: Number },
    speed: { type: Number },
    health_status: {
      type: String,
      enum: ['NORMAL', 'WARNING', 'CRITICAL'],
      default: 'NORMAL',
    },
    condition: { type: String, default: 'NORMAL' },
    source: {
      type: String,
      enum: ['esp32', 'simulation'],
      default: 'esp32',
    },
    is_charging: { type: Boolean, default: false },
    motor_direction: { type: String, default: 'S' },
  },
  { timestamps: true }
)

// Check if model already exists to prevent OverwriteModelError in hot reload
const SensorData: Model<ISensorData> =
  mongoose.models.SensorData || mongoose.model<ISensorData>('SensorData', SensorDataSchema)

export default SensorData
