import { NextResponse } from 'next/server'

const TOMORROW_KEY = process.env.TOMORROW_API_KEY
const WEATHERAPI_KEY = process.env.WEATHERAPI_KEY

// Fuente de Verdad Absoluta: Open-Meteo con el Modelo de Alta Precisión Europeo (ECMWF)
async function getOpenMeteo(lat: number, lng: number) {
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
      `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,` +
      `wind_speed_10m,wind_direction_10m,surface_pressure,visibility,precipitation_probability,uv_index` +
      `&wind_speed_unit=kmh&timezone=America%2FBogota&models=ecmwf_ifs04`, // ← FORZADO: Modelo Europeo ECMWF de alta resolución
      { next: { revalidate: 900 } } // Sincronizado a la caché de 15 minutos
    )
    if (!res.ok) return null
    const data = await res.json()
    
    // Open-Meteo puede estructurar los datos bajo el nombre del modelo si se especifica de forma estricta
    const c = data.current || data.current_ecmwf_ifs04
    if (!c) return null

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

// Respaldos térmicos y de telemetría auxiliar (Tomorrow y WeatherAPI)
async function getTomorrow(lat: number, lng: number) {
  try {
    if (!TOMORROW_KEY) return null
    const res = await fetch(
      `https://api.tomorrow.io/v4/weather/realtime?location=${lat},${lng}&apikey=${TOMORROW_KEY}&units=metric`,
      { next: { revalidate: 900 } }
    )
    if (!res.ok) return null
    const data = await res.json()
    const v = data.data.values
    return {
      temp: v.temperature,
      sensacion: v.temperatureApparent,
      humedad: v.humidity,
      viento: v.windSpeed * 3.6, // Convertido a km/h de forma segura
      direccionViento: v.windDirection,
      presion: v.pressureSurfaceLevel,
      visibilidad: v.visibility,
      fuente: 'tomorrow',
    }
  } catch { return null }
}

async function getWeatherApi(lat: number, lng: number) {
  try {
    if (!WEATHERAPI_KEY) return null
    const res = await fetch(
      `https://api.weatherapi.com/v1/current.json?key=${WEATHERAPI_KEY}&q=${lat},${lng}&aqi=no`,
      { next: { revalidate: 900 } }
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
  if (mm <= 0.5) return { nivel: 'Sin impacto', color: '#10b981', bg: '#ecfdf5', porcentaje: 10, descripcion: 'Condiciones ideales para operación de cosecha. Sin restricciones.' }
  if (mm <= 2)   return { nivel: 'Bajo',        color: '#84cc16', bg: '#f7fee7', porcentaje: 25, descripcion: 'Operación normal. Monitoreo rutinario recomendado.' }
  if (mm <= 5)   return { nivel: 'Moderado',    color: '#f59e0b', bg: '#fffbeb', porcentaje: 50, descripcion: 'Reducir velocidad de maquinaria. Evitar zonas con pendiente.' }
  if (mm <= 10)  return { nivel: 'Alto',        color: '#f97316', bg: '#fff7ed', porcentaje: 70, descripcion: 'Limitar tráfico pesado. Riesgo de compactación severa.' }
  if (mm <= 20)  return { nivel: 'Crítico',     color: '#ef4444', bg: '#fef2f2', porcentaje: 88, descripcion: 'Suspender operaciones. Riesgo de saturación del suelo.' }
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

  // Disparamos las consultas en paralelo
  const [openmeteo, tomorrow, weatherapi] = await Promise.all([
    getOpenMeteo(lat, lng),
    getTomorrow(lat, lng),
    getWeatherApi(lat, lng),
  ])

  // CASO DE FALLO CRÍTICO: Open-Meteo no responde. Activamos el árbol de contención térmico
  if (!openmeteo) {
    const backup = tomorrow || weatherapi
    if (!backup) {
      return NextResponse.json({ error: 'Servicios meteorológicos no disponibles temporalmente' }, { status: 500 })
    }
    
    return NextResponse.json({
      temp: Math.round(backup.temp * 10) / 10,
      sensacion: Math.round(backup.sensacion * 10) / 10,
      humedad: Math.round(backup.humedad),
      viento: Math.round(backup.viento * 10) / 10,
      direccionViento: Math.round(backup.direccionViento),
      direccionTexto: getDireccionViento(backup.direccionViento),
      presion: Math.round(backup.presion),
      visibilidad: Math.round(backup.visibilidad * 10) / 10,
      precipitacion: 0,
      probabilidad: 0,
      impacto: getImpacto(0),
      advertencia: 'Datos numéricos de telemetría de respaldo — Servicio de radar en mantenimiento',
      timestamp: new Date().toISOString(),
    })
  }

  // OPERACIÓN NORMAL: Open-Meteo es el cerebro absoluto
  const precipitacion = parseFloat(openmeteo.precipitacion.toFixed(2))
  const probabilidad = Math.round(openmeteo.probabilidad)
  const impacto = getImpacto(precipitacion)
  const direccionText = getDireccionViento(openmeteo.direccionViento)

  return NextResponse.json({
    temp: Math.round(openmeteo.temp * 10) / 10,
    sensacion: Math.round(openmeteo.sensacion * 10) / 10,
    humedad: Math.round(openmeteo.humedad),
    viento: Math.round(openmeteo.viento * 10) / 10,
    direccionViento: Math.round(openmeteo.direccionViento),
    direccionTexto: direccionText,
    presion: Math.round(openmeteo.presion),
    visibilidad: Math.round(openmeteo.visibilidad * 10) / 10,
    precipitacion,
    probabilidad,
    uvIndex: openmeteo.uvIndex,
    impacto,
    fuentes: {
      openmeteo: 'ok',
      tomorrow: tomorrow ? 'ok' : 'offline',
      weatherapi: weatherapi ? 'ok' : 'offline',
    },
    timestamp: new Date().toISOString(),
  })
}
