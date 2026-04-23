import type { RouteType } from '@/types/types';
import TaxiApp from '@/views/TaxiApp';

export const AppRoutes: RouteType[] = [
    {
        path: '/',
        element: <TaxiApp />,
        className: '',
    },
];