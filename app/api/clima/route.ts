import { NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'

const TOMORROW_KEY = process.env.TOMORROW_API_KEY
const WEATHERAPI_KEY = process.env.WEATHERAPI_KEY

const getOpenMeteo = async (lat: number, lng: number) => {
  return unstable_cache(
    async () => {
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
          `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,` +
          `wind_speed_10m,wind_direction_10m,surface_pressure,visibility,precipitation_probability,uv_index` +
          `&wind_speed_unit=kmh&timezone=America%2FBogota`
        )
        if (!res.ok) return null
        const data = await res.json()
        const c = data.current
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
          timestamp: new Date().toISOString()
        }
      } catch { return null }
    },
    [`openmeteo-${lat}-${lng}`],
    { revalidate: 300 }
  )()
}

const getTomorrow = async (lat: number, lng: number) => {
  return unstable_cache(
    async () => {
      try {
        if (!TOMORROW_KEY) return null
        const res = await fetch(
          `https://api.tomorrow.io/v4/weather/realtime?location=${lat},${lng}&apikey=${TOMORROW_KEY}&units=metric`
        )
        if (!res.ok) return null
        const data = await res.json()
        const v = data.data.values
        return {
          temp: v.temperature,
          sensacion: v.temperatureApparent,
          humedad: v.humidity,
          viento: v.windSpeed * 3.6,
          direccionViento: v.windDirection,
          presion: v.pressureSurfaceLevel,
          visibilidad: v.visibility,
          // ✅ CAMBIO 1: precipitationIntensity es mm/h — ideal para tiempo real
          precipitacion: v.precipitationIntensity ?? 0,
          // ✅ CAMBIO 2: Si hay intensidad de lluvia, forzar probabilidad a 100%
          probabilidad: v.precipitationProbability ?? (v.precipitationIntensity > 0 ? 100 : 0),
          // ✅ CAMBIO 3: Añadir uvIndex para que el response final no quede undefined
          uvIndex: v.uvIndex ?? null,
          fuente: 'tomorrow',
          timestamp: new Date().toISOString()
        }
      } catch { return null }
    },
    [`tomorrow-${lat}-${lng}`],
    { revalidate: 300 }
  )()
}

const getWeatherApi = async (lat: number, lng: number) => {
  return unstable_cache(
    async () => {
      try {
        if (!WEATHERAPI_KEY) return null
        const res = await fetch(
          `https://api.weatherapi.com/v1/current.json?key=${WEATHERAPI_KEY}&q=${lat},${lng}&aqi=no`
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
          precipitacion: c.precip_mm ?? 0,
          probabilidad: c.precip_mm > 0 ? 100 : 0,
          // ✅ CAMBIO 3 (también aquí): uvIndex para consistencia
          uvIndex: c.uv ?? null,
          fuente: 'weatherapi',
          timestamp: new Date().toISOString()
        }
      } catch { return null }
    },
    [`weatherapi-${lat}-${lng}`],
    { revalidate: 300 }
  )()
}

function getImpacto(mm: number) {
  if (mm <= 0.5) return { nivel: 'Sin impacto', color: '#10b981', bg: '#ecfdf5', porcentaje: 10, descripcion: 'Condiciones ideales para operation de cosecha. Sin restricciones.' }
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
  const lat = parseFloat(searchParams.get('lat') || '3.9044')
  const lng = parseFloat(searchParams.get('lng') || '-76.2960')

  // Disparamos las 3 APIs en paralelo — sin perder tiempo
  const [tomorrow, openmeteo, weatherapi] = await Promise.all([
    getTomorrow(lat, lng),
    getOpenMeteo(lat, lng),
    getWeatherApi(lat, lng),
  ])

  // ✅ CAMBIO 4 (el principal): Tomorrow.io es el REY del tiempo real.
  // Si falla → OpenMeteo. Si falla → WeatherAPI.
  const dataPrincipal = tomorrow || openmeteo || weatherapi

  if (!dataPrincipal) {
    return NextResponse.json({ error: 'Servicios meteorológicos no disponibles temporalmente' }, { status: 500 })
  }

  const precipitacion = parseFloat(dataPrincipal.precipitacion.toFixed(2))
  const probabilidad = Math.round(dataPrincipal.probabilidad)
  const impacto = getImpacto(precipitacion)
  const direccionText = getDireccionViento(dataPrincipal.direccionViento)

  return NextResponse.json({
    temp: Math.round(dataPrincipal.temp * 10) / 10,
    sensacion: Math.round(dataPrincipal.sensacion * 10) / 10,
    humedad: Math.round(dataPrincipal.humedad),
    viento: Math.round(dataPrincipal.viento * 10) / 10,
    direccionViento: Math.round(dataPrincipal.direccionViento),
    direccionTexto: direccionText,
    presion: Math.round(dataPrincipal.presion),
    visibilidad: Math.round(dataPrincipal.visibilidad * 10) / 10,
    precipitacion,
    probabilidad,
    uvIndex: dataPrincipal.uvIndex,
    impacto,
    // 🔍 Útil para debug: te dice cuál fuente está activa en cada momento
    fuentes: {
      activa: dataPrincipal.fuente,
      tomorrow: tomorrow ? 'ok' : 'offline',
      openmeteo: openmeteo ? 'ok' : 'offline',
      weatherapi: weatherapi ? 'ok' : 'offline'
    },
    timestamp: dataPrincipal.timestamp,
  })
}
