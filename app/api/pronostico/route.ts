import { NextResponse } from 'next/server'

// Extractor seguro para leer las variables del Modelo Europeo sin importar cómo las devuelva la API
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getVar(obj: any, key: string) {
  return obj[key] || obj[`${key}_ecmwf_ifs04`] || []
}

// 1. Horario 24h para el Dashboard Principal (Forzado a Modelo Europeo)
async function getHorarioOpenMeteo(lat: number, lng: number) {
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
      `&hourly=temperature_2m,precipitation_probability,precipitation,wind_speed_10m,relative_humidity_2m` +
      `&wind_speed_unit=kmh&timezone=America%2FBogota&forecast_days=3&models=ecmwf_ifs04`,
      { next: { revalidate: 900 } } // Revalidar estrictamente cada 15 minutos
    )
    if (!res.ok) return null
    const data = await res.json()

    const now = Date.now()
    let startIndex = data.hourly.time.findIndex((t: string) => {
      const timeMs = new Date(t + "-05:00").getTime()
      return timeMs >= now - 3600000
    })
    if (startIndex === -1) startIndex = 0

    // Extraemos los arrays seguros del modelo ECMWF
    const temps = getVar(data.hourly, 'temperature_2m')
    const precips = getVar(data.hourly, 'precipitation')
    const probs = getVar(data.hourly, 'precipitation_probability')
    const hums = getVar(data.hourly, 'relative_humidity_2m')
    const winds = getVar(data.hourly, 'wind_speed_10m')

    const resultado = data.hourly.time.slice(startIndex, startIndex + 24).map((t: string, i: number) => {
      const idx = startIndex + i
      return {
        hora: t,
        temp: Math.round(temps[idx] * 10) / 10,
        precipitacion: parseFloat((precips[idx] ?? 0).toFixed(2)),
        probabilidad: probs[idx] ?? 0,
        humedad: Math.round(hums[idx]),
        viento: Math.round(winds[idx] * 10) / 10,
      }
    })
    return resultado
  } catch { return null }
}

// 2. Horario 5 DÍAS COMPLETOS (Para gráficas de toda la semana - Forzado a Modelo Europeo)
async function getHorarioPorDia(lat: number, lng: number) {
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
      `&hourly=temperature_2m,precipitation,precipitation_probability,relative_humidity_2m,wind_speed_10m,surface_pressure` +
      `&wind_speed_unit=kmh&timezone=America%2FBogota&forecast_days=5&models=ecmwf_ifs04`,
      { next: { revalidate: 900 } }
    )
    if (!res.ok) return null
    const data = await res.json()

    const porFecha: Record<string, Record<string, number | string>[]> = {}
    
    // Extraemos arrays seguros
    const temps = getVar(data.hourly, 'temperature_2m')
    const precips = getVar(data.hourly, 'precipitation')
    const probs = getVar(data.hourly, 'precipitation_probability')
    const hums = getVar(data.hourly, 'relative_humidity_2m')
    const winds = getVar(data.hourly, 'wind_speed_10m')
    const press = getVar(data.hourly, 'surface_pressure')

    data.hourly.time.forEach((t: string, i: number) => {
      const fecha = t.slice(0, 10) // Extrae 'YYYY-MM-DD'
      if (!porFecha[fecha]) porFecha[fecha] = []
      porFecha[fecha].push({
        hora: t,
        temp: Math.round(temps[i] * 10) / 10,
        precipitacion: parseFloat((precips[i] ?? 0).toFixed(2)),
        probabilidad: probs[i] ?? 0,
        humedad: Math.round(hums[i]),
        viento: Math.round(winds[i] * 10) / 10,
        presion: Math.round(press[i] ?? 0),
      })
    })

    return porFecha
  } catch { return null }
}

// 3. Resumen Diario 5 días (Forzado a Modelo Europeo)
async function getDiarioOpenMeteo(lat: number, lng: number) {
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
      `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,relative_humidity_2m_max` +
      `&wind_speed_unit=kmh&timezone=America%2FBogota&forecast_days=5&models=ecmwf_ifs04`,
      { next: { revalidate: 900 } }
    )
    if (!res.ok) return null
    const data = await res.json()

    // Extraemos arrays seguros para los datos diarios
    const tMax = getVar(data.daily, 'temperature_2m_max')
    const tMin = getVar(data.daily, 'temperature_2m_min')
    const pSum = getVar(data.daily, 'precipitation_sum')
    const pProb = getVar(data.daily, 'precipitation_probability_max')
    const wMax = getVar(data.daily, 'wind_speed_10m_max')
    const hMax = getVar(data.daily, 'relative_humidity_2m_max')

    const resultado = data.daily.time.map((fecha: string, i: number) => ({
      fecha,
      tempMax: Math.round(tMax[i] * 10) / 10,
      tempMin: Math.round(tMin[i] * 10) / 10,
      precipitacion: parseFloat((pSum[i] ?? 0).toFixed(2)),
      probabilidad: pProb[i] ?? 0,
      viento: Math.round(wMax[i] * 10) / 10,
      humedad: Math.round(hMax[i]),
    }))
    return resultado
  } catch { return null }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const lat = parseFloat(searchParams.get('lat') || '3.9038')
  const lng = parseFloat(searchParams.get('lng') || '-76.2982')

  // Ejecutamos las llamadas al motor científico en paralelo para máxima velocidad
  const [horario, diario, horarioPorDia] = await Promise.all([
    getHorarioOpenMeteo(lat, lng),
    getDiarioOpenMeteo(lat, lng),
    getHorarioPorDia(lat, lng),
  ])

  if (!horario) {
    return NextResponse.json({ error: 'Pronóstico no disponible temporalmente' }, { status: 500 })
  }

  // Ahora el horario final es exactamente la lectura científica pura, sin mezclar con Tomorrow.io
  return NextResponse.json({
    horario: horario,
    diario: diario || [],
    horarioPorDia: horarioPorDia || {},
    fuentes: { openmeteo: 'ok', ecmwf_model: 'active' },
    timestamp: new Date().toISOString(),
  })
}
