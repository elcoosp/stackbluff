import React from 'react';
import { TournamentCard, TournamentData } from '../components/TournamentCard';

const tournaments: TournamentData[] = [
  {
    title: "Weekend MTT",
    status: "Registering",
    type: "MTT",
    blinds: "$0.50/$1.00",
    buyIn: "$500",
    prizePool: "$10,000",
    registered: 0,
    maxPlayers: 20,
  },
  {
    title: "Standard Sit & Go",
    status: "Registering",
    type: "S&G",
    blinds: "$0.10/$0.25",
    buyIn: "$250",
    prizePool: "$2,250",
    registered: 0,
    maxPlayers: 9,
  },
  {
    title: "Micro Sit & Go",
    status: "Registering",
    type: "S&G",
    blinds: "$0.02/$0.05",
    buyIn: "$100",
    prizePool: "$600",
    registered: 0,
    maxPlayers: 6,
  }
];

export default function TournamentLobby() {
  return (
    <div className="w-full max-w-7xl mx-auto p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {tournaments.map(t => <TournamentCard key={t.title} data={t} />)}
    </div>
  );
}
