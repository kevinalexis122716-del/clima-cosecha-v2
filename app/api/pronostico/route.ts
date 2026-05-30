import { NextResponse } from 'next/server'

const TOMORROW_KEY = process.env.TOMORROW_API_KEY

// Cache en memoria compartido
const cache: Record<string, { data: unknown; ts: number }> = {}
const CACHE_TTL = 3600000 // 1 hora

function getCache(key: string) {
  const entry = cache[key]
  if (!entry) return null
  if (Date.now() - entry.ts > CACHE_TTL) return null
  return entry.data
}
function setCache(key: string, data: unknown) {
  cache[key] = { data, ts: Date.now() }
}

async function getHorarioOpenMeteo(lat: number, lng: number) {
  const cacheKey = `openmeteo-pronostico-${lat}-${lng}`
  const cached = getCache(cacheKey)
  if (cached) return cached as Record<string, number | string>[]

  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
      `&hourly=temperature_2m,precipitation_probability,precipitation,wind_speed_10m,relative_humidity_2m` +
      `&wind_speed_unit=kmh&timezone=America%2FBogota&forecast_days=2`,
      { next: { revalidate: 1800 } }
    )
    if (!res.ok) return null
    const data = await res.json()

    // Encontrar el índice de la hora actual en Colombia para empezar desde ahí
    const ahoraISO = new Date().toLocaleString('sv-SE', { timeZone: 'America/Bogota' }).slice(0, 13)
    const idxActual = data.hourly.time.findIndex((t: string) => t.slice(0, 13) === ahoraISO)
    const inicio = idxActual >= 0 ? idxActual : 0

    const resultado = data.hourly.time.slice(inicio, inicio + 24).map((t: string, i: number) => ({
      hora: t,
      temp: Math.round(data.hourly.temperature_2m[inicio + i] * 10) / 10,
      precipitacion: parseFloat((data.hourly.precipitation[inicio + i] ?? 0).toFixed(2)),
      probabilidad: data.hourly.precipitation_probability[inicio + i] ?? 0,
      humedad: Math.round(data.hourly.relative_humidity_2m[inicio + i]),
      viento: Math.round(data.hourly.wind_speed_10m[inicio + i] * 10) / 10,
    }))
    setCache(cacheKey, resultado)
    return resultado
  } catch { return null }
}

async function getHorarioTomorrow(lat: number, lng: number) {
  const cacheKey = `tomorrow-pronostico-${lat}-${lng}`
  const cached = getCache(cacheKey)
  if (cached) return cached as Record<string, number | string>[]

  try {
    const res = await fetch(
      `https://api.tomorrow.io/v4/weather/forecast?location=${lat},${lng}&apikey=${TOMORROW_KEY}&units=metric&timesteps=1h`,
      { next: { revalidate: 3600 } }
    )
    if (!res.ok) return null
    const data = await res.json()
    const resultado = data.timelines.hourly.slice(0, 24).map((h: { time: string; values: Record<string, number> }) => ({
      hora: h.time,
      temp: Math.round(h.values.temperature * 10) / 10,
      humedad: Math.round(h.values.humidity),
      viento: Math.round(h.values.windSpeed * 10) / 10,
    }))
    setCache(cacheKey, resultado)
    return resultado
  } catch { return null }
}

async function getDiarioOpenMeteo(lat: number, lng: number) {
  const cacheKey = `openmeteo-diario-${lat}-${lng}`
  const cached = getCache(cacheKey)
  if (cached) return cached as Record<string, number | string>[]

  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
      `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,relative_humidity_2m_max` +
      `&wind_speed_unit=kmh&timezone=America%2FBogota&forecast_days=7`,
      { next: { revalidate: 3600 } }
    )
    if (!res.ok) return null
    const data = await res.json()
    const resultado = data.daily.time.map((fecha: string, i: number) => ({
      fecha,
      tempMax: Math.round(data.daily.temperature_2m_max[i] * 10) / 10,
      tempMin: Math.round(data.daily.temperature_2m_min[i] * 10) / 10,
      precipitacion: parseFloat((data.daily.precipitation_sum[i] ?? 0).toFixed(2)),
      probabilidad: data.daily.precipitation_probability_max[i] ?? 0,
      viento: Math.round(data.daily.wind_speed_10m_max[i] * 10) / 10,
      humedad: Math.round(data.daily.relative_humidity_2m_max[i]),
    }))
    setCache(cacheKey, resultado)
    return resultado
  } catch { return null }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const lat = parseFloat(searchParams.get('lat') || '3.9038')
  const lng = parseFloat(searchParams.get('lng') || '-76.2982')

  const [openmeteo, tomorrow, diario] = await Promise.all([
    getHorarioOpenMeteo(lat, lng),
    getHorarioTomorrow(lat, lng),
    getDiarioOpenMeteo(lat, lng),
  ])

  if (!openmeteo) {
    return NextResponse.json({ error: 'Pronóstico no disponible — Open-Meteo sin respuesta' }, { status: 500 })
  }

  const horarioFinal = openmeteo.map((om: Record<string, number | string>, i: number) => {
    const tw = tomorrow?.[i]
    return {
      hora: om.hora,
      precipitacion: om.precipitacion,
      probabilidad: om.probabilidad,
      temp: tw
        ? parseFloat((((Number(om.temp) + Number(tw.temp)) / 2)).toFixed(1))
        : om.temp,
      humedad: tw
        ? Math.round((Number(om.humedad) + Number(tw.humedad)) / 2)
        : om.humedad,
      viento: tw
        ? parseFloat((((Number(om.viento) + Number(tw.viento)) / 2)).toFixed(1))
        : om.viento,
    }
  })

  return NextResponse.json({
    horario: horarioFinal,
    diario: diario || [],
    fuentes: {
      openmeteo: 'ok',
      tomorrow: tomorrow ? 'ok' : 'error',
    },
    timestamp: new Date().toISOString(),
  })
}
