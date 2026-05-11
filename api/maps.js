export default async function handler(req, res) {
  const queryString = new URLSearchParams(req.query).toString()
  const path = req.url.replace('/api/maps', '')
  const url = `https://maps.googleapis.com${path}?${queryString}&key=${process.env.GOOGLE_PLACES_API_KEY}`

  try {
    const response = await fetch(url)
    const data = await response.json()
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.status(200).json(data)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}
