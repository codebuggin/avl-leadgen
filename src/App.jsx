import { useState, useRef, useCallback } from 'react'

const PRESET_NICHES = [
  'dental clinic', 'restaurant', 'gym', 'salon', 'optical store',
  'catering service', 'law firm', 'hotel', 'pharmacy',
  'ayurvedic clinic', 'homeopathy clinic'
]

const CITIES = [
  'Hyderabad', 'Mumbai', 'Delhi', 'Bangalore',
  'Chennai', 'Pune', 'Kolkata', 'Ahmedabad'
]

const OUTDATED_BUILDERS = [
  'wix.com', 'weebly.com', 'blogspot.com', 'wordpress.com',
  'jimdo.com', 'site123.com', 'yola.com'
]

const INVALID_DOMAINS = [
  'instagram.com', 'facebook.com', 'fb.com', 'twitter.com', 'x.com',
  'youtube.com', 'linkedin.com', 'justdial.com', 'sulekha.com',
  'practo.com', 'indiamart.com', 'tradeindia.com', 'google.com',
  'maps.google.com', 'linktr.ee', 'linkinbio', 'wa.me', 'whatsapp.com'
]

const PLACES_KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY
const OPENAI_KEY  = import.meta.env.VITE_OPENAI_API_KEY

/* ── Utilities ── */

function isRealWebsite(url) {
  if (!url) return false
  try {
    const domain = new URL(url).hostname.replace('www.', '')
    return !INVALID_DOMAINS.some(d => domain.includes(d))
  } catch {
    return false
  }
}

function classifyWebsite(website) {
  if (!isRealWebsite(website)) return 'no-website'
  const url = website.toLowerCase()
  if (OUTDATED_BUILDERS.some(b => url.includes(b))) return 'outdated'
  return 'has-website'
}

function delay(ms) {
  return new Promise(res => setTimeout(res, ms))
}

function waUrl(internationalPhone, pitch) {
  const digits = (internationalPhone || '').replace(/\D/g, '')
  if (!digits) return null
  return `https://wa.me/${digits}${pitch ? `?text=${encodeURIComponent(pitch)}` : ''}`
}

function toCSV(leads) {
  const headers = [
    'Name', 'City', 'Niche', 'Rating', 'Total Ratings',
    'Phone', 'Website', 'Address', 'Business Status', 'Website Status',
    'WhatsApp Link', 'Score', 'Reason', 'Pitch'
  ]
  const rows = leads.map(l => {
    const wa = waUrl(l.internationalPhone, l.pitch) || ''
    return [
      `"${(l.name || '').replace(/"/g, '""')}"`,
      l.city,
      l.niche,
      l.rating ?? '',
      l.userRatingsTotal ?? '',
      l.phone || '',
      l.website || '',
      `"${(l.address || '').replace(/"/g, '""')}"`,
      l.businessStatus || '',
      l.status,
      wa,
      l.score ?? '',
      `"${(l.reason || '').replace(/"/g, '""')}"`,
      `"${(l.pitch || '').replace(/"/g, '""')}"`,
    ]
  })
  return [headers, ...rows].map(r => r.join(',')).join('\n')
}

async function scoreLeadWithAI(lead) {
  if (!OPENAI_KEY) return {}
  const websiteLabel =
    lead.status === 'no-website' ? 'No real website (only has social media or directory listing)' :
    lead.status === 'outdated'   ? 'Outdated or template-based website' :
                                   'Has a proper website'
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 300,
        messages: [
          {
            role: 'system',
            content: `You are a lead scoring assistant for AVL Innovations, a web design agency based in Hyderabad that builds custom websites using React, Next.js and Tailwind. Never use templates. Write in plain professional English only. Do not use any Hindi, Urdu, or mixed language words.`,
          },
          {
            role: 'user',
            content: `Analyze this business and return ONLY a JSON object, no markdown, no backticks:
{
  "score": (0-10 integer, 10 = hottest lead),
  "reason": (one short sentence why),
  "pitch": (a short friendly professional cold outreach message in plain English, 3-4 sentences max, from AVL Innovations, mentioning the business name and offering to build or redesign their website. Sound human, not salesy.)
}

Business details:
- Name: ${lead.name}
- Niche: ${lead.niche}
- City: ${lead.city}
- Rating: ${lead.rating ?? 'unknown'} (${lead.userRatingsTotal ?? 0} reviews)
- Website status: ${websiteLabel}
- Website: ${lead.website || 'none'}`,
          },
        ],
      }),
    })
    const data = await res.json()
    const content = data.choices?.[0]?.message?.content?.trim()
    if (!content) return {}
    return JSON.parse(content)
  } catch (_) {
    return {}
  }
}

/* ── Components ── */

