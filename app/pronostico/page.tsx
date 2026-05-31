'use client'

import { useState, useEffect } from 'react'
import useSWR from 'swr'
import Image from 'next/image'
import { MapPin, Droplets, Wind, Thermometer, Clock, ChevronRight, ArrowLeft, Bell, Calendar } from 'lucide-react'
import Sidebar from '@/components/Sidebar'

const fetcher = (url: string) => fetch(url).then(r => r.json())

// ── Helpers de Cálculo y Formato ───────────────────────────────────────────

function calcularPuntoRocio(temp: number, humedad: number): number {
  const a = 17.625, b = 243.04
  const alpha = ((a * temp) / (b + temp)) + Math.log(humedad / 100)
  return parseFloat(((b * alpha) / (a - alpha)).toFixed(1))
}

function formatFecha(fecha: string, corta = false) {
  const d = new Date(fecha + 'T12:00:00')
  if (corta) {
    const opciones: Intl.DateTimeFormatOptions = { weekday: 'short', day: '2-digit', month: 'short' }
    return d.toLocaleDateString('es-CO', opciones)
  }
  const opcionesLargas: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
  return d.toLocaleDateString('es-CO', opcionesLargas)
}

function formatHora(iso: string) {
  return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function esHoy(fecha: string) {
  return fecha === new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Bogota' })
}

function getClasificacion(horas: HoraData[], mmTotal: number, prob: number): { label: string; icono: string } {
  if (!horas || horas.length === 0) {
    if (mmTotal > 30) return { label: 'Posible Tormenta', icono: '⛈️' }
    if (mmTotal >= 20) return { label: 'Lluvia muy fuerte', icono: '🌧️' }
    if (mmTotal >= 10) return { label: 'Lluvia fuerte', icono: '🌧️' }
    if (mmTotal >= 2) return { label: 'Lluvia moderada', icono: '🌦️' }
    if (mmTotal > 0) return { label: 'Lluvia débil', icono: '🌦️' }
    if (prob > 70) return { label: 'Seco (Nublado)', icono: '☁️' }
    if (prob > 40) return { label: 'Seco (Parcial)', icono: '⛅' }
    return { label: 'Seco', icono: '☀️' }
  }

  let max1h = 0
  let max2h = 0

  for (let i = 0; i < horas.length; i++) {
    if (horas[i].precipitacion > max1h) max1h = horas[i].precipitacion
    if (i < horas.length - 1) {
      const sum2h = horas[i].precipitacion + horas[i + 1].precipitacion
      if (sum2h > max2h) max2h = sum2h
    }
  }

  if (max2h >= 30) return { label: 'Tormenta', icono: '⛈️' }
  if (max1h >= 20) return { label: 'Lluvia muy fuerte', icono: '⛈️' }
  if (max1h >= 10) return { label: 'Lluvia fuerte', icono: '🌧️' }
  if (max1h >= 2) return { label: 'Lluvia moderada', icono: '🌦️' }
  if (max1h > 0 || mmTotal > 0) return { label: 'Lluvia débil', icono: '🌦️' }
  
  if (prob > 70) return { label: 'Seco (Nublado)', icono: '☁️' }
  if (prob > 40) return { label: 'Seco (Parcial)', icono: '⛅' }
  return { label: 'Seco', icono: '☀️' }
}

function getDescripcionDia(mm: number, prob: number, tempMax: number, tempMin: number, humedad: number, labelCondicion: string): string {
  let desc = `Se esperan condiciones de ${labelCondicion.toLowerCase()}`
  if (mm > 2) {
    desc += ` con ${mm.toFixed(1)} mm de lluvia acumulada total en el día`
    if (prob > 70) desc += ` y alta probabilidad de precipitación`
  } else if (prob > 50) {
    desc += ` con posibilidad de lluvia leve`
  } else {
    desc += ` y tiempo estable`
  }
  if (tempMax - tempMin > 8) {
    desc += `. Temperaturas variables entre ${tempMin}°C y ${tempMax}°C`
  } else {
    desc += `. Temperaturas entre ${tempMin}°C y ${tempMax}°C`
  }
  if (humedad > 85) desc += `. Humedad muy alta`
  else if (humedad > 70) desc += `. Humedad alta`
  else if (humedad > 50) desc += `. Humedad media`
  else desc += `. Humedad baja`

  desc += '.'
  return desc
}

function generarResumenTecnico(dia: DiaData, horas: HoraData[], clase: { label: string }, tecnico: any) {
  const max1h = horas?.length ? Math.max(...horas.map(h => h.precipitacion)) : 0
  let resumen = `Para la jornada se prevé un escenario meteorológico catalogado como ${clase.label.toLowerCase()}. `
  
  if (dia.precipitacion > 0) {
    resumen += `Se estima un acumulado total de ${dia.precipitacion.toFixed(1)} mm`
    if (max1h > 0) resumen += `, con una intensidad máxima proyectada de ${max1h.toFixed(1)} mm/h. `
    else resumen += `. `
    
    if (clase.label === 'Tormenta' || clase.label === 'Lluvia muy fuerte') {
      resumen += `¡ALERTA!: Las precipitaciones generarán alta escorrentía y saturación rápida del perfil del suelo. Se requiere suspensión inminente de labores de corte y transporte para evitar daños estructurales en los suelos (compactación severa) y atascos de maquinaria pesada. `
    } else if (clase.label === 'Lluvia fuerte' || clase.label === 'Lluvia moderada') {
      resumen += `Se advierte un incremento importante en la humedad del suelo ("piso") que podría reducir significativamente la eficiencia de los frentes de cosecha mecánica. Se recomienda evaluar el estado de los callejones y programar el transporte con alta precaución. `
    } else {
      resumen += `La precipitación proyectada es leve y no debería representar una limitante severa para las operaciones, permitiendo mantener los frentes de corte activos. `
    }
  } else {
    resumen += `La ausencia de precipitaciones significativas garantiza condiciones de piso óptimas para el tránsito ininterrumpido de maquinaria, el corte y el alce de la caña. `
  }
  
  resumen += `\n\nTérmicamente, la amplitud será de ${(dia.tempMax - dia.tempMin).toFixed(1)}°C (mínima de ${dia.tempMin}°C, máxima de ${dia.tempMax}°C). `
  
  let nivelHumedad = ''
  if (dia.humedad > 85 || (tecnico?.horasHR90 && tecnico.horasHR90 > 4)) nivelHumedad = 'niveles muy altos'
  else if (dia.humedad > 70) nivelHumedad = 'niveles altos'
  else if (dia.humedad > 50) nivelHumedad = 'niveles medios'
  else nivelHumedad = 'niveles bajos'

  resumen += `La humedad relativa promediará un ${dia.humedad}%.`
  return resumen
}

function calcularEventos(horas: HoraData[]) {
  if (!horas || horas.length === 0) return null
  const tempMax = Math.max(...horas.map(h => h.temp))
  const tempMin = Math.min(...horas.map(h => h.temp))
  const horaMax = horas.find(h => h.temp === tempMax)
  const horaMin = horas.find(h => h.temp === tempMin)
  const inicioLluvia = horas.find(h => h.precipitacion > 2)
  let finLluvia = null
  if (inicioLluvia) {
    const idx = horas.indexOf(inicioLluvia)
    finLluvia = horas.slice(idx + 1).find(h => h.precipitacion < 2)
  }
  const picoPrecip = horas.reduce((max, h) => h.precipitacion > max.precipitacion ? h : max, horas[0])
  return { tempMax, tempMin, horaMax, horaMin, inicioLluvia, finLluvia, picoPrecip }
}

function calcularDetallesTecnicos(horas: HoraData[], tempMax: number, tempMin: number) {
  if (!horas || horas.length === 0) return null
  const amplitud = parseFloat((tempMax - tempMin).toFixed(1))
  const humedadMedia = Math.round(horas.reduce((s, h) => s + h.humedad, 0) / horas.length)
  const horasHR90 = horas.filter(h => h.humedad > 90).length
  const evapotranspiracion = parseFloat((0.0023 * (tempMax - tempMin) ** 0.5 * ((tempMax + tempMin) / 2 + 17.8) * 24).toFixed(1))
  const radiacion = horas.some(h => h.precipitacion > 2) ? 420 : horas.some(h => h.probabilidad > 60) ? 620 : 820
  const rocioPromedio = calcularPuntoRocio((tempMax + tempMin) / 2, humedadMedia)
  const horasConPresion = horas.filter(h => h.presion && h.presion > 0)
  const presion = horasConPresion.length > 0
    ? Math.round(horasConPresion.reduce((s, h) => s + (h.presion ?? 0), 0) / horasConPresion.length)
    : null
  return { amplitud, humedadMedia, horasHR90, evapotranspiracion, radiacion, rocioPromedio, presion }
}

// ── Gráfica SVG Horizontal Deslizable ──────────────────────────────────────
function Grafica({ horas, tipo }: { horas: HoraData[]; tipo: 'temp' | 'precipitacion' | 'humedad' | 'viento' }) {
  if (!horas || horas.length === 0) return null
  const valores = horas.map(h => Number(h[tipo]))
  const min = Math.min(...valores)
  const max = Math.max(...valores)
  const rango = max - min || 1

  const W = 850, H = 160, padX = 40, padY = 20
  const innerW = W - padX * 2
  const innerH = H - padY * 2

  const puntos = valores.map((v, i) => ({
    x: padX + (i / (valores.length - 1)) * innerW,
    y: padY + innerH - ((v - min) / rango) * innerH,
    v,
  }))

  const pathLine = puntos.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const pathArea = `${pathLine} L ${puntos[puntos.length - 1].x} ${H - padY} L ${puntos[0].x} ${H - padY} Z`
  const colores: Record<string, string> = { temp: '#2563eb', precipitacion: '#0ea5e9', humedad: '#8b5cf6', viento: '#10b981' }
  const color = colores[tipo]
  const horasLabel = horas.filter((_, i) => i % 2 === 0)

  return (
    <svg viewBox={`0 0 ${W} ${H + 30}`} className="w-full h-auto overflow-visible">
      <defs>
        <linearGradient id={`grad-${tipo}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.15" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={pathArea} fill={`url(#grad-${tipo})`} />
      <path d={pathLine} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {puntos.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="4" fill={color} />
          <text x={p.x} y={p.y - 8} textAnchor="middle" fontSize="10" fill="#475569" fontWeight="600">
            {tipo === 'temp' ? `${p.v}°` : tipo === 'precipitacion' ? `${p.v}` : tipo === 'humedad' ? `${p.v}%` : `${p.v}`}
          </text>
        </g>
      ))}
      {horasLabel.map((h, i) => {
        const idx = horas.indexOf(h)
        const x = padX + (idx / (valores.length - 1)) * innerW
        return (
          <text key={i} x={x} y={H + 16} textAnchor="middle" fontSize="10" fill="#94a3b8">
            {formatHora(String(h.hora))}
          </text>
        )
      })}
      <line x1={padX} y1={H - padY} x2={W - padX} y2={H - padY} stroke="#e2e8f0" strokeWidth="1" />
    </svg>
  )
}

interface HoraData { hora: string; temp: number; precipitacion: number; probabilidad: number; humedad: number; viento: number; presion?: number }
interface DiaData { fecha: string; tempMax: number; tempMin: number; precipitacion: number; probabilidad: number; viento: number; humidity?: number; humedad: number }

// ── Componente Principal ───────────────────────────────────────────────────
export default function Pronosticos() {
  const [coords, setCoords] = useState({ lat: 3.9044, lng: -76.2960 })
  const [lugar, setLugar] = useState('Buga')
  const [diaSeleccionado, setDiaSeleccionado] = useState(0)
  const [tabGrafica, setTabGrafica] = useState<'temp' | 'precipitacion' | 'humedad' | 'viento'>('temp')
  const [, setSidebarCollapsed] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [fechaHoraActual, setFechaHoraActual] = useState({ fecha: '', hora: '' })
  
  // NUEVO: Control de flujos de pantalla para móvil (Imagen 1 vs Imagen 2)
  const [vistaMovil, setVistaMovil] = useState<'lista' | 'detalle'>('lista')

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const lat = parseFloat(params.get('lat') || '3.9044')
      const lng = parseFloat(params.get('lng') || '-76.2960')
      const name = params.get('lugar') || 'Buga'
      setCoords({ lat, lng })
      setLugar(name)
    }
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    const actualizarFechaHora = () => {
      const ahora = new Date()
      const fecha = ahora.toLocaleDateString('es-CO', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        timeZone: 'America/Bogota'
      })
      const hora = ahora.toLocaleTimeString('es-CO', {
        hour: '2-digit', minute: '2-digit', hour12: true,
        timeZone: 'America/Bogota'
      }).toUpperCase()
      setFechaHoraActual({ fecha, hora })
    }
    actualizarFechaHora()
    const intervalo = setInterval(actualizarFechaHora, 60000)
    return () => clearInterval(intervalo)
  }, [])

  const { data: pronostico } = useSWR(
    `/api/pronostico?lat=${coords.lat}&lng=${coords.lng}`,
    fetcher, { refreshInterval: 900000 }
  )

  const horarioPlano: HoraData[] = Array.isArray(pronostico?.horario) ? pronostico.horario : []
  const horarioPorDia: Record<string, HoraData[]> = pronostico?.horarioPorDia || {}
  const diario: DiaData[] = Array.isArray(pronostico?.diario) ? pronostico.diario.slice(0, 5) : []
  const diaActual = diario[diaSeleccionado]
  const horasDia: HoraData[] = diaActual ? (horarioPorDia[diaActual.fecha] || []) : []
  const condicion = diaActual ? getClasificacion(horasDia, diaActual.precipitacion, diaActual.probabilidad) : null
  const eventos = calcularEventos(horasDia)
  const tecnico = diaActual && eventos ? calcularDetallesTecnicos(horasDia, diaActual.tempMax, diaActual.tempMin) : null
  const alertasCount = horarioPlano.filter(h => h.precipitacion > 0.5).length

  const tabsGrafica = [
    { id: 'temp' as const, label: 'Temperatura', icono: '🌡️' },
    { id: 'precipitacion' as const, label: 'Precipitación', icono: '🌧️' },
    { id: 'humedad' as const, label: 'Humedad', icono: '💧' },
    { id: 'viento' as const, label: 'Viento', icono: '💨' },
  ]

  // ── RENDER MÓVIL VISTA 1: LISTA DE TARJETAS (Imagen 1) ───────────────────
  if (isMobile && vistaMovil === 'lista') {
    return (
      <div className="flex flex-col h-screen overflow-hidden bg-slate-50 font-sans">
        {/* TOPBAR MÓVIL ESTÁNDAR */}
        <div className="flex items-center justify-between bg-white px-4 py-3 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2">
            <Image src="/iconos/probabilidad.png" alt="logo" width={28} height={28} style={{ objectFit: 'contain' }} />
            <div>
              <div className="font-bold text-[0.95rem] text-slate-900 leading-tight">Clima Cosecha</div>
              <div className="text-[0.65rem] text-slate-400 leading-tight">Monitoreo agroclimático</div>
            </div>
          </div>
        </div>

        {/* UBICACIÓN Y HORARIO EN VIVO */}
        <div className="bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5 text-blue-600 font-semibold text-[0.88rem]">
            <MapPin size={15} />
            <span>{lugar}</span>
            <span className="text-slate-400 font-normal text-[0.72rem] ml-0.5">{coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}</span>
          </div>
          <div className="flex flex-col items-end text-[0.72rem] leading-tight text-slate-500">
            <span className="capitalize font-medium">{fechaHoraActual.fecha}</span>
            <span className="text-slate-900 font-bold mt-0.5">{fechaHoraActual.hora}</span>
          </div>
        </div>

        {/* LISTADO DE PRONÓSTICOS */}
        <div className="flex-1 overflow-y-auto p-4 pb-[100px] flex flex-col gap-3">
          <div>
            <h1 className="text-[1.25rem] font-extrabold text-slate-900 leading-none">Pronóstico 5 días</h1>
            <p className="text-[0.78rem] text-slate-400 mt-1">Consulta el comportamiento del clima para los próximos días</p>
          </div>

          {diario.length === 0 ? (
            <div className="text-slate-400 text-[0.85rem] py-10 text-center">Cargando pronósticos...</div>
          ) : (
            diario.map((dia, i) => {
              const horasEsteDia = horarioPorDia[dia.fecha] || []
              const cond = getClasificacion(horasEsteDia, dia.precipitacion, dia.probabilidad)
              return (
                <div key={dia.fecha} onClick={() => { setDiaSeleccionado(i); setVistaMovil('detalle') }}
                  className="bg-white border border-slate-200 rounded-[14px] p-4 flex flex-col gap-3 shadow-[0_1px_3px_rgba(0,0,0,0.03)] active:scale-[0.99] transition-all">
                  <div className="flex items-center justify-between">
                    {/* Bloque Fecha */}
                    <div className="w-[85px] shrink-0">
                      <div className="text-[0.82rem] font-bold text-blue-600 capitalize leading-tight">
                        {esHoy(dia.fecha) ? formatFecha(dia.fecha, true).split('.')[0] : formatFecha(dia.fecha, true).split('.')[0]}
                      </div>
                      <div className="text-[0.68rem] text-slate-400 capitalize mt-0.5">
                        {esHoy(dia.fecha) ? 'Hoy' : formatFecha(dia.fecha, true).split(',')[0]}
                      </div>
                    </div>
                    {/* Icono + Estado */}
                    <div className="flex-1 flex items-center gap-3 px-2 min-w-0">
                      <span className="text-3xl shrink-0">{cond.icono}</span>
                      <div className="min-w-0">
                        <div className="text-[0.82rem] font-medium text-slate-700 truncate leading-tight">{cond.label}</div>
                        <div className="text-[0.92rem] font-extrabold text-slate-900 mt-1">
                          <span className="text-red-500">{dia.tempMax}°</span>
                          <span className="text-slate-300 font-normal mx-1">/</span>
                          <span className="text-blue-500">{dia.tempMin}°</span>
                        </div>
                      </div>
                    </div>
                    {/* Botón flecha */}
                    <div className="w-[30px] h-[30px] rounded-full bg-slate-50 flex items-center justify-center text-slate-400">
                      <ChevronRight size={16} />
                    </div>
                  </div>
                  {/* Fila de Métricas Inferiores */}
                  <div className="flex justify-between items-center border-t border-slate-100 pt-2.5 mt-0.5 text-[0.72rem] text-slate-500 font-medium px-1">
                    <span className="flex items-center gap-1">💧 {dia.probabilidad}%</span>
                    <span className="flex items-center gap-1">🌧️ {dia.precipitacion} mm</span>
                    <span className="flex items-center gap-1">💨 {dia.viento} km/h</span>
                  </div>
                </div>
              )
            })
          )}

          {/* CUADRO INFORMATIVO DE SELECCIÓN */}
          <div className="bg-blue-50/70 border border-blue-100 rounded-xl p-3.5 flex items-start gap-2.5 mt-2">
            <span className="text-blue-500 text-[1.1rem] mt-0.5">ℹ️</span>
            <div>
              <div className="text-[0.78rem] font-bold text-blue-900">Selecciona un día para ver el detalle completo</div>
              <div className="text-[0.7rem] text-blue-700/90 mt-0.5 leading-normal">Podrás consultar el comportamiento horario y más información técnica.</div>
            </div>
          </div>
        </div>
        <Sidebar alertasCount={alertasCount} onToggle={setSidebarCollapsed} ultimaActualizacion={pronostico?.timestamp} coords={coords} lugar={lugar} />
      </div>
    )
  }

  // ── RENDER MÓVIL VISTA 2: DETALLE AVANZADO (Imagen 2) ───────────────────
  if (isMobile && vistaMovil === 'detalle' && diaActual && condicion) {
    return (
      <div className="flex flex-col h-screen overflow-hidden bg-slate-50 font-sans">
        {/* TOPBAR MÓVIL DETALLE CON BOTÓN ATRÁS */}
        <div className="flex items-center justify-between bg-white px-4 py-3 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2">
            <button onClick={() => setVistaMovil('lista')} className="w-8 h-8 -ml-1 rounded-full bg-slate-50 flex items-center justify-center text-slate-700 active:bg-slate-100">
              <ArrowLeft size={18} />
            </button>
            <div className="flex items-center gap-2">
              <Image src="/iconos/probabilidad.png" alt="logo" width={28} height={28} style={{ objectFit: 'contain' }} />
              <div>
                <div className="font-bold text-[0.95rem] text-slate-900 leading-tight">Clima Cosecha</div>
                <div className="text-[0.65rem] text-slate-400 leading-tight">Monitoreo agroclimático</div>
              </div>
            </div>
          </div>
          <div className="relative text-slate-400">
            <Bell size={20} />
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full text-[0.58rem] font-bold text-white flex items-center justify-center border border-white">4</span>
          </div>
        </div>

        {/* UBICACIÓN Y HORARIO EN VIVO */}
        <div className="bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5 text-blue-600 font-semibold text-[0.88rem]">
            <MapPin size={15} />
            <span>{lugar}</span>
            <span className="text-slate-400 font-normal text-[0.72rem] ml-0.5">{coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}</span>
          </div>
          <div className="flex flex-col items-end text-[0.72rem] leading-tight text-slate-500">
            <span className="capitalize font-medium">{fechaHoraActual.fecha}</span>
            <span className="text-slate-900 font-bold mt-0.5">{fechaHoraActual.hora}</span>
          </div>
        </div>

        {/* CONTENIDO TÉCNICO DETALLADO */}
        <div className="flex-1 overflow-y-auto p-4 pb-[100px] flex flex-col gap-4">
          
          {/* CABECERA RESUMEN DEL DÍA SELECCIONADO */}
          <div className="bg-white border border-slate-200 rounded-[14px] p-4 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
              <span className="text-[0.85rem] font-extrabold text-slate-900 capitalize">
                {esHoy(diaActual.fecha) ? formatFecha(diaActual.fecha) : formatFecha(diaActual.fecha)}
              </span>
              <button className="w-7 h-7 bg-slate-50 border border-slate-200 rounded-md flex items-center justify-center text-slate-400"><Calendar size={14} /></button>
            </div>
            
            <div className="flex items-center gap-4">
              <span className="text-5xl">{condicion.icono}</span>
              <div>
                <div className="text-[0.72rem] text-slate-400 font-bold tracking-wide">CONDICIÓN PREVISTA</div>
                <div className="text-[1.05rem] font-extrabold text-slate-900 leading-tight mt-0.5">{condicion.label}</div>
                <div className="text-[1.1rem] font-black mt-1">
                  <span className="text-red-500">{diaActual.tempMax}°</span>
                  <span className="text-slate-300 font-normal mx-1.5">/</span>
                  <span className="text-blue-500">{diaActual.tempMin}°</span>
                </div>
              </div>
            </div>

            {/* TABLA DE 4 COLUMNAS TÉCNICAS */}
            <div className="grid grid-cols-4 gap-1 text-center border-t border-slate-100 pt-3 mt-4 text-[0.68rem]">
              <div className="border-r border-slate-100">
                <div className="text-slate-400 font-medium">Prob. lluvia</div>
                <div className="font-extrabold text-slate-800 mt-1">💧 {diaActual.probabilidad}%</div>
              </div>
              <div className="border-r border-slate-100">
                <div className="text-slate-400 font-medium">Lluvia acum.</div>
                <div className="font-extrabold text-blue-600 mt-1">🌧️ {diaActual.precipitacion} mm</div>
              </div>
              <div className="border-r border-slate-100">
                <div className="text-slate-400 font-medium">Viento prom.</div>
                <div className="font-extrabold text-slate-800 mt-1">💨 {diaActual.viento} km/h</div>
              </div>
              <div>
                <div className="text-slate-400 font-medium">Humedad prom.</div>
                <div className="font-extrabold text-slate-800 mt-1">💦 {diaActual.humedad}%</div>
              </div>
            </div>
          </div>

          {/* TABS DE LA GRÁFICA */}
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 shrink-0">
            {tabsGrafica.map(tab => (
              <button key={tab.id} onClick={() => setTabGrafica(tab.id)}
                className={`px-3 py-2 rounded-lg text-[0.75rem] font-bold transition-all whitespace-nowrap border ${
                  tabGrafica === tab.id ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-slate-500 border-slate-200 active:bg-slate-100'
                }`}>
                {tab.id === 'temp' ? '🌡️ ' : tab.id === 'precipitacion' ? '🌧️ ' : tab.id === 'humedad' ? '💧 ' : '💨 '} 
                {tab.label}
              </button>
            ))}
          </div>

          {/* CONTENEDOR SVG CON HORIZONTAL SCROLL FORZADO */}
          <div className="bg-white border border-slate-200 rounded-[14px] p-4 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
            <div className="w-full overflow-x-auto pb-1 scrollbar-none">
              <div className="w-[850px]">
                {horasDia.length > 0 ? (
                  <Grafica horas={horasDia} tipo={tabGrafica} />
                ) : (
                  <div className="text-slate-400 text-center py-8 text-[0.8rem]">Sin datos detallados para este día.</div>
                )}
              </div>
            </div>
            {horasDia.length > 0 && (
              <div className="text-center text-blue-600 font-bold text-[0.68rem] mt-1 tracking-wide flex items-center justify-center gap-1">
                <span>← Desliza para ver más horas →</span>
              </div>
            )}
          </div>

          {/* CUADROS DETALLES INFERIORES */}
          <div className="bg-white border border-slate-200 rounded-[14px] p-4 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
            <div className="flex items-center gap-2 text-[0.82rem] font-bold text-slate-900 border-b border-slate-100 pb-2 mb-2.5">
              <span>📋</span>
              <span>Resumen del día</span>
            </div>
            <p className="text-[0.78rem] text-slate-600 leading-relaxed whiteSpace-pre-line">
              {generarResumenTecnico(diaActual, horasDia, condicion, tecnico)}
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-[14px] p-4 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
            <div className="flex items-center gap-2 text-[0.82rem] font-bold text-slate-900 border-b border-slate-100 pb-2 mb-2.5">
              <span>📅</span>
              <span>Eventos destacados</span>
            </div>
            {horasDia.length > 0 && eventos ? (
              <div className="flex flex-col gap-3 text-[0.76rem]">
                <div className="flex justify-between items-center border-b border-slate-50 pb-1.5">
                  <span className="text-slate-400 flex items-center gap-1.5">🌡️ Temperatura máxima</span>
                  <span className="font-bold text-slate-900">{eventos.tempMax}°C a las {formatHora(String(eventos.horaMax?.hora))}</span>
                </div>
                <div className="flex justify-between items-center border-b border-slate-50 pb-1.5">
                  <span className="text-slate-400 flex items-center gap-1.5">❄️ Temperatura mínima</span>
                  <span className="font-bold text-slate-900">{eventos.tempMin}°C a las {formatHora(String(eventos.horaMin?.hora))}</span>
                </div>
                <div className="flex justify-between items-center border-b border-slate-50 pb-1.5">
                  <span className="text-slate-400 flex items-center gap-1.5">🕒 Inicio de lluvia</span>
                  <span className="font-bold text-slate-900">{eventos.inicioLluvia ? formatHora(String(eventos.inicioLluvia.hora)) : 'No esperada'}</span>
                </div>
                <div className="flex justify-between items-center border-b border-slate-50 pb-1.5">
                  <span className="text-slate-400 flex items-center gap-1.5">🕒 Fin de lluvia</span>
                  <span className="font-bold text-slate-900">{eventos.finLluvia ? formatHora(String(eventos.finLluvia.hora)) : 'No esperada'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 flex items-center gap-1.5">💧 Pico de precipitación</span>
                  <span className="font-bold text-blue-600">{eventos.picoPrecip?.precipitacion > 0 ? `${eventos.picoPrecip.precipitacion} mm/h a las ${formatHora(String(eventos.picoPrecip.hora))}` : '0.0 mm'}</span>
                </div>
              </div>
            ) : (
              <div className="text-slate-400 text-[0.75rem]">Análisis horario disponible en las primeras 48 horas.</div>
            )}
          </div>

          {/* MATRIZ TÉCNICA 3 COLUMNAS COMPLETA (Imagen 2) */}
          <div className="bg-white border border-slate-200 rounded-[14px] p-4 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
            <div className="flex items-center gap-2 text-[0.82rem] font-bold text-slate-900 border-b border-slate-100 pb-2.5 mb-4">
              <span>📊</span>
              <span>Detalles técnicos del día</span>
            </div>
            <div className="grid grid-cols-3 gap-x-2 gap-y-4 text-center text-[0.7rem]">
              <div>
                <div className="text-slate-400 font-medium">Amplitud térmica</div>
                <div className="font-extrabold text-slate-900 mt-0.5">{tecnico?.amplitud ?? '--'} °C</div>
              </div>
              <div>
                <div className="text-slate-400 font-medium">Humedad relativa media</div>
                <div className="font-extrabold text-slate-900 mt-0.5">{tecnico?.humedadMedia ?? '--'} %</div>
              </div>
              <div>
                <div className="text-slate-400 font-medium">Horas con HR &gt; 90%</div>
                <div className="font-extrabold text-slate-900 mt-0.5">{tecnico?.horasHR90 ?? '--'} horas</div>
              </div>
              <div>
                <div className="text-slate-400 font-medium">Radiación solar máxima</div>
                <div className="font-extrabold text-slate-900 mt-0.5">{tecnico?.radiacion ?? '--'} W/m²</div>
              </div>
              <div>
                <div className="text-slate-400 font-medium">Punto de rocío promedio</div>
                <div className="font-extrabold text-slate-900 mt-0.5">{tecnico?.rocioPromedio ?? '--'} °C</div>
              </div>
              <div className="col-span-3 border-t border-slate-100 pt-2 text-center">
                <div className="text-slate-400 font-medium">Presión atmosférica</div>
                <div className="font-extrabold text-slate-900 mt-0.5">{tecnico?.presion ?? '--'} hPa</div>
              </div>
            </div>
          </div>
        </div>
        <Sidebar alertasCount={alertasCount} onToggle={setSidebarCollapsed} ultimaActualizacion={pronostico?.timestamp} coords={coords} lugar={lugar} />
      </div>
    )
  }

  // ── RENDER COMPRENSIVO PARA ESCRITORIO (PC / TAB) ───────────────────────
  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden bg-slate-50 font-sans">
      <Sidebar alertasCount={alertasCount} onToggle={setSidebarCollapsed} ultimaActualizacion={pronostico?.timestamp} coords={coords} lugar={lugar} />

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <div className="bg-white border-b border-slate-200 px-5 py-[10px] flex items-center justify-between shrink-0 h-[52px]">
          <div className="flex items-center gap-2">
            <MapPin size={15} color="#2563eb" />
            <span className="font-semibold text-blue-600 text-[0.88rem]">{lugar}</span>
            <span className="text-slate-400 text-[0.75rem] hidden md:block">{coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="mb-5">
            <h1 className="text-[1.6rem] font-extrabold text-slate-900 margin-0">Pronóstico 5 días</h1>
            <p className="text-[0.82rem] text-slate-400 mt-1">Consulta el comportamiento del clima para los próximos días</p>
          </div>

          {diario.length === 0 ? (
            <div className="text-slate-400 text-[0.9rem] p-5">Cargando pronóstico...</div>
          ) : (
            <div className="grid grid-cols-5 gap-3.5 mb-6">
              {diario.map((dia, i) => {
                const horasEsteDia = horarioPorDia[dia.fecha] || []
                const cond = getClasificacion(horasEsteDia, dia.precipitacion, dia.probabilidad)
                const activo = i === diaSeleccionado
                return (
                  <div key={dia.fecha} onClick={() => setDiaSeleccionado(i)}
                    className={`bg-white rounded-xl p-4 cursor-pointer border transition-all ${
                      activo ? 'border-blue-600 shadow-[0_4px_12px_rgba(37,99,235,0.1)] bg-white' : 'border-slate-200 bg-slate-50 hover:bg-slate-100/50'
                    }`}>
                    <div className={`text-[0.7rem] font-bold ${activo ? 'text-blue-600' : 'text-slate-400'}`}>{esHoy(dia.fecha) ? 'Hoy' : formatFecha(dia.fecha, true)}</div>
                    <div className="text-3xl my-2">{cond.icono}</div>
                    <div className="text-[0.78rem] text-slate-700 font-semibold truncate">{cond.label}</div>
                    <div className="text-[1.1rem] font-extrabold mt-1">
                      <span className="text-red-500">{dia.tempMax}°</span> / <span className="text-blue-500">{dia.tempMin}°</span>
                    </div>
                    <div className="flex flex-col gap-1 mt-3 text-[0.65rem] text-slate-400 font-medium">
                      <span>💧 Prob: {dia.probabilidad}%</span>
                      <span>🌧️ Acum: {dia.precipitacion} mm</span>
                      <span>💨 Viento: {dia.viento} km/h</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {diaActual && condicion && (
            <div>
              <h2 className="text-[1.1rem] font-bold text-slate-900 mb-4">Detalle del pronóstico</h2>
              <div className="grid grid-cols-[290px_1fr] gap-4 mb-4">
                {/* INFO GENERAL */}
                <div className="bg-white rounded-xl p-[18px] border border-slate-200 shadow-sm">
                  <div className="text-[0.7rem] font-bold text-slate-400 tracking-wider mb-4">INFORMACIÓN GENERAL DEL DÍA</div>
                  <div className="flex flex-col gap-3">
                    {[
                      { icon: <Thermometer size={14} className="text-red-500" />, label: 'Temperatura máxima', valor: `${diaActual.tempMax}°C`, color: 'text-red-500' },
                      { icon: <Thermometer size={14} className="text-blue-500" />, label: 'Temperatura mínima', valor: `${diaActual.tempMin}°C`, color: 'text-blue-500' },
                      { icon: <Droplets size={14} className="text-sky-500" />, label: 'Lluvia acumulada', valor: `${diaActual.precipitacion} mm`, color: 'text-sky-600' },
                      { icon: <Droplets size={14} className="text-slate-400" />, label: 'Probabilidad de lluvia', valor: `${diaActual.probabilidad}%`, color: 'text-slate-700' },
                      { icon: <Wind size={14} className="text-emerald-500" />, label: 'Viento promedio', valor: `${diaActual.viento} km/h`, color: 'text-emerald-600' },
                      { icon: <Droplets size={14} className="text-purple-500" />, label: 'Humedad promedio', valor: `${diaActual.humedad}%`, color: 'text-purple-600' },
                      { icon: <Clock size={14} className="text-amber-500" />, label: 'Presión atmosférica', valor: `${tecnico?.presion ?? 904} hPa`, color: 'text-amber-600' },
                    ].map((item, i) => (
                      <div key={i} className="flex justify-between items-center py-1 border-b border-slate-100 last:border-none">
                        <div className="flex items-center gap-2 text-[0.78rem] text-slate-600">{item.icon} {item.label}</div>
                        <span className={`text-[0.82rem] font-bold ${item.color}`}>{item.valor}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* GRÁFICA */}
                <div className="bg-white rounded-xl p-[18px] border border-slate-200 shadow-sm">
                  <div className="text-[0.78rem] font-bold text-slate-900 mb-3">{formatFecha(diaActual.fecha)}</div>
                  <div className="flex gap-1.5 mb-4">
                    {tabsGrafica.map(tab => (
                      <button key={tab.id} onClick={() => setTabGrafica(tab.id)}
                        className={`px-3 py-1.5 rounded-lg border text-[0.75rem] font-bold cursor-pointer transition-all ${
                          tabGrafica === tab.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                        }`}>
                        {tab.icono} {tab.label}
                      </button>
                    ))}
                  </div>
                  {horasDia.length > 0 ? <Grafica horas={horasDia} tipo={tabGrafica} /> : <div className="text-slate-400 text-center py-8 text-[0.82rem]">Sin datos detallados.</div>}
                </div>
              </div>

              {/* PANELES INFERIORES DESKTOP */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white rounded-xl p-[18px] border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-2 text-[0.82rem] font-bold text-slate-900 border-b border-slate-100 pb-2 mb-2.5">📋 Resumen agronómico del día</div>
                  <p className="text-[0.78rem] text-slate-600 leading-relaxed whiteSpace-pre-line">{generarResumenTecnico(diaActual, horasDia, condicion, tecnico)}</p>
                </div>
                <div className="bg-white rounded-xl p-[18px] border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-2 text-[0.82rem] font-bold text-slate-900 border-b border-slate-100 pb-2 mb-2.5">📅 Eventos destacados</div>
                  {horasDia.length > 0 && eventos ? (
                    <div className="flex flex-col gap-2.5 text-[0.76rem]">
                      <div className="flex justify-between">
                        <span className="text-slate-400">🌡️ Temp Máxima:</span>
                        <span className="font-bold text-slate-900">{eventos.tempMax}°C a las {formatHora(String(eventos.horaMax?.hora))}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">❄️ Temp Mínima:</span>
                        <span className="font-bold text-slate-900">{eventos.tempMin}°C a las {formatHora(String(eventos.horaMin?.hora))}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">🌧️ Inicio Lluvia:</span>
                        <span className="font-bold text-slate-900">{eventos.inicioLluvia ? formatHora(String(eventos.inicioLluvia.hora)) : 'No esperada'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">🕒 Fin Lluvia:</span>
                        <span className="font-bold text-slate-900">{eventos.finLluvia ? formatHora(String(eventos.finLluvia.hora)) : 'No esperada'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">💧 Pico Precipitación:</span>
                        <span className="font-bold text-blue-600">{eventos.picoPrecip?.precipitacion > 0 ? `${eventos.picoPrecip.precipitacion} mm` : '0.0 mm'}</span>
                      </div>
                    </div>
                  ) : <div className="text-slate-400 text-[0.75rem]">Datos disponibles para las primeras 48h.</div>}
                </div>

                <div className="bg-white rounded-xl p-[18px] border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-2 text-[0.82rem] font-bold text-slate-900 border-b border-slate-100 pb-2 mb-3">📊 Detalles técnicos del día</div>
                  {tecnico ? (
                    <div className="grid grid-cols-3 gap-y-3 gap-x-1.5 text-center text-[0.68rem]">
                      <div><div className="text-slate-400 font-medium">Amp. térmica</div><div className="font-bold mt-0.5">{tecnico.amplitud} °C</div></div>
                      <div><div className="text-slate-400 font-medium">HR Media</div><div className="font-bold mt-0.5">{tecnico.humedadMedia} %</div></div>
                      <div><div className="text-slate-400 font-medium">HR &gt; 90%</div><div className="font-bold mt-0.5">{tecnico.horasHR90} h</div></div>
                      <div><div className="text-slate-400 font-medium">Radiación Máx</div><div className="font-bold mt-0.5">{tecnico.radiacion} W/m²</div></div>
                      <div><div className="text-slate-400 font-medium">Punto Rocío</div><div className="font-bold mt-0.5">{tecnico.rocioPromedio} °C</div></div>
                      <div className="col-span-3 text-center border-t border-slate-100 pt-2"><div className="text-slate-400 font-medium">Presión atmosférica</div><div className="font-bold mt-0.5">{tecnico.presion ?? '--'} hPa</div></div>
                    </div>
                  ) : <div className="text-slate-400 text-[0.75rem]">Cálculos disponibles para las primeras 48h.</div>}
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  )
}
