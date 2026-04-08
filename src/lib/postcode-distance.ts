/* ──────────────────────────────────────────────────────
   Postcode-based distance estimation
   UK postcode area centroids + Haversine formula
   ────────────────────────────────────────────────────── */

/** Approximate lat/lng centroids for ~60 common UK postcode areas */
const POSTCODE_CENTROIDS: Record<string, [number, number]> = {
  // East Anglia & Essex (home territory)
  'CO': [51.889, 0.903],    // Colchester
  'IP': [52.189, 1.088],    // Ipswich
  'NR': [52.630, 1.297],    // Norwich
  'CM': [51.736, 0.469],    // Chelmsford
  'CB': [52.205, 0.121],    // Cambridge
  'SS': [51.538, 0.707],    // Southend
  'PE': [52.573, -0.245],   // Peterborough

  // London & surrounds
  'E':  [51.545, 0.055],    // East London
  'EC': [51.514, -0.090],   // East Central London
  'N':  [51.575, -0.100],   // North London
  'NW': [51.550, -0.200],   // North West London
  'SE': [51.475, -0.050],   // South East London
  'SW': [51.470, -0.175],   // South West London
  'W':  [51.510, -0.200],   // West London
  'WC': [51.516, -0.120],   // West Central London
  'EN': [51.652, -0.080],   // Enfield
  'IG': [51.570, 0.080],    // Ilford
  'RM': [51.575, 0.183],    // Romford
  'DA': [51.447, 0.211],    // Dartford
  'BR': [51.395, 0.050],    // Bromley
  'CR': [51.372, -0.100],   // Croydon
  'KT': [51.378, -0.300],   // Kingston
  'TW': [51.449, -0.340],   // Twickenham
  'UB': [51.530, -0.440],   // Uxbridge
  'HA': [51.580, -0.340],   // Harrow
  'WD': [51.653, -0.395],   // Watford

  // South East
  'CT': [51.280, 1.080],    // Canterbury
  'ME': [51.349, 0.538],    // Medway
  'TN': [51.130, 0.265],    // Tonbridge
  'RH': [51.237, -0.172],   // Redhill
  'GU': [51.237, -0.774],   // Guildford
  'BN': [50.828, -0.139],   // Brighton
  'PO': [50.798, -1.091],   // Portsmouth
  'SO': [50.903, -1.404],   // Southampton
  'SL': [51.511, -0.595],   // Slough
  'HP': [51.753, -0.749],   // Hemel Hempstead
  'AL': [51.750, -0.341],   // St Albans
  'SG': [51.904, -0.191],   // Stevenage
  'LU': [51.878, -0.419],   // Luton
  'MK': [52.042, -0.760],   // Milton Keynes
  'OX': [51.752, -1.258],   // Oxford
  'RG': [51.454, -0.973],   // Reading

  // South West
  'SP': [51.068, -1.795],   // Salisbury
  'BA': [51.380, -2.359],   // Bath
  'BS': [51.454, -2.587],   // Bristol
  'EX': [50.723, -3.533],   // Exeter
  'PL': [50.375, -4.143],   // Plymouth
  'TR': [50.263, -5.051],   // Truro
  'DT': [50.713, -2.437],   // Dorchester
  'BH': [50.720, -1.879],   // Bournemouth
  'GL': [51.864, -2.244],   // Gloucester
  'SN': [51.559, -1.782],   // Swindon

  // Midlands
  'B':  [52.486, -1.890],   // Birmingham
  'CV': [52.408, -1.510],   // Coventry
  'LE': [52.634, -1.133],   // Leicester
  'NG': [52.950, -1.150],   // Nottingham
  'DE': [52.922, -1.476],   // Derby
  'ST': [52.983, -2.180],   // Stoke
  'WV': [52.586, -2.130],   // Wolverhampton
  'WS': [52.586, -1.982],   // Walsall
  'DY': [52.512, -2.085],   // Dudley
  'WR': [52.193, -2.221],   // Worcester
  'NN': [52.235, -0.901],   // Northampton
  'LN': [53.234, -0.538],   // Lincoln

  // North
  'M':  [53.483, -2.244],   // Manchester
  'L':  [53.408, -2.991],   // Liverpool
  'S':  [53.383, -1.465],   // Sheffield
  'LS': [53.800, -1.549],   // Leeds
  'BD': [53.795, -1.759],   // Bradford
  'HX': [53.725, -1.863],   // Halifax
  'HD': [53.650, -1.785],   // Huddersfield
  'WF': [53.683, -1.498],   // Wakefield
  'DN': [53.523, -1.134],   // Doncaster
  'HU': [53.745, -0.336],   // Hull
  'YO': [53.958, -1.080],   // York
  'NE': [54.978, -1.614],   // Newcastle
  'SR': [54.906, -1.381],   // Sunderland
  'DH': [54.779, -1.573],   // Durham
  'TS': [54.574, -1.235],   // Teesside
  'DL': [54.523, -1.553],   // Darlington
  'CA': [54.891, -2.933],   // Carlisle
  'LA': [54.046, -2.799],   // Lancaster
  'PR': [53.763, -2.703],   // Preston
  'BB': [53.755, -2.482],   // Blackburn
  'BL': [53.578, -2.429],   // Bolton
  'OL': [53.541, -2.108],   // Oldham
  'WN': [53.549, -2.632],   // Wigan
  'SK': [53.399, -2.015],   // Stockport
  'WA': [53.390, -2.597],   // Warrington
  'CH': [53.190, -2.890],   // Chester
  'CW': [53.101, -2.441],   // Crewe

  // Wales
  'CF': [51.482, -3.179],   // Cardiff
  'SA': [51.622, -3.943],   // Swansea
  'LD': [52.241, -3.380],   // Llandrindod Wells
  'LL': [53.120, -3.830],   // Llandudno
  'SY': [52.707, -2.754],   // Shrewsbury
  'NP': [51.588, -2.999],   // Newport

  // Scotland
  'EH': [55.953, -3.189],   // Edinburgh
  'G':  [55.864, -4.252],   // Glasgow
  'AB': [57.150, -2.094],   // Aberdeen
  'DD': [56.462, -2.970],   // Dundee
  'FK': [56.117, -3.937],   // Falkirk
  'KY': [56.201, -3.150],   // Kirkcaldy
  'IV': [57.478, -4.224],   // Inverness
  'PH': [56.396, -3.432],   // Perth
  'PA': [55.847, -4.434],   // Paisley

  // Northern Ireland
  'BT': [54.597, -5.930],   // Belfast
}

