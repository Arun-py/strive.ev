import { NextResponse } from 'next/server'
import mongoose from 'mongoose'

// GET /api/health - Health check endpoint
export async function GET() {
  const mongoStatus = mongoose.connection.readyState
  const statusMap: Record<number, string> = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  }
  
  return NextResponse.json({
    status: 'STRIVE-EV Backend Online',
    timestamp: new Date().toISOString(),
    mongodb: statusMap[mongoStatus] || 'unknown',
    version: '1.0.0',
    endpoints: [
      'GET /api/health',
      'GET /api/car1/data',
      'POST /api/car1/data',
      'GET /api/car1/latest',
    ],
  })
}
