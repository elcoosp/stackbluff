import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { SeasonCardModal } from '../components/SeasonCardModal';
import { useSeasonCard } from '../hooks/useSeasonCard';

export const SeasonCardPage: React.FC = () => {
  const { seasonId } = useParams<{ seasonId: string }>();
  const { data, isLoading, error } = useSeasonCard(Number(seasonId));
  const [showModal, setShowModal] = useState(true);

  if (isLoading) return <div className="p-8 text-center">Loading season card…</div>;
  if (error || !data) return <div className="p-8 text-center text-red-600">Failed to load card.</div>;

  const card = {
    seasonId: data.season_id,
    cardImageUrl: data.card_image_url,
    cardData: data.card_data as any,
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <h1 className="mb-6 text-3xl font-bold text-slate-900">Season {data.season_id} Card</h1>
      {showModal && <SeasonCardModal card={card} onClose={() => setShowModal(false)} />}
    </div>
  );
};
