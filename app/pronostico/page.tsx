'use client'

import { useState, useEffect } from 'react'
import useSWR from 'swr'
import { MapPin, Droplets, Wind, Thermometer, Clock } from 'lucide-react'
import Sidebar from '@/components/Sidebar'

const fetcher = (url: string) => fetch(url).then(r => r.json())

// ── Helpers ────────────────────────────────────────────────────────────────

function calcularPuntoRocio(temp: number, humedad: number): number {
  const a = 17.625, b = 243.04
  const alpha = ((a * temp) / (b + temp)) + Math.log(humedad / 100)
  return parseFloat(((b * alpha) / (a - alpha)).toFixed(1))
}

function formatFecha(fecha: string, corta = false) {
  const d = new Date(fecha + 'T12:00:00')
  if (corta) return d.toLocaleDateString('es-CO', { weekday: 'short', day: '2-digit', month: 'short' })
  return d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function formatHora(iso: string) {
  return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function esHoy(fecha: string) {
  return fecha === new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Bogota' })
}

function getCondicion(mm: number, prob: number): { label: string; icono: string } {
  if (mm > 10) return { label: 'Tormenta', icono: '⛈️' }
  if (mm > 5)  return { label: 'Lluvioso', icono: '🌧️' }
  if (mm > 2)  return { label: 'Lluvia moderada', icono: '🌦️' }
  if (mm > 0.5) return { label: 'Lluvia leve', icono: '🌦️' }
  if (prob > 70) return { label: 'Muy nublado', icono: '☁️' }
  if (prob > 40) return { label: 'Parcialmente nublado', icono: '⛅' }
  if (prob > 20) return { label: 'Mayormente soleado', icono: '🌤️' }
  return { label: 'Soleado', icono: '☀️' }
}

function getDescripcionDia(mm: number, prob: number, tempMax: number, tempMin: number, humedad: number): string {
  const condicion = getCondicion(mm, prob)
  let desc = `Se espera un día ${condicion.label.toLowerCase()}`

  if (mm > 2) {
    desc += ` con ${mm.toFixed(1)} mm de lluvia acumulada`
    if (prob > 70) desc += ` y alta probabilidad de precipitación`
  } else if (prob > 50) {
    desc += ` con posibilidad de lluvia leve`
  } else {
    desc += ` con condiciones estables`
  }

  if (tempMax - tempMin > 8) {
    desc += `. Se esperan variaciones importantes de temperatura entre ${tempMin}°C y ${tempMax}°C`
  } else {
    desc += `. Temperaturas entre ${tempMin}°C y ${tempMax}°C`
  }

  if (humedad > 85) {
    desc += `. Humedad muy alta, condiciones favorables para enfermedades fungosas en cultivos`
  } else if (humedad > 70) {
    desc += `. Humedad moderada-alta`
  }

  desc += '.'
  return desc
}

interface HoraData { hora: string; temp: number; precipitacion: number; probabilidad: number; humedad: number; viento: number }
interface DiaData { fecha: string; tempMax: number; tempMin: number; precipitacion: number; probabilidad: number; viento: number; humedad: number }

function calcularEventos(horas: HoraData[]) {
  if (!horas || horas.length === 0) return null

  const tempMax = Math.max(...horas.map(h => h.temp))
  const tempMin = Math.min(...horas.map(h => h.temp))
  const horaMax = horas.find(h => h.temp === tempMax)
  const horaMin = horas.find(h => h.temp === tempMin)

  // Inicio lluvia: primera hora con más de 2mm
  const inicioLluvia = horas.find(h => h.precipitacion > 2)
  // Fin lluvia: después del inicio, primera hora con menos de 2mm
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
  const presion = 903

  return { amplitud, humedadMedia, horasHR90, evapotranspiracion, radiacion, rocioPromedio, presion }
}

// ── Gráfica SVG simple ──────────────────────────────────────────────────────
function Grafica({ horas, tipo }: { horas: HoraData[]; tipo: 'temp' | 'precipitacion' | 'humedad' | 'viento' }) {
  if (!horas || horas.length === 0) return null

  const valores = horas.map(h => Number(h[tipo]))
  const min = Math.min(...valores)
  const max = Math.max(...valores)
  const rango = max - min || 1

  const W = 800, H = 160, padX = 40, padY = 20
  const innerW = W - padX * 2
  const innerH = H - padY * 2

  const puntos = valores.map((v, i) => ({
    x: padX + (i / (valores.length - 1)) * innerW,
    y: padY + innerH - ((v - min) / rango) * innerH,
    v,
  }))

  const pathLine = puntos.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const pathArea = `${pathLine} L ${puntos[puntos.length - 1].x} ${H - padY} L ${puntos[0].x} ${H - padY} Z`

  const colores: Record<string, string> = {
    temp: '#2563eb', precipitacion: '#0ea5e9', humedad: '#8b5cf6', viento: '#10b981'
  }
  const color = colores[tipo]

  const horasLabel = horas.filter((_, i) => i % 2 === 0)

  return (
    <svg viewBox={`0 0 ${W} ${H + 30}`} style={{ width: '100%', height: 'auto' }}>
      {/* Área */}
      <defs>
        <linearGradient id={`grad-${tipo}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.15" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={pathArea} fill={`url(#grad-${tipo})`} />
      <path d={pathLine} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

      {/* Puntos y valores */}
      {puntos.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="4" fill={color} />
          <text x={p.x} y={p.y - 8} textAnchor="middle" fontSize="10" fill="#475569" fontWeight="600">
            {tipo === 'temp' ? `${p.v}°` : tipo === 'precipitacion' ? `${p.v}` : tipo === 'humedad' ? `${p.v}%` : `${p.v}`}
          </text>
        </g>
      ))}

      {/* Eje X */}
      {horasLabel.map((h, i) => {
        const idx = horas.indexOf(h)
        const x = padX + (idx / (valores.length - 1)) * innerW
        return (
          <text key={i} x={x} y={H + 16} textAnchor="middle" fontSize="10" fill="#94a3b8">
            {formatHora(String(h.hora))}
          </text>
        )
      })}

      {/* Línea base */}
      <line x1={padX} y1={H - padY} x2={W - padX} y2={H - padY} stroke="#e2e8f0" strokeWidth="1" />
    </svg>
  )
}

// ── Componente principal ────────────────────────────────────────────────────
export default function Pronosticos() {
  const [coords] = useState({ lat: 3.9044, lng: -76.2960 })
  const [lugar] = useState('Buga')
  const [diaSeleccionado, setDiaSeleccionado] = useState(0)
  const [tabGrafica, setTabGrafica] = useState<'temp' | 'precipitacion' | 'humedad' | 'viento'>('temp')
  const [, setSidebarCollapsed] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const { data: pronostico } = useSWR(
    `/api/pronostico?lat=${coords.lat}&lng=${coords.lng}`,
    fetcher, { refreshInterval: 1200000 }
  )

  const diario: DiaData[] = Array.isArray(pronostico?.diario) ? pronostico.diario.slice(0, 5) : []
  const horarioPorDia: Record<string, HoraData[]> = pronostico?.horarioPorDia || {}

  const diaActual = diario[diaSeleccionado]
  const horasDia: HoraData[] = diaActual ? (horarioPorDia[diaActual.fecha] || []) : []
  const condicion = diaActual ? getCondicion(diaActual.precipitacion, diaActual.probabilidad) : null
  const eventos = calcularEventos(horasDia)
  const tecnico = diaActual && eventos ? calcularDetallesTecnicos(horasDia, diaActual.tempMax, diaActual.tempMin) : null

  const tabsGrafica = [
    { id: 'temp' as const, label: 'Temperatura', icono: '🌡️' },
    { id: 'precipitacion' as const, label: 'Precipitación', icono: '🌧️' },
    { id: 'humedad' as const, label: 'Humedad', icono: '💧' },
    { id: 'viento' as const, label: 'Viento', icono: '💨' },
  ]

  const contenido = (
    <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '12px' : '20px 24px' }}>

      {/* TÍTULO */}
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: isMobile ? '1.3rem' : '1.6rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Pronóstico 5 días</h1>
        <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '4px 0 0' }}>
          Consulta el comportamiento del clima para los próximos días
        </p>
      </div>

      {/* TARJETAS 5 DÍAS */}
      {diario.length === 0 ? (
        <div style={{ color: '#94a3b8', fontSize: '0.9rem', padding: '20px' }}>Cargando pronóstico...</div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(5, 1fr)',
          gap: '10px', marginBottom: '24px',
        }}>
          {diario.map((dia, i) => {
            const cond = getCondicion(dia.precipitacion, dia.probabilidad)
            const activo = i === diaSeleccionado
            return (
              <div key={dia.fecha} onClick={() => setDiaSeleccionado(i)} style={{
                background: activo ? '#ffffff' : '#f8fafc',
                border: activo ? '2px solid #2563eb' : '1px solid #e2e8f0',
                borderRadius: '14px', padding: '14px 12px', cursor: 'pointer',
                boxShadow: activo ? '0 4px 12px rgba(37,99,235,0.12)' : '0 1px 3px rgba(0,0,0,0.04)',
                transition: 'all 0.2s',
              }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: activo ? '#2563eb' : '#94a3b8', marginBottom: '2px' }}>
                  {esHoy(dia.fecha) ? 'Hoy' : formatFecha(dia.fecha, true)}
                </div>
                {esHoy(dia.fecha) && <div style={{ fontSize: '0.6rem', color: '#94a3b8', marginBottom: '6px' }}>Hoy</div>}
                <div style={{ fontSize: '2rem', margin: '8px 0' }}>{cond.icono}</div>
                <div style={{ fontSize: '0.75rem', color: '#475569', marginBottom: '8px', fontWeight: 500 }}>{cond.label}</div>
                <div style={{ fontSize: '1rem', fontWeight: 800 }}>
                  <span style={{ color: '#ef4444' }}>{dia.tempMax}°</span>
                  {' / '}
                  <span style={{ color: '#2563eb' }}>{dia.tempMin}°</span>
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.65rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '2px' }}>
                    💧 {dia.probabilidad}%
                  </span>
                  <span style={{ fontSize: '0.65rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '2px' }}>
                    🌧️ {dia.precipitacion} mm
                  </span>
                  <span style={{ fontSize: '0.65rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '2px' }}>
                    💨 {dia.viento} km/h
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* DETALLE DEL DÍA */}
      {diaActual && (
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', marginBottom: '16px' }}>
            Detalle del pronóstico
          </h2>

          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '280px 1fr',
            gap: '16px', marginBottom: '16px',
          }}>
            {/* INFO GENERAL */}
            <div style={{
              background: '#ffffff', borderRadius: '14px', padding: '18px',
              border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', marginBottom: '12px' }}>
                INFORMACIÓN GENERAL DEL DÍA
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <span style={{ fontSize: '2.5rem' }}>{condicion?.icono}</span>
                <div>
                  <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.9rem' }}>{condicion?.label}</div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px', lineHeight: 1.4 }}>
                    {getDescripcionDia(diaActual.precipitacion, diaActual.probabilidad, diaActual.tempMax, diaActual.tempMin, diaActual.humedad)}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  { icon: <Thermometer size={14} color="#ef4444" />, label: 'Temperatura máxima', valor: `${diaActual.tempMax}°C`, color: '#ef4444' },
                  { icon: <Thermometer size={14} color="#2563eb" />, label: 'Temperatura mínima', valor: `${diaActual.tempMin}°C`, color: '#2563eb' },
                  { icon: <Droplets size={14} color="#0ea5e9" />, label: 'Lluvia acumulada', valor: `${diaActual.precipitacion} mm`, color: '#0ea5e9' },
                  { icon: <Droplets size={14} color="#64748b" />, label: 'Probabilidad de lluvia', valor: `${diaActual.probabilidad}%`, color: '#64748b' },
                  { icon: <Wind size={14} color="#10b981" />, label: 'Viento promedio', valor: `${diaActual.viento} km/h O`, color: '#10b981' },
                  { icon: <Droplets size={14} color="#8b5cf6" />, label: 'Humedad promedio', valor: `${diaActual.humedad}%`, color: '#8b5cf6' },
                  { icon: <Clock size={14} color="#f59e0b" />, label: 'Presión atmosférica', valor: `${tecnico?.presion ?? 903} hPa`, color: '#f59e0b' },
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#475569' }}>
                      {item.icon} {item.label}
                    </div>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: item.color }}>{item.valor}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* GRÁFICA */}
            <div style={{
              background: '#ffffff', borderRadius: '14px', padding: '18px',
              border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0f172a', marginBottom: '12px' }}>
                {esHoy(diaActual.fecha) ? 'Hoy' : formatFecha(diaActual.fecha)}
              </div>

              {/* Tabs gráfica */}
              <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
                {tabsGrafica.map(tab => (
                  <button key={tab.id} onClick={() => setTabGrafica(tab.id)} style={{
                    padding: '6px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                    background: tabGrafica === tab.id ? '#2563eb' : '#f1f5f9',
                    color: tabGrafica === tab.id ? '#ffffff' : '#64748b',
                    fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px',
                  }}>
                    {tab.icono} {tab.label}
                  </button>
                ))}
              </div>

              {horasDia.length > 0 ? (
                <Grafica horas={horasDia} tipo={tabGrafica} />
              ) : (
                <div style={{ color: '#94a3b8', fontSize: '0.82rem', padding: '20px 0' }}>Sin datos horarios para este día</div>
              )}
            </div>
          </div>

          {/* EVENTOS + TÉCNICO */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr',
            gap: '16px',
          }}>

            {/* RESUMEN */}
            <div style={{
              background: '#ffffff', borderRadius: '14px', padding: '18px',
              border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                <span>📋</span>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a' }}>Resumen del día</span>
              </div>
              <p style={{ fontSize: '0.78rem', color: '#475569', lineHeight: 1.6, margin: 0 }}>
                {getDescripcionDia(diaActual.precipitacion, diaActual.probabilidad, diaActual.tempMax, diaActual.tempMin, diaActual.humedad)}
              </p>
              {diaActual.precipitacion > 2 && (
                <p style={{ fontSize: '0.78rem', color: '#475569', lineHeight: 1.6, marginTop: '8px' }}>
                  Se recomienda suspender o reducir las operaciones de cosecha durante las horas de mayor precipitación.
                </p>
              )}
            </div>

            {/* EVENTOS DESTACADOS */}
            <div style={{
              background: '#ffffff', borderRadius: '14px', padding: '18px',
              border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                <span>📅</span>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a' }}>Eventos destacados</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {eventos?.horaMax && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <Thermometer size={16} color="#ef4444" style={{ flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Temperatura máxima</div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a' }}>
                        {eventos.tempMax}°C a las {formatHora(String(eventos.horaMax.hora))}
                      </div>
                    </div>
                  </div>
                )}
                {eventos?.horaMin && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <Thermometer size={16} color="#2563eb" style={{ flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Temperatura mínima</div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a' }}>
                        {eventos.tempMin}°C a las {formatHora(String(eventos.horaMin.hora))}
                      </div>
                    </div>
                  </div>
                )}
                {eventos?.inicioLluvia ? (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <Clock size={16} color="#0ea5e9" style={{ flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Inicio de lluvia (&gt;2mm)</div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a' }}>
                        {formatHora(String(eventos.inicioLluvia.hora))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <Clock size={16} color="#10b981" style={{ flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Lluvia significativa</div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#10b981' }}>No esperada</div>
                    </div>
                  </div>
                )}
                {eventos?.finLluvia && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <Clock size={16} color="#94a3b8" style={{ flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Fin de lluvia</div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a' }}>
                        {formatHora(String(eventos.finLluvia.hora))}
                      </div>
                    </div>
                  </div>
                )}
                {eventos?.picoPrecip && eventos.picoPrecip.precipitacion > 0 && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <Droplets size={16} color="#0ea5e9" style={{ flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Pico de precipitación</div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a' }}>
                        {eventos.picoPrecip.precipitacion} mm/h a las {formatHora(String(eventos.picoPrecip.hora))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* DETALLES TÉCNICOS */}
            <div style={{
              background: '#ffffff', borderRadius: '14px', padding: '18px',
              border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                <span>📊</span>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a' }}>Detalles técnicos del día</span>
              </div>
              {tecnico && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[
                    { label: 'Amplitud térmica', valor: `${tecnico.amplitud} °C` },
                    { label: 'Humedad relativa media', valor: `${tecnico.humedadMedia} %` },
                    { label: 'Horas con HR > 90%', valor: `${tecnico.horasHR90} horas` },
                    { label: 'Evapotranspiración estimada', valor: `${tecnico.evapotranspiracion} mm/día` },
                    { label: 'Radiación solar máxima', valor: `${tecnico.radiacion} W/m²` },
                    { label: 'Punto de rocío promedio', valor: `${tecnico.rocioPromedio} °C` },
                    { label: 'Presión atmosférica', valor: `${tecnico.presion} hPa` },
                  ].map((item, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid #f1f5f9' }}>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{item.label}</span>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0f172a' }}>{item.valor}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )

  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f1f5f9', fontFamily: '"DM Sans", system-ui, sans-serif' }}>
        <div style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <MapPin size={14} color="#2563eb" />
          <span style={{ fontWeight: 600, color: '#2563eb', fontSize: '0.88rem' }}>{lugar}</span>
        </div>
        {contenido}
        <div style={{ background: '#ffffff', borderTop: '1px solid #e2e8f0', display: 'flex', flexShrink: 0 }}>
          {[
            { id: 'dashboard', label: 'Dashboard', emoji: '📊', href: '/' },
            { id: 'pronosticos', label: 'Pronósticos', emoji: '🌦️', href: '/pronosticos' },
            { id: 'alertas', label: 'Alertas', emoji: '🔔', href: '/alertas' },
          ].map(tab => (
            <a key={tab.id} href={tab.href} style={{
              flex: 1, padding: '10px 0', background: 'none', border: 'none',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
              textDecoration: 'none',
              color: tab.id === 'pronosticos' ? '#2563eb' : '#94a3b8',
              borderTop: tab.id === 'pronosticos' ? '2px solid #2563eb' : '2px solid transparent',
            }}>
              <span style={{ fontSize: '1.2rem' }}>{tab.emoji}</span>
              <span style={{ fontSize: '0.65rem', fontWeight: tab.id === 'pronosticos' ? 700 : 400 }}>{tab.label}</span>
            </a>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#f1f5f9', fontFamily: '"DM Sans", system-ui, sans-serif' }}>
      <Sidebar alertasCount={0} onToggle={setSidebarCollapsed} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100vh', overflow: 'hidden' }}>
        <div style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, height: '52px' }}>
          <MapPin size={15} color="#2563eb" />
          <span style={{ fontWeight: 600, color: '#2563eb', fontSize: '0.88rem' }}>{lugar}</span>
          <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}</span>
        </div>
        {contenido}
      </div>
    </div>
  )
}
