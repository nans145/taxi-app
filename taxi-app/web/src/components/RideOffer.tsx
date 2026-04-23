import { useEffect, useRef, useState } from 'react';

interface RideOfferData {
    id: number;
    clientName: string;
    clientRating: number;
    pickupStreet: string;
    destinationStreet: string;
    price: number;
    isNight: boolean;
    distance: number;
    timeout: number;
}

interface RideOfferProps {
    offer: RideOfferData | null;
    onAccept: (rideId: number) => void;
    onDecline: (rideId: number) => void;
}

export default function RideOffer({ offer, onAccept, onDecline }: RideOfferProps) {
    const [timeLeft, setTimeLeft] = useState(0);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        if (!offer) return;

        setTimeLeft(offer.timeout);

        intervalRef.current = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(intervalRef.current!);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [offer]);

    if (!offer) return null;

    const progress  = (timeLeft / offer.timeout) * 100;
    const isUrgent  = timeLeft <= 5;

    function renderStars(rating: number) {
        return Array.from({ length: 5 }, (_, i) => (
            <span key={i} style={{ color: i < Math.round(rating) ? '#f59e0b' : '#4b5563' }}>
                ★
            </span>
        ));
    }

    return (
        <div style={styles.overlay}>
            <div style={styles.card}>

                {/* Header */}
                <div style={styles.header}>
                    <span style={styles.badge}>🚖 Nouvelle course</span>
                    {offer.isNight && (
                        <span style={styles.nightBadge}>🌙 Tarif nuit</span>
                    )}
                </div>

                {/* Timer bar */}
                <div style={styles.timerBar}>
                    <div
                        style={{
                            ...styles.timerFill,
                            width: `${progress}%`,
                            backgroundColor: isUrgent ? '#ef4444' : '#22c55e',
                            transition: 'width 1s linear, background-color 0.3s ease',
                        }}
                    />
                </div>
                <p style={{ ...styles.timerText, color: isUrgent ? '#ef4444' : '#9ca3af' }}>
                    Expire dans <strong>{timeLeft}s</strong>
                </p>

                {/* Infos client */}
                <div style={styles.clientRow}>
                    <div style={styles.avatar}>
                        {offer.clientName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <p style={styles.clientName}>{offer.clientName}</p>
                        <div style={styles.stars}>
                            {renderStars(offer.clientRating)}
                            <span style={styles.ratingText}>{offer.clientRating.toFixed(1)}</span>
                        </div>
                    </div>
                </div>

                {/* Trajet */}
                <div style={styles.tripBox}>
                    <div style={styles.tripRow}>
                        <span style={styles.dotGreen}>●</span>
                        <div>
                            <p style={styles.tripLabel}>Prise en charge</p>
                            <p style={styles.tripStreet}>{offer.pickupStreet}</p>
                        </div>
                    </div>
                    <div style={styles.tripLine} />
                    <div style={styles.tripRow}>
                        <span style={styles.dotRed}>●</span>
                        <div>
                            <p style={styles.tripLabel}>Destination</p>
                            <p style={styles.tripStreet}>{offer.destinationStreet}</p>
                        </div>
                    </div>
                </div>

                {/* Prix + Distance */}
                <div style={styles.statsRow}>
                    <div style={styles.statBox}>
                        <p style={styles.statValue}>${offer.price}</p>
                        <p style={styles.statLabel}>Prix</p>
                    </div>
                    <div style={styles.statDivider} />
                    <div style={styles.statBox}>
                        <p style={styles.statValue}>{offer.distance}m</p>
                        <p style={styles.statLabel}>Distance jusqu'au client</p>
                    </div>
                </div>

                {/* Boutons */}
                <div style={styles.actions}>
                    <button style={styles.btnDecline} onClick={() => onDecline(offer.id)}>
                        ✕ Refuser
                    </button>
                    <button style={styles.btnAccept} onClick={() => onAccept(offer.id)}>
                        ✓ Accepter
                    </button>
                </div>

            </div>
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    overlay: {
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        paddingBottom: '1.5rem',
        zIndex: 9999,
        pointerEvents: 'none',
    },
    card: {
        background: '#1c1b19',
        border: '1px solid #2e2d2b',
        borderRadius: '1rem',
        padding: '1.25rem',
        width: 'min(420px, 90vw)',
        pointerEvents: 'all',
        boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
        animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
    },
    header: {
        display: 'flex',
        gap: '0.5rem',
        marginBottom: '0.75rem',
        alignItems: 'center',
    },
    badge: {
        background: '#22c55e20',
        color: '#22c55e',
        fontSize: '0.75rem',
        fontWeight: 600,
        padding: '0.25rem 0.625rem',
        borderRadius: '9999px',
        border: '1px solid #22c55e40',
    },
    nightBadge: {
        background: '#f59e0b20',
        color: '#f59e0b',
        fontSize: '0.75rem',
        fontWeight: 600,
        padding: '0.25rem 0.625rem',
        borderRadius: '9999px',
        border: '1px solid #f59e0b40',
    },
    timerBar: {
        background: '#2e2d2b',
        borderRadius: '9999px',
        height: '4px',
        overflow: 'hidden',
        marginBottom: '0.375rem',
    },
    timerFill: {
        height: '100%',
        borderRadius: '9999px',
    },
    timerText: {
        fontSize: '0.75rem',
        marginBottom: '1rem',
        textAlign: 'right' as const,
    },
    clientRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        marginBottom: '1rem',
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: '9999px',
        background: '#3b3a37',
        color: '#cdccca',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        fontSize: '1rem',
        flexShrink: 0,
    },
    clientName: {
        color: '#cdccca',
        fontWeight: 600,
        fontSize: '0.9rem',
        marginBottom: '0.125rem',
    },
    stars: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.125rem',
        fontSize: '0.9rem',
    },
    ratingText: {
        color: '#9ca3af',
        fontSize: '0.75rem',
        marginLeft: '0.25rem',
    },
    tripBox: {
        background: '#242320',
        borderRadius: '0.625rem',
        padding: '0.75rem 1rem',
        marginBottom: '0.875rem',
    },
    tripRow: {
        display: 'flex',
        gap: '0.75rem',
        alignItems: 'flex-start',
    },
    tripLine: {
        width: '1px',
        height: '1rem',
        background: '#3b3a37',
        marginLeft: '0.375rem',
        marginBlock: '0.25rem',
    },
    dotGreen: { color: '#22c55e', lineHeight: 1.4, flexShrink: 0 },
    dotRed:   { color: '#ef4444', lineHeight: 1.4, flexShrink: 0 },
    tripLabel: {
        color: '#6b7280',
        fontSize: '0.7rem',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.05em',
    },
    tripStreet: {
        color: '#cdccca',
        fontSize: '0.875rem',
        fontWeight: 500,
    },
    statsRow: {
        display: 'flex',
        background: '#242320',
        borderRadius: '0.625rem',
        overflow: 'hidden',
        marginBottom: '1rem',
    },
    statBox: {
        flex: 1,
        padding: '0.625rem 0.75rem',
        textAlign: 'center' as const,
    },
    statDivider: {
        width: '1px',
        background: '#3b3a37',
        alignSelf: 'stretch',
    },
    statValue: {
        color: '#cdccca',
        fontWeight: 700,
        fontSize: '1.1rem',
    },
    statLabel: {
        color: '#6b7280',
        fontSize: '0.7rem',
        marginTop: '0.125rem',
    },
    actions: {
        display: 'flex',
        gap: '0.75rem',
    },
    btnDecline: {
        flex: 1,
        padding: '0.75rem',
        borderRadius: '0.625rem',
        background: '#2e2d2b',
        color: '#9ca3af',
        fontWeight: 600,
        fontSize: '0.9rem',
        border: '1px solid #3b3a37',
        cursor: 'pointer',
        transition: 'background 0.15s',
    },
    btnAccept: {
        flex: 2,
        padding: '0.75rem',
        borderRadius: '0.625rem',
        background: '#22c55e',
        color: '#fff',
        fontWeight: 700,
        fontSize: '0.9rem',
        border: 'none',
        cursor: 'pointer',
        transition: 'background 0.15s',
    },
};
