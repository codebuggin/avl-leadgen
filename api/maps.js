export default async function handler(req, res) {
  // Strip the query string from the path so we don't get a double-? URL.
  // req.url  = "/api/maps/maps/api/place/textsearch/json?query=..."
  // req.query = { query: "..." }  ← Vercel parses this for us
  const pathWithQuery = req.url.replace('/api/maps', '')
  const pathOnly      = pathWithQuery.split('?')[0]
  const queryString   = new URLSearchParams(req.query).toString()
  const url = `https://maps.googleapis.com${pathOnly}?${queryString}&key=${process.env.GOOGLE_PLACES_API_KEY}`

  console.log('[maps proxy] →', url.replace(process.env.GOOGLE_PLACES_API_KEY, 'KEY'))

  try {
    const response = await fetch(url)
    const data = await response.json()
    console.log('[maps proxy] status:', data.status, '| results:', data.results?.length ?? (data.result ? 1 : 0))
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.status(200).json(data)
  } catch (error) {
    console.error('[maps proxy] error:', error.message)
    res.status(500).json({ error: error.message })
  }
}
