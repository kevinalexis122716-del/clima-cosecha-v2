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
              attribution: '© OpenStreetMap | Radar: OpenWeatherMap',
            },
          },
          layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
        },
        center: [lng, lat],
        zoom: 10,
      })

      map.on('load', () => {
        if (owmKey) {
          // Capa sutil de nubes
          map.addSource('nubes', {
            type: 'raster',
            tiles: [`https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=${owmKey}`],
            tileSize: 256,
          })
          map.addLayer({
            id: 'nubes-layer',
            type: 'raster',
            source: 'nubes',
            paint: { 'raster-opacity': 0.15 },
          })

          // Capa de Precipitación Libre (Azules a Morados intensos)
          map.addSource('precipitacion', {
            type: 'raster',
            tiles: [`https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${owmKey}`],
            tileSize: 256,
          })
          map.addLayer({
            id: 'precipitacion-layer',
            type: 'raster',
            source: 'precipitacion',
            paint: { 'raster-opacity': 0.85 },
          })
        }

        // Marcador interactivo
        const el = document.createElement('div')
        el.style.cssText = `
          width: 18px; height: 18px; background: #2563eb;
          border: 3px solid white; border-radius: 50%;
          box-shadow: 0 0 0 4px rgba(37,99,235,0.35), 0 2px 10px rgba(0,0,0,0.5); cursor: pointer;
        `
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([lng, lat])
          .addTo(map)
        markerRef.current = marker
      })

      map.on('click', (e) => {
        const newLat = e.lngLat.lat
        const newLng = e.lngLat.lng
        if (markerRef.current) markerRef.current.setLngLat([newLng, newLat])
        if (onClickMapa) onClickMapa(newLat, newLng)
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
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '100%' }}>
      <div ref={mapaRef} style={{ width: '100%', height: '100%', borderRadius: 'inherit' }} />

      {/* BADGE SUPERIOR DE TELEMETRÍA */}
      <div className="absolute top-[10px] left-[10px] z-20 bg-white/90 backdrop-blur-md rounded-lg py-[5px] px-[12px] border border-slate-200 text-[0.72rem] text-slate-600 flex items-center gap-[8px] shadow-sm">
        <span className="w-[7px] h-[7px] bg-emerald-500 rounded-full shadow-[0_0_5px_#10b981]" />
        Precipitación <span className="hidden md:inline">en tiempo real</span>
        <span className="bg-emerald-50 text-emerald-500 text-[0.62rem] font-bold px-[7px] py-[1px] rounded-full">En vivo</span>
      </div>

      {/* LEYENDA PREMIUM INTEGRADA */}
      <div className="absolute bottom-[10px] right-[10px] md:bottom-[14px] md:right-[14px] z-20 bg-white/95 backdrop-blur-md rounded-full py-[8px] px-[12px] md:px-[16px] border border-slate-200 shadow-[0_4px_15px_rgba(0,0,0,0.08)] flex items-center gap-[8px] md:gap-[10px]">
        <div className="text-[0.6rem] md:text-[0.65rem] font-bold text-blue-500 flex gap-[4px]">
          Precipitación <span className="text-slate-500 font-semibold hidden md:inline">Ligera</span>
        </div>
        <div className="w-[80px] md:w-[120px] h-[6px] rounded-full" style={{
          background: 'linear-gradient(to right, rgba(167, 192, 255, 0.4), #8ca5ff, #4a6ee0, #5e35b1, #311b92)'
        }} />
        <div className="text-[0.6rem] md:text-[0.65rem] font-semibold text-slate-500">
          Intensa
        </div>
      </div>
    </div>
  )
}
