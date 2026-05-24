import { NextResponse } from 'next/server'

const TOMORROW_KEY = process.env.TOMORROW_API_KEY

// Cache en memoria
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
      precipitacion: h.values.precipitationIntensity || 0,
      probabilidad: h.values.precipitationProbability || 0,
      humedad: Math.round(h.values.humidity),
      viento: Math.round(h.values.windSpeed * 10) / 10,
    }))
    setCache(cacheKey, resultado)
    return resultado
  } catch { return null }
}

async function getHorarioOpenMeteo(lat: number, lng: number) {
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=temperature_2m,precipitation_probability,precipitation,wind_speed_10m,relative_humidity_2m&wind_speed_unit=kmh&timezone=America%2FBogota&forecast_days=2`,
      { next: { revalidate: 1800 } }
    )
    if (!res.ok) return null
    const data = await res.json()
    return data.hourly.time.slice(0, 24).map((t: string, i: number) => ({
      hora: t,
      temp: Math.round(data.hourly.temperature_2m[i] * 10) / 10,
      precipitacion: data.hourly.precipitation[i] || 0,
      probabilidad: data.hourly.precipitation_probability[i] || 0,
      humedad: Math.round(data.hourly.relative_humidity_2m[i]),
      viento: Math.round(data.hourly.wind_speed_10m[i] * 10) / 10,
    }))
  } catch { return null }
}

async function getDiarioOpenMeteo(lat: number, lng: number) {
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,relative_humidity_2m_max&wind_speed_unit=kmh&timezone=America%2FBogota&forecast_days=7`,
      { next: { revalidate: 3600 } }
    )
    if (!res.ok) return null
    const data = await res.json()
    return data.daily.time.map((fecha: string, i: number) => ({
      fecha,
      tempMax: Math.round(data.daily.temperature_2m_max[i] * 10) / 10,
      tempMin: Math.round(data.daily.temperature_2m_min[i] * 10) / 10,
      precipitacion: data.daily.precipitation_sum[i] || 0,
      probabilidad: data.daily.precipitation_probability_max[i] || 0,
      viento: Math.round(data.daily.wind_speed_10m_max[i] * 10) / 10,
      humedad: Math.round(data.daily.relative_humidity_2m_max[i]),
    }))
  } catch { return null }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const lat = parseFloat(searchParams.get('lat') || '3.9038')
  const lng = parseFloat(searchParams.get('lng') || '-76.2982')

  const [tomorrow, openmeteo, diario] = await Promise.all([
    getHorarioTomorrow(lat, lng),
    getHorarioOpenMeteo(lat, lng),
    getDiarioOpenMeteo(lat, lng),
  ])

  const horario = tomorrow || openmeteo
  if (!horario) {
    return NextResponse.json({ error: 'Sin pronóstico disponible' }, { status: 500 })
  }

  const horarioFinal = horario.map((h: Record<string, number | string>, i: number) => {
    const om = openmeteo?.[i]
    const tw = tomorrow?.[i]
    const precip = tw && om
      ? parseFloat(((Number(tw.precipitacion) * 0.55) + (Number(om.precipitacion) * 0.45)).toFixed(2))
      : Number(h.precipitacion)
    return { ...h, precipitacion: precip }
  })

  return NextResponse.json({
    horario: horarioFinal,
    diario: diario || [],
    fuentes: {
      tomorrow: tomorrow ? 'ok' : 'error',
      openmeteo: openmeteo ? 'ok' : 'error',
    },
    timestamp: new Date().toISOString(),
  })
}