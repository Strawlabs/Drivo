import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

/*
  Leaflet's default marker icon breaks under Vite bundling (its relative
  image paths don't resolve), and a stock red teardrop pin wouldn't match
  this app's design language anyway — every marker here is a custom
  L.divIcon built from the same pin/car/dot shapes already used in the
  stylized map placeholders this replaces, so the visual language doesn't
  change, only the map underneath it does.
*/
function buildIcon(type, color) {
  const c = color ?? 'var(--color-primary)'
  const html = {
    car: `<div style="width:26px;height:26px;border-radius:50%;background:${c};border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center">
            <span class="material-symbols-outlined" style="font-size:15px;color:white">navigation</span>
          </div>`,
    pin: `<div style="display:flex;flex-direction:column;align-items:center;transform:translateY(-8px)">
            <div style="width:30px;height:30px;background:${c};border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 3px 10px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center">
              <span class="material-symbols-outlined" style="font-size:15px;color:white;transform:rotate(45deg)">location_on</span>
            </div>
          </div>`,
    dot: `<div style="width:14px;height:14px;border-radius:50%;background:${c};border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.35)"></div>`,
    driver: `<div style="width:28px;height:28px;border-radius:50%;background:${c};border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:10px">EV</div>`,
  }[type] ?? `<div style="width:14px;height:14px;border-radius:50%;background:${c};border:2px solid white"></div>`

  const size = { car: 26, pin: 30, dot: 14, driver: 28 }[type] ?? 14
  return L.divIcon({ html, className: '', iconSize: [size, size], iconAnchor: [size / 2, type === 'pin' ? size : size / 2] })
}

// react-leaflet only reads `center`/`zoom` on first mount — this keeps the
// view in sync when the caller's coordinates change later (e.g. BookRidePage
// swapping pickup/destination).
//
// invalidateSize() matters because every map here sits inside a flexbox
// container (flex-1 / height:100% panels) whose real pixel size isn't known
// until after layout settles — Leaflet computes its projection off whatever
// size the container had at construction time, so without this the map can
// initialize against a stale/zero size and every overlay (the route
// polyline especially) projects to a degenerate point until something else
// forces a resize.
function ViewSync({ center, zoom, bounds }) {
  const map = useMap()
  useEffect(() => {
    map.invalidateSize()
    if (bounds && bounds.length >= 2) {
      map.fitBounds(bounds, { padding: [32, 32] })
    } else if (center) {
      map.setView(center, zoom)
    }
  }, [JSON.stringify(center), zoom, JSON.stringify(bounds)])

  useEffect(() => {
    const raf = requestAnimationFrame(() => map.invalidateSize())
    const t = setTimeout(() => map.invalidateSize(), 250)
    return () => { cancelAnimationFrame(raf); clearTimeout(t) }
  }, [])

  return null
}

/*
  Dark CARTO basemap — free, no API key, no billing account, still backed
  by OpenStreetMap data. Chosen over the default light OSM tiles because
  every map surface in this app (SOS button, gradient overlays, route
  glow) was built for a dark map underneath it; the light default would
  clash badly with all of that surrounding chrome.
*/
export default function RealMap({
  center,
  zoom = 14,
  markers = [],
  route = null,
  bounds = null,
  interactive = true,
  className,
}) {
  // Absolutely positioned to fill the nearest `position: relative` ancestor
  // — the same convention every map/decorative panel in this app already
  // uses (`className="relative ..."` wrapper + `absolute inset-0` content).
  // A percentage height here doesn't reliably resolve when the caller's
  // wrapper gets its size from `flex: 1` + `min-height` rather than an
  // explicit `height` (a real CSS percentage-resolution gap, not a Leaflet
  // quirk) — this sidesteps that entirely instead of fighting it.
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      className={className}
      zoomControl={false}
      dragging={interactive}
      scrollWheelZoom={interactive}
      doubleClickZoom={interactive}
      touchZoom={interactive}
      keyboard={interactive}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        subdomains="abcd"
        maxZoom={19}
      />
      <ViewSync center={center} zoom={zoom} bounds={bounds} />
      {route && route.length > 1 && (
        // Keyed on the route's endpoints so a genuinely new route (new
        // pickup/destination, or the real OSRM path arriving after the
        // straight-line fallback) fully remounts the layer instead of
        // relying on react-leaflet's prop-diffing, which was observed
        // leaving a stale/collapsed path on screen after a route change.
        <Polyline key={`${route[0]?.join(',')}-${route[route.length - 1]?.join(',')}-${route.length}`}
          positions={route} pathOptions={{ color: '#2ecc71', weight: 4, opacity: 0.9 }} />
      )}
      {markers.map(m => (
        <Marker key={m.id} position={m.position} icon={buildIcon(m.type, m.color)}
          eventHandlers={m.onClick ? { click: m.onClick } : undefined} />
      ))}
    </MapContainer>
  )
}
