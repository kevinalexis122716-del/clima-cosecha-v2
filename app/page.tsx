'use client'

import { useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import useSWR from 'swr'
import Image from 'next/image'
import { MapPin, Calendar, Clock } from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import CondicionWidget from '@/components/CondicionWidget'

const Mapa = dynamic(() => import('@/components/Mapa'), { ssr: false })
const fetcher = (url: string) => fetch(url).then(r => r.json())

function getColorPrecip(mm: number) {
  if (mm <= 0.5) return '#10b981'
  if (mm <= 2) return '#84cc16'
  if (mm <= 5) return '#f59e0b'
  if (mm <= 10) return '#f97316'
  if (mm <= 20) return '#ef4444'
  return '#7c3aed'
}

function formatHora(isoString: string) {
  try {
    return new Date(isoString).toLocaleTimeString('es-CO', {
      hour: '2-digit', minute: '2-digit', hour12: false
    })
  } catch { return '--:--' }
}

function getFechaActual() {
  return new Date().toLocaleDateString('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })
}

function getHoraActual() {
  return new Date().toLocaleTimeString('es-CO', {
    hour: '2-digit', minute: '2-digit', hour12: true
  }).toUpperCase()
}

function getIconoCondicion(mm: number, prob: number) {
  if (mm > 5) return '⛈️'
  if (mm > 0.5) return '🌧️'
  if (prob > 60) return '⛅'
  if (prob > 30) return '🌤️'
  return '☀️'
}

export default function Home() {
  const [coords, setCoords] = useState({ lat: 3.9038, lng: -76.2982 })
  const [lugar, setLugar] = useState('Tuluá')
  const [, setSidebarCollapsed] = useState(false)

  const { data: clima, isLoading: loadingClima } = useSWR(
    `/api/clima?lat=${coords.lat}&lng=${coords.lng}`,
    fetcher, { refreshInterval: 300000 }
  )

  const { data: pronostico, isLoading: loadingPron } = useSWR(
    `/api/pronostico?lat=${coords.lat}&lng=${coords.lng}`,
    fetcher, { refreshInterval: 600000 }
  )

  const onClickMapa = useCallback(async (lat: number, lng: number) => {
    setCoords({ lat, lng })
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=es`
      )
      const data = await res.json()
      const nombre = data.address?.city || data.address?.town ||
        data.address?.village || data.address?.county || 'Ubicación seleccionada'
      setLugar(nombre)
    } catch { setLugar('Ubicación seleccionada') }
  }, [])

  const horario = pronostico?.horario || []
  const alertasCount = horario.filter((h: Record<string, number>) => h.precipitacion > 0.5).length

  const kpis = [
    {
      label: 'TEMPERATURA',
      valor: loadingClima ? '--' : `${clima?.temp ?? '--'}°C`,
      sub: `Sensación ${clima?.sensacion ?? '--'}°C`,
      icono: '/iconos/temperatura.png',
      color: '#f97316',
    },
    {
      label: 'PROB. LLUVIA',
      valor: loadingClima ? '--' : `${clima?.probabilidad ?? '--'}%`,
      sub: (clima?.probabilidad ?? 0) > 60 ? 'Alta' : (clima?.probabilidad ?? 0) > 30 ? 'Moderada' : 'Baja',
      icono: '/iconos/probabilidad.png',
      color: '#2563eb',
    },
    {
      label: 'PRECIPITACIÓN',
      valor: loadingClima ? '--' : `${clima?.precipitacion ?? '--'} mm/h`,
      sub: (clima?.precipitacion ?? 0) > 0.5 ? 'Lluvia activa' : 'Sin lluvia',
      icono: '/iconos/lluvia.png',
      color: getColorPrecip(clima?.precipitacion ?? 0),
    },
    {
      label: 'VIENTO',
      valor: loadingClima ? '--' : `${clima?.viento ?? '--'} km/h`,
      sub: clima?.direccionTexto ?? '--',
      icono: '/iconos/viento.png',
      color: '#0ea5e9',
    },
    {
      label: 'HUMEDAD',
      valor: loadingClima ? '--' : `${clima?.humedad ?? '--'}%`,
      sub: (clima?.humedad ?? 0) > 80 ? 'Alta' : (clima?.humedad ?? 0) > 50 ? 'Moderada' : 'Baja',
      icono: '/iconos/humedad.png',
      color: '#8b5cf6',
    },
    {
      label: 'PRESIÓN',
      valor: loadingClima ? '--' : `${clima?.presion ?? '--'} hPa`,
      sub: 'Estable',
      icono: '/iconos/presion.png',
      color: '#f59e0b',
    },
  ]

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      overflow: 'hidden',
      background: '#f1f5f9',
      fontFamily: '"DM Sans", system-ui, sans-serif',
    }}>
      <Sidebar alertasCount={alertasCount} onToggle={setSidebarCollapsed} />

      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        height: '100vh',
        overflow: 'hidden',
      }}>

        {/* TOPBAR */}
        <div style={{
          background: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          padding: '10px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          height: '52px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MapPin size={15} color="#2563eb" />
            <span style={{ fontWeight: 600, color: '#2563eb', fontSize: '0.88rem' }}>{lugar}</span>
            <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
              {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '0.82rem' }}>
              <Calendar size={14} />
              <span style={{ textTransform: 'capitalize' }}>{getFechaActual()}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#0f172a', fontSize: '0.88rem', fontWeight: 700 }}>
              <Clock size={14} color="#2563eb" />
              <span>{getHoraActual()}</span>
            </div>
          </div>
        </div>

        {/* CONTENIDO */}
        <div style={{
          flex: 1,
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          overflow: 'hidden',
        }}>

          {/* KPI STRIP */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(6, 1fr)',
            gap: '10px',
            flexShrink: 0,
          }}>
            {kpis.map((kpi, i) => (
              <div key={i} style={{
                background: '#ffffff',
                borderRadius: '12px',
                padding: '10px 14px',
                border: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}>
                <Image
                  src={kpi.icono}
                  alt={kpi.label}
                  width={36}
                  height={36}
                  style={{ objectFit: 'contain', flexShrink: 0 }}
                />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.6rem', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.4px' }}>
                    {kpi.label}
                  </div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: kpi.color, whiteSpace: 'nowrap' }}>
                    {kpi.valor}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                    {kpi.sub}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* MAPA + COLUMNA DERECHA */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 300px',
            gap: '10px',
            flex: 1,
            minHeight: 0,
          }}>

            {/* MAPA */}
            <div style={{
              background: '#ffffff',
              borderRadius: '14px',
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
              position: 'relative',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}>
              <div style={{
                position: 'absolute', top: '10px', left: '10px', zIndex: 10,
                background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)',
                borderRadius: '8px', padding: '5px 12px',
                border: '1px solid #e2e8f0',
                fontSize: '0.72rem', color: '#475569',
                display: 'flex', alignItems: 'center', gap: '8px',
                boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
              }}>
                <span style={{
                  width: '7px', height: '7px', background: '#10b981',
                  borderRadius: '50%', display: 'inline-block',
                  boxShadow: '0 0 5px #10b981',
                }} />
                Mapa en tiempo real
                <span style={{
                  background: '#ecfdf5', color: '#10b981',
                  fontSize: '0.62rem', fontWeight: 700,
                  padding: '1px 7px', borderRadius: '20px',
                }}>En vivo</span>
              </div>

              <div style={{
                position: 'absolute', bottom: '10px', left: '10px', zIndex: 10,
                background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)',
                borderRadius: '8px', padding: '6px 12px',
                border: '1px solid #e2e8f0',
                fontSize: '0.68rem', color: '#475569',
                boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
              }}>
                <div style={{ marginBottom: '3px', fontWeight: 700, fontSize: '0.6rem', color: '#94a3b8' }}>INTENSIDAD</div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  {([['#84cc16', 'Ligera'], ['#f59e0b', 'Moderada'], ['#ef4444', 'Intensa']] as [string, string][]).map(([color, label]) => (
                    <span key={label} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ width: '9px', height: '9px', background: color, borderRadius: '2px', display: 'inline-block' }} />
                      {label}
                    </span>
                  ))}
                </div>
              </div>

              <Mapa lat={coords.lat} lng={coords.lng} onClickMapa={onClickMapa} />
            </div>

            {/* COLUMNA DERECHA — solo CondicionWidget ocupando todo */}
            <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <div style={{
                flex: 1,
                borderRadius: '14px',
                overflow: 'hidden',
                minHeight: 0,
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}>
                <CondicionWidget
                  precipitacion={clima?.precipitacion ?? 0}
                  probabilidad={clima?.probabilidad ?? 0}
                  temp={clima?.temp ?? 25}
                  humedad={clima?.humedad ?? 60}
                />
              </div>
            </div>
          </div>

          {/* PRÓXIMAS 24 HORAS */}
          <div style={{
            background: '#ffffff', borderRadius: '14px', padding: '12px 16px',
            border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            flexShrink: 0,
          }}>
            <div style={{ fontSize: '0.62rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '1px', marginBottom: '10px' }}>
              PRÓXIMAS 24 HORAS
            </div>
            {loadingPron ? (
              <div style={{ color: '#94a3b8', fontSize: '0.82rem' }}>Cargando pronóstico...</div>
            ) : (
              <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
                {horario.map((h: Record<string, number | string>, i: number) => {
                  const mm = Number(h.precipitacion)
                  const prob = Number(h.probabilidad)
                  const temp = Number(h.temp)
                  const color = getColorPrecip(mm)
                  const esAhora = i === 0
                  return (
                    <div key={i} style={{
                      minWidth: '70px',
                      background: esAhora ? '#eff6ff' : '#f8fafc',
                      borderRadius: '10px',
                      padding: '8px 6px',
                      textAlign: 'center',
                      border: esAhora ? '1.5px solid #2563eb' : `1px solid ${mm > 0.5 ? color + '40' : '#e2e8f0'}`,
                      flexShrink: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '3px',
                    }}>
                      <div style={{ fontSize: '0.66rem', color: esAhora ? '#2563eb' : '#94a3b8', fontWeight: 600 }}>
                        {esAhora ? 'Ahora' : formatHora(String(h.hora))}
                      </div>
                      <div style={{ fontSize: '0.95rem' }}>{getIconoCondicion(mm, prob)}</div>
                      <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0f172a' }}>{temp.toFixed(0)}°</div>
                      <div style={{ fontSize: '0.7rem', fontWeight: 700, color }}>
                        {mm.toFixed(1)}<span style={{ fontSize: '0.58rem', color: '#94a3b8' }}>mm</span>
                      </div>
                      <div style={{ fontSize: '0.62rem', color: '#94a3b8' }}>{prob.toFixed(0)}%</div>
                      <div style={{ height: '3px', background: '#e2e8f0', borderRadius: '4px' }}>
                        <div style={{ width: `${Math.min(prob, 100)}%`, height: '100%', background: color, borderRadius: '4px' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}