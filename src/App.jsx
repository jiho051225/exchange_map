import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import { STOPS } from './data/stops.js'
import { berlinNow, berlinToIso, fetchRoutes, formatTime } from './api/routes.js'

const storageKey = 'frankfurt-route-last'

function initialInputs() {
  const initial = { from: null, to: null, ...berlinNow(10), old: false }
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || 'null')
    if (saved) {
      initial.from = STOPS.find(stop => stop.id === saved.from) || null
      initial.to = STOPS.find(stop => stop.id === saved.to) || null
      if (saved.date && saved.time) {
        initial.date = saved.date
        initial.time = saved.time
        initial.old = berlinToIso(saved.date, saved.time) <= new Date().toISOString()
      }
    }
  } catch { /* Storage may be disabled. */ }
  return initial
}

function PlaceInput({ kind, label, value, stop, onChange, onChoose, active, setActive }) {
  const inputRef = useRef(null)
  const matches = STOPS.filter(item => !value.trim() || item.name.toLowerCase().includes(value.trim().toLowerCase())).slice(0, 8)
  return <div className="place-row">
    <span className={`place-dot ${kind === 'from' ? 'origin' : 'destination'}`} />
    <label htmlFor={kind}>{label}</label>
    <input id={kind} ref={inputRef} value={value} autoComplete="off" placeholder={`${label} 정류장을 검색하세요`}
      aria-autocomplete="list" aria-expanded={active} aria-controls={`${kind}List`}
      onFocus={() => setActive(true)} onChange={event => onChange(event.target.value)}
      onKeyDown={event => {
        if (event.key === 'Escape') setActive(false)
        if (event.key === 'Enter' && active && matches[0]) {
          event.preventDefault()
          onChoose(matches[0])
        }
      }} />
    {active && <div id={`${kind}List`} className="suggestions show" role="listbox">
      {matches.length ? matches.map(item => <button key={item.id} type="button" role="option" aria-selected={stop?.id === item.id}
        onMouseDown={event => event.preventDefault()} onClick={() => { onChoose(item); inputRef.current?.focus() }}>
        {item.name}<small>프랑크푸르트 정류장</small>
      </button>) : <button type="button" disabled>일치하는 정류장이 없습니다</button>}
    </div>}
  </div>
}

function RouteCard({ route, selected, onSelect }) {
  return <button type="button" className={`route-card ${selected ? 'selected' : ''}`} aria-pressed={selected} onClick={onSelect}>
    <div className="badges">{route.badges.map((badge, index) => <span key={badge} className={`badge ${index ? 'other' : ''}`}>{badge}</span>)}</div>
    <div className="route-main"><strong>{route.minutes}</strong><small>분</small><span className="right">환승 {route.transfers}회</span></div>
    <div className="route-times">{formatTime(route.start)} <span>→</span> {formatTime(route.end)}</div>
    <div className="segments">{route.legs.map((leg, index) => <span key={index} className="segment-wrap">
      <span className={`segment ${leg.transit ? '' : 'walk'}`}>{leg.transit ? leg.line || leg.mode || '대중교통' : '도보'}</span>
      {index < route.legs.length - 1 && <i />}
    </span>)}</div>
    {selected && <div className="route-detail"><strong>이동 순서 · 프랑크푸르트 현지 시각</strong>
      {route.legs.map((leg, index) => <div className="leg" key={index}>
        <span className="leg-time">{formatTime(leg.start)}</span>
        <div className="leg-body"><b>{leg.from} → {leg.to}</b>
          <span>{leg.transit ? `${leg.line || leg.mode || '대중교통'}${leg.headsign ? ` · ${leg.headsign} 방향` : ''}` : '도보 연결'}</span>
          <small>도착 {formatTime(leg.end)}{leg.platform ? ` · 승강장 ${leg.platform}` : ''}</small>
        </div>
      </div>)}
      <div className="detail-note">배차 간격과 요금 정보 없음 · 시간은 제공처의 경로 조회 기준입니다. 승차 전 노선 방향과 승강장을 현장에서 다시 확인하세요.</div>
    </div>}
  </button>
}

