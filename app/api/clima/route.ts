import { NextResponse } from 'next/server'

const TOMORROW_KEY = process.env.TOMORROW_API_KEY
const WEATHERAPI_KEY = process.env.WEATHERAPI_KEY

// Tomorrow.io — variables meteorológicas generales (temperatura, viento, presión, etc.)
// NO se usa su precipitationIntensity porque es tasa mm/h, no acumulado real de la hora.
async function getTomorrow(lat: number, lng: number) {
  try {
    const res = await fetch(
      `https://api.tomorrow.io/v4/weather/realtime?location=${lat},${lng}&apikey=${TOMORROW_KEY}&units=metric`,
      { next: { revalidate: 600 } }
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

// Open-Meteo — fuente exclusiva de precipitación y probabilidad.
// "precipitation" en el campo current = mm acumulados en la hora en curso (dato real, no tasa).
// "precipitation_probability" = probabilidad para el período actual.
async function getOpenMeteo(lat: number, lng: number) {
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
      `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,` +
      `wind_speed_10m,wind_direction_10m,surface_pressure,visibility,precipitation_probability,uv_index` +
      `&wind_speed_unit=kmh&timezone=America%2FBogota`,
      { next: { revalidate: 600 } }
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
      // Precipitación acumulada en la hora en curso — dato correcto para toma de decisiones
      precipitacion: c.precipitation ?? 0,
      probabilidad: c.precipitation_probability ?? 0,
      uvIndex: c.uv_index ?? null,
      fuente: 'openmeteo',
    }
  } catch { return null }
}

// WeatherAPI — solo como fallback para variables meteorológicas generales.
// Su precip_mm NO se usa; su probabilidad siempre es 0 (la API no lo entrega).
async function getWeatherApi(lat: number, lng: number) {
  try {
    const res = await fetch(
      `https://api.weatherapi.com/v1/current.json?key=${WEATHERAPI_KEY}&q=${lat},${lng}&aqi=no`,
      { next: { revalidate: 600 } }
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

  const [tomorrow, openmeteo, weatherapi] = await Promise.all([
    getTomorrow(lat, lng),
    getOpenMeteo(lat, lng),
    getWeatherApi(lat, lng),
  ])

  // Sin Open-Meteo no hay precipitación confiable — respondemos con advertencia explícita.
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
        tomorrow: tomorrow   ? 'ok' : 'error',
        openmeteo: 'error',
        weatherapi: weatherapi ? 'ok' : 'error',
      },
      timestamp: new Date().toISOString(),
    })
  }

  // Variables meteorológicas generales: Tomorrow primero, luego Open-Meteo, luego WeatherAPI.
  const meteo = tomorrow || openmeteo || weatherapi!

  // Precipitación y probabilidad: SOLO Open-Meteo.
  // precipitation = mm acumulados en la hora en curso (no es tasa mm/h).
  const precipitacion = parseFloat(openmeteo.precipitacion.toFixed(2))
  const probabilidad  = Math.round(openmeteo.probabilidad)

  const impacto   = getImpacto(precipitacion)
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
    // mm acumulados en la hora en curso — dato confiable para cosecha de caña
    precipitacion,
    probabilidad,
    uvIndex: openmeteo.uvIndex,
    impacto,
    fuentes: {
      tomorrow:  tomorrow   ? 'ok' : 'error',
      openmeteo: 'ok',
      weatherapi: weatherapi ? 'ok' : 'error',
    },
    timestamp: new Date().toISOString(),
  })
}
