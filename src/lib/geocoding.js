// Real address search and reverse geocoding via Nominatim — OpenStreetMap's
// free public geocoder. Same "no API key, no billing account" philosophy as
// routing.js (OSRM) and RealMap.jsx (CARTO tiles). Nominatim's usage policy
// caps this at ~1 request/second for the shared public instance, which is
// why search is debounced at the call site rather than firing per keystroke.
const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org'

// Rough Bangalore bounding box — biases results toward the city this app
// operates in without hard-excluding anything outside it.
const BANGALORE_VIEWBOX = '77.35,13.20,77.85,12.75' // left,top,right,bottom

export async function searchAddress(query) {
  const q = query.trim()
  if (q.length < 3) return []

  const params = new URLSearchParams({
    q,
    format: 'jsonv2',
    limit: '5',
    countrycodes: 'in',
    viewbox: BANGALORE_VIEWBOX,
    bounded: '0', // bias, don't hard-exclude — the rider may genuinely be outside the box
  })

  try {
    const res = await fetch(`${NOMINATIM_BASE}/search?${params}`, {
      headers: { 'Accept-Language': 'en' },
    })
    if (!res.ok) throw new Error(`Nominatim responded ${res.status}`)
    const data = await res.json()
    return data.map(r => ({
      address: r.display_name,
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
    }))
  } catch (err) {
    console.warn('Address search unavailable:', err.message)
    return []
  }
}

export async function reverseGeocode(lat, lng) {
  const params = new URLSearchParams({ lat, lon: lng, format: 'jsonv2' })
  try {
    const res = await fetch(`${NOMINATIM_BASE}/reverse?${params}`, {
      headers: { 'Accept-Language': 'en' },
    })
    if (!res.ok) throw new Error(`Nominatim responded ${res.status}`)
    const data = await res.json()
    return data.display_name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`
  } catch (err) {
    console.warn('Reverse geocoding unavailable:', err.message)
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
  }
}

// Wraps the browser Geolocation API in a promise and immediately resolves
// it to a real address via reverseGeocode, since every caller here wants
// "where am I, in words" rather than raw coordinates alone.
export function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not available in this browser.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        const address = await reverseGeocode(lat, lng)
        resolve({ address, lat, lng })
      },
      err => reject(new Error(err.message || 'Could not get your location.')),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    )
  })
}