function ScoreBadge({ score }) {
  if (score == null) return null
  let bg, color, label
  if (score >= 8) {
    bg = '#b4ff4e'; color = '#0d0d0d'; label = `🔥 ${score}/10`
  } else if (score >= 5) {
    bg = 'var(--yellow-dim)'; color = 'var(--yellow)'; label = `⚡ ${score}/10`
  } else {
    bg = 'var(--surface-2)'; color = 'var(--text-dim)'; label = `${score}/10`
  }
  return (
    <span style={{
      fontFamily: 'var(--mono)', fontSize: '12px', fontWeight: 700, color,
      background: bg, border: `1px solid ${score >= 8 ? 'transparent' : 'var(--border)'}`,
      borderRadius: 'var(--radius)', padding: '3px 9px', whiteSpace: 'nowrap', flexShrink: 0,
    }}>
      {label}
    </span>
  )
}

function StatusBadge({ status }) {
  const map = {
    'no-website': { label: 'No Website',      color: 'var(--red)',    bg: 'var(--red-dim)'    },
    'outdated':   { label: 'Outdated / Basic', color: 'var(--yellow)', bg: 'var(--yellow-dim)' },
    'has-website':{ label: 'Has Website',      color: 'var(--green)',  bg: 'var(--green-dim)'  },
  }
  const s = map[status] || map['no-website']
  return (
    <span style={{
      fontFamily: 'var(--mono)', fontSize: '10px', fontWeight: 600,
      letterSpacing: '0.04em', textTransform: 'uppercase',
      color: s.color, background: s.bg, border: `1px solid ${s.color}33`,
      borderRadius: 'var(--radius)', padding: '2px 7px', whiteSpace: 'nowrap', flexShrink: 0,
    }}>
      {s.label}
    </span>
  )
}

function BusinessStatusBadge({ status }) {
  if (!status || status === 'OPERATIONAL') return null
  const closed = status === 'CLOSED_PERMANENTLY'
  return (
    <span style={{
      fontFamily: 'var(--mono)', fontSize: '10px', fontWeight: 600,
      letterSpacing: '0.04em', textTransform: 'uppercase',
      color: closed ? 'var(--red)' : 'var(--yellow)',
      background: closed ? 'var(--red-dim)' : 'var(--yellow-dim)',
      border: `1px solid ${closed ? 'rgba(255,78,78,0.3)' : 'rgba(255,204,78,0.3)'}`,
      borderRadius: 'var(--radius)', padding: '2px 7px', whiteSpace: 'nowrap', flexShrink: 0,
    }}>
      {closed ? 'Permanently Closed' : 'Temp. Closed'}
    </span>
  )
}