function MapView({ route, from, to, notice }) {
  const element = useRef(null)
  const map = useRef(null)
  const layer = useRef(null)
  useEffect(() => {
    const instance = L.map(element.current, { zoomControl: false }).setView([50.112, 8.680], 13)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' }).addTo(instance)
    L.control.zoom({ position: 'bottomright' }).addTo(instance)
    map.current = instance
    layer.current = L.featureGroup().addTo(instance)
    return () => { instance.remove(); map.current = null; layer.current = null }
  }, [])
  useEffect(() => {
    if (!route || !from || !to || !map.current) return
    layer.current.clearLayers()
    const places = [[from.lat, from.lon], [to.lat, to.lon]]
    for (const [index, stop] of [from, to].entries()) {
      const popup = L.DomUtil.create('span')
      popup.textContent = stop.name
      L.marker(places[index], { icon: L.divIcon({ className: `map-marker ${index ? 'end' : ''}`, iconSize: [16, 16] }) })
        .bindPopup(popup).addTo(layer.current)
    }
    for (const leg of route.legs) {
      if (leg.points.length > 1) L.polyline(leg.points, {
        color: leg.transit ? '#1675ed' : '#7d9cb8', weight: leg.transit ? 5 : 3,
        opacity: .85, dashArray: leg.transit ? null : '5 6',
      }).addTo(layer.current)
    }
    const bounds = L.latLngBounds([...places, ...route.legs.flatMap(leg => leg.points)])
    map.current.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 })
  }, [route, from, to])
  const hasGeometry = route?.legs.some(leg => leg.points.length > 1)
  return <main className="map-area">
    <div id="map" ref={element} />
    <div className="map-overlay top-left"><span className="live-dot" /> FRANKFURT AM MAIN <span className="divider">/</span> GERMANY</div>
    <div className="map-overlay top-right">낯선 도시의 이동을 위한 길찾기</div>
    {(!route || !hasGeometry) && <div className="map-notice">{route ? '제공처에 경로 좌표가 없어 지점만 표시합니다.' : notice}</div>}
    <div className="map-credit">실제 경로 데이터 Transitous · © OpenStreetMap contributors</div>
  </main>
}

