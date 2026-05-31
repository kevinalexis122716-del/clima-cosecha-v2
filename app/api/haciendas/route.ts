import { NextResponse } from 'next/server'
import { list } from '@vercel/blob'

export async function GET() {
  try {
    const { blobs } = await list({ prefix: 'haciendas' })
    if (blobs.length === 0) return NextResponse.json([])

    const res = await fetch(blobs[0].url, { next: { revalidate: 0 } })
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json([])
  }
}
