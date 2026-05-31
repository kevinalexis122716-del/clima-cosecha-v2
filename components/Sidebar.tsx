'use client'

import Image from 'next/image'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, CloudRain, Bell, ChevronLeft, ChevronRight, User, Search, X, Settings, MapPin } from 'lucide-react'

interface SidebarProps {
  alertasCount?: number
  onToggle?: (collapsed: boolean) => void
  ultimaActualizacion?: string
  coords?: { lat: number; lng: number }
  lugar?: string
  onSelectHacienda?: (hacienda: { nombre: string; lat: number; lng: number }) => void
}

interface Hacienda {
  nombre: string
  lat: number
  lng: number
}

export default function Sidebar({ alertasCount = 0, onToggle, ultimaActualizacion, coords, lugar, onSelectHacienda }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()
  const [minutos, setMinutos] = useState(0)
  const [haciendas, setHaciendas] = useState<Hacienda[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [filtradas, setFiltradas] = useState<Hacienda[]>([])
  const [mostrarBuscadorMovil, setMostrarBuscadorMovil] = useState(false)
  const [mostrarPerfilMovil, setMostrarPerfilMovil] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/haciendas').then(r => r.json()).then(data => {
      if (Array.isArray(data)) setHaciendas(data)
    }).catch(() => {})
  }, [])

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

  useEffect(() => {
    if (busqueda.trim().length < 2) {
      setFiltradas([])
      return
    }
    const q = busqueda.toLowerCase()
    setFiltradas(haciendas.filter(h => h.nombre.toLowerCase().includes(q)).slice(0, 10))
  }, [busqueda, haciendas])

  const toggle = () => {
    const next = !collapsed
    setCollapsed(next)
    onToggle?.(next)
  }

  const seleccionar = (h: Hacienda) => {
    onSelectHacienda?.(h)
    setBusqueda('')
    setFiltradas([])
    setMostrarBuscadorMovil(false)
  }

  const pronosticosHref = coords
    ? `/pronostico?lat=${coords.lat}&lng=${coords.lng}&lugar=${encodeURIComponent(lugar || 'Buga')}`
    : '/pronostico'

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
    { href: null, label: 'Perfil', icon: User, action: () => setMostrarPerfilMovil(true) },
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
        <nav className="flex-1 p-3 flex flex-col gap-0 overflow-y-auto">
          {navItems.map(({ href, label, icon: Icon, badge }) => {
            const active = href !== null && (
              pathname === href ||
              (label === 'Pronósticos' && pathname === '/pronostico') ||
              (label === 'Alertas' && pathname === '/alertas')
            )
            const content = (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: collapsed ? '10px 0' : '10px 12px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                margin: '2px 0', borderRadius: '10px',
                background: active ? '#eff6ff' : 'transparent',
                color: active ? '#2563eb' : '#64748b',
                cursor: 'pointer', transition: 'all 0.2s', position: 'relative',
              }}>
                <Icon size={18} strokeWidth={active ? 2.5 : 1.8} />
                {!collapsed && <span style={{ fontSize: '0.85rem', fontWeight: active ? 600 : 400, whiteSpace: 'nowrap', flex: 1 }}>{label}</span>}
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
            return <Link key={label} href={href} style={{ textDecoration: 'none' }}>{content}</Link>
          })}

          {/* BUSCADOR HACIENDAS ESCRITORIO */}
          {!collapsed && haciendas.length > 0 && (
            <div className="mt-3 border-t border-slate-100 pt-3" ref={searchRef}>
              <div className="text-[0.6rem] font-bold text-slate-400 tracking-wider mb-2 px-1">BUSCAR HACIENDA</div>
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={busqueda}
                  onChange={e => setBusqueda(e.target.value)}
                  placeholder="Ej: Alicia, Alejandría..."
                  className="w-full pl-8 pr-3 py-2 text-[0.78rem] border border-slate-200 rounded-lg outline-none focus:border-blue-400 bg-slate-50"
                />
                {busqueda && (
                  <button onClick={() => { setBusqueda(''); setFiltradas([]) }} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <X size={13} />
                  </button>
                )}
              </div>
              {filtradas.length > 0 && (
                <div className="mt-1 bg-white border border-slate-200 rounded-lg shadow-md overflow-hidden max-h-48 overflow-y-auto">
                  {filtradas.map((h, i) => (
                    <button key={i} onClick={() => seleccionar(h)}
                      className="w-full text-left px-3 py-2 text-[0.78rem] hover:bg-blue-50 flex items-center gap-2 border-b border-slate-50 last:border-none transition-colors">
                      <MapPin size={12} className="text-blue-500 shrink-0" />
                      <span className="text-slate-700 font-medium truncate">{h.nombre}</span>
                    </button>
                  ))}
                </div>
              )}
              {busqueda.trim().length >= 2 && filtradas.length === 0 && (
                <p className="text-[0.72rem] text-slate-400 px-1 mt-1">Sin resultados</p>
              )}
            </div>
          )}
        </nav>

        {/* ADMIN + USUARIO ESCRITORIO */}
        <div style={{ padding: collapsed ? '14px 0' : '14px 12px', borderTop: '1px solid #e2e8f0' }}>
          {!collapsed && (
            <div style={{ width: '100%' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0f172a' }}>Kevin Sanchez</div>
              <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginBottom: '6px' }}>Desarrollador</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: minutos >= 15 ? '#fff7ed' : '#f0fdf4', border: `1px solid ${minutos >= 15 ? '#fed7aa' : '#bbf7d0'}`, borderRadius: '8px', padding: '4px 8px', marginBottom: '8px' }}>
                <span style={{ width: '6px', height: '6px', background: minutos >= 15 ? '#f97316' : '#10b981', borderRadius: '50%', flexShrink: 0 }} />
                <span style={{ fontSize: '0.62rem', color: minutos >= 15 ? '#c2410c' : '#15803d', fontWeight: 600 }}>
                  {!ultimaActualizacion ? 'Cargando...' : minutos === 0 ? 'Actualizado ahora' : `Hace ${minutos} min`}
                </span>
              </div>
              <Link href="/admin" style={{ textDecoration: 'none' }}>
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-blue-600 transition-colors cursor-pointer text-[0.75rem] font-medium">
                  <Settings size={14} />
                  <span>Panel Admin</span>
                </div>
              </Link>
            </div>
          )}
          {collapsed && (
            <div className="flex flex-col items-center gap-2">
              <Link href="/admin">
                <div className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-slate-50 transition-colors cursor-pointer">
                  <Settings size={15} />
                </div>
              </Link>
            </div>
          )}
        </div>
      </aside>

      {/* BUSCADOR MÓVIL OVERLAY */}
      {mostrarBuscadorMovil && (
        <div className="md:hidden fixed inset-0 bg-black/40 z-[60] flex flex-col justify-start pt-16 px-4">
          <div className="bg-white rounded-2xl shadow-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Search size={16} className="text-blue-500" />
              <span className="font-bold text-slate-900 text-[0.9rem]">Buscar Hacienda</span>
              <button onClick={() => { setMostrarBuscadorMovil(false); setBusqueda(''); setFiltradas([]) }} className="ml-auto text-slate-400">
                <X size={20} />
              </button>
            </div>
            <input
              autoFocus
              type="text"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Ej: Alicia, Alejandría..."
              className="w-full px-4 py-2.5 text-[0.88rem] border border-slate-200 rounded-xl outline-none focus:border-blue-400 bg-slate-50"
            />
            {filtradas.length > 0 && (
              <div className="mt-2 max-h-64 overflow-y-auto flex flex-col gap-0.5">
                {filtradas.map((h, i) => (
                  <button key={i} onClick={() => seleccionar(h)}
                    className="w-full text-left px-3 py-2.5 text-[0.82rem] hover:bg-blue-50 flex items-center gap-2 rounded-lg transition-colors">
                    <MapPin size={14} className="text-blue-500 shrink-0" />
                    <span className="text-slate-700 font-medium">{h.nombre}</span>
                  </button>
                ))}
              </div>
            )}
            {busqueda.trim().length >= 2 && filtradas.length === 0 && (
              <p className="text-[0.78rem] text-slate-400 mt-2 text-center">Sin resultados</p>
            )}
          </div>
        </div>
      )}

      {/* PERFIL MÓVIL OVERLAY */}
      {mostrarPerfilMovil && (
        <div className="md:hidden fixed inset-0 bg-black/40 z-[60] flex flex-col justify-end">
          <div className="bg-white rounded-t-3xl shadow-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="font-bold text-slate-900 text-[1rem]">Perfil</span>
              <button onClick={() => setMostrarPerfilMovil(false)} className="text-slate-400"><X size={22} /></button>
            </div>
            <div className="flex items-center gap-3 mb-4 p-3 bg-slate-50 rounded-xl">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <User size={20} className="text-blue-600" />
              </div>
              <div>
                <div className="font-bold text-slate-900 text-[0.9rem]">Kevin Sanchez</div>
                <div className="text-[0.7rem] text-slate-400">Desarrollador</div>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl mb-4">
              <span style={{ width: '7px', height: '7px', background: minutos >= 15 ? '#f97316' : '#10b981', borderRadius: '50%', flexShrink: 0, display: 'inline-block' }} />
              <span className="text-[0.78rem] font-medium" style={{ color: minutos >= 15 ? '#c2410c' : '#15803d' }}>
                {!ultimaActualizacion ? 'Cargando...' : minutos === 0 ? 'Actualizado ahora' : `Hace ${minutos} min`}
              </span>
            </div>
            <Link href="/admin" onClick={() => setMostrarPerfilMovil(false)} style={{ textDecoration: 'none' }}>
              <div className="flex items-center gap-3 p-3 border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-colors">
                <Settings size={18} className="text-blue-600" />
                <div>
                  <div className="font-bold text-[0.85rem]">Panel Administrador</div>
                  <div className="text-[0.7rem] text-slate-400">Gestión de haciendas y archivos</div>
                </div>
              </div>
            </Link>
          </div>
        </div>
      )}

      {/* BOTTOM NAVIGATION MÓVIL */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full bg-white border-t border-slate-200 flex items-center justify-around pb-6 pt-3 px-2 z-50 shadow-[0_-4px_10px_rgba(0,0,0,0.03)] rounded-t-3xl">
        {navItemsMobile.map(({ href, label, icon: Icon, badge, action }) => {
          const active = href !== null && (
            pathname === href ||
            (label === 'Pronósticos' && pathname === '/pronostico') ||
            (label === 'Alertas' && pathname === '/alertas')
          )
          const disabled = href === null && !action

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
                  <button onClick={action} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    <Icon size={22} color="#94a3b8" strokeWidth={2} />
                    <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 500 }}>{label}</span>
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </nav>

      {/* LUPA MÓVIL — aparece en topbar, se maneja desde page.tsx via prop */}
      {haciendas.length > 0 && (
        <button
          onClick={() => setMostrarBuscadorMovil(true)}
          className="md:hidden fixed top-3 right-4 z-40 w-9 h-9 bg-white border border-slate-200 rounded-full flex items-center justify-center shadow-sm text-slate-500 hover:text-blue-600"
        >
          <Search size={17} />
        </button>
      )}
    </>
  )
}
