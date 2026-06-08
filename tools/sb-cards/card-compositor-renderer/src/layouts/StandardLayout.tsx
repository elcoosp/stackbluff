import React from 'react';
import { PIP_GRID_COLS, PIP_GRID_ROWS, pipLayouts } from '../utils/pipGrid';

interface Props {
  rank: string;
  suit: string;
  artUrl: string;
  cornerPlaqueUrl?: string;
  borderUrl?: string;
  showPipPattern: boolean;
  artOpacity: number;
  noPadding: boolean;
  isBack: boolean;
  pipBaseUrl: string;
  onImageError?: (url: string) => void;
}

export const StandardLayout: React.FC<Props> = ({
  rank,
  suit,
  artUrl,
  cornerPlaqueUrl,
  borderUrl,
  showPipPattern,
  artOpacity,
  noPadding,
  isBack,
  pipBaseUrl,
  onImageError,
}) => {
  const suitColor = suit === 'hearts' || suit === 'diamonds' ? '#B82B4B' : '#1C1B1E';
  const pipPositions = showPipPattern && pipLayouts[rank] ? pipLayouts[rank] : [];
  const handleError = (url: string) => () => onImageError?.(url);

  const artStyle = noPadding || isBack
    ? { top: 0, left: 0, width: 1000, height: 1400 }
    : { top: 200, left: 50, width: 900, height: 1000 };

  return (
    <div className="relative w-[1000px] h-[1400px] bg-white shadow-2xl rounded-[32px] overflow-hidden">
      {/* Heavy corner light gradients – larger radius, higher opacity */}
      <div className="absolute top-0 left-0 w-[500px] h-[500px] pointer-events-none z-15"
        style={{ background: 'radial-gradient(circle at top left, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.6) 40%, rgba(255,255,255,0) 80%)' }} />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] pointer-events-none z-15"
        style={{ background: 'radial-gradient(circle at bottom right, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.6) 40%, rgba(255,255,255,0) 80%)' }} />

      {borderUrl && !isBack && (
        <img src={borderUrl} onError={handleError(borderUrl)} className="absolute inset-0 w-full h-full pointer-events-none z-10" alt="border" />
      )}

      <div className="absolute flex items-center justify-center pointer-events-none z-20"
        style={{ top: artStyle.top, left: artStyle.left, width: artStyle.width, height: artStyle.height, opacity: artOpacity }}>
        <img src={artUrl} onError={handleError(artUrl)} className="max-w-full max-h-full object-contain" alt="art" />
      </div>

      {pipPositions.map(([col, row], idx) => {
        const left = PIP_GRID_COLS[col] - 80;
        const top = PIP_GRID_ROWS[row] - 80;
        const shouldRotate = row === 3 || row === 4;
        const pipUrl = `${pipBaseUrl}${suit}-160.png`;
        return (
          <img key={idx} src={pipUrl} onError={handleError(pipUrl)}
            className="absolute w-[160px] h-[160px] pointer-events-none z-30"
            style={{ left, top, transform: shouldRotate ? 'rotate(180deg)' : 'none' }}
            alt="pip" />
        );
      })}

      {!isBack && rank && (
        <>
          <div className="absolute top-[35px] left-[35px] z-40">
            {cornerPlaqueUrl ? (
              <div className="flex flex-col items-center">
                <div className="relative w-[160px] h-[160px]">
                  <img src={cornerPlaqueUrl} onError={handleError(cornerPlaqueUrl)} className="absolute inset-0 w-full h-full" alt="plaque" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[120px] font-bold leading-none" style={{ color: suitColor, textShadow: '2px 2px white' }}>
                      {rank}
                    </span>
                  </div>
                </div>
                {suit && <img src={`${pipBaseUrl}${suit}-90.png`} onError={handleError(`${pipBaseUrl}${suit}-90.png`)} className="w-[90px] h-[90px] mt-2" alt="suit" />}
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <span className="text-[120px] font-bold leading-none" style={{ color: suitColor }}>{rank}</span>
                {suit && <img src={`${pipBaseUrl}${suit}-100.png`} onError={handleError(`${pipBaseUrl}${suit}-100.png`)} className="w-[100px] h-[100px]" alt="suit" />}
              </div>
            )}
          </div>

          <div className="absolute bottom-[35px] right-[35px] rotate-180 z-40">
            {cornerPlaqueUrl ? (
              <div className="flex flex-col items-center">
                <div className="relative w-[160px] h-[160px]">
                  <img src={cornerPlaqueUrl} onError={handleError(cornerPlaqueUrl)} className="absolute inset-0 w-full h-full" alt="plaque" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[120px] font-bold leading-none" style={{ color: suitColor, textShadow: '2px 2px white' }}>
                      {rank}
                    </span>
                  </div>
                </div>
                {suit && <img src={`${pipBaseUrl}${suit}-90.png`} onError={handleError(`${pipBaseUrl}${suit}-90.png`)} className="w-[90px] h-[90px] mt-2" alt="suit" />}
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <span className="text-[120px] font-bold leading-none" style={{ color: suitColor }}>{rank}</span>
                {suit && <img src={`${pipBaseUrl}${suit}-100.png`} onError={handleError(`${pipBaseUrl}${suit}-100.png`)} className="w-[100px] h-[100px]" alt="suit" />}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
