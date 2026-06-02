import { NextResponse } from 'next/server'

const TOMORROW_KEY = process.env.TOMORROW_API_KEY
const WEATHERAPI_KEY = process.env.WEATHERAPI_KEY
const OWM_KEY = process.env.NEXT_PUBLIC_OWM_KEY

async function getTomorrow(lat: number, lng: number) {
  try {
    const res = await fetch(
      `https://api.tomorrow.io/v4/weather/realtime?location=${lat},${lng}&apikey=${TOMORROW_KEY}&units=metric`,
      { next: { revalidate: 60 } }
    )
    if (!res.ok) return null
    const data = await res.json()
    const v = data.data.values
    return {
      temp: v.temperature,
      sensacion: v.temperatureApparent,
      humedad: v.humidity,
      viento: v.windSpeed,
      direccionViento: v.windDirection,
      presion: v.pressureSurfaceLevel,
      visibilidad: v.visibility,
      fuente: 'tomorrow',
    }
  } catch { return null }
}

async function getOpenMeteo(lat: number, lng: number) {
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
      `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,` +
      `wind_speed_10m,wind_direction_10m,surface_pressure,visibility,precipitation_probability,uv_index` +
      `&wind_speed_unit=kmh&timezone=America%2FBogota`,
      { next: { revalidate: 60 } }
    )
    if (!res.ok) return null
    const data = await res.json()
    const c = data.current
    return {
      temp: c.temperature_2m,
      sensacion: c.apparent_temperature,
      humedad: c.relative_humidity_2m,
      viento: c.wind_speed_10m,
      direccionViento: c.wind_direction_10m,
      presion: c.surface_pressure,
      visibilidad: c.visibility / 1000,
      precipitacion: c.precipitation ?? 0,
      probabilidad: c.precipitation_probability ?? 0,
      uvIndex: c.uv_index ?? null,
      fuente: 'openmeteo',
    }
  } catch { return null }
}

async function getOpenWeatherMap(lat: number, lng: number) {
  try {
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${OWM_KEY}&units=metric`,
      { next: { revalidate: 600 } }
    )
    if (!res.ok) return null
    const data = await res.json()
    // rain.1h = mm acumulados en la última hora real — dato de estaciones + radar
    const precipitacion = data.rain?.['1h'] ?? data.snow?.['1h'] ?? 0
    return {
      precipitacion: parseFloat(precipitacion.toFixed(2)),
      fuente: 'openweathermap',
    }
  } catch { return null }
}

async function getWeatherApi(lat: number, lng: number) {
  try {
    const res = await fetch(
      `https://api.weatherapi.com/v1/current.json?key=${WEATHERAPI_KEY}&q=${lat},${lng}&aqi=no`,
      { next: { revalidate: 60 } }
    )
    if (!res.ok) return null
    const data = await res.json()
    const c = data.current
    return {
      temp: c.temp_c,
      sensacion: c.feelslike_c,
      humedad: c.humidity,
      viento: c.wind_kph,
      direccionViento: c.wind_degree,
      presion: c.pressure_mb,
      visibilidad: c.vis_km,
      fuente: 'weatherapi',
    }
  } catch { return null }
}

function getImpacto(mm: number) {
  if (mm <= 0.5) return { nivel: 'Sin impacto', color: '#10b981', bg: '#ecfdf5', porcentaje: 10,  descripcion: 'Condiciones ideales para operación de cosecha. Sin restricciones.' }
  if (mm <= 2)   return { nivel: 'Bajo',        color: '#84cc16', bg: '#f7fee7', porcentaje: 25,  descripcion: 'Operación normal. Monitoreo rutinario recomendado.' }
  if (mm <= 5)   return { nivel: 'Moderado',    color: '#f59e0b', bg: '#fffbeb', porcentaje: 50,  descripcion: 'Reducir velocidad de maquinaria. Evitar zonas con pendiente.' }
  if (mm <= 10)  return { nivel: 'Alto',        color: '#f97316', bg: '#fff7ed', porcentaje: 70,  descripcion: 'Limitar tráfico pesado. Riesgo de compactación severa.' }
  if (mm <= 20)  return { nivel: 'Crítico',     color: '#ef4444', bg: '#fef2f2', porcentaje: 88,  descripcion: 'Suspender operaciones. Riesgo de saturación del suelo.' }
  return           { nivel: 'Extremo',          color: '#7c3aed', bg: '#f5f3ff', porcentaje: 100, descripcion: 'Parada total. Evacuar maquinaria de zonas bajas.' }
}

