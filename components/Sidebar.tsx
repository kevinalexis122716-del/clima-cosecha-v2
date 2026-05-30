'use client'

import Image from 'next/image'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, CloudRain, Bell, ChevronLeft, ChevronRight } from 'lucide-react'

interface SidebarProps {
  alertasCount?: number
  onToggle?: (collapsed: boolean) => void
}

export default function Sidebar({ alertasCount = 0, onToggle }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()
  const [minutos, setMinutos] = useState(0)

  useEffect(() => {
    setMinutos(0)
    const intervalo = setInterval(() => {
      setMinutos(m => {
        if (m >= 19) return 0
        return m + 1
      })
    }, 60000) // cada minuto
    return () => clearInterval(intervalo)
  }, [])

  const toggle = () => {
    const next = !collapsed
    setCollapsed(next)
    onToggle?.(next)
  }

  const navItems = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: null, label: 'Pronósticos', icon: CloudRain },
    { href: null, label: 'Alertas', icon: Bell, badge: alertasCount },
  ]

  return (
    <aside style={{
      width: collapsed ? '68px' : '220px',
      minHeight: '100vh',
      background: '#ffffff',
      borderRight: '1px solid #e2e8f0',
      display: 'flex',
      flexDirection: 'column',
      transition: 'width 0.3s ease',
      flexShrink: 0,
      overflow: 'hidden',
      position: 'relative',
    }}>

      {/* LOGO + TOGGLE */}
      <div style={{
        padding: '16px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid #e2e8f0',
        gap: '8px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
          <div style={{
            width: '36px', height: '36px', flexShrink: 0,
            borderRadius: '10px',
            overflow: 'hidden',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Image
              src="/iconos/probabilidad.png"
              alt="logo"
              width={36}
              height={36}
              style={{ objectFit: 'contain' }}
            />
          </div>
          {!collapsed && (
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a', whiteSpace: 'nowrap' }}>Clima Cosecha</div>
              <div style={{ fontSize: '0.65rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>Monitoreo agroclimático</div>
            </div>
          )}
        </div>

        <button onClick={toggle} style={{
          width: '26px', height: '26px', flexShrink: 0,
          background: '#f1f5f9',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
          color: '#64748b',
          transition: 'background 0.2s',
        }}>
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {/* NAV */}
      <nav style={{ flex: 1, padding: '12px 8px' }}>
        {navItems.map(({ href, label, icon: Icon, badge }) => {
          const active = href !== null && pathname === href
          const disabled = href === null

          const content = (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: collapsed ? '10px 0' : '10px 12px',
              justifyContent: collapsed ? 'center' : 'flex-start',
              margin: '2px 0',
              borderRadius: '10px',
              background: active ? '#eff6ff' : 'transparent',
              color: disabled ? '#cbd5e1' : active ? '#2563eb' : '#64748b',
              cursor: disabled ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              position: 'relative',
              opacity: disabled ? 0.5 : 1,
            }}>
              <Icon size={18} strokeWidth={active ? 2.5 : 1.8} />
              {!collapsed && (
                <span style={{
                  fontSize: '0.85rem',
                  fontWeight: active ? 600 : 400,
                  whiteSpace: 'nowrap',
                  flex: 1,
                }}>{label}</span>
              )}
              {!collapsed && disabled && (
                <span style={{
                  fontSize: '0.58rem', fontWeight: 700,
                  background: '#f1f5f9', color: '#94a3b8',
                  padding: '2px 6px', borderRadius: '20px',
                  border: '1px solid #e2e8f0',
                }}>Pronto</span>
              )}
              {badge !== undefined && badge > 0 && (
                <span style={{
                  position: collapsed ? 'absolute' : 'relative',
                  top: collapsed ? '4px' : 'auto',
                  right: collapsed ? '4px' : 'auto',
                  background: '#ef4444', color: 'white',
                  fontSize: '0.6rem', fontWeight: 700,
                  padding: '1px 5px', borderRadius: '20px',
                  minWidth: '16px', textAlign: 'center',
                }}>{badge}</span>
              )}
            </div>
          )

          return href ? (
            <Link key={label} href={href} style={{ textDecoration: 'none' }}>
              {content}
            </Link>
          ) : (
            <div key={label}>{content}</div>
          )
        })}
      </nav>

      {/* USUARIO */}
      <div style={{
        padding: collapsed ? '14px 0' : '14px 12px',
        borderTop: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'flex-start',
      }}>
        {!collapsed && (
          <div style={{ width: '100%' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0f172a' }}>Kevin Sanchez</div>
            <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginBottom: '6px' }}>Desarrollador</div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: minutos >= 15 ? '#fff7ed' : '#f0fdf4',
              border: `1px solid ${minutos >= 15 ? '#fed7aa' : '#bbf7d0'}`,
              borderRadius: '8px',
              padding: '4px 8px',
            }}>
              <span style={{
                width: '6px', height: '6px',
                background: minutos >= 15 ? '#f97316' : '#10b981',
                borderRadius: '50%',
                flexShrink: 0,
              }} />
              <span style={{
                fontSize: '0.62rem',
                color: minutos >= 15 ? '#c2410c' : '#15803d',
                fontWeight: 600,
              }}>
                {minutos === 0 ? 'Actualizado ahora' : `Hace ${minutos} min`}
              </span>
            </div>
          </div>
        )}
      </div>

    </aside>
  )
}
