import React from 'react';
import { PlatformAPI } from '../platform/PlatformAPI';

export interface SeasonCardData {
  seasonId: number;
  cardImageUrl: string | null;
  cardData: {
    rank_tier: string;
    best_hand?: string;
    total_chips_won?: number;
    hands_played?: number;
  } | null;
}

interface SeasonCardModalProps {
  card: SeasonCardData;
  onClose: () => void;
}

export const SeasonCardModal: React.FC<SeasonCardModalProps> = ({ card, onClose }) => {
  const handleShare = () => {
    const url = card.cardImageUrl ?? window.location.href;
    const tier = card.cardData?.rank_tier ?? 'Unknown';
    const season = card.seasonId;

    PlatformAPI.shareContent({
      url,
      title: `I finished Season ${season} as ${tier}!`,
      text: `Try to beat me at StackBluff! 🃏`,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <h2 className="mb-4 text-center text-2xl font-bold text-slate-900">
          Season {card.seasonId} Complete!
        </h2>

        {card.cardImageUrl ? (
          <img
            src={card.cardImageUrl}
            alt={`Season ${card.seasonId} card`}
            className="mb-4 w-full rounded-lg shadow"
          />
        ) : (
          <div className="mb-4 rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 p-6 text-center shadow">
            <p className="text-xl font-semibold text-slate-800">
              Rank: {card.cardData?.rank_tier}
            </p>
            <p className="mt-1 text-slate-600">
              Best Hand: {card.cardData?.best_hand ?? 'N/A'}
            </p>
            <p className="text-slate-600">
              Chips Won: {card.cardData?.total_chips_won ?? 0}
            </p>
            <p className="text-slate-600">
              Hands Played: {card.cardData?.hands_played ?? 0}
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleShare}
            className="flex-1 rounded-lg bg-blue-600 py-2.5 font-medium text-white transition hover:bg-blue-700 active:scale-95"
          >
            Share
          </button>
          <button
            onClick={onClose}
            className="flex-1 rounded-lg bg-slate-200 py-2.5 font-medium text-slate-800 transition hover:bg-slate-300 active:scale-95"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
