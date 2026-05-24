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
          paint: { 'raster-opacity': 0.4 },
        })

        // Capa de precipitación encima
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
    <div
      ref={mapaRef}
      style={{ width: '100%', height: '100%', minHeight: '500px' }}
    />
  )
}