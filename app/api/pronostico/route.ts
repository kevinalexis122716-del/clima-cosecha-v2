import { NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'

const TOMORROW_KEY = process.env.TOMORROW_API_KEY

// ─────────────────────────────────────────────
// TOMORROW.IO — Primeras 5 horas (radar real)
// ─────────────────────────────────────────────
const getTomorrowForecast = async (lat: number, lng: number) => {
  return unstable_cache(
    async () => {
      try {
        if (!TOMORROW_KEY) return null
        const res = await fetch(
          `https://api.tomorrow.io/v4/weather/forecast?location=${lat},${lng}&apikey=${TOMORROW_KEY}&units=metric&timesteps=1h`
        )
        if (!res.ok) return null
        const data = await res.json()

        // Tomorrow devuelve data.timelines.hourly[]
        const hourly = data?.timelines?.hourly
        if (!hourly || !Array.isArray(hourly)) return null

        // Solo tomamos las próximas 5 horas
        return hourly.slice(0, 5).map((h: any) => {
          const v = h.values
          return {
            hora: h.time,                                      // ISO string
            temp: Math.round(v.temperature * 10) / 10,
            precipitacion: parseFloat((v.precipitationIntensity ?? 0).toFixed(2)), // mm/h real
            probabilidad: v.precipitationProbability ?? (v.precipitationIntensity > 0 ? 100 : 0),
            humedad: Math.round(v.humidity ?? 0),
            viento: Math.round((v.windSpeed ?? 0) * 3.6 * 10) / 10, // m/s → km/h
            fuente: 'tomorrow',
          }
        })
      } catch { return null }
    },
    [`pronostico-tomorrow-${lat}-${lng}`],
    { revalidate: 300 }
  )()
}

// ─────────────────────────────────────────────
// OPEN-METEO — Carrusel horario 24h completo
// ─────────────────────────────────────────────
const getHorarioOpenMeteo = async (lat: number, lng: number) => {
  return unstable_cache(
    async () => {
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
          `&hourly=temperature_2m,precipitation_probability,precipitation,wind_speed_10m,relative_humidity_2m` +
          `&wind_speed_unit=kmh&timezone=America%2FBogota&forecast_days=3`
        )
        if (!res.ok) return null
        const data = await res.json()

        const now = Date.now()
        let startIndex = data.hourly.time.findIndex((t: string) => {
          const timeMs = new Date(t + '-05:00').getTime()
          return timeMs >= now - 3600000
        })
        if (startIndex === -1) startIndex = 0

        return data.hourly.time.slice(startIndex, startIndex + 24).map((t: string, i: number) => {
          const idx = startIndex + i
          return {
            hora: t + ':00',                                   // Normalizar a ISO-like para comparar
            temp: Math.round(data.hourly.temperature_2m[idx] * 10) / 10,
            precipitacion: parseFloat((data.hourly.precipitation[idx] ?? 0).toFixed(2)),
            probabilidad: data.hourly.precipitation_probability[idx] ?? 0,
            humedad: Math.round(data.hourly.relative_humidity_2m[idx]),
            viento: Math.round(data.hourly.wind_speed_10m[idx] * 10) / 10,
            fuente: 'openmeteo',
          }
        })
      } catch { return null }
    },
    [`pronostico-horario-${lat}-${lng}`],
    { revalidate: 300 }
  )()
}

// ─────────────────────────────────────────────
// OPEN-METEO — Por día (sin cambios)
// ─────────────────────────────────────────────
const getHorarioPorDia = async (lat: number, lng: number) => {
  return unstable_cache(
    async () => {
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
          `&hourly=temperature_2m,precipitation,precipitation_probability,relative_humidity_2m,wind_speed_10m,surface_pressure` +
          `&wind_speed_unit=kmh&timezone=America%2FBogota&forecast_days=5`
        )
        if (!res.ok) return null
        const data = await res.json()

        const porFecha: Record<string, Record<string, number | string>[]> = {}
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
            presion: Math.round(data.hourly.surface_pressure[i] ?? 0),
          })
        })
        return porFecha
      } catch { return null }
    },
    [`pronostico-pordia-${lat}-${lng}`],
    { revalidate: 300 }
  )()
}

