import React, { useState, useEffect } from 'react'
import { fetchNui, onNuiMessage } from '../utils/nui'

interface Props {
  currentRide: any
  lang?: Record<string, string>
}

const ClientView: React.FC<Props> = ({ currentRide }) => {
  const [destination, setDestination]   = useState<any>(null)
  const [error, setError]               = useState<string>('')
  const [driversCount, setDriversCount] = useState<number | null>(null)
  const [myRating, setMyRating]         = useState<number | null>(null)
  const [driverInfo, setDriverInfo]     = useState<{ name: string; rating: number } | null>(null)

  useEffect(() => {
    fetchNui('Taxi:CheckDrivers', {}).catch(() => {})
    fetchNui('Taxi:GetMyRating', {}).catch(() => {})

    const cleanDrivers = onNuiMessage('Taxi:DriversCount', (payload) => {
      setDriversCount(payload.count)
    })
    const cleanMyRating = onNuiMessage('Taxi:MyRating', (payload) => {
      setMyRating(payload.rating)
    })
    // Note du chauffeur reçue quand il accepte la course
    const cleanDriverRating = onNuiMessage('Taxi:RideAccepted', (payload) => {
      if (payload.driverName && payload.driverRating !== undefined) {
        setDriverInfo({ name: payload.driverName, rating: payload.driverRating })
      }
    })

    return () => {
      cleanDrivers()
      cleanMyRating()
      cleanDriverRating()
    }
  }, [])

  // Reset driverInfo si plus de course
  useEffect(() => {
    if (!currentRide) setDriverInfo(null)
  }, [currentRide])

  const setWaypoint = async () => {
    setError('')
    try {
      const result = await fetchNui<any>('Taxi:SetWaypoint', {})
      if (result.ok) {
        setDestination(result)
      } else {
        setError(result.error || "Placez un point GPS sur la carte d'abord !")
      }
    } catch {
      setError('Erreur GPS')
    }
  }

  const requestRide = async () => {
    if (!destination) { setError("Placez un point GPS d'abord !"); return }
    if (driversCount === 0) { setError('Aucun taxi disponible en ville !'); return }
    setError('')
    await fetchNui('Taxi:RequestRide', {
      destination: destination.destination,
      destinationStreet: destination.destinationStreet,
    })
  }

  const cancelRide = () => fetchNui('Taxi:CancelRide', {})

  function renderStars(rating: number) {
    return Array.from({ length: 5 }, (_, i) => (
      <span key={i} style={{ color: i < Math.round(rating) ? '#f59e0b' : '#4b5563', fontSize: 14 }}>★</span>
    ))
  }

  if (currentRide) {
    return (
      <div className="taxi-client">
        <div className="taxi-header">
          <div className="taxi-icon">🚕</div>
          <h1>{currentRide.status === 'accepted' || currentRide.status === 'inprogress' ? 'Votre taxi arrive !' : 'En attente...'}</h1>
        </div>

        <div className="taxi-ride-status">
          {currentRide.status === 'pending' && (
            <>
              <div className="status-badge pending">🔍 Recherche d'un chauffeur...</div>
              <div className="waiting-animation">
                <div className="dot" /><div className="dot" /><div className="dot" />
              </div>
            </>
          )}

          {(currentRide.status === 'accepted' || currentRide.status === 'inprogress') && (
            <>
              <div className="status-badge accepted">
                {currentRide.status === 'inprogress' ? '🚗 Course en cours !' : '🚖 Votre chauffeur arrive !'}
              </div>

              {/* Note du chauffeur */}
              {driverInfo && (
                <div style={driverCardStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={avatarStyle}>
                      {driverInfo.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p style={{ color: '#cdccca', fontWeight: 600, fontSize: 13, marginBottom: 2 }}>
                        {driverInfo.name}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {renderStars(driverInfo.rating)}
                        <span style={{ color: '#9ca3af', fontSize: 12, marginLeft: 4 }}>
                          {driverInfo.rating.toFixed(1)}/5
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          <div className="ride-details">
            <div className="detail-row"><span>📍 Départ</span><span>{currentRide.pickupStreet}</span></div>
            <div className="detail-row"><span>🏁 Destination</span><span>{currentRide.destinationStreet}</span></div>
            <div className="detail-row price">
              <span>💰 Prix {currentRide.isNight ? '🌙' : ''}</span>
              <span>${currentRide.price}</span>
            </div>
          </div>
        </div>

        <button className="taxi-btn taxi-btn-danger" onClick={cancelRide}>❌ Annuler la course</button>
      </div>
    )
  }

  return (
    <div className="taxi-client">
      <div className="taxi-header">
        <div className="taxi-icon">🚕</div>
        <h1>Commander un taxi</h1>
      </div>

      {myRating !== null && (
        <div className="taxi-my-rating">
          Votre réputation : {'⭐'.repeat(Math.round(myRating))} {myRating.toFixed(1)}/5
        </div>
      )}

      <div className={`taxi-drivers-status ${driversCount === 0 ? 'unavailable' : 'available'}`}>
        {driversCount === null && '⏳ Vérification...'}
        {driversCount === 0 && '🔴 Aucun taxi disponible en ville'}
        {driversCount !== null && driversCount > 0 && `🟢 ${driversCount} taxi${driversCount > 1 ? 's' : ''} disponible${driversCount > 1 ? 's' : ''}`}
      </div>

      <div className="taxi-info">
        <div className="taxi-hint">📍 Placez un point GPS sur la carte, puis appuyez sur "Définir la destination".</div>
      </div>

      {destination && (
        <div className="taxi-info">
          <div className="detail-row"><span>🏁 Destination</span><span>{destination.destinationStreet}</span></div>
        </div>
      )}

      {error && <div className="taxi-error">{error}</div>}

      <button className="taxi-btn taxi-btn-primary" onClick={setWaypoint}
        disabled={driversCount === 0} style={{ opacity: driversCount === 0 ? 0.4 : 1 }}>
        📍 Définir la destination (GPS)
      </button>
      <button className="taxi-btn taxi-btn-success" onClick={requestRide}
        disabled={!destination || driversCount === 0}
        style={{ opacity: !destination || driversCount === 0 ? 0.4 : 1 }}>
        🚕 Appeler un taxi
      </button>
    </div>
  )
}

const driverCardStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.07)',
  borderRadius: 10,
  padding: '10px 14px',
  border: '1px solid rgba(245,158,11,0.25)',
}

const avatarStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: '50%',
  background: '#3b3a37',
  color: '#cdccca',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 700,
  fontSize: 14,
  flexShrink: 0,
}

export default ClientView
