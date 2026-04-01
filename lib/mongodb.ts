import mongoose from 'mongoose'

const MONGODB_URI: string = process.env.MONGODB_URI || ''

if (!MONGODB_URI && typeof window === 'undefined') {
  console.warn('Warning: MONGODB_URI environment variable is not set')
}

interface MongooseCache {
  conn: typeof mongoose | null
  promise: Promise<typeof mongoose> | null
}

declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: MongooseCache
}

if (!global.mongooseCache) {
  global.mongooseCache = { conn: null, promise: null }
}

const cached = global.mongooseCache

export async function connectDB() {
  if (cached.conn) {
    return cached.conn
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    }
    cached.promise = mongoose.connect(MONGODB_URI, opts)
  }

  try {
    cached.conn = await cached.promise
  } catch (e) {
    cached.promise = null
    throw e
  }

  return cached.conn
}

export default connectDB
