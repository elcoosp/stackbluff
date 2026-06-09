import React from 'react';

interface Props {
  rank: string;
  suit: string;
  artUrl: string;
  cornerPlaqueUrl?: string;
  borderUrl?: string;
  centerBandUrl?: string;
  pipBaseUrl: string;
  onImageError?: (url: string) => void;
  rankImageUrl?: string;
  useRankImage?: boolean;
  onRankImageError?: () => void;
  onRankImageLoad?: () => void;
}

export const ReversibleLayout: React.FC<Props> = ({
  rank,
  suit,
  artUrl,
  cornerPlaqueUrl,
  borderUrl,
  centerBandUrl,
  pipBaseUrl,
  onImageError,
  rankImageUrl,
  useRankImage = true,
  onRankImageError,
  onRankImageLoad,
}) => {
  const suitColor = suit === 'hearts' || suit === 'diamonds' ? '#B82B4B' : '#1C1B1E';
  const handleError = (url: string) => () => onImageError?.(url);

  const renderRank = () => {
    if (rankImageUrl && useRankImage) {
      return (
        <img
          src={rankImageUrl}
          onError={onRankImageError}
          onLoad={onRankImageLoad}
          className="max-w-full max-h-full object-contain"
          alt={rank}
          style={{ maxWidth: '120px', maxHeight: '120px' }}
        />
      );
    }
    return (
      <span className="text-[120px] font-bold leading-none" style={{ color: suitColor, textShadow: '2px 2px white' }}>
        {rank}
      </span>
    );
  };

  return (
    <div className="relative w-[1000px] h-[1400px] bg-white shadow-2xl rounded-[32px] overflow-hidden">
      <div className="absolute top-0 left-0 w-[600px] h-[600px] pointer-events-none z-25"
        style={{ background: 'radial-gradient(circle at top left, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.6) 40%, rgba(255,255,255,0) 70%)' }} />
      <div className="absolute bottom-0 right-0 w-[600px] h-[600px] pointer-events-none z-25"
        style={{ background: 'radial-gradient(circle at bottom right, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.6) 40%, rgba(255,255,255,0) 70%)' }} />

      {borderUrl && (
        <img src={borderUrl} onError={handleError(borderUrl)} className="absolute inset-0 w-full h-full pointer-events-none z-10" alt="border" />
      )}

      <div className="absolute flex items-center justify-center pointer-events-none z-20"
           style={{ bottom: 'calc(50% + 10px)', left: '50%', transform: 'translateX(-50%)', width: '900px', height: 'auto', maxHeight: '620px', marginTop: '20px' }}>
        <img src={artUrl} onError={handleError(artUrl)} className="max-w-full max-h-full object-contain" alt="art top" />
      </div>

      <div className="absolute flex items-center justify-center pointer-events-none z-20"
           style={{ top: 'calc(50% + 10px)', left: '50%', transform: 'translateX(-50%)', width: '900px', height: 'auto', maxHeight: '620px', marginBottom: '20px' }}>
        <img src={artUrl} onError={handleError(artUrl)} className="max-w-full max-h-full object-contain rotate-180" alt="art bottom" />
      </div>

      {centerBandUrl && (
        <img src={centerBandUrl} onError={handleError(centerBandUrl)} className="absolute top-1/2 left-0 w-full -translate-y-1/2 pointer-events-none z-30" alt="center band" />
      )}

      <div className="absolute top-[35px] left-[35px] z-40">
        {cornerPlaqueUrl ? (
          <div className="flex flex-col items-center">
            <div className="relative w-[160px] h-[160px]">
              <img src={cornerPlaqueUrl} onError={handleError(cornerPlaqueUrl)} className="absolute inset-0 w-full h-full" alt="plaque" />
              <div className="absolute inset-0 flex items-center justify-center">
                {renderRank()}
              </div>
            </div>
            <img src={`${pipBaseUrl}${suit}-90.png`} onError={handleError(`${pipBaseUrl}${suit}-90.png`)} className="w-[90px] h-[90px] mt-2" alt="suit" />
          </div>
        ) : (
          <div className="flex flex-col items-center">
            {renderRank()}
            <img src={`${pipBaseUrl}${suit}-100.png`} onError={handleError(`${pipBaseUrl}${suit}-100.png`)} className="w-[100px] h-[100px]" alt="suit" />
          </div>
        )}
      </div>

      <div className="absolute bottom-[35px] right-[35px] rotate-180 z-40">
        {cornerPlaqueUrl ? (
          <div className="flex flex-col items-center">
            <div className="relative w-[160px] h-[160px]">
              <img src={cornerPlaqueUrl} onError={handleError(cornerPlaqueUrl)} className="absolute inset-0 w-full h-full" alt="plaque" />
              <div className="absolute inset-0 flex items-center justify-center">
                {renderRank()}
              </div>
            </div>
            <img src={`${pipBaseUrl}${suit}-90.png`} onError={handleError(`${pipBaseUrl}${suit}-90.png`)} className="w-[90px] h-[90px] mt-2" alt="suit" />
          </div>
        ) : (
          <div className="flex flex-col items-center">
            {renderRank()}
            <img src={`${pipBaseUrl}${suit}-100.png`} onError={handleError(`${pipBaseUrl}${suit}-100.png`)} className="w-[100px] h-[100px]" alt="suit" />
          </div>
        )}
      </div>
    </div>
  );
};
