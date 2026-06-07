import React from 'react';
import { PIP_GRID_COLS, PIP_GRID_ROWS, pipLayouts } from '../utils/pipGrid';

interface Props {
  rank: string;
  suit: string;
  artUrl: string;
  cornerPlaqueUrl?: string;
  borderUrl?: string;
  cornerLightUrl?: string;
  showPipPattern: boolean;
  artOpacity: number;
  noPadding: boolean;
  isBack: boolean;
}

export const StandardLayout: React.FC<Props> = ({
  rank,
  suit,
  artUrl,
  cornerPlaqueUrl,
  borderUrl,
  cornerLightUrl,
  showPipPattern,
  artOpacity,
  noPadding,
  isBack,
}) => {
  const suitColor = suit === 'hearts' || suit === 'diamonds' ? '#B82B4B' : '#1C1B1E';
  const pipPositions = showPipPattern && pipLayouts[rank] ? pipLayouts[rank] : [];

  return (
    <div className="relative w-[1000px] h-[1400px] bg-white shadow-2xl">
      {borderUrl && <img src={borderUrl} className="absolute inset-0 w-full h-full pointer-events-none" alt="border" />}
      <div
        className="absolute flex items-center justify-center pointer-events-none"
        style={{
          top: noPadding || isBack ? 0 : 200,
          left: noPadding || isBack ? 0 : 50,
          width: noPadding || isBack ? 1000 : 900,
          height: noPadding || isBack ? 1400 : 1000,
          opacity: artOpacity,
        }}
      >
        <img src={artUrl} className="max-w-full max-h-full object-contain" alt="art" />
      </div>
      {pipPositions.map(([col, row], idx) => {
        const left = PIP_GRID_COLS[col] - 80;
        const top = PIP_GRID_ROWS[row] - 80;
        return (
          <img
            key={idx}
            src={`/2-pips/${suit}-160.png`}
            className="absolute w-[160px] h-[160px] pointer-events-none"
            style={{ left, top }}
            alt="pip"
          />
        );
      })}
      {cornerLightUrl && !isBack && (
        <img src={cornerLightUrl} className="absolute inset-0 w-full h-full pointer-events-none mix-blend-multiply" alt="corner light" />
      )}
      <div className="absolute top-[35px] left-[35px]">
        {cornerPlaqueUrl ? (
          <div className="flex flex-col items-center">
            <img src={cornerPlaqueUrl} className="w-[160px] h-[160px]" alt="plaque" />
            <div className="text-[120px] font-bold text-center leading-none mt-[-120px]" style={{ color: suitColor, textShadow: '2px 2px white' }}>
              {rank}
            </div>
            {suit && <img src={`/2-pips/${suit}-90.png`} className="w-[90px] h-[90px] mt-2" alt="suit" />}
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="text-[120px] font-bold leading-none" style={{ color: suitColor }}>
              {rank}
            </div>
            {suit && <img src={`/2-pips/${suit}-100.png`} className="w-[100px] h-[100px]" alt="suit" />}
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
            {suit && <img src={`/2-pips/${suit}-90.png`} className="w-[90px] h-[90px] mt-2" alt="suit" />}
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="text-[120px] font-bold leading-none" style={{ color: suitColor }}>
              {rank}
            </div>
            {suit && <img src={`/2-pips/${suit}-100.png`} className="w-[100px] h-[100px]" alt="suit" />}
          </div>
        )}
      </div>
    </div>
  );
};
