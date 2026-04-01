import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import SensorData from '@/lib/models/SensorData'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// GET /api/car1/latest - Get latest N sensor readings
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
      count: data.length,
      data: data.reverse(),
    })
  } catch (error) {
    console.error('Error fetching latest data:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch latest data' },
      { status: 500 }
    )
  }
}
