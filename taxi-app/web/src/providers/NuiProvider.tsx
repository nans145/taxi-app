import { type ReactNode, createContext, useCallback, useEffect, useState } from 'react';

type Handler = (payload: unknown) => void;

interface NuiContextType {
    registerCallback: (name: string, cb: Handler) => void;
    unregisterCallback: (name: string) => void;
}

export const NuiContext = createContext<NuiContextType | null>(null);

const NuiProvider = ({ children }: { children: ReactNode }) => {
    const [handlers, setHandlers] = useState<Record<string, Handler>>({});

    const registerCallback = useCallback((name: string, cb: Handler) => {
        setHandlers((handlers) => ({ ...handlers, [name]: cb }));
    }, []);

    const unregisterCallback = useCallback((name: string) => {
        setHandlers((prev) => {
            const { [name]: _, ...rest } = prev;
            return rest;
        });
    }, []);

    useEffect(() => {
        const onMessage = (e: MessageEvent<any>) => {
            const data = e.data;
            if (!data) return;

            // Debug — à retirer une fois que ça marche
            console.log('[NUI RAW MESSAGE]', JSON.stringify(data));

            // Format direct { action, payload }
            if (data.action && handlers[data.action]) {
                handlers[data.action](data.payload);
                return;
            }

            // Format 17mov_Phone SendAppMessage : { data: { action, payload } }
            if (data.data?.action && handlers[data.data.action]) {
                handlers[data.data.action](data.data.payload);
                return;
            }

            // Format { type, payload }
            if (data.type && handlers[data.type]) {
                handlers[data.type](data.payload);
                return;
            }
        };

        window.addEventListener('message', onMessage);
        return () => window.removeEventListener('message', onMessage);
    }, [handlers]);

    return (
        <NuiContext.Provider value={{ registerCallback, unregisterCallback }}>
            {children}
        </NuiContext.Provider>
    );
};

export default NuiProvider;