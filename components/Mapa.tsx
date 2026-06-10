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

      const map = new maplibregl.Map({
        container: mapaRef.current!,
        style: {
          version: 8,
          sources: {
            osm: {
              type: 'raster',
              tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
              tileSize: 256,
              attribution: '© OpenStreetMap | Satélite: IEM GOES',
            },
          },
          layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
        },
        center: [lng, lat],
        zoom: 10,
      })

      map.on('load', () => {
        
        // 🚀 LA MAGIA: Satélite Infrarrojo GOES (Universidad de Iowa)
        // 100% Gratuito, sin API Keys, sin límite de usuarios.
        map.addSource('satelite-iem', {
          type: 'raster',
          tiles: [
            'https://mesonet.agron.iastate.edu/cgi-bin/wms/goes/conus_ir.cgi?service=WMS&request=GetMap&version=1.1.1&layers=goes_conus_ir&styles=&format=image/png&transparent=true&width=256&height=256&srs=EPSG:3857&bbox={bbox-epsg-3857}'
          ],
          tileSize: 256,
        })
        
        map.addLayer({
          id: 'satelite-layer',
          type: 'raster',
          source: 'satelite-iem',
          paint: { 'raster-opacity': 0.65 }, // Transparencia para ver las calles abajo
        })

        // Tu Marcador interactivo premium
        const el = document.createElement('div')
        el.style.cssText = `
          width: 18px; height: 18px; background: #ef4444;
          border: 3px solid white; border-radius: 50%;
          box-shadow: 0 0 0 4px rgba(239,68,68,0.35), 0 2px 10px rgba(0,0,0,0.5); cursor: pointer;
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
        Capa Satelital <span className="hidden md:inline">GOES</span>
        <span className="bg-emerald-50 text-emerald-500 text-[0.62rem] font-bold px-[7px] py-[1px] rounded-full">En vivo</span>
      </div>

      {/* LEYENDA PREMIUM INTEGRADA */}
      <div className="absolute bottom-[10px] right-[10px] md:bottom-[14px] md:right-[14px] z-20 bg-white/95 backdrop-blur-md rounded-full py-[8px] px-[12px] md:px-[16px] border border-slate-200 shadow-[0_4px_15px_rgba(0,0,0,0.08)] flex items-center gap-[8px] md:gap-[10px]">
        <div className="text-[0.6rem] md:text-[0.65rem] font-bold text-slate-600 flex gap-[4px]">
          Nubes <span className="text-slate-400 font-semibold hidden md:inline">Ligeras</span>
        </div>
        <div className="w-[80px] md:w-[120px] h-[6px] rounded-full" style={{
          // Colores de la escala termal del satélite
          background: 'linear-gradient(to right, rgba(255,255,255,0.2), #ffffff, #ffff00, #ff9900, #ff0000)'
        }} />
        <div className="text-[0.6rem] md:text-[0.65rem] font-semibold text-slate-600">
          Tormenta
        </div>
      </div>
    </div>
  )
}
