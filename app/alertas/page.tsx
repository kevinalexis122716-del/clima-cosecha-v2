'use client'

import { useState, useEffect } from 'react'
import useSWR from 'swr'
import Image from 'next/image'
import { MapPin, AlertTriangle, Eye, CheckCircle, Clock, ChevronRight, Bell } from 'lucide-react'
import Sidebar from '@/components/Sidebar'

const fetcher = (url: string) => fetch(url).then(r => r.json())

interface HoraData {
  hora: string
  temp: number
  precipitacion: number
  probabilidad: number
  humedad: number
  viento: number
}

function formatHora(isoString: string) {
  try {
    return new Date(isoString).toLocaleTimeString('es-CO', {
      hour: '2-digit', minute: '2-digit', hour12: false
    })
  } catch { return '--:--' }
}

function getFechaCorta(isoString: string) {
  try {
    return new Date(isoString).toLocaleDateString('es-CO', {
      day: 'numeric', month: 'short', year: 'numeric'
    })
  } catch { return '' }
}

export default function AlertasPage() {
  const [coords, setCoords] = useState({ lat: 3.9044, lng: -76.2960 })
  const [lugar, setLugar] = useState('Buga')
  const [, setSidebarCollapsed] = useState(false)
  const [minutosActualizacion, setMinutosActualizacion] = useState(0)

  // Sincronizar ubicación desde la URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const lat = parseFloat(params.get('lat') || '3.9044')
      const lng = parseFloat(params.get('lng') || '-76.2960')
      const name = params.get('lugar') || 'Buga'
      setCoords({ lat, lng })
      setLugar(name)
    }
  }, [])

  const { data: pronostico } = useSWR(
    `/api/pronostico?lat=${coords.lat}&lng=${coords.lng}`,
    fetcher, { refreshInterval: 900000 }
  )

  useEffect(() => {
    if (!pronostico?.timestamp) return
    const calcular = () => {
      const diff = Math.floor((Date.now() - new Date(pronostico.timestamp).getTime()) / 60000)
      setMinutosActualizacion(Math.max(0, diff))
    }
    calcular()
    const interval = setInterval(calcular, 60000)
    return () => clearInterval(interval)
  }, [pronostico?.timestamp])

  const horario: HoraData[] = Array.isArray(pronostico?.horario) ? pronostico.horario : []

  // Categorización lógica
  const criticas = horario.filter(h => h.precipitacion > 10)
  const vigilancia = horario.filter(h => h.precipitacion > 5 && h.precipitacion <= 10)
  const sinRiesgo = horario.filter(h => h.precipitacion > 1 && h.precipitacion <= 5)
  
  const totalSidebar = criticas.length + vigilancia.length

  const alertasLista = [
    ...criticas.map(h => ({ ...h, nivel: 'ALTO' as const })),
    ...vigilancia.map(h => ({ ...h, nivel: 'MODERADO' as const }))
  ].sort((a, b) => new Date(a.hora).getTime() - new Date(b.hora).getTime())

  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden bg-slate-50 font-sans">
      <Sidebar alertasCount={totalSidebar} onToggle={setSidebarCollapsed} ultimaActualizacion={pronostico?.timestamp} coords={coords} lugar={lugar} />

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        
        {/* HEADER MÓVIL (Mockup) */}
        <div className="flex md:hidden items-center justify-between bg-white px-4 py-3 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2">
            <Image src="/iconos/probabilidad.png" alt="logo" width={28} height={28} style={{ objectFit: 'contain' }} />
            <div>
              <div className="font-bold text-[0.95rem] text-slate-900 leading-tight">Clima Cosecha</div>
              <div className="text-[0.65rem] text-slate-400 leading-tight">Monitoreo agroclimático</div>
            </div>
          </div>
        </div>

        {/* INFO UBICACIÓN Y FECHA */}
        <div className="bg-white border-b border-slate-200 px-4 md:px-5 py-2 flex items-center justify-between shrink-0 md:h-[52px]">
          <div className="flex items-center gap-2">
            <MapPin size={15} color="#2563eb" />
            <div className="flex flex-col md:flex-row md:items-center md:gap-2">
              <span className="font-semibold text-blue-600 text-[0.85rem] md:text-[0.88rem]">{lugar}</span>
              <span className="text-slate-400 text-[0.65rem] md:text-[0.75rem]">{coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}</span>
            </div>
          </div>
          <div className="flex flex-col items-end text-right">
            <span className="text-slate-500 text-[0.65rem] md:text-[0.75rem] font-medium">Sábado, 30 May 2026</span>
            <span className="text-slate-900 text-[0.75rem] md:text-[0.85rem] font-bold">06:37 P.M.</span>
          </div>
        </div>

        {/* CONTENIDO PRINCIPAL */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-[100px] md:pb-6 flex flex-col gap-6">
          
          <div>
            <h1 className="text-[1.4rem] md:text-[1.6rem] font-black text-slate-900 tracking-tight">Alertas meteorológicas</h1>
            <p className="text-[0.8rem] text-slate-400 mt-0.5">Monitoreo en tiempo real de condiciones climáticas y alertas activas</p>
          </div>

          {/* GRID DE RESUMEN (4 Cards) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            
            {/* Alertas Activas */}
            <div className="bg-white border border-slate-200 rounded-2xl p-3.5 flex items-center gap-3 shadow-sm border-l-4 border-l-red-500">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-red-500 shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <div className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-wider">Alertas activas</div>
                <div className="text-[1.4rem] font-black text-slate-900 leading-none mt-1">{criticas.length}</div>
                <div className="text-[0.6rem] text-slate-500 mt-1">Requieren atención</div>
              </div>
            </div>

            {/* En Vigilancia */}
            <div className="bg-white border border-slate-200 rounded-2xl p-3.5 flex items-center gap-3 shadow-sm border-l-4 border-l-amber-500">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500 shrink-0">
                <Eye size={20} />
              </div>
              <div>
                <div className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-wider">En vigilancia</div>
                <div className="text-[1.4rem] font-black text-slate-900 leading-none mt-1">{vigilancia.length}</div>
                <div className="text-[0.6rem] text-slate-500 mt-1">Mantente informado</div>
              </div>
            </div>

            {/* Sin Riesgo */}
            <div className="bg-white border border-slate-200 rounded-2xl p-3.5 flex items-center gap-3 shadow-sm border-l-4 border-l-emerald-500">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-500 shrink-0">
                <CheckCircle size={20} />
              </div>
              <div>
                <div className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-wider">Sin riesgo</div>
                <div className="text-[1.4rem] font-black text-slate-900 leading-none mt-1">{sinRiesgo.length}</div>
                <div className="text-[0.6rem] text-slate-500 mt-1">Condiciones normales</div>
              </div>
            </div>

            {/* Última Actualización */}
            <div className="bg-white border border-slate-200 rounded-2xl p-3.5 flex items-center gap-3 shadow-sm border-l-4 border-l-blue-500">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                <Clock size={20} />
              </div>
              <div className="min-w-0">
                <div className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-wider truncate">Actualización</div>
                <div className="text-[1rem] font-black text-blue-600 leading-none mt-1">Hace {minutosActualizacion} min</div>
                <div className="text-[0.55rem] text-slate-400 mt-1 truncate">30 May 2026, 06:34 PM</div>
              </div>
            </div>
          </div>

          {/* LISTADO DE ALERTAS DETALLADAS */}
          <div className="flex flex-col gap-4">
            <h2 className="text-[1.1rem] font-bold text-slate-900">Alertas activas</h2>
            
            {alertasLista.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-slate-400 text-[0.85rem]">
                ✅ No se detectan riesgos meteorológicos críticos en las próximas 24 horas.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {alertasLista.map((alerta, idx) => (
                  <div key={idx} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm relative overflow-hidden">
                    <div className="flex items-start gap-4">
                      {/* Icono de Alerta */}
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${alerta.nivel === 'ALTO' ? 'bg-red-50 text-red-500' : 'bg-amber-50 text-amber-500'}`}>
                        {alerta.nivel === 'ALTO' ? <AlertTriangle size={28} /> : <span className="text-3xl">⛈️</span>}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="text-[1rem] font-extrabold text-slate-900">
                            {alerta.nivel === 'ALTO' ? 'Lluvias fuertes' : 'Tormenta eléctrica'}
                          </h3>
                          <span className={`text-[0.65rem] font-bold px-2 py-0.5 rounded-md ${alerta.nivel === 'ALTO' ? 'bg-red-500 text-white' : 'bg-amber-500 text-white'}`}>
                            {alerta.nivel}
                          </span>
                        </div>
                        <p className="text-[0.78rem] text-slate-500 mt-1 leading-snug">
                          {alerta.nivel === 'ALTO' 
                            ? 'Se esperan lluvias intensas que pueden generar acumulaciones significativas y afectar el piso.' 
                            : 'Probabilidad de tormentas con ráfagas de viento fuertes en la zona.'}
                        </p>
                        
                        {/* Detalles de Tiempo y Métrica */}
                        <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-slate-50">
                          <div>
                            <div className="text-[0.6rem] font-bold text-slate-400 uppercase">Inicio</div>
                            <div className="text-[0.85rem] font-bold text-slate-900 mt-0.5">{formatHora(alerta.hora)}</div>
                            <div className="text-[0.6rem] text-slate-400">30 May 2026</div>
                          </div>
                          <div>
                            <div className="text-[0.6rem] font-bold text-slate-400 uppercase">Fin est.</div>
                            <div className="text-[0.85rem] font-bold text-slate-900 mt-0.5">{formatHora(new Date(new Date(alerta.hora).getTime() + 3600000).toISOString())}</div>
                            <div className="text-[0.6rem] text-slate-400">30 May 2026</div>
                          </div>
                          <div className="text-right">
                            <div className="text-[0.6rem] font-bold text-slate-400 uppercase">{alerta.nivel === 'ALTO' ? 'Precipitación' : 'Probabilidad'}</div>
                            <div className={`text-[0.85rem] font-black mt-0.5 ${alerta.nivel === 'ALTO' ? 'text-red-500' : 'text-amber-500'}`}>
                              {alerta.nivel === 'ALTO' ? `${alerta.precipitacion} mm` : `${alerta.probabilidad}%`}
                            </div>
                            <div className="text-[0.6rem] text-slate-400">Estimados</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
