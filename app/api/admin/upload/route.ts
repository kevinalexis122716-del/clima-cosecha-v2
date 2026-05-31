import { NextResponse } from 'next/server'
import { put, del, list } from '@vercel/blob'

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  const expected = Buffer.from(
    `${process.env.ADMIN_USER}:${process.env.ADMIN_PASSWORD}`
  ).toString('base64')

  if (authHeader !== `Basic ${expected}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File
  if (!file) return NextResponse.json({ error: 'Sin archivo' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())

  // Borrar archivo anterior si existe
  const { blobs } = await list({ prefix: 'haciendas' })
  for (const blob of blobs) await del(blob.url)

  // Parsear Excel — columna C (HACIENDA - SUERTE), G (LAT), H (LONG)
  const rows: { nombre: string; lat: number; lng: number }[] = []
  const workbook = await parseExcel(buffer)
  for (const row of workbook) {
    const nombre = row[2] // columna C (índice 2)
    const lat = parseFloat(row[6])  // columna G (índice 6)
    const lng = parseFloat(row[7])  // columna H (índice 7)
    if (nombre && !isNaN(lat) && !isNaN(lng)) {
      rows.push({ nombre: String(nombre).trim(), lat, lng })
    }
  }

  const blob = await put('haciendas.json', JSON.stringify(rows), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
  })

  return NextResponse.json({ ok: true, total: rows.length, url: blob.url })
}

export async function DELETE(request: Request) {
  const authHeader = request.headers.get('authorization')
  const expected = Buffer.from(
    `${process.env.ADMIN_USER}:${process.env.ADMIN_PASSWORD}`
  ).toString('base64')

  if (authHeader !== `Basic ${expected}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { blobs } = await list({ prefix: 'haciendas' })
  for (const blob of blobs) await del(blob.url)
  return NextResponse.json({ ok: true })
}

async function parseExcel(buffer: Buffer): Promise<string[][]> {
  const XLSX = await import('xlsx')
  const wb = XLSX.read(buffer, { type: 'buffer' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as string[][]
  return data.slice(1) // saltar fila 1 de rótulos
}
