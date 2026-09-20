import { useState, useEffect, useRef } from 'react'
import { searchAddress } from '@/lib/geocoding'

/*
  Free-text address search with a live suggestions dropdown — the Uber/
  Rapido pattern — replacing the old fixed 9-location <select>. Debounced
  at 400ms both to feel responsive and to stay well under Nominatim's free
  public-instance rate limit (see src/lib/geocoding.js).
*/
export default function LocationSearchInput({
  value,
  onChange,
  onSelect,
  placeholder,
  onUseCurrentLocation,
  locatingCurrent,
  autoFocus,
}) {
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef(null)
  const wrapRef = useRef(null)

  useEffect(() => {
    clearTimeout(debounceRef.current)
    if (!value || value.trim().length < 3) {
      setSuggestions([])
      return
    }
    setSearching(true)
    debounceRef.current = setTimeout(async () => {
      const results = await searchAddress(value)
      setSuggestions(results)
      setSearching(false)
    }, 400)
    return () => clearTimeout(debounceRef.current)
  }, [value])

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleSelect(result) {
    onSelect(result)
    setOpen(false)
    setSuggestions([])
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <input
        type="text"
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        style={{ width: '100%', height: 52, padding: '0 16px', background: '#F8F9FA', border: 'none', borderRadius: 12, fontSize: 15, color: 'var(--color-on-surface)', outline: 'none', fontFamily: 'var(--font-sans)', boxSizing: 'border-box' }}
      />
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 6, background: 'white', borderRadius: 12, boxShadow: '0 8px 24px rgba(26,43,60,0.15)', border: '1px solid var(--color-outline-variant)', zIndex: 50, overflow: 'hidden' }}>
          {onUseCurrentLocation && (
            <button type="button" onClick={onUseCurrentLocation} disabled={locatingCurrent}
              className="flex items-center gap-3 w-full text-left"
              style={{ padding: '12px 16px', background: 'none', border: 'none', borderBottom: '1px solid var(--color-outline-variant)', cursor: locatingCurrent ? 'not-allowed' : 'pointer' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--color-primary)' }}>my_location</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-primary)' }}>
                {locatingCurrent ? 'Finding your location…' : 'Use current location'}
              </span>
            </button>
          )}
          {searching && (
            <p style={{ padding: '12px 16px', fontSize: 13, color: 'var(--color-secondary)' }}>Searching…</p>
          )}
          {!searching && suggestions.length === 0 && value.trim().length >= 3 && (
            <p style={{ padding: '12px 16px', fontSize: 13, color: 'var(--color-secondary)' }}>No matches found.</p>
          )}
          {!searching && suggestions.map((s, i) => (
            <button key={`${s.lat}-${s.lng}-${i}`} type="button" onClick={() => handleSelect(s)}
              className="flex items-start gap-3 w-full text-left"
              style={{ padding: '12px 16px', background: 'none', border: 'none', borderTop: i > 0 ? '1px solid var(--color-outline-variant)' : 'none', cursor: 'pointer' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--color-secondary)', marginTop: 2 }}>location_on</span>
              <span style={{ fontSize: 13, color: 'var(--color-on-surface)', lineHeight: 1.4 }}>{s.address}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
