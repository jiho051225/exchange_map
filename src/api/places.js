export async function searchPlaces(query, signal) {
  const response = await fetch(`/api/places?q=${encodeURIComponent(query)}`, { signal, headers: { accept: 'application/json' } })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const places = await response.json()
  if (!Array.isArray(places)) throw new Error('Invalid place search response')
  return places
}
