import { type HTMLAttributes, useEffect, useRef, useState } from 'react';

import { LoaderCircle, Pin } from 'lucide-react';

import { cn } from '@/lib/utils';

const Map = ({ x, y, className, ...props }: { x: number; y: number } & HTMLAttributes<HTMLDivElement>) => {
    const [mapSize, setMapSize] = useState({ width: 0, height: 0 });
    const [mapData, setMapData] = useState<string | null>(null);

    const wrapperRef = useRef<HTMLDivElement | null>(null);

    // Fetch map image when component mounts or when x/y changes
    useEffect(() => {
        if (mapSize.width === 0 || mapSize.height === 0) return;

        const fetchMap = async () => {
            const map = await getMap({ x, y, width: mapSize.width, height: mapSize.height });

            setMapData(map);
        };

        fetchMap();
    }, [x, y, mapSize.height, mapSize.width, getMap]);

    // Observe size changes of the wrapper div
    useEffect(() => {
        if (!wrapperRef.current) return;

        setMapSize({
            height: wrapperRef.current.clientHeight,
            width: wrapperRef.current.clientWidth,
        });
    }, [wrapperRef]);

    return (
        <div
            className={cn('relative flex items-center justify-center rounded-xl overflow-hidden', className)}
            ref={wrapperRef}
            {...props}
        >
            {mapData ? (
                <>
                    <div className='absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2'>
                        <div className='bg-[#fff] text-[#fff] rounded-full min-w-10 size-10 p-1 shadow-[0_0_40px_rgba(0,0,0,0.7)] flex justify-center items-center relative -top-7'>
                            <div className='size-8 min-w-8 flex items-center justify-center rounded-full bg-[#3B8BEE] text-white'>
                                <Pin className='size-4 fill-current' />
                            </div>
                            <svg
                                width='16'
                                height='8'
                                viewBox='0 0 16 8'
                                fill='none'
                                xmlns='http://www.w3.org/2000/svg'
                                className='absolute left-1/2 bottom-[-6.5px] -translate-x-1/2'
                            >
                                <path
                                    d='M15.7764 0C12.4406 1.23427 9.64637 3.76948 7.88867 7.06055C6.13082 3.7692 3.33617 1.23415 0 0C2.49551 0.761247 5.1441 1.17188 7.88867 1.17188C10.6329 1.17188 13.2811 0.761072 15.7764 0Z'
                                    fill='currentColor'
                                />
                            </svg>
                        </div>
                    </div>
                    <img src={mapData} alt='Map' />
                </>
            ) : (
                <>
                    <svg role='img' width='100%' height='100%'>
                        <rect x='0' y='0' width='100%' height='100%' fill='url(#map-loading)' />
                        <defs>
                            <linearGradient id='map-loading' gradientTransform='translate(-2 0)'>
                                <stop offset='0%' stopColor='#7a7e96' stopOpacity='0.1'></stop>
                                <stop offset='50%' stopColor='#7a7e96' stopOpacity='0.2'></stop>
                                <stop offset='100%' stopColor='#7a7e96' stopOpacity='0.1'></stop>
                                <animateTransform
                                    attributeName='gradientTransform'
                                    type='translate'
                                    values='-2 0; 0 0; 2 0'
                                    dur='1.2s'
                                    repeatCount='indefinite'
                                ></animateTransform>
                            </linearGradient>
                        </defs>
                    </svg>

                    <div className='absolute size-full flex items-center justify-center'>
                        <div className='flex items-center justify-center gap-1 rounded-lg bg-[#3B8BEE] p-2 text-white'>
                            <LoaderCircle className='size-4 animate-spin' />
                            <p className='text-nowrap text-sm'>Loading map</p>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default Map;
