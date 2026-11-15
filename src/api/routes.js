const berlinParts = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
})
const berlinClock = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
})
const transitModes = new Set([
  'TRANSIT', 'TRAM', 'SUBWAY', 'FERRY', 'AIRPLANE', 'BUS', 'COACH',
  'RAIL', 'HIGHSPEED_RAIL', 'LONG_DISTANCE', 'NIGHT_RAIL',
  'REGIONAL_RAIL', 'REGIONAL_FAST_RAIL', 'SUBURBAN', 'FUNICULAR',
  'AERIAL_LIFT', 'METRO', 'CABLE_CAR', 'OTHER',
])

function parts(date) {
  return Object.fromEntries(berlinParts.formatToParts(date).filter(part => part.type !== 'literal').map(part => [part.type, part.value]))
}

export function berlinNow(offsetMinutes = 0) {
  const p = parts(new Date(Date.now() + offsetMinutes * 60000))
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` }
}

export function berlinToIso(date, time) {
  const wall = Date.parse(`${date}T${time}:00Z`)
  let utc = wall
  for (let i = 0; i < 3; i++) {
    const p = parts(new Date(utc))
    const shown = Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:00Z`)
    utc += wall - shown
  }
  return new Date(utc).toISOString()
}

export function formatTime(timestamp) {
  if (!timestamp) return '시간 미제공'
  const date = new Date(timestamp)
  return Number.isNaN(+date) ? '시간 미제공' : berlinClock.format(date)
}

export function formatDuration(minutes) {
  const total = Math.max(0, Math.round(minutes))
  if (total < 60) return `${total}분`
  return `${Math.floor(total / 60)}시간 ${total % 60}분`
}

function decodePolyline(value, precision = 6) {
  let index = 0, lat = 0, lon = 0
  const points = []
  while (index < value.length) {
    for (const latitude of [true, false]) {
      let result = 0, shift = 0, byte
      do {
        byte = value.charCodeAt(index++) - 63
        result |= (byte & 31) << shift
        shift += 5
      } while (byte >= 32 && index < value.length)
      const delta = result & 1 ? ~(result >> 1) : result >> 1
      if (latitude) lat += delta
      else lon += delta
    }
    const point = [lat / 10 ** precision, lon / 10 ** precision]
    if (Math.abs(point[0]) <= 90 && Math.abs(point[1]) <= 180) points.push(point)
  }
  return points
}

function normalize(raw, id) {
  const legs = (raw.legs || []).map(leg => ({
    start: leg.startTime ?? leg.departure ?? leg.from?.departure,
    end: leg.endTime ?? leg.arrival ?? leg.to?.arrival,
    from: leg.from?.name ?? leg.from?.stop?.name ?? '승차 지점',
    to: leg.to?.name ?? leg.to?.stop?.name ?? '하차 지점',
    mode: leg.mode ?? leg.route?.mode ?? '',
    line: leg.routeShortName ?? leg.route?.shortName ?? leg.route?.name ?? '',
    headsign: leg.headsign ?? leg.trip?.headsign ?? '',
    platform: leg.from?.platform ?? leg.from?.track ?? '',
    transit: transitModes.has(leg.mode) || Boolean(leg.routeId || leg.tripId || leg.transitLeg || leg.route || leg.trip),
    points: typeof leg.legGeometry?.points === 'string' ? decodePolyline(leg.legGeometry.points) : [],
  }))
  const start = raw.startTime ?? legs[0]?.start
  const end = raw.endTime ?? legs.at(-1)?.end
  const minutes = Number.isFinite(+raw.duration) ? Math.round(+raw.duration / 60) : Math.round((new Date(end) - new Date(start)) / 60000)
  const transfers = Number.isInteger(raw.transfers) ? raw.transfers : Math.max(0, legs.filter(leg => leg.transit).length - 1)
  const key = legs.map(leg => `${leg.line}/${leg.from}/${leg.to}/${leg.start}`).join('|')
  return { id, legs, start, end, minutes, transfers, key, badges: [] }
}

function recommend(rawRoutes) {
  const valid = rawRoutes.map(normalize).filter(route => Number.isFinite(route.minutes) && route.minutes >= 0 && route.legs.length && route.legs.some(leg => leg.transit))
  const unique = [...new Map(valid.map(route => [route.key, route])).values()]
  if (!unique.length) return []
  const fastest = [...unique].sort((a, b) => a.minutes - b.minutes || a.transfers - b.transfers)[0]
  const least = [...unique].sort((a, b) => a.transfers - b.transfers || a.minutes - b.minutes)[0]
  const balanced = [...unique].filter(route => route.minutes <= fastest.minutes + 15).sort((a, b) => a.transfers - b.transfers || a.minutes - b.minutes)[0]
  for (const [route, label] of [[fastest, '가장 빠름'], [least, '환승 최소'], [balanced, '균형 추천']]) {
    if (route && !route.badges.includes(label)) route.badges.push(label)
  }
  return [...new Set([fastest, least, balanced])].slice(0, 3)
}

export async function fetchRoutes(from, to, iso, signal) {
  const placeValue = place => place.type === 'PLACE' || place.type === 'ADDRESS'
    ? `${place.lat},${place.lon}` : place.id
  const query = new URLSearchParams({
    fromPlace: placeValue(from),
    toPlace: placeValue(to),
    time: iso,
    searchWindow: '3600',
    numItineraries: '8',
    maxItineraries: '20',
    directModes: 'WALK',
  })
  const response = await fetch(`/api/plan?${query}`, { signal, headers: { accept: 'application/json' } })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const data = await response.json()
  return recommend(data.itineraries || [])
}
