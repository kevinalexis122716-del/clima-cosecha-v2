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
        // Capa de nubes
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
          paint: { 'raster-opacity': 0.3 },
        })

        // Capa de RADAR (reemplaza precipitation_new)
        map.addSource('radar', {
          type: 'raster',
          tiles: [
            `https://tile.openweathermap.org/map/PAC0/{z}/{x}/{y}.png?appid=${owmKey}`
          ],
          tileSize: 256,
          attribution: '© OpenWeatherMap',
        })
        map.addLayer({
          id: 'radar-layer',
          type: 'raster',
          source: 'radar',
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

      {/* Leyenda radar estilo OpenWeatherMap */}
      <div style={{
        position: 'absolute', bottom: '10px', left: '10px', zIndex: 10,
        background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)',
        borderRadius: '10px', padding: '6px 12px',
        border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        display: 'flex', flexDirection: 'column', gap: '3px'
      }}>
        <div style={{ fontSize: '0.6rem', fontWeight: 700, color: '#94a3b8', marginBottom: '2px' }}>
          RADAR mm/h
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '0.65rem', color: '#64748b' }}>0</span>
          <div style={{
            width: '120px', height: '10px', borderRadius: '6px',
            background: 'linear-gradient(to right, #a0d8f0, #4fc3f7, #00e676, #ffee58, #ff7043, #b71c1c)',
          }} />
          <span style={{ fontSize: '0.65rem', color: '#64748b' }}>40+</span>
        </div>
      </div>
    </div>
  )
}