const getDiarioOpenMeteo = async (lat: number, lng: number) => {
  return unstable_cache(
    async () => {
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
          `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,relative_humidity_2m_max` +
          `&wind_speed_unit=kmh&timezone=America%2FBogota&forecast_days=5`
        )
        if (!res.ok) return null
        const data = await res.json()

        return data.daily.time.map((fecha: string, i: number) => ({
          fecha,
          tempMax: Math.round(data.daily.temperature_2m_max[i] * 10) / 10,
          tempMin: Math.round(data.daily.temperature_2m_min[i] * 10) / 10,
          precipitacion: parseFloat((data.daily.precipitation_sum[i] ?? 0).toFixed(2)),
          probabilidad: data.daily.precipitation_probability_max[i] ?? 0,
          viento: Math.round(data.daily.wind_speed_10m_max[i] * 10) / 10,
          humedad: Math.round(data.daily.relative_humidity_2m_max[i]),
        }))
      } catch { return null }
    },
    [`pronostico-diario-${lat}-${lng}`],
    { revalidate: 300 }
  )()
}

// ─────────────────────────────────────────────
// MERGE: Tomorrow (5h) + OpenMeteo (resto 24h)
// ─────────────────────────────────────────────
function mergeHorario(
  tomorrowHoras: any[] | null,
  openmeteoHoras: any[] | null
): any[] {
  // Si Tomorrow falla, usar solo OpenMeteo
  if (!tomorrowHoras || tomorrowHoras.length === 0) {
    return openmeteoHoras ?? []
  }

  // Extraer las horas cubiertas por Tomorrow (formato "2026-06-03T15:00:00Z" → "2026-06-03T15")
  const horasCubiertasPorTomorrow = new Set(
    tomorrowHoras.map(h => h.hora.slice(0, 13))
  )

  // Filtrar OpenMeteo: solo horas que Tomorrow NO cubre
  const openmeteoRestante = (openmeteoHoras ?? []).filter(h => {
    const horaKey = h.hora.slice(0, 13)
    return !horasCubiertasPorTomorrow.has(horaKey)
  })

  // Combinar: primero Tomorrow (ordenado), luego OpenMeteo
  const merged = [...tomorrowHoras, ...openmeteoRestante]

  // Ordenar por hora ascendente
  merged.sort((a, b) => new Date(a.hora).getTime() - new Date(b.hora).getTime())

  // Limitar a 24 entradas
  return merged.slice(0, 24)
}

// ─────────────────────────────────────────────
// Handler principal
// ─────────────────────────────────────────────
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const lat = parseFloat(searchParams.get('lat') || '3.9044')
  const lng = parseFloat(searchParams.get('lng') || '-76.2960')

  const [tomorrowForecast, horarioOpenMeteo, diario, horarioPorDia] = await Promise.all([
    getTomorrowForecast(lat, lng),
    getHorarioOpenMeteo(lat, lng),
    getDiarioOpenMeteo(lat, lng),
    getHorarioPorDia(lat, lng),
  ])

  if (!horarioOpenMeteo && !tomorrowForecast) {
    return NextResponse.json({ error: 'Pronóstico no disponible temporalmente' }, { status: 500 })
  }

  // Merge inteligente: Tomorrow para primeras 5h, OpenMeteo para el resto
  const horarioMergeado = mergeHorario(tomorrowForecast, horarioOpenMeteo)

  return NextResponse.json({
    horario: horarioMergeado,
    diario: diario || [],
    horarioPorDia: horarioPorDia || {},
    fuentes: {
      tomorrow_forecast: tomorrowForecast ? `ok (${tomorrowForecast.length}h)` : 'offline',
      openmeteo: horarioOpenMeteo ? 'ok' : 'offline',
    },
    timestamp: new Date().toISOString(),
  })
}
