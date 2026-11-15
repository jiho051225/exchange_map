export async function placeSearchMiddleware(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'GET 요청만 허용됩니다.' })
  if ((req.url || '').length > 512) return send(res, 414, { error: '요청이 너무 깁니다.' })
  const query = new URL(req.url, 'http://localhost').searchParams.get('q')?.trim() || ''
  if (query.length < 2 || query.length > 80) return send(res, 400, { error: '검색어를 2~80자로 입력하세요.' })

  const upstream = new URL(process.env.UPSTREAM_GEOCODE_URL || 'https://api.transitous.org/api/v1/geocode')
  upstream.searchParams.set('text', query)
  upstream.searchParams.set('place', '50.1109,8.6821')
  upstream.searchParams.set('numResults', '8')
  const contact = process.env.APP_CONTACT_URL || 'https://github.com/jiho051225/exchange_map'
  const headers = { accept: 'application/json', 'user-agent': `FrankfurtRoute/1.0 (+${contact})` }
  if (process.env.UPSTREAM_API_KEY) headers[process.env.UPSTREAM_API_KEY_HEADER || 'x-api-key'] = process.env.UPSTREAM_API_KEY

  try {
    const response = await fetch(upstream, { headers, signal: AbortSignal.timeout(10000) })
    if (!response.ok) {
      console.error(`Transitous place search failed: HTTP ${response.status}`)
      return send(res, 502, { error: '장소 검색 서비스가 요청을 처리하지 못했습니다.' })
    }
    const results = await response.json()
    if (!Array.isArray(results)) return send(res, 502, { error: '장소 검색 응답 형식이 올바르지 않습니다.' })
    send(res, 200, results.filter(item => ['STOP', 'PLACE', 'ADDRESS'].includes(item.type) && typeof item.id === 'string' && typeof item.name === 'string' && Number.isFinite(item.lat) && Number.isFinite(item.lon))
      .map(item => ({
        id: item.id, type: item.type, name: item.name, lat: item.lat, lon: item.lon,
        modes: Array.isArray(item.modes) ? item.modes : [],
        area: item.areas?.find(area => area.default)?.name || item.areas?.[0]?.name || '',
        country: item.country || item.areas?.find(area => area.adminLevel === 2)?.name || '',
      })))
  } catch {
    send(res, 502, { error: '장소 검색 서비스에 연결하지 못했습니다.' })
  }
}

function send(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(JSON.stringify(payload))
}
