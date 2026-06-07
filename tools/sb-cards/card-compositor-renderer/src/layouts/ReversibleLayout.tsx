import React from 'react';

interface Props {
  rank: string;
  suit: string;
  artUrl: string;
  cornerPlaqueUrl?: string;
  borderUrl?: string;
  cornerLightUrl?: string;
  centerBandUrl?: string;
}

export const ReversibleLayout: React.FC<Props> = ({
  rank,
  suit,
  artUrl,
  cornerPlaqueUrl,
  borderUrl,
  cornerLightUrl,
  centerBandUrl,
}) => {
  const suitColor = suit === 'hearts' || suit === 'diamonds' ? '#B82B4B' : '#1C1B1E';

  return (
    <div className="relative w-[1000px] h-[1400px] bg-white shadow-2xl">
      {borderUrl && <img src={borderUrl} className="absolute inset-0 w-full h-full pointer-events-none" alt="border" />}
      <div className="absolute top-[calc(50%-330px)] left-[50%] translate-x-[-50%] w-[900px] h-[640px] flex items-center justify-center pointer-events-none">
        <img src={artUrl} className="max-w-full max-h-full object-contain" alt="art" />
      </div>
      <div className="absolute bottom-[calc(50%-330px)] left-[50%] translate-x-[-50%] w-[900px] h-[640px] flex items-center justify-center pointer-events-none rotate-180">
        <img src={artUrl} className="max-w-full max-h-full object-contain" alt="art rotated" />
      </div>
      {centerBandUrl && <img src={centerBandUrl} className="absolute top-1/2 left-0 w-full -translate-y-1/2 pointer-events-none" alt="center band" />}
      {cornerLightUrl && <img src={cornerLightUrl} className="absolute inset-0 w-full h-full pointer-events-none mix-blend-multiply" alt="corner light" />}
      <div className="absolute top-[35px] left-[35px]">
        {cornerPlaqueUrl ? (
          <div className="flex flex-col items-center">
            <img src={cornerPlaqueUrl} className="w-[160px] h-[160px]" alt="plaque" />
            <div className="text-[120px] font-bold text-center leading-none mt-[-120px]" style={{ color: suitColor, textShadow: '2px 2px white' }}>
              {rank}
            </div>
            <img src={`/2-pips/${suit}-90.png`} className="w-[90px] h-[90px] mt-2" alt="suit" />
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="text-[120px] font-bold leading-none" style={{ color: suitColor }}>
              {rank}
            </div>
            <img src={`/2-pips/${suit}-100.png`} className="w-[100px] h-[100px]" alt="suit" />
          </div>
        )}
      </div>
      <div className="absolute bottom-[35px] right-[35px] rotate-180">
        {cornerPlaqueUrl ? (
          <div className="flex flex-col items-center">
            <img src={cornerPlaqueUrl} className="w-[160px] h-[160px]" alt="plaque" />
            <div className="text-[120px] font-bold text-center leading-none mt-[-120px]" style={{ color: suitColor, textShadow: '2px 2px white' }}>
              {rank}
            </div>
            <img src={`/2-pips/${suit}-90.png`} className="w-[90px] h-[90px] mt-2" alt="suit" />
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="text-[120px] font-bold leading-none" style={{ color: suitColor }}>
              {rank}
            </div>
            <img src={`/2-pips/${suit}-100.png`} className="w-[100px] h-[100px]" alt="suit" />
          </div>
        )}
      </div>
    </div>
  );
};
