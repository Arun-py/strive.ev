import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import SensorData from '@/lib/models/SensorData'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// POST /api/car1/data - Receive data from ESP32
export async function POST(request: NextRequest) {
  try {
    await connectDB()
    
    const body = await request.json()
    
    // Create new sensor data entry
    const sensorData = new SensorData({
      ...body,
      source: 'esp32',
      time: new Date().toISOString(),
    })
    
    await sensorData.save()
    
    return NextResponse.json({
      success: true,
      id: sensorData._id,
      message: 'Data received successfully',
    })
  } catch (error) {
    console.error('Error saving sensor data:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to save sensor data' },
      { status: 500 }
    )
  }
}

// GET /api/car1/data - Get recent sensor data
export async function GET(request: NextRequest) {
  try {
    await connectDB()
    
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    
    const data = await SensorData.find({ source: 'esp32' })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()
    
    return NextResponse.json({
      success: true,
      data: data.reverse(),
    })
  } catch (error) {
    console.error('Error fetching sensor data:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch sensor data' },
      { status: 500 }
    )
  }
}