/**
 * Extract the postcode area (letter prefix) from a UK postcode.
 * e.g. 'CO3 4AB' -> 'CO', 'IP24 3HJ' -> 'IP', 'E1 6AN' -> 'E'
 */
export function extractPostcodeArea(postcode: string): string | null {
  if (!postcode) return null
  const cleaned = postcode.trim().toUpperCase().replace(/\s+/g, '')
  // UK postcode areas are 1-2 letters at the start
  const match = cleaned.match(/^([A-Z]{1,2})\d/)
  return match ? match[1] : null
}

/**
 * Haversine distance between two lat/lng points, in miles.
 */
function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const R = 3958.8 // Earth radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Estimate the straight-line distance in miles between two UK postcodes.
 * Returns null if either postcode area is not recognised.
 */
export function estimateDistance(from: string, to: string): number | null {
  const areaFrom = extractPostcodeArea(from)
  const areaTo = extractPostcodeArea(to)
  if (!areaFrom || !areaTo) return null

  const coordsFrom = POSTCODE_CENTROIDS[areaFrom]
  const coordsTo = POSTCODE_CENTROIDS[areaTo]
  if (!coordsFrom || !coordsTo) return null

  return Math.round(haversineDistance(
    coordsFrom[0], coordsFrom[1],
    coordsTo[0], coordsTo[1],
  ))
}

/**
 * Get the hassle factor adjustment based on distance from base.
 *   0-10 miles:  0
 *  10-20 miles:  5
 *  20-30 miles: 10
 *  30-50 miles: 20
 *  50+ miles:   30
 */
export function getDistanceHassleAdjustment(miles: number): number {
  if (miles <= 10) return 0
  if (miles <= 20) return 5
  if (miles <= 30) return 10
  if (miles <= 50) return 20
  return 30
}
