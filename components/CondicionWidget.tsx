'use client'

import Image from 'next/image'

interface CondicionWidgetProps {
  precipitacion: number
  probabilidad: number
  temp: number
  humedad: number
}

function getCondicion(precipitacion: number, probabilidad: number) {
  if (precipitacion > 5) return {
    label: 'Lluvioso',
    desc: 'Lluvia activa en la región',
    imagen: '/imagenes/lluvioso.jpg',
  }
  if (precipitacion > 0.5) return {
    label: 'Lluvia leve',
    desc: 'Precipitación leve detectada',
    imagen: '/imagenes/lluvioso.jpg',
  }
  if (probabilidad > 60) return {
    label: 'Parcialmente nublado',
    desc: 'Condiciones estables en la región',
    imagen: '/imagenes/nublado.jpg',
  }
  if (probabilidad > 30) return {
    label: 'Nublado',
    desc: 'Cielo cubierto sin lluvia',
    imagen: '/imagenes/nublado.jpg',
  }
  return {
    label: 'Soleado',
    desc: 'Condiciones ideales para cosecha',
    imagen: '/imagenes/soleado.jpg',
  }
}

// Fórmula de Magnus — punto de rocío real
function calcularPuntoRocio(temp: number, humedad: number): number {
  const a = 17.625
  const b = 243.04
  const alpha = ((a * temp) / (b + temp)) + Math.log(humedad / 100)
  return parseFloat(((b * alpha) / (a - alpha)).toFixed(1))
}

export default function CondicionWidget({ precipitacion, probabilidad, temp, humedad }: CondicionWidgetProps) {
  const condicion = getCondicion(precipitacion, probabilidad)
  const puntoRocio = calcularPuntoRocio(temp, humedad)
  const indiceUV = precipitacion > 1 ? 2 : probabilidad > 60 ? 3 : 6

  return (
    <div style={{
      borderRadius: '16px',
      overflow: 'hidden',
      position: 'relative',
      height: '100%',
      minHeight: '200px',
    }}>
      {/* Imagen de fondo */}
      <Image
        src={condicion.imagen}
        alt={condicion.label}
        fill
        style={{ objectFit: 'cover' }}
        priority
      />

      {/* Overlay degradado */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.1), rgba(0,0,0,0.65))',
      }} />

      {/* Contenido */}
      <div style={{
        position: 'relative',
        zIndex: 2,
        padding: '20px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        boxSizing: 'border-box',
      }}>
        <div style={{
          fontSize: '0.65rem',
          fontWeight: 700,
          color: 'rgba(255,255,255,0.7)',
          letterSpacing: '1px',
          marginBottom: '6px',
        }}>
          CONDICIONES ACTUALES
        </div>
        <div style={{
          fontSize: '1.5rem',
          fontWeight: 700,
          color: '#ffffff',
          marginBottom: '4px',
        }}>
          {condicion.label}
        </div>
        <div style={{
          fontSize: '0.82rem',
          color: 'rgba(255,255,255,0.8)',
          marginBottom: '16px',
        }}>
          {condicion.desc}
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <div style={{
            background: 'rgba(255,255,255,0.15)',
            backdropFilter: 'blur(8px)',
            borderRadius: '10px',
            padding: '8px 14px',
            flex: 1,
          }}>
            <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.65)', marginBottom: '3px' }}>
              ÍNDICE UV
            </div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ffffff' }}>
              {indiceUV} {indiceUV <= 2 ? 'Bajo' : indiceUV <= 4 ? 'Moderado' : 'Alto'}
            </div>
          </div>
          <div style={{
            background: 'rgba(255,255,255,0.15)',
            backdropFilter: 'blur(8px)',
            borderRadius: '10px',
            padding: '8px 14px',
            flex: 1,
          }}>
            <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.65)', marginBottom: '3px' }}>
              PUNTO DE ROCÍO
            </div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ffffff' }}>
              {puntoRocio}°C
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}