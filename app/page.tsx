'use client'

import { useState, useCallback, useEffect } from 'react'
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
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
  })
}

function getHoraActual() {
  return new Date().toLocaleTimeString('es-CO', {
    hour: '2-digit', minute: '2-digit', hour12: true
  }).toUpperCase()
}

// Icono meteorológico dinámico según precipitación y probabilidad
function getIconoCondicion(mm: number, prob: number) {
  if (mm > 5) return '⛈️'
  if (mm > 0.5) return '🌧️'
  if (prob > 60) return '⛅'
  if (prob > 30) return '🌤️'
  return '☀️'
}

export default function Home() {
  const [coords, setCoords] = useState({ lat: 3.9044, lng: -76.2960 })
  const [lugar, setLugar] = useState('Buga')
  const [, setSidebarCollapsed] = useState(false)

  useEffect(() => {
    const savedCoords = localStorage.getItem('coords')
    const savedLugar = localStorage.getItem('lugar')
    if (savedCoords) setCoords(JSON.parse(savedCoords))
    if (savedLugar) setLugar(savedLugar)
  }, [])

  // SWR configurado a 300000ms (5 minutos exactos de intervalo de refresco)
  const { data: clima, isLoading: loadingClima } = useSWR(
    `/api/clima?lat=${coords.lat}&lng=${coords.lng}`,
    fetcher, { refreshInterval: 300000 }
  )

  const { data: pronostico, isLoading: loadingPron } = useSWR(
    `/api/pronostico?lat=${coords.lat}&lng=${coords.lng}`,
    fetcher, { refreshInterval: 300000 }
  )

  const onClickMapa = useCallback(async (lat: number, lng: number) => {
    setCoords({ lat, lng })
    localStorage.setItem('coords', JSON.stringify({ lat, lng }))
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=es`
      )
      const data = await res.json()
      const nombre = data.address?.city || data.address?.town ||
        data.address?.village || data.address?.county || 'Ubicación seleccionada'
      setLugar(nombre)
      localStorage.setItem('lugar', nombre)
    } catch { setLugar('Ubicación seleccionada') }
  }, [])

  const onSelectHacienda = useCallback((h: { nombre: string; lat: number; lng: number }) => {
    setCoords({ lat: h.lat, lng: h.lng })
    setLugar(h.nombre)
    localStorage.setItem('coords', JSON.stringify({ lat: h.lat, lng: h.lng }))
    localStorage.setItem('lugar', h.nombre)
  }, [])

  const horario: Record<string, number | string>[] = Array.isArray(pronostico?.horario) ? pronostico.horario : []
  const alertasCount = horario.filter((h) => Number(h.precipitacion) > 5).length

  const kpis = [
    { label: 'TEMPERATURA', valor: loadingClima ? '--' : `${clima?.temp ?? '--'}°C`, sub: `Sensación ${clima?.sensacion ?? '--'}°C`, icono: '/iconos/temperatura.png', color: '#f97316' },
    { label: 'PROB. LLUVIA', valor: loadingClima ? '--' : (clima?.probabilidad != null ? `${clima.probabilidad}%` : '--'), sub: clima?.probabilidad == null ? 'Sin datos' : (clima.probabilidad > 60 ? 'Alta' : clima.probabilidad > 30 ? 'Moderada' : 'Baja'), icono: '/iconos/probabilidad.png', color: '#2563eb' },
    { label: 'PRECIPITACIÓN', valor: loadingClima ? '--' : `${clima?.precipitacion ?? '--'} mm`, sub: clima?.precipitacion == null ? 'Sin datos' : (clima.precipitacion > 0.5 ? 'Lluvia activa' : 'Sin lluvia'), icono: '/iconos/lluvia.png', color: getColorPrecip(clima?.precipitacion ?? 0) },
    { label: 'VIENTO', valor: loadingClima ? '--' : `${clima?.viento ?? '--'} km/h`, sub: clima?.direccionTexto ?? '--', icono: '/iconos/viento.png', color: '#0ea5e9' },
    { label: 'HUMEDAD', valor: loadingClima ? '--' : `${clima?.humedad ?? '--'}%`, sub: (clima?.humedad ?? 0) > 80 ? 'Alta' : (clima?.humedad ?? 0) > 50 ? 'Moderada' : 'Baja', icono: '/iconos/humedad.png', color: '#8b5cf6' },
    { label: 'PRESIÓN', valor: loadingClima ? '--' : `${clima?.presion ?? '--'} hPa`, sub: 'Estable', icono: '/iconos/presion.png', color: '#f59e0b' },
  ]

  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden bg-slate-50 font-sans">
      <Sidebar
        alertasCount={alertasCount}
        onToggle={setSidebarCollapsed}
        ultimaActualizacion={clima?.timestamp}
        coords={coords}
        lugar={lugar}
        onSelectHacienda={onSelectHacienda}
      />

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <div className="flex md:hidden items-center justify-start bg-white px-4 py-3 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2">
            <Image src="/iconos/probabilidad.png" alt="logo" width={28} height={28} style={{ objectFit: 'contain', flexShrink: 0 }} />
            <div>
              <div className="font-bold text-[0.95rem] text-slate-900 leading-tight">Clima Cosecha</div>
              <div className="text-[0.65rem] text-slate-400 leading-tight">Monitoreo agroclimático</div>
            </div>
          </div>
        </div>

        <div className="bg-white border-b border-slate-200 px-4 md:px-5 py-2 md:py-[10px] flex items-center justify-between shrink-0 md:h-[52px]">
          <div className="flex items-center gap-2">
            <MapPin size={15} color="#2563eb" />
            <span className="font-semibold text-blue-600 text-[0.88rem]">{lugar}</span>
            <span className="text-slate-400 text-[0.75rem] hidden md:block">{coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}</span>
          </div>
          <div className="flex flex-col md:flex-row items-end md:items-center gap-1 md:gap-[20px]">
            <div className="flex items-center gap-[6px] text-slate-500 text-[0.75rem] md:text-[0.82rem]">
              <Calendar size={13} />
              <span className="capitalize">{getFechaActual()}</span>
            </div>
            <div className="flex items-center gap-[6px] text-slate-900 text-[0.8rem] md:text-[0.88rem] font-bold">
              <Clock size={13} color="#2563eb" />
              <span>{getHoraActual()}</span>
            </div>
          </div>
        </div>

        <div className="flex-1 p-3 md:p-4 flex flex-col gap-[10px] overflow-y-auto md:overflow-hidden pb-[90px] md:pb-4">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-[10px] shrink-0">
            {kpis.map((kpi, i) => (
              <div key={i} className="bg-white rounded-xl p-[10px] md:p-[10px_14px] border border-slate-200 flex items-center gap-2 md:gap-[10px] shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                <Image src={kpi.icono} alt={kpi.label} width={36} height={36} style={{ objectFit: 'contain', flexShrink: 0 }} className="w-8 md:w-9 h-8 md:h-9" />
                <div className="min-w-0">
                  <div className="text-[0.55rem] md:text-[0.6rem] text-slate-400 font-bold tracking-[0.4px] truncate">{kpi.label}</div>
                  <div className="text-[0.9rem] md:text-[0.95rem] font-bold whitespace-nowrap" style={{ color: kpi.color }}>{kpi.valor}</div>
                  <div className="text-[0.6rem] md:text-[0.68rem] text-slate-500 whitespace-nowrap">{kpi.sub}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col md:grid md:grid-cols-[1fr_300px] gap-[10px] flex-none md:flex-1 min-h-0 shrink-0 md:shrink">
            {/* Contenedor del mapa optimizado */}
            <div className="relative bg-white rounded-xl border border-slate-200 overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)] h-[250px] md:h-auto md:min-h-0">
              <Mapa lat={coords.lat} lng={coords.lng} onClickMapa={onClickMapa} />
            </div>

            <div className="flex flex-col min-h-0 shrink-0 md:shrink">
              <div className="flex-1 rounded-xl overflow-hidden min-h-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                <CondicionWidget precipitacion={clima?.precipitacion ?? 0} probabilidad={clima?.probabilidad ?? 0} temp={clima?.temp ?? 25} humedad={clima?.humedad ?? 60} uvIndex={clima?.uvIndex ?? null} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl py-[12px] px-[16px] border border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.04)] shrink-0">
            <div className="text-[0.62rem] font-bold text-slate-400 tracking-[1px] mb-[10px]">PRÓXIMAS 24 HORAS</div>
            {loadingPron ? (
              <div className="text-slate-400 text-[0.82rem]">Cargando pronóstico...</div>
            ) : (
              <div className="flex gap-[6px] overflow-x-auto pb-[4px]">
                {horario.map((h: Record<string, number | string>, i: number) => {
                  const mm = Number(h.precipitacion); const prob = Number(h.probabilidad); const temp = Number(h.temp);
                  const color = getColorPrecip(mm); const esAhora = i === 0;
                  return (
                    <div key={i} className="min-w-[70px] rounded-[10px] p-[8px_6px] text-center shrink-0 flex flex-col gap-[3px]" style={{ background: esAhora ? '#eff6ff' : '#f8fafc', border: esAhora ? '1.5px solid #2563eb' : `1px solid ${mm > 0.5 ? color + '40' : '#e2e8f0'}` }}>
                      <div className="text-[0.66rem] font-semibold" style={{ color: esAhora ? '#2563eb' : '#94a3b8' }}>
                        {esAhora ? 'Ahora' : formatHora(String(h.hora))}
                      </div>
                      <div className="text-[0.95rem]">{getIconoCondicion(mm, prob)}</div>
                      <div className="text-[0.88rem] font-bold text-slate-900">{temp.toFixed(0)}°</div>
                      <div className="text-[0.7rem] font-bold" style={{ color }}>
                        {mm.toFixed(1)}<span className="text-[0.58rem] text-slate-400">mm</span>
                      </div>
                      <div className="text-[0.62rem] text-slate-400">{prob.toFixed(0)}%</div>
                      <div className="h-[3px] bg-slate-200 rounded-[4px]">
                        <div className="h-full rounded-[4px]" style={{ width: `${Math.min(prob, 100)}%`, background: color }} />
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
