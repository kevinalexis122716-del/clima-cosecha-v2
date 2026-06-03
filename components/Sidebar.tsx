'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { LayoutDashboard, CloudLightning, Bell } from 'lucide-react'

interface SidebarProps {
  alertasCount: number
  onToggle: (collapsed: boolean) => void
  ultimaActualizacion?: string
  coords: { lat: number; lng: number }
  lugar: string
  onSelectHacienda?: (h: { nombre: string; lat: number; lng: number }) => void
}

export default function Sidebar({ alertasCount, onToggle, ultimaActualizacion, collapsed: propCollapsed }: any) {
  const [collapsed, setCollapsed] = useState(false)
  const [minutos, setMinutos] = useState(0)

  useEffect(() => {
    if (!ultimaActualizacion) return

    const calcularMinutosTranscurridos = () => {
      const diferenciaMs = Date.now() - new Date(ultimaActualizacion).getTime()
      const minutosTranscurridos = Math.floor(diferenciaMs / 60000)
      setMinutos(minutosTranscurridos >= 0 ? minutosTranscurridos : 0)
    }

    calcularMinutosTranscurridos()
    const timer = setInterval(calcularMinutosTranscurridos, 15000) // Verifica el reloj cada 15 segundos

    return () => clearInterval(timer)
  }, [ultimaActualizacion])

  const toggleSidebar = () => {
    setCollapsed(!collapsed)
    if (onToggle) onToggle(!collapsed)
  }

  return (
    <div style={{ width: collapsed ? '70px' : '240px', background: 'white', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', height: '100vh', transition: 'width 0.2s ease', shrink: 0 }} className="hidden md:flex">
      <div style={{ padding: '18px 16px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid #e2e8f0', cursor: 'pointer' }} onClick={toggleSidebar}>
        <Image src="/iconos/probabilidad.png" alt="logo" width={28} height={28} />
        {!collapsed && (
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a', lineHeight: 'tight' }}>Clima Cosecha</div>
            <div style={{ fontSize: '0.65rem', color: '#64748b' }}>Monitoreo agroclimático</div>
          </div>
        )}
      </div>

      <div style={{ flex: 1, padding: '16px 8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '8px', background: '#eff6ff', color: '#2563eb', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}>
          <LayoutDashboard size={18} />
          {!collapsed && <span>Dashboard</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '8px', color: '#64748b', fontSize: '0.85rem', cursor: 'pointer' }}>
          <CloudLightning size={18} />
          {!collapsed && <span>Pronósticos</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: '8px', color: '#64748b', fontSize: '0.85rem', cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Bell size={18} />
            {!collapsed && <span>Alertas</span>}
          </div>
          {!collapsed && alertasCount > 0 && (
            <span style={{ background: '#ef4444', color: 'white', fontSize: '0.65rem', fontWeight: 700, padding: '2px 6px', borderRadius: '10px' }}>{alertasCount}</span>
          )}
        </div>
      </div>

      <div style={{ padding: collapsed ? '14px 0' : '14px 12px', borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start' }}>
        {!collapsed && (
          <div style={{ width: '100%' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0f172a' }}>Kevin Sanchez</div>
            <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginBottom: '6px' }}>Desarrollador</div>
            
            {/* PASTILLA REACTIVA: Alerta naranja si supera los 6 minutos (datos viejos) */}
            <div style={{ 
              display: 'flex', alignItems: 'center', gap: '6px', 
              background: minutos >= 6 ? '#fff7ed' : '#f0fdf4', 
              border: `1px solid ${minutos >= 6 ? '#fed7aa' : '#bbf7d0'}`, 
              borderRadius: '8px', padding: '4px 8px' 
            }}>
              <span style={{ 
                width: '6px', height: '6px', 
                background: minutos >= 6 ? '#f97316' : '#10b981', 
                borderRadius: '50%', flexShrink: 0 
              }} />
              <span style={{ 
                fontSize: '0.62rem', 
                color: minutos >= 6 ? '#c2410c' : '#15803d', 
                fontWeight: 600 
              }}>
                {!ultimaActualizacion 
                  ? 'Cargando...' 
                  : minutos === 0 
                    ? 'Actualizado ahora' 
                    : `Hace ${minutos} min`
                }
              </span>
            </div>
          </div>
        )}
        {collapsed && (
          <span style={{ width: '8px', height: '8px', background: minutos >= 6 ? '#f97316' : '#10b981', borderRadius: '50%' }} />
        )}
      </div>
    </div>
  )
}