export default function App() {
  const initial = useMemo(initialInputs, [])
  const [from, setFrom] = useState(initial.from)
  const [to, setTo] = useState(initial.to)
  const [fromText, setFromText] = useState(initial.from?.name || '')
  const [toText, setToText] = useState(initial.to?.name || '')
  const [active, setActive] = useState(null)
  const [date, setDate] = useState(initial.date)
  const [time, setTime] = useState(initial.time)
  const [routes, setRoutes] = useState([])
  const [selected, setSelected] = useState(null)
  const [searchedPlaces, setSearchedPlaces] = useState(null)
  const [sort, setSort] = useState('duration')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(initial.old ? { kind: 'info', text: '저장된 출발 시간이 지났습니다. 새 시간을 입력하세요.' } : null)
  const [notice, setNotice] = useState('경로를 선택하면 지도에서 확인할 수 있습니다.')
  const request = useRef(null)
  const sorted = useMemo(() => [...routes].sort((a, b) => sort === 'transfers'
    ? a.transfers - b.transfers || a.minutes - b.minutes
    : a.minutes - b.minutes || a.transfers - b.transfers), [routes, sort])
  const selectedRoute = routes.find(route => route.id === selected)

  useEffect(() => () => request.current?.abort(), [])

  async function search(event) {
    event?.preventDefault()
    if (request.current) return
    setMessage(null)
    if (!from || !to) return setMessage({ kind: 'error', text: '검색 후보에서 출발지와 도착지를 선택하세요.' })
    if (from.id === to.id) return setMessage({ kind: 'error', text: '서로 다른 출발지와 도착지를 선택하세요.' })
    if (!date || !time) return setMessage({ kind: 'error', text: '출발 날짜와 시간을 입력하세요.' })
    let iso
    try { iso = berlinToIso(date, time) } catch { return setMessage({ kind: 'error', text: '올바른 날짜와 시간을 입력하세요.' }) }
    if (iso <= new Date().toISOString()) return setMessage({ kind: 'error', text: '프랑크푸르트 현지 시각 기준 미래의 출발 시간을 입력하세요.' })
    const controller = new AbortController()
    request.current = controller
    setLoading(true)
    setRoutes([])
    setSelected(null)
    setSearchedPlaces(null)
    setNotice('경로를 조회하고 있습니다…')
    setMessage({ kind: 'info', text: 'Transitous에서 실제 운행 경로를 조회하고 있습니다.' })
    try { localStorage.setItem(storageKey, JSON.stringify({ from: from.id, to: to.id, date, time })) } catch { /* Search still works. */ }
    try {
      const found = await fetchRoutes(from, to, iso, controller.signal)
      setRoutes(found)
      if (found.length) {
        setSearchedPlaces({ from, to })
        setSelected(found[0].id)
        setMessage(null)
      } else {
        setNotice('표시할 경로가 없습니다.')
        setMessage({ kind: 'info', text: '이 조건에서 대중교통 경로를 찾지 못했습니다. 장소나 출발 시간을 바꿔 보세요.' })
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        setNotice('경로를 불러오지 못했습니다.')
        setMessage({ kind: 'error', retry: true, text: '경로 서비스에 연결하지 못했습니다. 네트워크 상태를 확인하고 다시 시도하세요.' })
      }
    } finally { request.current = null; setLoading(false) }
  }

  return <div className="app-shell" onClick={event => { if (!event.target.closest('.place-row')) setActive(null) }}>
    <aside className="sidebar">
      <header className="brand"><span className="brand-mark">↗</span><div><strong>길위의 프랑크푸르트</strong><small>FRANKFURT TRANSIT GUIDE</small></div><span className="city-tag">FRANKFURT</span></header>
      <div className="sidebar-scroll">
        <div className="intro"><p className="eyebrow">PUBLIC TRANSIT ROUTE</p><h1>가볍게 떠나는<br /><em>당신의 다음 정류장</em></h1><p>프랑크푸르트의 버스·U-Bahn·S-Bahn·트램 경로를 비교해 보세요.</p></div>
        <div className="mode-row" aria-label="교통수단"><span className="mode active">↗ <b>대중교통</b></span><span className="mode">🚶 도보 연결 포함</span></div>
        <form onSubmit={search} noValidate>
          <div className="place-box">
            <PlaceInput kind="from" label="출발" value={fromText} stop={from} active={active === 'from'} setActive={open => setActive(open ? 'from' : null)}
              onChange={value => { setFromText(value); setFrom(null); setActive('from') }} onChoose={stop => { setFrom(stop); setFromText(stop.name); setActive(null) }} />
            <button className="swap" type="button" title="출발지와 도착지 바꾸기" aria-label="출발지와 도착지 바꾸기" onClick={() => { setFrom(to); setTo(from); setFromText(toText); setToText(fromText) }}>⇅</button>
            <PlaceInput kind="to" label="도착" value={toText} stop={to} active={active === 'to'} setActive={open => setActive(open ? 'to' : null)}
              onChange={value => { setToText(value); setTo(null); setActive('to') }} onChoose={stop => { setTo(stop); setToText(stop.name); setActive(null) }} />
          </div>
          <div className="time-heading"><span>출발 일시</span><span>프랑크푸르트 현지 시각 · Europe/Berlin</span></div>
          <div className="time-row"><input type="date" aria-label="출발 날짜" value={date} onChange={event => setDate(event.target.value)} /><input type="time" aria-label="출발 시간" value={time} onChange={event => setTime(event.target.value)} /></div>
          <button className="search-button" type="submit" disabled={loading}>{loading ? '경로 조회 중…' : '경로 찾기'} <span>→</span></button>
        </form>
        {message && <div className={`message ${message.kind === 'info' ? 'info' : ''}`} role="status">{message.text}{message.retry && <button type="button" onClick={search}>다시 시도</button>}</div>}
        <div className="results-heading"><div><span className="eyebrow">YOUR ROUTES</span><h2>추천 경로 <span>{routes.length ? String(routes.length).padStart(2, '0') : ''}</span></h2></div><select aria-label="경로 정렬" value={sort} onChange={event => setSort(event.target.value)}><option value="duration">소요 시간순</option><option value="transfers">환승 횟수순</option></select></div>
        {!routes.length && <div className="empty-state"><span className="empty-icon">↗</span><strong>어디로 이동하시나요?</strong><p>출발지와 도착지를 정하면<br />추천 경로가 이곳에 표시됩니다.</p></div>}
        <div className="results">{sorted.map(route => <RouteCard key={route.id} route={route} selected={route.id === selected} onSelect={() => setSelected(route.id)} />)}</div>
        <details className="tips"><summary><span className="tip-icon">✦</span><span><strong>교환학생 교통 팁</strong><small>Deutschland-Semesterticket</small></span><span className="chevron">⌄</span></summary><div className="tip-body"><p>별도 교통권을 구매하기 전에 학교가 Deutschland-Semesterticket을 제공하는지 확인하세요. 교환학생의 발급 자격·방법·유효기간은 학교의 공식 안내를 확인해야 합니다.</p><a href="https://www.rmv.de/c/de/tickets/sortiment/tickets-im-ueberblick/deutschlandsemesterticket" target="_blank" rel="noopener noreferrer">RMV 공식 안내 →</a><small>적용 범위: 제공 학교의 자격 확인 대상 · 확인일 2026.11.15</small></div></details>
      </div>
      <footer className="sidebar-footer"><span>데이터 <a href="https://transitous.org/sources/" target="_blank" rel="noopener noreferrer">Transitous</a> · 지도 © OpenStreetMap</span><span>FRANKFURT AM MAIN</span></footer>
    </aside>
    <MapView route={selectedRoute} from={searchedPlaces?.from} to={searchedPlaces?.to} notice={notice} />
  </div>
}
