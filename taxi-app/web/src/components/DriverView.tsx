import React, { useEffect, useState, useRef } from 'react'
import { fetchNui } from '../utils/nui'
import { onNuiMessage } from '../utils/nui'
import './DriverView.css'

export interface Ride {
  id: number
  clientName: string
  pickupStreet: string
  destinationStreet: string
  price: number
  distance: number
  clientRating?: number
  isNight?: boolean
}

interface RideOffer extends Ride {
  timeout: number
}

interface DriverStats {
  totalRides: number
  totalEarned: number
  todayRides: number
  todayEarned: number
  avgRating: number
}

interface HistoryRide {
  id: number
  clientName: string
  pickupStreet: string
  destinationStreet: string
  price: number
  isNight: number
  createdAt: string
}

interface Props {
  rides: Ride[]
  currentRide: any
  rideOffer: RideOffer | null
}

const DriverView: React.FC<Props> = ({ rides, currentRide, rideOffer }) => {
  const [ratingPopup, setRatingPopup] = useState<any>(null)
  const [tab, setTab]                 = useState<'rides' | 'stats' | 'history'>('rides')
  const [stats, setStats]             = useState<DriverStats | null>(null)
  const [history, setHistory]         = useState<HistoryRide[]>([])
  const [timeLeft, setTimeLeft]       = useState<number>(0)
  const declinedRef                   = useRef(false)   // ← évite double decline

  // ── Countdown + decline automatique à 0 ──────────────────
  useEffect(() => {
    if (!rideOffer) {
      setTimeLeft(0)
      declinedRef.current = false
      return
    }
    setTimeLeft(rideOffer.timeout)
    declinedRef.current = false

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval)
          // Decline automatique si pas encore fait
          if (!declinedRef.current) {
            declinedRef.current = true
            fetchNui('Taxi:DeclineRide', { rideId: rideOffer.id }).catch(() => {})
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [rideOffer])

  useEffect(() => {
    const cleanShowRating = onNuiMessage('Taxi:ShowRating', (payload) => {
      setRatingPopup(payload)
    })
    const cleanStats = onNuiMessage('Taxi:DriverStats', (payload) => {
      setStats(payload)
    })
    const cleanHistory = onNuiMessage('Taxi:RideHistory', (payload) => {
      setHistory(payload.rides || [])
    })
    return () => { cleanShowRating(); cleanStats(); cleanHistory() }
  }, [])

  useEffect(() => {
    if (tab === 'stats')   fetchNui('Taxi:GetDriverStats', {}).catch(() => {})
    if (tab === 'history') fetchNui('Taxi:GetRideHistory', {}).catch(() => {})
  }, [tab])

  const acceptRide = (rideId: number) => {
    declinedRef.current = true   // empêche le decline auto si on accepte
    fetchNui('Taxi:AcceptRide', { rideId })
  }

  const declineRide = (rideId: number) => {
    if (declinedRef.current) return
    declinedRef.current = true
    fetchNui('Taxi:DeclineRide', { rideId })
  }

  const submitRating = (stars: number) => {
    if (!ratingPopup) return
    fetchNui('Taxi:RateClient', { rideId: ratingPopup.rideId, stars })
    setRatingPopup(null)
  }

  const finishRide = () => {
    if (!currentRide) return
    fetchNui('Taxi:FinishRide', { rideId: currentRide.id })
  }

  const cancelRide = () => fetchNui('Taxi:CancelRide', {})

  const formatDistance = (dist: number) =>
    !dist ? '—' : dist < 1000 ? `${Math.round(dist)}m` : `${(dist / 1000).toFixed(1)}km`

  const timerPercent = rideOffer ? (timeLeft / rideOffer.timeout) * 100 : 0
  const timerColor   = timerPercent > 50 ? '#22c55e' : timerPercent > 25 ? '#f59e0b' : '#ef4444'


  // ── Rating popup ──────────────────────────────────────────
  if (ratingPopup) {
    return (
      <div className="dv-rating-overlay">
        <div className="dv-rating-card">
          <p className="dv-rating-title">⭐ Noter le client</p>
          <p className="dv-rating-client">{ratingPopup.clientName}</p>
          <div className="dv-stars">
            {[1,2,3,4,5].map(star => (
              <button key={star} className="dv-star-btn" onClick={() => submitRating(star)}>⭐</button>
            ))}
          </div>
          <button className="dv-btn-decline" onClick={() => setRatingPopup(null)}>Passer</button>
        </div>
      </div>
    )
  }


  // ── Offre de course dispatch ──────────────────────────────
  if (rideOffer && !currentRide) {
    return (
      <div className="dv-alert-overlay">
        <div className="dv-alert-card">
          <div className="dv-alert-pulse" />
          <div className="dv-alert-header">
            <span className="dv-alert-icon">🚨</span>
            <span className="dv-alert-title">
              Nouvelle course ! {rideOffer.isNight ? '🌙' : ''}
            </span>
          </div>

          <div className="dv-alert-body">
            <div className="dv-route">
              <div className="dv-route-dot pickup" />
              <div className="dv-route-line" />
              <div className="dv-route-dot dest" />
              <div className="dv-route-labels">
                <span>{rideOffer.pickupStreet}</span>
                <span>{rideOffer.destinationStreet}</span>
              </div>
            </div>

            <div className="dv-alert-meta">
              <div className="dv-meta-item">
                <span className="dv-meta-label">Distance</span>
                <span className="dv-meta-value">{formatDistance(rideOffer.distance)}</span>
              </div>
              <div className="dv-meta-divider" />
              <div className="dv-meta-item">
                <span className="dv-meta-label">Prix</span>
                <span className="dv-meta-value price">${rideOffer.price}</span>
              </div>
              <div className="dv-meta-divider" />
              <div className="dv-meta-item">
                <span className="dv-meta-label">Client</span>
                <span className="dv-meta-value">{rideOffer.clientName}</span>
              </div>
              <div className="dv-meta-divider" />
              <div className="dv-meta-item">
                <span className="dv-meta-label">Note</span>
                <span className="dv-meta-value">⭐ {rideOffer.clientRating?.toFixed(1) || '5.0'}</span>
              </div>
            </div>
          </div>

          {/* Timer visuel */}
          <div style={{ padding: '0 4px', marginBottom: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ color: '#6b7280', fontSize: 11 }}>Temps restant</span>
              <span style={{ color: timerColor, fontSize: 12, fontWeight: 700 }}>{timeLeft}s</span>
            </div>
            <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)' }}>
              <div style={{
                height: '100%',
                width: `${timerPercent}%`,
                background: timerColor,
                borderRadius: 2,
                transition: 'width 1s linear, background 0.3s',
              }} />
            </div>
          </div>

          <div className="dv-alert-actions">
            <button className="dv-btn-decline" onClick={() => declineRide(rideOffer.id)}>
              Ignorer
            </button>
            <button className="dv-btn-accept" onClick={() => acceptRide(rideOffer.id)}>
              ✅ Accepter
            </button>
          </div>
        </div>
      </div>
    )
  }


  // ── Course en cours ───────────────────────────────────────
  if (currentRide) {
    return (
      <div className="dv-container">
        <div className="dv-header">
          <span className="dv-header-icon">🚖</span>
          <span className="dv-header-title">Course en cours</span>
          <span className="dv-status-dot active" />
        </div>

        <div className="dv-current-card">
          <div className="dv-route">
            <div className="dv-route-dot pickup" />
            <div className="dv-route-line" />
            <div className="dv-route-dot dest" />
            <div className="dv-route-labels">
              <span>{currentRide.pickupStreet}</span>
              <span>{currentRide.destinationStreet}</span>
            </div>
          </div>

          <div className="dv-alert-meta" style={{ marginTop: 16 }}>
            <div className="dv-meta-item">
              <span className="dv-meta-label">Client</span>
              <span className="dv-meta-value">{currentRide.clientName || '—'}</span>
            </div>
            <div className="dv-meta-divider" />
            <div className="dv-meta-item">
              <span className="dv-meta-label">Prix</span>
              <span className="dv-meta-value price">${currentRide.price}</span>
            </div>
            {currentRide.isNight && (
              <>
                <div className="dv-meta-divider" />
                <div className="dv-meta-item">
                  <span className="dv-meta-label">Tarif</span>
                  <span className="dv-meta-value">🌙 Nuit</span>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="dv-actions">
          {currentRide.status === 'accepted' && (
            <button className="dv-btn-pickup"
              onClick={() => fetchNui('taxi:ClientPickedUp', { rideId: currentRide.id })}>
              👤 Client récupéré
            </button>
          )}
          {currentRide.status === 'inprogress' && (
            <button className="dv-btn-finish" onClick={finishRide}>
              ✅ Terminer la course
            </button>
          )}
          <button className="dv-btn-cancel" onClick={cancelRide}>Annuler</button>
        </div>
      </div>
    )
  }


  // ── Vue principale avec onglets ───────────────────────────
  return (
    <div className="dv-container">
      <div className="dv-header">
        <span className="dv-header-icon">🚖</span>
        <span className="dv-header-title">Taxi</span>
        {rides.length > 0 && tab === 'rides' && (
          <span className="dv-badge">{rides.length}</span>
        )}
      </div>

      {/* Onglets */}
      <div style={tabBarStyle}>
        {(['rides','stats','history'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{ ...tabBtnStyle, ...(tab === t ? tabBtnActiveStyle : {}) }}
          >
            {t === 'rides' ? '🚗 Courses' : t === 'stats' ? '📊 Stats' : '📍 Historique'}
          </button>
        ))}
      </div>

      {/* ── Onglet Courses ── */}
      {tab === 'rides' && (
        rides.length === 0 ? (
          <div className="dv-empty">
            <span className="dv-empty-icon">🕐</span>
            <p>En attente de courses...</p>
            <span className="dv-empty-sub">Vous serez notifié automatiquement</span>
          </div>
        ) : (
          <div className="dv-rides-list">
            {rides.map((ride) => (
              <div key={ride.id} className="dv-ride-card">
                <div className="dv-route">
                  <div className="dv-route-dot pickup" />
                  <div className="dv-route-line" />
                  <div className="dv-route-dot dest" />
                  <div className="dv-route-labels">
                    <span>{ride.pickupStreet}</span>
                    <span>{ride.destinationStreet}</span>
                  </div>
                </div>
                <div className="dv-ride-footer">
                  <span className="dv-ride-dist">{formatDistance(ride.distance)}</span>
                  <span className="dv-client-rating">⭐ {ride.clientRating?.toFixed(1) || '5.0'}</span>
                  <span className="dv-ride-price">${ride.price}</span>
                  <button className="dv-btn-accept-sm" onClick={() => acceptRide(ride.id)}>
                    Accepter
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ── Onglet Stats ── */}
      {tab === 'stats' && (
        <div style={statsContainerStyle}>
          {!stats ? (
            <div className="dv-empty"><span className="dv-empty-icon">⏳</span><p>Chargement...</p></div>
          ) : (
            <>
              <div style={statsSectionTitle}>Aujourd'hui</div>
              <div style={statsGridStyle}>
                <div style={statCardStyle}>
                  <p style={statValueStyle}>{stats.todayRides}</p>
                  <p style={statLabelStyle}>Courses</p>
                </div>
                <div style={statCardStyle}>
                  <p style={{ ...statValueStyle, color: '#22c55e' }}>${stats.todayEarned}</p>
                  <p style={statLabelStyle}>Revenus</p>
                </div>
              </div>
              <div style={statsSectionTitle}>Total</div>
              <div style={statsGridStyle}>
                <div style={statCardStyle}>
                  <p style={statValueStyle}>{stats.totalRides}</p>
                  <p style={statLabelStyle}>Courses</p>
                </div>
                <div style={statCardStyle}>
                  <p style={{ ...statValueStyle, color: '#22c55e' }}>${stats.totalEarned}</p>
                  <p style={statLabelStyle}>Revenus</p>
                </div>
              </div>
              <div style={statCardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <p style={statLabelStyle}>Note moyenne</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {Array.from({ length: 5 }, (_, i) => (
                      <span key={i} style={{ color: i < Math.round(stats.avgRating) ? '#f59e0b' : '#4b5563', fontSize: 16 }}>★</span>
                    ))}
                    <span style={{ ...statValueStyle, fontSize: 16 }}>{stats.avgRating.toFixed(1)}</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Onglet Historique ── */}
      {tab === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {history.length === 0 ? (
            <div className="dv-empty">
              <span className="dv-empty-icon">📭</span>
              <p>Aucune course pour l'instant</p>
            </div>
          ) : (
            history.map((h) => (
              <div key={h.id} style={historyCardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: '#9ca3af', fontSize: 11 }}>{h.createdAt}</span>
                  <span style={{ color: '#22c55e', fontWeight: 700, fontSize: 13 }}>
                    ${h.price} {h.isNight ? '🌙' : ''}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ color: '#22c55e', fontSize: 10 }}>●</span>
                    <span style={{ color: '#cdccca', fontSize: 12 }}>{h.pickupStreet}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ color: '#ef4444', fontSize: 10 }}>●</span>
                    <span style={{ color: '#cdccca', fontSize: 12 }}>{h.destinationStreet}</span>
                  </div>
                </div>
                <div style={{ marginTop: 6, color: '#6b7280', fontSize: 11 }}>
                  Client : {h.clientName}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────
const tabBarStyle: React.CSSProperties = {
  display: 'flex', gap: 6, marginBottom: 12,
}
const tabBtnStyle: React.CSSProperties = {
  flex: 1, padding: '7px 0', borderRadius: 8,
  background: 'rgba(255,255,255,0.05)', color: '#9ca3af',
  border: '1px solid rgba(255,255,255,0.08)',
  fontSize: 11, fontWeight: 600, cursor: 'pointer',
  transition: 'all 0.15s',
}
const tabBtnActiveStyle: React.CSSProperties = {
  background: 'rgba(59,130,246,0.2)', color: '#60a5fa',
  border: '1px solid rgba(59,130,246,0.35)',
}
const statsContainerStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 10,
}
const statsSectionTitle: React.CSSProperties = {
  color: '#6b7280', fontSize: 11, fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4,
}
const statsGridStyle: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
}
const statCardStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.07)', borderRadius: 10, padding: '10px 14px',
}
const statValueStyle: React.CSSProperties = {
  color: '#cdccca', fontWeight: 700, fontSize: 20, marginBottom: 2,
}
const statLabelStyle: React.CSSProperties = {
  color: '#6b7280', fontSize: 11,
}
const historyCardStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 10, padding: '10px 14px',
}

export default DriverView
