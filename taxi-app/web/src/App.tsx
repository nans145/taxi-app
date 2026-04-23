// App.tsx
import { useEffect, useRef, useState } from 'react';
import { AppSubRoutes } from './components/Animations';
import { useNuiCallback, useNuiEvent } from './hooks/useNui';
import { fetchNui } from './utils/nui';           // ← chemin correct
import { AppRoutes } from './routes';
import RideOffer from './components/RideOffer';

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

const App = () => {
    const IsNUILoaded = useRef(false);
    const [NuiLoaded] = useNuiCallback('Core:NuiLoaded');
    const [rideOffer, setRideOffer] = useState<RideOfferData | null>(null);

    useEffect(() => {
        if (IsNUILoaded.current) return;
        NuiLoaded().then(() => {
            setExternalRouting(
                window.name,
                AppRoutes.map((route) => ({
                    path: route.path,
                    index: route.index ?? false,
                })),
            );
        });
        IsNUILoaded.current = true;
    }, [NuiLoaded]);

    useNuiEvent<RideOfferData>('rideOffer', (data) => {
        setRideOffer(data);
    });

    useNuiEvent('rideOfferExpired', () => {
        setRideOffer(null);
    });

    function handleAccept(rideId: number) {
        fetchNui('taxi-app:server:acceptRide', rideId);
        setRideOffer(null);
    }

    function handleDecline(rideId: number) {
        fetchNui('taxi-app:server:declineRide', rideId);
        setRideOffer(null);
    }

    return (
        <div className='w-full h-full relative overflow-hidden' style={{ background: 'transparent' }}>
            <div className='absolute top-0 left-0 w-full h-full overflow-hidden' style={{ background: 'transparent' }}>
                <AppSubRoutes routes={AppRoutes} />
            </div>
            <RideOffer
                offer={rideOffer}
                onAccept={handleAccept}
                onDecline={handleDecline}
            />
        </div>
    );
};

export default App;