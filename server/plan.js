const coordinates = /^-?\d{1,2}(?:\.\d+)?,\s*-?\d{1,3}(?:\.\d+)?$/

function validPoint(value) {
  if (!coordinates.test(value || '')) return false
  const [lat, lon] = value.split(',').map(Number)
  return Math.abs(lat) <= 90 && Math.abs(lon) <= 180
}

function validPlace(value) {
  if (typeof value !== 'string') return false
  if (value.includes(',')) return validPoint(value)
  return value.length <= 200 && /^[^\s\p{C}]+$/u.test(value)
}

export async function planMiddleware(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'GET 요청만 허용됩니다.' })
  if ((req.url || '').length > 2048) return send(res, 414, { error: '요청이 너무 깁니다.' })
  const incoming = new URL(req.url, 'http://localhost')
  const from = incoming.searchParams.get('fromPlace')
  const to = incoming.searchParams.get('toPlace')
  const time = incoming.searchParams.get('time')
  if (!validPlace(from) || !validPlace(to) || !time || Number.isNaN(Date.parse(time))) {
    return send(res, 400, { error: '출발지, 도착지, 출발 시간을 확인하세요.' })
  }
  const upstream = new URL(process.env.UPSTREAM_API_URL || 'https://api.transitous.org/api/v6/plan')
  upstream.searchParams.set('fromPlace', from)
  upstream.searchParams.set('toPlace', to)
  upstream.searchParams.set('time', time)
  upstream.searchParams.set('searchWindow', '3600')
  upstream.searchParams.set('numItineraries', '8')
  upstream.searchParams.set('maxItineraries', '20')
  upstream.searchParams.set('directModes', 'WALK')
  const contact = process.env.APP_CONTACT_URL || 'https://github.com/jiho051225/exchange_map'
  const headers = {
    accept: 'application/json',
    'user-agent': `FrankfurtRoute/1.0 (+${contact})`,
  }
  if (process.env.UPSTREAM_API_KEY) {
    const header = process.env.UPSTREAM_API_KEY_HEADER || 'x-api-key'
    headers[header] = process.env.UPSTREAM_API_KEY
  }
  try {
    const response = await fetch(upstream, { headers, signal: AbortSignal.timeout(15000) })
    if (!response.ok) {
      console.error(`Transitous plan request failed: HTTP ${response.status}`)
      return send(res, 502, { error: '경로 서비스가 요청을 처리하지 못했습니다.', upstreamStatus: response.status })
    }
    const body = await response.text()
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
    res.end(body)
  } catch {
    send(res, 502, { error: '경로 서비스에 연결하지 못했습니다.' })
  }
}

function send(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(JSON.stringify(payload))
}
