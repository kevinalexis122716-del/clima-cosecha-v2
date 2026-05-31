import { NextResponse } from 'next/server'

const TOMORROW_KEY = process.env.TOMORROW_API_KEY

const cache: Record<string, { data: unknown; ts: number }> = {}
const CACHE_TTL = 900000 // 15 minutos en milisegundos (15 * 60 * 1000)

function getCache(key: string) {
  const entry = cache[key]
  if (!entry) return null
  if (Date.now() - entry.ts > CACHE_TTL) return null
  return entry.data
}
function setCache(key: string, data: unknown) {
  cache[key] = { data, ts: Date.now() }
}

// 1. Horario 24h para el Dashboard Principal
async function getHorarioOpenMeteo(lat: number, lng: number) {
  const cacheKey = `openmeteo-pronostico-v2-${lat}-${lng}` // Forzado v2 para limpiar memoria vieja
  const cached = getCache(cacheKey)
  if (cached) return cached as Record<string, number | string>[]

  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
      `&hourly=temperature_2m,precipitation_probability,precipitation,wind_speed_10m,relative_humidity_2m` +
      `&wind_speed_unit=kmh&timezone=America%2FBogota&forecast_days=3`,
      { next: { revalidate: 900 } } // Revalidar cada 15 minutos
    )
    if (!res.ok) return null
    const data = await res.json()

    const now = Date.now()
    let startIndex = data.hourly.time.findIndex((t: string) => {
      const timeMs = new Date(t + "-05:00").getTime()
      return timeMs >= now - 3600000
    })
    if (startIndex === -1) startIndex = 0

    const resultado = data.hourly.time.slice(startIndex, startIndex + 24).map((t: string, i: number) => {
      const idx = startIndex + i
      return {
        hora: t,
        temp: Math.round(data.hourly.temperature_2m[idx] * 10) / 10,
        precipitacion: parseFloat((data.hourly.precipitation[idx] ?? 0).toFixed(2)),
        probabilidad: data.hourly.precipitation_probability[idx] ?? 0,
        humedad: Math.round(data.hourly.relative_humidity_2m[idx]),
        viento: Math.round(data.hourly.wind_speed_10m[idx] * 10) / 10,
      }
    })
    setCache(cacheKey, resultado)
    return resultado
  } catch { return null }
}

// 2. Horario Tomorrow para fusionar datos secundarios
async function getHorarioTomorrow(lat: number, lng: number) {
  const cacheKey = `tomorrow-pronostico-v2-${lat}-${lng}` // Forzado v2
  const cached = getCache(cacheKey)
  if (cached) return cached as Record<string, number | string>[]

  try {
    const res = await fetch(
      `https://api.tomorrow.io/v4/weather/forecast?location=${lat},${lng}&apikey=${TOMORROW_KEY}&units=metric&timesteps=1h`,
      { next: { revalidate: 900 } } // Revalidar cada 15 minutos
    )
    if (!res.ok) return null
    const data = await res.json()
    const resultado = data.timelines.hourly.slice(0, 48).map((h: { time: string; values: Record<string, number> }) => ({
      hora: h.time,
      temp: Math.round(h.values.temperature * 10) / 10,
      humedad: Math.round(h.values.humidity),
      viento: Math.round(h.values.windSpeed * 10) / 10,
    }))
    setCache(cacheKey, resultado)
    return resultado
  } catch { return null }
}

// 3. Horario 5 DÍAS COMPLETOS (Para gráficas de toda la semana)
async function getHorarioPorDia(lat: number, lng: number) {
  const cacheKey = `openmeteo-horario-dias-v2-${lat}-${lng}` // ¡ACTUALIZADO v2! Fuerza descarga limpia de 5 días
  const cached = getCache(cacheKey)
  if (cached) return cached

  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
      `&hourly=temperature_2m,precipitation,precipitation_probability,relative_humidity_2m,wind_speed_10m` +
      `&wind_speed_unit=kmh&timezone=America%2FBogota&forecast_days=5`,
      { next: { revalidate: 900 } } // Revalidar cada 15 minutos
    )
    if (!res.ok) return null
    const data = await res.json()

    const porFecha: Record<string, any[]> = {}

    data.hourly.time.forEach((t: string, i: number) => {
      const fecha = t.slice(0, 10)
      if (!porFecha[fecha]) porFecha[fecha] = []
      porFecha[fecha].push({
        hora: t,
        temp: Math.round(data.hourly.temperature_2m[i] * 10) / 10,
        precipitacion: parseFloat((data.hourly.precipitation[i] ?? 0).toFixed(2)),
        probabilidad: data.hourly.precipitation_probability[i] ?? 0,
        humedad: Math.round(data.hourly.relative_humidity_2m[i]),
        viento: Math.round(data.hourly.wind_speed_10m[i] * 10) / 10,
      })
    })

    setCache(cacheKey, porFecha)
    return porFecha
  } catch { return null }
}

// 4. Resumen Diario 5 días
async function getDiarioOpenMeteo(lat: number, lng: number) {
  const cacheKey = `openmeteo-diario-v2-${lat}-${lng}` // Forzado v2
  const cached = getCache(cacheKey)
  if (cached) return cached as Record<string, number | string>[]

  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
      `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,relative_humidity_2m_max` +
      `&wind_speed_unit=kmh&timezone=America%2FBogota&forecast_days=5`,
      { next: { revalidate: 900 } } // Revalidar cada 15 minutos
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

  const [openmeteo, tomorrow, diario, horarioPorDia] = await Promise.all([
    getHorarioOpenMeteo(lat, lng),
    getHorarioTomorrow(lat, lng),
    getDiarioOpenMeteo(lat, lng),
    getHorarioPorDia(lat, lng),
  ])

  if (!openmeteo) {
    return NextResponse.json({ error: 'Pronóstico no disponible' }, { status: 500 })
  }

  const horarioFinal = openmeteo.map((om: Record<string, number | string>) => {
    const omTime = new Date(om.hora + "-05:00").getTime();
    const tw = tomorrow?.find((t: Record<string, number | string>) => new Date(t.hora as string).getTime() === omTime);

    return {
      hora: om.hora,
      precipitacion: om.precipitacion,
      probabilidad: om.probabilidad,
      temp: tw ? parseFloat((((Number(om.temp) + Number(tw.temp)) / 2)).toFixed(1)) : om.temp,
      humedad: tw ? Math.round((Number(om.humedad) + Number(tw.humedad)) / 2) : om.humedad,
      viento: tw ? parseFloat((((Number(om.viento) + Number(tw.viento)) / 2)).toFixed(1)) : om.viento,
    }
  })

  return NextResponse.json({
    horario: horarioFinal,
    diario: diario || [],
    horarioPorDia: horarioPorDia || {},
    fuentes: { openmeteo: 'ok', tomorrow: tomorrow ? 'ok' : 'error' },
    timestamp: new Date().toISOString(),
  })
}
