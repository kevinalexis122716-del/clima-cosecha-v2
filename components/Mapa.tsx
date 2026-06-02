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
        // Capa de nubes con opacidad muy baja — solo referencia visual, no tapa la precipitación
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
          // Bajamos de 0.4 a 0.15 — referencia visual sin distorsionar colores de precipitación
          paint: { 'raster-opacity': 0.15 },
        })

        // Capa de precipitación encima — precipitation_new usa la paleta verde→amarillo→rojo
        map.addSource('precipitacion', {
          type: 'raster',
          tiles: [
            `https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${owmKey}`
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

      {/* Leyenda de intensidad de precipitación — igual a OpenWeatherMap */}
      <div style={{
        position: 'absolute',
        bottom: '28px',
        left: '12px',
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(6px)',
        borderRadius: '10px',
        padding: '10px 14px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.18)',
        zIndex: 10,
        minWidth: '210px',
      }}>
        <div style={{ fontSize: '0.62rem', fontWeight: 700, color: '#374151', letterSpacing: '0.8px', marginBottom: '7px' }}>
          INTENSIDAD DE PRECIPITACIÓN
        </div>
        {/* Barra de gradiente igual a la paleta precipitation_new de OWM */}
        <div style={{
          height: '10px',
          borderRadius: '5px',
          background: 'linear-gradient(to right, #a8e4ff, #59b4ff, #00d4aa, #00c800, #ffff00, #ff9600, #ff0000, #c80000)',
          marginBottom: '5px',
        }} />
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.58rem', color: '#6b7280' }}>0 mm/h</span>
          <span style={{ fontSize: '0.58rem', color: '#6b7280' }}>0.2</span>
          <span style={{ fontSize: '0.58rem', color: '#6b7280' }}>1</span>
          <span style={{ fontSize: '0.58rem', color: '#6b7280' }}>4</span>
          <span style={{ fontSize: '0.58rem', color: '#6b7280' }}>10</span>
          <span style={{ fontSize: '0.58rem', color: '#6b7280' }}>40+ mm/h</span>
        </div>
        <div style={{ display: 'flex', gap: '10px', marginTop: '7px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#59b4ff' }} />
            <span style={{ fontSize: '0.6rem', color: '#374151' }}>Ligera</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ffff00' }} />
            <span style={{ fontSize: '0.6rem', color: '#374151' }}>Moderada</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ff0000' }} />
            <span style={{ fontSize: '0.6rem', color: '#374151' }}>Intensa</span>
          </div>
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
