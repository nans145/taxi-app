import { useState, useEffect, useRef } from 'react';
import { useNuiEvent } from '@/hooks/useNui';
import { useNuiCallback } from '@/hooks/useNui';
import { fetchNui } from '@/utils/nui';
import ClientView from '@/components/ClientView';
import DriverView from '@/components/DriverView';

const TaxiApp = () => {
    const [isDriver, setIsDriver]       = useState(false);
    const [currentRide, setCurrentRide] = useState<any>(null);
    const [rides, setRides]             = useState<any[]>([]);
    const [rideOffer, setRideOffer]     = useState<any>(null);   // ← offre dispatch
    const intervalRef                   = useRef<ReturnType<typeof setInterval> | null>(null);

    const [getState] = useNuiCallback<Record<string, unknown>, any>('Taxi:GetState');

    const loadState = () => {
        getState({}).then((state: any) => {
            if (!state) return;
            setIsDriver(state.isDriver ?? false);
            setCurrentRide(state.currentRide ?? null);
        });
        fetchNui('Taxi:CheckDrivers', {}).catch(() => {});
        fetchNui('Taxi:GetMyRating', {}).catch(() => {});
    };

    useNuiEvent('Core:AppReady', () => {
        setTimeout(loadState, 300);

        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = setInterval(() => {
            fetchNui('Taxi:CheckDrivers', {}).catch(() => {});
        }, 10000);
    });

    useEffect(() => {
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, []);

    useNuiEvent('Taxi:RefreshState', () => {
        setTimeout(loadState, 300);
    });

    useNuiEvent('Taxi:DriversCountChanged', () => {
        fetchNui('Taxi:CheckDrivers', {}).catch(() => {});
    });

    // ── Courses (liste générale) ──
    useNuiEvent<any[]>('Taxi:UpdateRides', (p) => setRides(p ?? []));

    // ── Offre dispatch (1 seul chauffeur à la fois) ──
    useNuiEvent<any>('Taxi:RideOffer',        (p) => setRideOffer(p));
    useNuiEvent('Taxi:RideOfferExpired',      () => setRideOffer(null));

    // ── Suivi de la course en cours ──
    useNuiEvent<any>('Taxi:RideCreated',    (p) => setCurrentRide(p));
    useNuiEvent<any>('Taxi:RideAccepted',   (p) => setCurrentRide(p));
    useNuiEvent<any>('Taxi:RideAssigned',   (p) => { setCurrentRide(p); setRideOffer(null); });
    useNuiEvent<any>('Taxi:RideStarted',    (p) => setCurrentRide(p));
    useNuiEvent<any>('Taxi:ClientPickedUp', (p) => setCurrentRide(p));
    useNuiEvent('Taxi:RideCancelled',       () => { setCurrentRide(null); setRideOffer(null); });
    useNuiEvent('Taxi:RideFinished',        () => { setCurrentRide(null); setRideOffer(null); });

    return (
        <>
            <style>{`
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; width: 100%; height: 100%; overflow: hidden; }
                .taxi-client { display:flex; flex-direction:column; gap:10px; padding:16px; height:100%; background:transparent; color:#fff; overflow-y:auto; }
                .taxi-header { display:flex; align-items:center; gap:10px; margin-bottom:4px; }
                .taxi-header h1 { font-size:18px; font-weight:700; color:#fff; }
                .taxi-icon { font-size:28px; }
                .taxi-btn { width:100%; padding:12px; border:none; border-radius:12px; font-size:14px; font-weight:600; cursor:pointer; margin-top:6px; color:#fff; }
                .taxi-btn:active { transform:scale(0.97); }
                .taxi-btn-primary { background:#3b82f6; }
                .taxi-btn-success { background:#22c55e; }
                .taxi-btn-danger  { background:#ef4444; }
                .taxi-drivers-status { padding:10px 14px; border-radius:10px; font-weight:600; font-size:13px; text-align:center; }
                .taxi-drivers-status.available   { background:rgba(34,197,94,0.2); color:#4ade80; }
                .taxi-drivers-status.unavailable { background:rgba(239,68,68,0.2); color:#f87171; }
                .taxi-my-rating { background:rgba(245,197,24,0.15); color:#fbbf24; padding:8px 14px; border-radius:10px; font-size:13px; text-align:center; }
                .taxi-info { background:rgba(255,255,255,0.07); border-radius:10px; padding:10px 14px; }
                .taxi-hint { color:#cbd5e1; font-size:12px; line-height:1.5; }
                .taxi-error { background:rgba(239,68,68,0.2); color:#f87171; padding:8px 14px; border-radius:10px; font-size:13px; text-align:center; }
                .detail-row { display:flex; justify-content:space-between; align-items:center; padding:4px 0; font-size:13px; color:#e2e8f0; border-bottom:1px solid rgba(255,255,255,0.06); }
                .detail-row:last-child { border-bottom:none; }
                .detail-row.price span:last-child { color:#fbbf24; font-weight:700; }
                .taxi-ride-status { display:flex; flex-direction:column; gap:10px; }
                .status-badge { padding:10px 14px; border-radius:10px; font-weight:600; font-size:13px; text-align:center; }
                .status-badge.pending  { background:rgba(251,191,36,0.2); color:#fbbf24; }
                .status-badge.accepted { background:rgba(34,197,94,0.2); color:#4ade80; }
                .waiting-animation { display:flex; justify-content:center; gap:6px; padding:8px; }
                .dot { width:8px; height:8px; border-radius:50%; background:#fbbf24; animation:bounce 1.2s infinite ease-in-out; }
                .dot:nth-child(2) { animation-delay:0.2s; }
                .dot:nth-child(3) { animation-delay:0.4s; }
                @keyframes bounce { 0%,80%,100%{transform:scale(0.7);opacity:0.5} 40%{transform:scale(1.1);opacity:1} }
                .ride-details { background:rgba(255,255,255,0.07); border-radius:10px; padding:10px 14px; display:flex; flex-direction:column; gap:2px; }
            `}</style>
            {isDriver ? (
                <DriverView
                    rides={rides}
                    currentRide={currentRide}
                    rideOffer={rideOffer}
                />
            ) : (
                <ClientView currentRide={currentRide} />
            )}
        </>
    );
};

export default TaxiApp;
