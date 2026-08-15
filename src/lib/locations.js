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
