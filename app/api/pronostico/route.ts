import { NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'

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

        return {
          datos: resultado,
          timestamp: new Date().toISOString()
        }
      } catch { return null }
    },
    [`pronostico-horario-${lat}-${lng}`],
    { revalidate: 300 }
  )()
}

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

        const resultado = data.daily.time.map((fecha: string, i: number) => ({
          fecha,
          tempMax: Math.round(data.daily.temperature_2m_max[i] * 10) / 10,
          tempMin: Math.round(data.daily.temperature_2m_min[i] * 10) / 10,
          precipitacion: parseFloat((data.daily.precipitation_sum[i] ?? 0).toFixed(2)),
          probabilidad: data.daily.precipitation_probability_max[i] ?? 0,
          viento: Math.round(data.daily.wind_speed_10m_max[i] * 10) / 10,
          humedad: Math.round(data.daily.relative_humidity_2m_max[i]),
        }))
        return resultado
      } catch { return null }
    },
    [`pronostico-diario-${lat}-${lng}`],
    { revalidate: 300 }
  )()
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const lat = parseFloat(searchParams.get('lat') || '3.9044')
  const lng = parseFloat(searchParams.get('lng') || '-76.2960')

  const [horarioContainer, diario, horarioPorDia] = await Promise.all([
    getHorarioOpenMeteo(lat, lng),
    getDiarioOpenMeteo(lat, lng),
    getHorarioPorDia(lat, lng),
  ])

  if (!horarioContainer) {
    return NextResponse.json({ error: 'Pronóstico no disponible temporalmente' }, { status: 500 })
  }

  return NextResponse.json({
    horario: horarioContainer.datos,
    diario: diario || [],
    horarioPorDia: horarioPorDia || {},
    fuentes: { openmeteo: 'ok', best_match: 'active' },
    timestamp: horarioContainer.timestamp, 
  })
}