function getDireccionViento(grados: number): string {
  const dirs = ['Norte', 'Nornoreste', 'Noreste', 'Estenoreste', 'Este', 'Estesureste', 'Sureste', 'Sursureste', 'Sur', 'Sursuroeste', 'Suroeste', 'Oestesuroeste', 'Oeste', 'Oestenoroeste', 'Noroeste', 'Nornoreste']
  return dirs[Math.round(grados / 22.5) % 16]
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const lat = parseFloat(searchParams.get('lat') || '3.9038')
  const lng = parseFloat(searchParams.get('lng') || '-76.2982')

  const [tomorrow, openmeteo, weatherapi, owm] = await Promise.all([
    getTomorrow(lat, lng),
    getOpenMeteo(lat, lng),
    getWeatherApi(lat, lng),
    getOpenWeatherMap(lat, lng),
  ])

  if (!openmeteo) {
    const meteo = tomorrow || weatherapi
    if (!meteo) {
      return NextResponse.json({ error: 'Sin datos disponibles' }, { status: 500 })
    }
    const direccion = getDireccionViento(meteo.direccionViento)
    return NextResponse.json({
      temp: Math.round(meteo.temp * 10) / 10,
      sensacion: Math.round(meteo.sensacion * 10) / 10,
      humedad: Math.round(meteo.humedad),
      viento: Math.round(meteo.viento * 10) / 10,
      direccionViento: Math.round(meteo.direccionViento),
      direccionTexto: direccion,
      presion: Math.round(meteo.presion),
      visibilidad: Math.round(meteo.visibilidad * 10) / 10,
      precipitacion: null,
      probabilidad: null,
      impacto: null,
      advertencia: 'Precipitación no disponible — Open-Meteo sin respuesta',
      fuentes: {
        tomorrow: tomorrow ? 'ok' : 'error',
        openmeteo: 'error',
        weatherapi: weatherapi ? 'ok' : 'error',
        openweathermap: owm ? 'ok' : 'error',
      },
      timestamp: new Date().toISOString(),
    })
  }

  const meteo = tomorrow || openmeteo || weatherapi!

  // Precipitación: tomamos el mayor valor entre OWM y Open-Meteo
  // OWM rain.1h es acumulado real de la última hora — más reactivo a tormentas
  // Open-Meteo es acumulado desde inicio de la hora — puede estar retrasado
  const precipOWM = owm?.precipitacion ?? 0
  const precipOM = parseFloat(openmeteo.precipitacion.toFixed(2))
  const precipitacion = Math.max(precipOWM, precipOM)

  const probabilidad = Math.round(openmeteo.probabilidad)
  const impacto = getImpacto(precipitacion)
  const direccion = getDireccionViento(meteo.direccionViento)

  return NextResponse.json({
    temp: Math.round(meteo.temp * 10) / 10,
    sensacion: Math.round(meteo.sensacion * 10) / 10,
    humedad: Math.round(meteo.humedad),
    viento: Math.round(meteo.viento * 10) / 10,
    direccionViento: Math.round(meteo.direccionViento),
    direccionTexto: direccion,
    presion: Math.round(meteo.presion),
    visibilidad: Math.round(meteo.visibilidad * 10) / 10,
    precipitacion,
    probabilidad,
    uvIndex: openmeteo.uvIndex,
    impacto,
    fuentes: {
      tomorrow: tomorrow ? 'ok' : 'error',
      openmeteo: 'ok',
      weatherapi: weatherapi ? 'ok' : 'error',
      openweathermap: owm ? 'ok' : 'error',
    },
    timestamp: new Date().toISOString(),
  })
}