function relativeTime(ts) {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} min${m !== 1 ? 's' : ''} ago`
  const h = Math.floor(m / 60)
  return `${h} hr${h !== 1 ? 's' : ''} ago`
}

function DemoCard({ demo }) {
  const [, setTick] = useState(0)
  const [copied, setCopied] = useState(false)

  // Re-render every 30 s so the timestamp stays fresh
  useState(() => {
    const id = setInterval(() => setTick(t => t + 1), 30000)
    return () => clearInterval(id)
  })

  function copyLink() {
    navigator.clipboard.writeText(demo.url).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const wa = demo.pitch && demo.internationalPhone
    ? waUrl(demo.internationalPhone, demo.pitch) : null

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--accent-border)',
      borderRadius: 'var(--radius-lg)', padding: '16px 18px',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      {/* Name */}
      <div style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 600, color: 'var(--text-bright)', lineHeight: 1.3 }}>
        {demo.name}
      </div>

      {/* Tags */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <Tag label={demo.city}  color="var(--accent)"   bg="var(--accent-dim)" />
        <Tag label={demo.niche} color="var(--text-dim)" bg="var(--surface-2)"  />
      </div>

      {/* URL row */}
      <a
        href={demo.url} target="_blank" rel="noreferrer"
        style={{
          fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600,
          padding: '7px 14px', borderRadius: 'var(--radius)',
          background: 'var(--accent)', color: '#0d0d0d',
          textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6,
          alignSelf: 'flex-start',
        }}
      >
        View Demo →
      </a>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          onClick={copyLink}
          style={{
            fontFamily: 'var(--mono)', fontSize: 11, padding: '4px 12px', borderRadius: 4,
            background: copied ? 'var(--green-dim)' : 'var(--surface-2)',
            color: copied ? 'var(--green)' : 'var(--text-dim)',
            border: `1px solid ${copied ? 'rgba(78,255,143,0.4)' : 'var(--border)'}`,
            cursor: 'pointer', transition: 'all 0.2s',
          }}
        >
          {copied ? '✓ Copied' : '⧉ Copy Link'}
        </button>
        {wa && (
          <a
            href={wa} target="_blank" rel="noreferrer"
            style={{
              fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 500,
              padding: '4px 10px', borderRadius: 4,
              background: 'var(--accent-dim)', color: 'var(--accent)',
              border: '1px solid var(--accent-border)',
              textDecoration: 'none', whiteSpace: 'nowrap',
            }}
          >
            WhatsApp ↗
          </a>
        )}
      </div>

      {/* Timestamp */}
      <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>
        Deployed {relativeTime(demo.deployedAt)}
      </div>
    </div>
  )
}

function MiniSpinner() {
  return (
    <span style={{
      display: 'inline-block', width: 10, height: 10, flexShrink: 0,
      border: '1.5px solid rgba(180,255,78,0.2)', borderTopColor: 'var(--accent)',
      borderRadius: '50%', animation: 'spin 0.7s linear infinite',
    }} />
  )
}

function LeadCard({ lead, onDeploySuccess }) {
  const [hovered, setHovered]       = useState(false)
  const [pitchOpen, setPitchOpen]   = useState(false)
  const [copied, setCopied]         = useState(false)
  const [deployState, setDeployState] = useState('idle') // 'idle' | 'loading' | 'done'
  const [deployUrl, setDeployUrl]   = useState(null)
  const [deployError, setDeployError] = useState(null)
  const [localPitch, setLocalPitch] = useState(null)

  // Use locally overridden pitch (post-deploy) if available
  const effectivePitch = localPitch ?? lead.pitch
  const wa = effectivePitch && lead.internationalPhone
    ? waUrl(lead.internationalPhone, effectivePitch) : null

  const canDeploy = lead.status === 'no-website' || lead.status === 'outdated'

  function copyPitch() {
    navigator.clipboard.writeText(effectivePitch).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleDeploy() {
    setDeployState('loading')
    setDeployError(null)
    try {
      const res = await fetch(`${import.meta.env.VITE_AGENT2_URL}/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinicName: lead.name,
          phone:      lead.phone   || '0000000000',
          address:    lead.address || 'Hyderabad',
          city:       lead.city    || 'Hyderabad',
          tagline:    'Your Smile Is Our Priority',
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      // Accept common response shapes
      const url = data.url ?? data.demoUrl ?? data.deployUrl ?? data.link ??
        Object.values(data).find(v => typeof v === 'string' && v.startsWith('http'))
      if (!url) throw new Error('No URL returned')
      setDeployUrl(url)
      setDeployState('done')
      const updatedPitch = lead.pitch
        ? `${lead.pitch}\n\nWe built a free demo of your website: ${url} — take a look!`
        : null
      if (updatedPitch) setLocalPitch(updatedPitch)
      onDeploySuccess?.({
        id:                lead.id,
        name:              lead.name,
        niche:             lead.niche,
        city:              lead.city,
        url,
        pitch:             updatedPitch ?? lead.pitch,
        internationalPhone:lead.internationalPhone,
        deployedAt:        Date.now(),
      })
    } catch (_) {
      setDeployError('Deploy failed — make sure Agent 2 is running on port 3001')
      setDeployState('idle')
    }
  }

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: `1px solid ${hovered ? 'var(--border-2)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-lg)', padding: '16px 18px',
        display: 'flex', flexDirection: 'column', gap: '10px',
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Top: name (Google Maps link) + score badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <a
          href={`https://www.google.com/maps/place/?q=place_id:${lead.id}`}
          target="_blank" rel="noreferrer"
          className="lead-name-link"
          style={{ fontFamily: 'var(--mono)', fontSize: '13px', fontWeight: 600, color: 'var(--text-bright)', lineHeight: 1.3 }}
        >
          {lead.name}
        </a>
        <ScoreBadge score={lead.score} />
      </div>

      {/* Reason */}
      {lead.reason && (
        <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5, fontStyle: 'italic' }}>
          {lead.reason}
        </div>
      )}

      {/* Tags row */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <Tag label={lead.city} color="var(--accent)" bg="var(--accent-dim)" />
        <Tag label={lead.niche} color="var(--text-dim)" bg="var(--surface-2)" />
        <StatusBadge status={lead.status} />
        <BusinessStatusBadge status={lead.businessStatus} />
      </div>

      {/* Contact info */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
        {/* Phone */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--text-dim)', fontSize: 13, flexShrink: 0 }}>📞</span>
          {lead.phone ? (
            <a href={`tel:${lead.phone}`} className="tel-link"
               style={{ fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--text)', textDecoration: 'none' }}>
              {lead.phone}
            </a>
          ) : (
            <span style={{ fontSize: 12, color: 'var(--text-dim)', fontStyle: 'italic' }}>No phone listed</span>
          )}
        </div>

        {/* Website */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <span style={{ color: 'var(--text-dim)', fontSize: 13, flexShrink: 0, lineHeight: 1.5 }}>🌐</span>
          {lead.website ? (
            <a href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
               target="_blank" rel="noreferrer"
               style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--accent)', wordBreak: 'break-all', lineHeight: 1.5 }}>
              {lead.website}
            </a>
          ) : (
            <span style={{ fontSize: 12, color: 'var(--red)', fontStyle: 'italic' }}>No website</span>
          )}
        </div>

        {/* Address */}
        {lead.address && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <span style={{ color: 'var(--text-dim)', fontSize: 13, flexShrink: 0, lineHeight: 1.5 }}>📍</span>
            <span style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }}>{lead.address}</span>
          </div>
        )}

        {/* Rating */}
        {lead.rating != null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--text-dim)', fontSize: 13 }}>★</span>
            <span style={{ fontSize: 12, color: 'var(--text)' }}>
              {lead.rating} ({lead.userRatingsTotal ?? 0} reviews)
            </span>
          </div>
        )}
      </div>

      {/* Pitch + WhatsApp section */}
      {effectivePitch && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Action row */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => setPitchOpen(o => !o)}
              style={{
                fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--accent)',
                background: 'none', border: 'none', cursor: 'pointer',
                padding: 0, display: 'flex', alignItems: 'center', gap: 5,
              }}
            >
              {pitchOpen ? '▾ Hide Pitch' : '▸ View Pitch'}
            </button>
            {wa && (
              <a href={wa} target="_blank" rel="noreferrer"
                 style={{
                   fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 500,
                   padding: '3px 10px', borderRadius: 4,
                   background: 'var(--accent-dim)', color: 'var(--accent)',
                   border: '1px solid var(--accent-border)',
                   textDecoration: 'none', whiteSpace: 'nowrap',
                 }}>
                WhatsApp ↗
              </a>
            )}
          </div>

          {/* Expanded pitch */}
          {pitchOpen && (
            <div style={{
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', padding: '10px 12px',
              display: 'flex', flexDirection: 'column', gap: 10,
            }}>
              <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
                {effectivePitch}
              </div>
              <button
                onClick={copyPitch}
                style={{
                  fontFamily: 'var(--mono)', fontSize: 11, padding: '4px 12px',
                  borderRadius: 4, alignSelf: 'flex-start',
                  background: copied ? 'var(--green-dim)' : 'var(--surface)',
                  color: copied ? 'var(--green)' : 'var(--text-dim)',
                  border: `1px solid ${copied ? 'rgba(78,255,143,0.4)' : 'var(--border)'}`,
                  cursor: 'pointer', transition: 'all 0.2s',
                }}
              >
                {copied ? '✓ Copied!' : '⧉ Copy'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Deploy Demo section */}
      {canDeploy && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {deployState === 'done' ? (
              <span style={{
                fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600,
                padding: '4px 12px', borderRadius: 4,
                background: 'var(--green-dim)', color: 'var(--green)',
                border: '1px solid rgba(78,255,143,0.4)',
              }}>
                ✓ Demo Live
              </span>
            ) : (
              <button
                onClick={handleDeploy}
                disabled={deployState === 'loading'}
                style={{
                  fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 500,
                  padding: '4px 12px', borderRadius: 4, cursor: deployState === 'loading' ? 'not-allowed' : 'pointer',
                  background: 'transparent', color: 'var(--accent)',
                  border: '1px solid var(--accent-border)',
                  display: 'flex', alignItems: 'center', gap: 6,
                  opacity: deployState === 'loading' ? 0.6 : 1,
                  transition: 'opacity 0.2s',
                }}
              >
                {deployState === 'loading' ? (
                  <><MiniSpinner /> Deploying…</>
                ) : (
                  '🚀 Deploy Demo'
                )}
              </button>
            )}

            {/* Live demo link */}
            {deployUrl && (
              <a href={deployUrl} target="_blank" rel="noreferrer"
                 style={{
                   fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--accent)',
                   wordBreak: 'break-all', textDecoration: 'underline',
                   textDecorationColor: 'var(--accent-border)',
                 }}>
                {deployUrl}
              </a>
            )}
          </div>

          {/* Error message */}
          {deployError && (
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--red)', lineHeight: 1.5 }}>
              {deployError}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Tag({ label, color, bg }) {
  return (
    <span style={{
      fontFamily: 'var(--mono)', fontSize: '11px', color, background: bg,
      borderRadius: 4, padding: '2px 8px', whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  )
}

function Pill({ label, active, onClick, accent }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontFamily: 'var(--mono)', fontSize: '12px', padding: '5px 14px',
        borderRadius: 20, cursor: 'pointer',
        background: active ? (accent || 'var(--accent)') : 'var(--surface)',
        color: active ? '#0d0d0d' : 'var(--text)',
        border: `1px solid ${active ? (accent || 'var(--accent)') : 'var(--border)'}`,
        transition: 'all 0.15s', fontWeight: active ? 600 : 400,
      }}
    >
      {label}
    </button>
  )
}

function SelectablePill({ label, selected, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontFamily: 'var(--mono)', fontSize: '12px', padding: '4px 12px',
        borderRadius: 20, cursor: 'pointer',
        background: selected ? 'var(--accent-dim)' : 'var(--surface)',
        color: selected ? 'var(--accent)' : 'var(--text-dim)',
        border: `1px solid ${selected ? 'var(--accent-border)' : 'var(--border)'}`,
        transition: 'all 0.15s', fontWeight: selected ? 500 : 400,
      }}
    >
      {selected ? '✓ ' : ''}{label}
    </button>
  )
}

