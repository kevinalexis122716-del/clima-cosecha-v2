'use client'

import { useEffect, useRef } from 'react'

interface MapaProps {
  lat: number
  lng: number
  onClickMapa?: (lat: number, lng: number) => void
}

export default function Mapa({ lat, lng, onClickMapa }: MapaProps) {
  const mapaRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null)

  useEffect(() => {
    if (!mapaRef.current || mapInstanceRef.current) return

    const iniciarMapa = async () => {
      const maplibregl = (await import('maplibre-gl')).default
      await import('maplibre-gl/dist/maplibre-gl.css')

      const owmKey = process.env.NEXT_PUBLIC_OWM_KEY || ''

      const map = new maplibregl.Map({
        container: mapaRef.current!,
        style: {
          version: 8,
          sources: {
            osm: {
              type: 'raster',
              tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
              tileSize: 256,
              attribution: '© OpenStreetMap',
            },
          },
          layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
        },
        center: [lng, lat],
        zoom: 10,
      })

      map.on('load', () => {
        // Capa de nubes con opacidad baja
        map.addSource('nubes', {
          type: 'raster',
          tiles: [
            `https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=${owmKey}`
          ],
          tileSize: 256,
          attribution: '© OpenWeatherMap',
        })
        map.addLayer({
          id: 'nubes-layer',
          type: 'raster',
          source: 'nubes',
          paint: { 'raster-opacity': 0.15 },
        })

        // Capa de precipitación API 2.0 (Capa PR0 estándar)
        map.addSource('precipitacion', {
          type: 'raster',
          tiles: [
            `https://maps.openweathermap.org/maps/2.0/weather/PR0/{z}/{x}/{y}?appid=${owmKey}`
          ],
          tileSize: 256,
          attribution: '© OpenWeatherMap',
        })
        map.addLayer({
          id: 'precipitacion-layer',
          type: 'raster',
          source: 'precipitacion',
          paint: { 'raster-opacity': 0.85 },
        })

        // Marcador de ubicación
        const el = document.createElement('div')
        el.style.cssText = `
          width: 18px;
          height: 18px;
          background: #2563eb;
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 0 0 4px rgba(37,99,235,0.35), 0 2px 10px rgba(0,0,0,0.5);
          cursor: pointer;
        `
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([lng, lat])
          .addTo(map)
        markerRef.current = marker
      })

      // Click para cambiar ubicación
      map.on('click', (e) => {
        const newLat = e.lngLat.lat
        const newLng = e.lngLat.lng
        if (markerRef.current) {
          markerRef.current.setLngLat([newLng, newLat])
        }
        if (onClickMapa) {
          onClickMapa(newLat, newLng)
        }
      })

      mapInstanceRef.current = map
    }

    iniciarMapa()

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [lat, lng, onClickMapa])

  useEffect(() => {
    if (!mapInstanceRef.current || !markerRef.current) return
    markerRef.current.setLngLat([lng, lat])
    mapInstanceRef.current.flyTo({ center: [lng, lat], zoom: 10 })
  }, [lat, lng])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '500px' }}>
      <div ref={mapaRef} style={{ width: '100%', height: '100%' }} />

      {/* LEYENDA IDÉNTICA A LA NATIVA DE OPENWEATHERMAP */}
      <div style={{
        position: 'absolute',
        bottom: '24px',
        right: '12px',
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(8px)',
        borderRadius: '30px',
        padding: '8px 16px',
        boxShadow: '0 4px 15px rgba(0,0,0,0.08)',
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
      }}>
        <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#f97316', display: 'flex', gap: '4px' }}>
          Precipitación <span style={{ color: '#64748b', fontWeight: 600 }}>0 mm/h</span>
        </div>
        
        <div style={{
          width: '120px',
          height: '6px',
          borderRadius: '3px',
          // Gradiente exacto de la documentación API 2.0 PR0
          background: 'linear-gradient(to right, rgba(136,184,237,0.1), #88b8ed, #408ce0, #24c79f, #14a60f, #ebd01a, #e38612, #d9251c, #9c1752)',
        }} />
        
        <div style={{ fontSize: '0.65rem', fontWeight: 600, color: '#64748b' }}>
          40 mm/h
        </div>
      </div>

      {/* Badge "En vivo" */}
      <div style={{
        position: 'absolute',
        top: '12px',
        left: '12px',
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(6px)',
        borderRadius: '8px',
        padding: '6px 12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        <div style={{
          width: '8px', height: '8px', borderRadius: '50%', background: '#10b981',
          boxShadow: '0 0 0 3px rgba(16,185,129,0.3)',
        }} />
        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#374151' }}>Precipitación en tiempo real</span>
        <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#10b981' }}>En vivo</span>
      </div>
    </div>
  )
}
