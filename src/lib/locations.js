// Without a real geocoding/Places integration, pickup and destination are
// a picker over known Bangalore areas rather than free text everywhere a
// rider chooses a location — shared here so Book Ride and Schedule a Ride
// can't drift into two different lists.
export const KNOWN_LOCATIONS = [
  'Koramangala 5th Block',
  'MG Road Metro Station',
  'HSR Layout Sector 2',
  'Indiranagar 100 Ft Road',
  'Whitefield ITPL Gate',
  'Electronic City Phase 1',
  'Silk Board Junction',
  'Jayanagar 4th Block',
  'Bellandur Lake Road',
]

// Approximate real coordinates for each location above, so fare/ETA can be
// derived from actual distance instead of a flat number.
export const LOCATION_COORDS = {
  'Koramangala 5th Block':    { lat: 12.9352, lng: 77.6146 },
  'MG Road Metro Station':    { lat: 12.9757, lng: 77.6079 },
  'HSR Layout Sector 2':      { lat: 12.9116, lng: 77.6412 },
  'Indiranagar 100 Ft Road':  { lat: 12.9784, lng: 77.6408 },
  'Whitefield ITPL Gate':     { lat: 12.9698, lng: 77.7500 },
  'Electronic City Phase 1':  { lat: 12.8452, lng: 77.6602 },
  'Silk Board Junction':      { lat: 12.9172, lng: 77.6228 },
  'Jayanagar 4th Block':      { lat: 12.9250, lng: 77.5938 },
  'Bellandur Lake Road':      { lat: 12.9304, lng: 77.6784 },
}
