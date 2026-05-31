'use client'

import Image from 'next/image'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, CloudRain, Bell, ChevronLeft, ChevronRight, User } from 'lucide-react'

interface SidebarProps {
  alertasCount?: number
  onToggle?: (collapsed: boolean) => void
  ultimaActualizacion?: string
  coords?: { lat: number; lng: number }
  lugar?: string
}

export default function Sidebar({ alertasCount = 0, onToggle, ultimaActualizacion, coords, lugar }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()
  const [minutos, setMinutos] = useState(0)

  useEffect(() => {
    function calcular() {
      if (!ultimaActualizacion) return
      const diff = Math.floor((Date.now() - new Date(ultimaActualizacion).getTime()) / 60000)
      setMinutos(Math.min(diff, 20))
    }
    calcular()
    const intervalo = setInterval(calcular, 60000)
    return () => clearInterval(intervalo)
  }, [ultimaActualizacion])

  const toggle = () => {
    const next = !collapsed
    setCollapsed(next)
    onToggle?.(next)
  }

  // Sincronización de parámetros URL para Pronósticos
  const pronosticosHref = coords
    ? `/pronostico?lat=${coords.lat}&lng=${coords.lng}&lugar=${encodeURIComponent(lugar || 'Buga')}`
    : '/pronostico'

  // SOLUCIÓN: Activación de enlace dinámico y persistencia de ubicación para Alertas
  const alertasHref = coords
    ? `/alertas?lat=${coords.lat}&lng=${coords.lng}&lugar=${encodeURIComponent(lugar || 'Buga')}`
    : '/alertas'

  const navItems = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: pronosticosHref, label: 'Pronósticos', icon: CloudRain },
    { href: alertasHref, label: 'Alertas', icon: Bell, badge: alertasCount },
  ]

  const navItemsMobile = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: pronosticosHref, label: 'Pronósticos', icon: CloudRain },
    { href: alertasHref, label: 'Alertas', icon: Bell, badge: alertasCount },
    { href: null, label: 'Perfil', icon: User },
  ]

  return (
    <>
      {/* SIDEBAR ESCRITORIO */}
      <aside className="hidden md:flex flex-col shrink-0 overflow-hidden relative transition-all duration-300 bg-white border-r border-slate-200"
        style={{ width: collapsed ? '68px' : '220px', minHeight: '100vh' }}>

        {/* LOGO + TOGGLE */}
        <div className="p-4 flex items-center justify-between border-b border-slate-200 gap-2">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-9 h-9 shrink-0 rounded-[10px] overflow-hidden flex items-center justify-center">
              <Image src="/iconos/probabilidad.png" alt="logo" width={36} height={36} style={{ objectFit: 'contain' }} />
            </div>
            {!collapsed && (
              <div className="overflow-hidden">
                <div className="font-bold text-[0.88rem] text-slate-900 whitespace-nowrap">Clima Cosecha</div>
                <div className="text-[0.65rem] text-slate-400 whitespace-nowrap">Monitoreo agroclimático</div>
              </div>
            )}
          </div>
          <button onClick={toggle} className="w-[26px] h-[26px] shrink-0 bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-center cursor-pointer text-slate-500 transition-colors hover:bg-slate-200">
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        {/* NAV ESCRITORIO */}
        <nav className="flex-1 p-3">
          {navItems.map(({ href, label, icon: Icon, badge, disabled }) => {
            // SOLUCIÓN: Agregada validación de ruta activa limpia para /pronostico y /alertas sin query params
            const active = href !== null && (
              pathname === href || 
              (label === 'Pronósticos' && pathname === '/pronostico') ||
              (label === 'Alertas' && pathname === '/alertas')
            )
            const isDisabled = disabled === true || href === null

            const content = (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: collapsed ? '10px 0' : '10px 12px',
                justifyment: collapsed ? 'center' : 'flex-start',
                margin: '2px 0', borderRadius: '10px',
                background: active ? '#eff6ff' : 'transparent',
                color: isDisabled ? '#cbd5e1' : active ? '#2563eb' : '#64748b',
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s', position: 'relative',
                opacity: isDisabled ? 0.5 : 1,
              }}>
                <Icon size={18} strokeWidth={active ? 2.5 : 1.8} />
                {!collapsed && (
                  <span style={{ fontSize: '0.85rem', fontWeight: active ? 600 : 400, whiteSpace: 'nowrap', flex: 1 }}>{label}</span>
                )}
                {!collapsed && isDisabled && href === null && (
                  <span className="text-[0.58rem] font-bold bg-slate-100 text-slate-400 px-[6px] py-[2px] rounded-full border border-slate-200">Pronto</span>
                )}
                {badge !== undefined && badge > 0 && (
                  <span style={{
                    position: collapsed ? 'absolute' : 'relative',
                    top: collapsed ? '4px' : 'auto', right: collapsed ? '4px' : 'auto',
                    background: '#ef4444', color: 'white',
                    fontSize: '0.6rem', fontWeight: 700,
                    padding: '1px 5px', borderRadius: '20px', minWidth: '16px', textAlign: 'center',
                  }}>{badge}</span>
                )}
              </div>
            )

            return href ? (
              <Link key={label} href={href} style={{ textDecoration: 'none' }}>{content}</Link>
            ) : (
              <div key={label}>{content}</div>
            )
          })}
        </nav>

        {/* USUARIO ESCRITORIO */}
        <div style={{ padding: collapsed ? '14px 0' : '14px 12px', borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyment: collapsed ? 'center' : 'flex-start' }}>
          {!collapsed && (
            <div style={{ width: '100%' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0f172a' }}>Kevin Sanchez</div>
              <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginBottom: '6px' }}>Desarrollador</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: minutos >= 15 ? '#fff7ed' : '#f0fdf4', border: `1px solid ${minutos >= 15 ? '#fed7aa' : '#bbf7d0'}`, borderRadius: '8px', padding: '4px 8px' }}>
                <span style={{ width: '6px', height: '6px', background: minutos >= 15 ? '#f97316' : '#10b981', borderRadius: '50%', flexShrink: 0 }} />
                <span style={{ fontSize: '0.62rem', color: minutos >= 15 ? '#c2410c' : '#15803d', fontWeight: 600 }}>
                  {!ultimaActualizacion ? 'Cargando...' : minutos === 0 ? 'Actualizado ahora' : `Hace ${minutos} min`}
                </span>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* BOTTOM NAVIGATION MÓVIL */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full bg-white border-t border-slate-200 flex items-center justify-around pb-6 pt-3 px-2 z-50 shadow-[0_-4px_10px_rgba(0,0,0,0.03)] rounded-t-3xl">
        {navItemsMobile.map(({ href, label, icon: Icon, badge }) => {
          // SOLUCIÓN: Agregada validación de ruta activa limpia también en la barra de navegación del celular
          const active = href !== null && (
            pathname === href || 
            (label === 'Pronósticos' && pathname === '/pronostico') ||
            (label === 'Alertas' && pathname === '/alertas')
          )
          const disabled = href === null

          return (
            <div key={label} className="relative flex flex-col items-center gap-1">
              {active && <div className="absolute -top-3 w-8 h-1 rounded-full bg-blue-600" />}
              <div className={`flex flex-col items-center gap-1 ${disabled ? 'opacity-40' : ''}`}>
                {href ? (
                  <Link href={href} style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                    <div className="relative">
                      <Icon size={22} color={active ? '#2563eb' : '#94a3b8'} strokeWidth={active ? 2.5 : 2} />
                      {badge !== undefined && badge > 0 && (
                        <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[0.6rem] font-bold px-[5px] py-[1px] rounded-full border-2 border-white">{badge}</span>
                      )}
                    </div>
                    <span style={{ fontSize: '0.65rem', color: active ? '#2563eb' : '#94a3b8', fontWeight: active ? 700 : 500 }}>{label}</span>
                  </Link>
                ) : (
                  <>
                    <div className="relative">
                      <Icon size={22} color="#94a3b8" strokeWidth={2} />
                      {badge !== undefined && badge > 0 && (
                        <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[0.6rem] font-bold px-[5px] py-[1px] rounded-full border-2 border-white">{badge}</span>
                      )}
                    </div>
                    <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 500 }}>{label}</span>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </nav>
    </>
  )
}
