import React from "react";
import { PlatformAPI } from "../platform/PlatformAPI";

interface SeasonCardProps {
    seasonId: number;
    rankTier: string;
    handsPlayed: number;
    totalChipsWon: number;
    bestHand: string;
    cardImageUrl?: string;
}

export const SeasonCard: React.FC<SeasonCardProps> = ({
    seasonId,
    rankTier,
    handsPlayed,
    totalChipsWon,
    bestHand,
    cardImageUrl,
}) => {
    const handleShare = async () => {
        await PlatformAPI.shareContent({
            title: `Season ${seasonId} Results`,
            text: `I finished Season ${seasonId} as ${rankTier}! Hands played: ${handsPlayed}, Total chips won: ${totalChipsWon}. Try to beat me at StackBluff!`,
            url: cardImageUrl || `${window.location.origin}/season-cards/${seasonId}`,
        });
    };

    return (
        <div className="season-card">
            <h2>Season {seasonId} Card</h2>
            <div className="rank-tier">Rank: {rankTier}</div>
            <div className="stats">
                <div>Hands Played: {handsPlayed}</div>
                <div>Total Chips Won: {totalChipsWon}</div>
                <div>Best Hand: {bestHand}</div>
            </div>
            <button onClick={handleShare}>Share</button>
        </div>
    );
};
