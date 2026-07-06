export function ClubPageSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl animate-pulse">
      <div className="mb-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-lg bg-white/10" />
          <div className="flex-grow">
            <div className="h-8 w-48 bg-white/10 rounded mb-2" />
            <div className="h-4 w-32 bg-white/10 rounded" />
          </div>
        </div>
      </div>
      <div className="flex gap-2 mb-6 border-b border-white/10">
        <div className="h-10 w-24 bg-white/10 rounded" />
        <div className="h-10 w-24 bg-white/10 rounded" />
        <div className="h-10 w-24 bg-white/10 rounded" />
      </div>
      <div className="bg-white/5 rounded-xl p-6">
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 bg-white/10 rounded" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function LeaderboardSkeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 bg-white/5 rounded-lg">
          <div className="w-12 h-8 bg-white/10 rounded" />
          <div className="w-12 h-12 rounded-full bg-white/10" />
          <div className="flex-grow h-6 bg-white/10 rounded" />
          <div className="w-24 h-6 bg-white/10 rounded" />
        </div>
      ))}
    </div>
  );
}

export function TournamentSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="p-6 bg-white/5 rounded-xl">
          <div className="h-6 w-48 bg-white/10 rounded mb-4" />
          <div className="grid grid-cols-2 gap-4">
            <div className="h-16 bg-white/10 rounded" />
            <div className="h-16 bg-white/10 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
