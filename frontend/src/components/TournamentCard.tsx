import React from 'react';

const TOURNAMENT_BG_MAP: Record<string, string> = {
  "Weekend MTT": "/images/tournaments/bg_weekend_mtt.jpg",
  "Standard Sit & Go": "/images/tournaments/bg_standard_sng.jpg",
  "Micro Sit & Go": "/images/tournaments/bg_micro_sng.jpg",
};

export interface TournamentData {
  title: string;
  status: "Registering" | "Running" | "Completed";
  type: "MTT" | "S&G";
  blinds: string;
  buyIn: string;
  prizePool: string;
  registered: number;
  maxPlayers: number;
}

export const TournamentCard: React.FC<{ data: TournamentData }> = ({ data }) => {
  const bgImage = TOURNAMENT_BG_MAP[data.title] || "/images/tournaments/bg_weekend_mtt.jpg";

  return (
    <div className="relative w-full aspect-[16/9] rounded-2xl overflow-hidden group transition-all duration-300 hover:-translate-y-1">
      <img
        src={bgImage}
        alt={`${data.title} background`}
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
      />

      <div
        className="absolute inset-0 backdrop-blur-xl bg-[#131315]/60 border border-[#c6c6cf]/10 flex flex-col p-6 justify-between"
        style={{ boxShadow: "0 8px 32px rgba(0, 0, 0, 0.6)" }}
      >
        <div className="flex justify-between items-start">
          <div>
            <h2 className="font-display text-2xl md:text-3xl text-[#e4e2e4] leading-tight">
              {data.title}
            </h2>
            <span
              className="inline-block mt-2 px-3 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-widest text-[#003824] bg-[#4edea3]"
              style={{ boxShadow: "0px 0px 12px rgba(78, 222, 163, 0.4)" }}
            >
              {data.status}
            </span>
          </div>

          <span className="px-3 py-1 border border-[#c6c6cf]/30 rounded text-[#c6c6cf] text-sm font-mono">
            {data.type}
          </span>
        </div>

        <div className="flex gap-8 mt-4">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-widest text-[#bbcac0] font-mono">Blinds</span>
            <span className="text-base text-[#e4e2e4] font-mono font-bold">{data.blinds}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-widest text-[#bbcac0] font-mono">Buy-in</span>
            <span className="text-base text-[#e4e2e4] font-mono font-bold">{data.buyIn}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-widest text-[#bbcac0] font-mono">Prize Pool</span>
            <span className="text-base text-[#4edea3] font-mono font-bold">{data.prizePool}</span>
          </div>
        </div>

        <div className="flex justify-between items-center mt-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#4edea3] animate-pulse" style={{ boxShadow: "0px 0px 8px #4edea3" }}></div>
            <span className="font-mono text-sm text-[#c6c6cf]">
              <span className="text-[#e4e2e4] font-bold">{data.registered}</span> / {data.maxPlayers}
            </span>
          </div>

          <button
            className="px-6 py-2 rounded-lg font-sans text-sm font-semibold transition-all duration-300
                       bg-gradient-to-b from-[#4edea3] to-[#005f40] text-[#003824]
                       border border-[#c6c6cf]/20 hover:shadow-[0_0_16px_rgba(78,222,163,0.6)]"
          >
            Register
          </button>
        </div>
      </div>
    </div>
  );
};