function Label({ children }) {
  return (
    <div style={{
      fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.1em',
      textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: 600,
    }}>
      {children}
    </div>
  )
}

function FieldLabel({ children }) {
  return (
    <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text)', fontWeight: 500, marginBottom: 2 }}>
      {children}
    </div>
  )
}

const inputStyle = {
  background: 'var(--surface-2)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius)', padding: '9px 12px',
  color: 'var(--text-bright)', fontSize: 13, fontFamily: 'var(--mono)',
  outline: 'none', width: '100%',
}

function StatCard({ label, value, color, small }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)', padding: '14px 18px',
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ fontFamily: 'var(--mono)', fontSize: small ? 22 : 28, fontWeight: 600, color, lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <span style={{
      display: 'inline-block', width: 12, height: 12,
      border: '2px solid rgba(180,255,78,0.2)', borderTopColor: 'var(--accent)',
      borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0,
    }} />
  )
}

/* ── Main App ── */

export default function App() {
  const [selectedNiche, setSelectedNiche] = useState('')
  const [customNiche, setCustomNiche]     = useState('')
  const [selectedCities, setSelectedCities] = useState([])
  const [leads, setLeads]         = useState([])
  const [demos, setDemos]         = useState([])
  const [customCities, setCustomCities]       = useState([])
  const [customCityInput, setCustomCityInput] = useState('')
  const [scanning, setScanning] = useState(false)
  const [phase, setPhase]       = useState('idle')
  const [statusMsg, setStatusMsg] = useState('')
  const [filter, setFilter]     = useState('all')
  const [error, setError]       = useState('')
  const abortRef = useRef(false)

  const addDemo = useCallback((demo) => {
    setDemos(prev => [demo, ...prev])
  }, [])

  const niche = customNiche.trim() || selectedNiche

  const scoredLeads = leads.filter(l => l.score != null)
  const avgScore = scoredLeads.length > 0
    ? (scoredLeads.reduce((s, l) => s + l.score, 0) / scoredLeads.length).toFixed(1)
    : '—'

  const counts = {
    all: leads.length,
    'no-website': leads.filter(l => l.status === 'no-website').length,
    outdated:     leads.filter(l => l.status === 'outdated').length,
    'has-website':leads.filter(l => l.status === 'has-website').length,
    hot:          leads.filter(l => (l.score ?? -1) >= 8).length,
  }

  const filteredLeads =
    filter === 'all'         ? leads :
    filter === 'hot'         ? leads.filter(l => (l.score ?? -1) >= 8) :
    leads.filter(l => l.status === filter)

  function toggleCity(city) {
    setSelectedCities(prev =>
      prev.includes(city) ? prev.filter(c => c !== city) : [...prev, city]
    )
  }

  function toggleAllCities() {
    setSelectedCities(prev => prev.length === CITIES.length ? [] : [...CITIES])
  }

  function commitCustomCities(raw) {
    const parts = raw.split(',').map(s => s.trim()).filter(Boolean)
    if (!parts.length) return
    setCustomCities(prev => {
      const existing = new Set(prev.map(c => c.toLowerCase()))
      return [...prev, ...parts.filter(p => !existing.has(p.toLowerCase()))]
    })
    setCustomCityInput('')
  }

  function handleCustomCityChange(e) {
    const val = e.target.value
    if (val.includes(',')) {
      commitCustomCities(val)
    } else {
      setCustomCityInput(val)
    }
  }

  function removeCustomCity(city) {
    setCustomCities(prev => prev.filter(c => c !== city))
  }

  const startScan = useCallback(async () => {
    if (!PLACES_KEY) { setError('VITE_GOOGLE_PLACES_API_KEY is not set in .env'); return }
    if (!niche)      { setError('Please select or enter a niche.'); return }
    const allCities = [...selectedCities, ...customCities]
    if (allCities.length === 0) { setError('Please select or enter at least one city.'); return }

    setError('')
    setLeads([])
    setScanning(true)
    setPhase('places')
    abortRef.current = false

    const collectedLeads = []

    // ── Phase 1: Google Places ──
    for (const city of allCities) {
      if (abortRef.current) break
      setStatusMsg(`Scanning ${niche}s in ${city}…`)

      let placeIds = []
      try {
        const url = `/maps/maps/api/place/textsearch/json?query=${encodeURIComponent(niche + ' in ' + city)}&key=${PLACES_KEY}`
        const res  = await fetch(url)
        const data = await res.json()
        if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
          setError(`API Error (${data.status}): ${data.error_message || 'Check your API key and billing.'}`)
          break
        }
        placeIds = (data.results || []).map(r => r.place_id)

        // Paginate up to 3 pages total (max ~60 results per city)
        let nextToken = data.next_page_token
        let pageCount = 1
        while (nextToken && pageCount < 3 && !abortRef.current) {
          await delay(2000)
          setStatusMsg(`Loading page ${pageCount + 1} for ${city}…`)
          try {
            const pageRes  = await fetch(`/maps/maps/api/place/textsearch/json?pagetoken=${nextToken}&key=${PLACES_KEY}`)
            const pageData = await pageRes.json()
            if (pageData.status === 'OK') {
              placeIds  = [...placeIds, ...(pageData.results || []).map(r => r.place_id)]
              nextToken = pageData.next_page_token
            } else {
              nextToken = null
            }
          } catch (_) { nextToken = null }
          pageCount++
        }
      } catch (e) {
        setError(`Network error: ${e.message}`)
        break
      }

      for (let i = 0; i < placeIds.length; i++) {
        if (abortRef.current) break
        try {
          const fields = 'name,website,formatted_phone_number,international_phone_number,rating,formatted_address,user_ratings_total,opening_hours,business_status'
          const url  = `/maps/maps/api/place/details/json?place_id=${placeIds[i]}&fields=${fields}&key=${PLACES_KEY}`
          const res  = await fetch(url)
          const data = await res.json()
          if (data.status === 'OK' && data.result) {
            const r      = data.result
            const status = classifyWebsite(r.website)
            const lead   = {
              id:                placeIds[i],
              name:              r.name,
              city,
              niche,
              rating:            r.rating,
              userRatingsTotal:  r.user_ratings_total,
              phone:             r.formatted_phone_number,
              internationalPhone:r.international_phone_number,
              // Clear social/directory URLs so they don't appear as website links
              website:           status === 'no-website' ? '' : r.website,
              address:           r.formatted_address,
              isOpen:            r.opening_hours?.open_now,
              businessStatus:    r.business_status,
              status,
              score: null,
              reason: null,
              pitch: null,
            }
            setStatusMsg(`Fetching details: ${r.name}`)
            collectedLeads.push(lead)
            setLeads(prev => [...prev, lead])
          }
        } catch (_) {}
        await delay(200)
      }
    }

    // ── Phase 2: AI Scoring ──
    if (!abortRef.current && collectedLeads.length > 0 && OPENAI_KEY) {
      setPhase('ai')

      // Auto-score permanently closed businesses immediately — skip AI for them
      collectedLeads.forEach(lead => {
        if (lead.businessStatus === 'CLOSED_PERMANENTLY') {
          lead.score  = 0
          lead.reason = 'Business is permanently closed.'
          lead.pitch  = ''
          setLeads(prev => prev.map(l => l.id === lead.id ? { ...lead } : l))
        }
      })

      const leadsToScore = collectedLeads.filter(l => l.businessStatus !== 'CLOSED_PERMANENTLY')
      const BATCH = 3
      let scored = 0

      for (let i = 0; i < leadsToScore.length; i += BATCH) {
        if (abortRef.current) break
        const batch = leadsToScore.slice(i, i + BATCH)
        setStatusMsg(`AI scoring leads… (${scored}/${leadsToScore.length})`)

        const results = await Promise.all(batch.map(lead => scoreLeadWithAI(lead)))

        results.forEach((result, idx) => {
          Object.assign(batch[idx], result)
          const updated = { ...batch[idx] }
          setLeads(prev => prev.map(l => l.id === updated.id ? updated : l))
        })

        scored += batch.length
        if (i + BATCH < leadsToScore.length) await delay(500)
      }

      if (!abortRef.current) {
        const sorted = [...collectedLeads].sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
        setLeads(sorted)
        const sc  = sorted.filter(l => l.score != null)
        const avg = sc.length > 0
          ? (sc.reduce((s, l) => s + l.score, 0) / sc.length).toFixed(1) : '—'
        setStatusMsg(`Done — ${sorted.length} leads found, avg score ${avg}`)
      } else {
        setStatusMsg('Scan stopped.')
      }
    } else {
      setStatusMsg(
        abortRef.current ? 'Scan stopped.' :
        !OPENAI_KEY      ? `Done — ${collectedLeads.length} leads found (set VITE_OPENAI_API_KEY to enable AI scoring)` :
                           `Done — ${collectedLeads.length} leads found`
      )
    }

    setScanning(false)
    setPhase('idle')
  }, [niche, selectedCities, customCities])

  function stopScan() {
    abortRef.current = true
    setStatusMsg('Stopping…')
  }

  function exportCSV() {
    const content = toCSV(filteredLeads)
    const blob = new Blob([content], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `avl-leads-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input:focus { border-color: var(--accent-border) !important; box-shadow: 0 0 0 3px var(--accent-dim); }
        .lead-name-link { text-decoration: none; }
        .lead-name-link:hover { text-decoration: underline; text-decoration-color: rgba(240,240,240,0.35); }
        .tel-link:hover { text-decoration: underline; }
        @media (max-width: 720px) {
          .stats-grid { grid-template-columns: repeat(3, 1fr) !important; }
          .leads-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 480px) {
          .stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>

        {/* Header */}
        <header style={{
          borderBottom: '1px solid var(--border)', padding: '18px 32px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
        }}>
          <div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 4 }}>
              AVL Systems
            </div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 18, fontWeight: 600, color: 'var(--accent)', letterSpacing: '-0.01em' }}>
              Lead Gen Agent
            </div>
          </div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-dim)', textAlign: 'right', lineHeight: 1.8 }}>
            <div>Google Places + GPT-4o-mini</div>
            <div style={{ color: 'var(--accent)', opacity: 0.6 }}>v2.1.0</div>
          </div>
        </header>

        <main style={{
          flex: 1, padding: '28px 32px', maxWidth: 1120, width: '100%',
          margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24,
        }}>

          {/* Config Panel */}
          <section style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)', padding: '24px',
            display: 'flex', flexDirection: 'column', gap: 20,
          }}>
            <Label>Scan Configuration</Label>

            {/* Niche */}
            <div>
              <FieldLabel>Niche</FieldLabel>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                {PRESET_NICHES.map(n => (
                  <SelectablePill
                    key={n} label={n}
                    selected={selectedNiche === n && !customNiche.trim()}
                    onClick={() => { setSelectedNiche(n); setCustomNiche('') }}
                  />
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>or custom:</span>
                <input
                  type="text"
                  placeholder="e.g. pediatric clinic"
                  value={customNiche}
                  onChange={e => { setCustomNiche(e.target.value); if (e.target.value) setSelectedNiche('') }}
                  style={{ ...inputStyle, flex: 1 }}
                />
              </div>
            </div>

            {/* Cities */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <FieldLabel>Target Cities</FieldLabel>
                <button
                  onClick={toggleAllCities}
                  style={{
                    fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--accent)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    textDecoration: 'underline', padding: 0,
                  }}
                >
                  {selectedCities.length === CITIES.length ? 'Deselect all' : 'Select all'}
                </button>
              </div>

              {/* Preset Indian cities */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {CITIES.map(city => (
                  <SelectablePill
                    key={city} label={city}
                    selected={selectedCities.includes(city)}
                    onClick={() => toggleCity(city)}
                  />
                ))}
              </div>

              {/* Custom location tags */}
              {customCities.length > 0 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {customCities.map(city => (
                    <span
                      key={city}
                      style={{
                        fontFamily: 'var(--mono)', fontSize: '12px',
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        padding: '4px 10px', borderRadius: 20,
                        background: 'rgba(78,184,255,0.12)',
                        color: '#4eb8ff',
                        border: '1px solid rgba(78,184,255,0.3)',
                      }}
                    >
                      {city}
                      <button
                        onClick={() => removeCustomCity(city)}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: '#4eb8ff', opacity: 0.7, padding: 0, lineHeight: 1,
                          fontSize: 13, display: 'flex', alignItems: 'center',
                        }}
                        title={`Remove ${city}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Custom location input */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <FieldLabel>Custom Location (optional)</FieldLabel>
                <input
                  type="text"
                  placeholder="Type any city, country or area e.g. Dubai, London, New York, Riyadh..."
                  value={customCityInput}
                  onChange={handleCustomCityChange}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (customCityInput.trim()) commitCustomCities(customCityInput) } }}
                  onBlur={() => { if (customCityInput.trim()) commitCustomCities(customCityInput) }}
                  style={inputStyle}
                />
                <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-dim)' }}>
                  Press Enter or comma to add · Multiple: "Dubai, London, Riyadh"
                </div>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{
                fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--red)',
                background: 'var(--red-dim)', border: '1px solid rgba(255,78,78,0.2)',
                borderRadius: 'var(--radius)', padding: '10px 14px', lineHeight: 1.5,
              }}>
                ⚠ {error}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              {!scanning ? (
                <button
                  onClick={startScan}
                  style={{
                    fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 600,
                    padding: '10px 28px', borderRadius: 'var(--radius)',
                    background: 'var(--accent)', color: '#0d0d0d', cursor: 'pointer',
                    letterSpacing: '0.02em', border: 'none',
                  }}
                >
                  ▶ Start Scan
                </button>
              ) : (
                <button
                  onClick={stopScan}
                  style={{
                    fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 600,
                    padding: '10px 28px', borderRadius: 'var(--radius)',
                    background: 'var(--red-dim)', color: 'var(--red)',
                    border: '1px solid rgba(255,78,78,0.3)', cursor: 'pointer',
                    letterSpacing: '0.02em',
                  }}
                >
                  ■ Stop
                </button>
              )}
              {leads.length > 0 && (
                <button
                  onClick={exportCSV}
                  style={{
                    fontFamily: 'var(--mono)', fontSize: 12, padding: '9px 20px',
                    borderRadius: 'var(--radius)', background: 'var(--surface-2)',
                    color: 'var(--text)', border: '1px solid var(--border)', cursor: 'pointer',
                  }}
                >
                  ↓ Export CSV
                </button>
              )}
              {leads.length > 0 && !scanning && (
                <button
                  onClick={() => { setLeads([]); setStatusMsg(''); setFilter('all') }}
                  style={{
                    fontFamily: 'var(--mono)', fontSize: 12, padding: '9px 20px',
                    borderRadius: 'var(--radius)', background: 'none',
                    color: 'var(--text-dim)', border: '1px solid var(--border)', cursor: 'pointer',
                  }}
                >
                  ✕ Clear
                </button>
              )}
            </div>
          </section>

          {/* Status Bar */}
          {(scanning || statusMsg) && (
            <div style={{
              fontFamily: 'var(--mono)', fontSize: 12, background: 'var(--surface)',
              border: `1px solid ${scanning ? 'var(--accent-border)' : 'var(--border)'}`,
              borderRadius: 'var(--radius)', padding: '10px 16px',
              display: 'flex', flexDirection: 'column', gap: 8, transition: 'border-color 0.3s',
            }}>
              {scanning && phase === 'ai' && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  paddingBottom: 8, borderBottom: '1px solid var(--border)', fontSize: 11,
                }}>
                  <span style={{ color: 'var(--green)' }}>✓</span>
                  <span style={{ color: 'var(--text-dim)' }}>Phase 1 complete — {leads.length} leads found</span>
                  <span style={{ marginLeft: 'auto', color: 'var(--accent)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    ◈ AI Scoring
                  </span>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: scanning ? 'var(--accent)' : 'var(--text-dim)' }}>
                {scanning && <Spinner />}
                {statusMsg}
              </div>
            </div>
          )}

          {/* Results */}
          {leads.length > 0 && (
            <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
                <StatCard label="Total"       value={counts.all}          color="var(--text-bright)" />
                <StatCard label="No Website"  value={counts['no-website']}color="var(--red)"         />
                <StatCard label="Outdated"    value={counts.outdated}     color="var(--yellow)"      />
                <StatCard label="Has Website" value={counts['has-website']}color="var(--green)"      />
                <StatCard label="Avg Score"   value={avgScore}            color="var(--accent)" small />
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Pill label={`All (${counts.all})`}                        active={filter === 'all'}          onClick={() => setFilter('all')} />
                <Pill label={`🔥 Hot (${counts.hot})`}                    active={filter === 'hot'}          onClick={() => setFilter('hot')} accent="#b4ff4e" />
                <Pill label={`No Website (${counts['no-website']})`}       active={filter === 'no-website'}   onClick={() => setFilter('no-website')} />
                <Pill label={`Outdated (${counts.outdated})`}              active={filter === 'outdated'}     onClick={() => setFilter('outdated')} />
                <Pill label={`Has Website (${counts['has-website']})`}     active={filter === 'has-website'}  onClick={() => setFilter('has-website')} />
              </div>

              {/* ── Live Demos ── */}
              {demos.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 600, color: 'var(--text-bright)' }}>
                      🚀 Live Demos
                    </div>
                    <span style={{
                      fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600,
                      padding: '2px 8px', borderRadius: 20,
                      background: 'var(--accent)', color: '#0d0d0d',
                    }}>
                      {demos.length}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
                    {demos.map(d => <DemoCard key={d.id + d.deployedAt} demo={d} />)}
                  </div>
                </div>
              )}

              {filteredLeads.length > 0 ? (
                <div className="leads-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
                  {filteredLeads.map(lead => <LeadCard key={lead.id} lead={lead} onDeploySuccess={addDemo} />)}
                </div>
              ) : (
                <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text-dim)', textAlign: 'center', padding: '40px 0' }}>
                  No leads match this filter.
                </div>
              )}
            </section>
          )}

          {/* Demos standalone — persists even when leads are cleared */}
          {leads.length === 0 && demos.length > 0 && (
            <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 600, color: 'var(--text-bright)' }}>
                  🚀 Live Demos
                </div>
                <span style={{
                  fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600,
                  padding: '2px 8px', borderRadius: 20,
                  background: 'var(--accent)', color: '#0d0d0d',
                }}>
                  {demos.length}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
                {demos.map(d => <DemoCard key={d.id + d.deployedAt} demo={d} />)}
              </div>
            </section>
          )}

          {!scanning && leads.length === 0 && !statusMsg && (
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: 12, padding: '80px 0', color: 'var(--text-dim)', fontFamily: 'var(--mono)',
            }}>
              <div style={{ fontSize: 36, opacity: 0.2 }}>⊙</div>
              <div style={{ fontSize: 13 }}>Configure above and start a scan</div>
              <div style={{ fontSize: 11, opacity: 0.5 }}>
                Phase 1: Google Places · Phase 2: GPT-4o-mini scoring + pitch
              </div>
            </div>
          )}
        </main>

        <footer style={{
          borderTop: '1px solid var(--border)', padding: '13px 32px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
        }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-dim)' }}>
            AVL Lead Gen Agent
          </span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-dim)' }}>
            {leads.length > 0 ? `${leads.length} leads · avg score ${avgScore}` : 'Ready'}
          </span>
        </footer>
      </div>
    </>
  )
}
