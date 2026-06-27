import { useAuthStore } from '../../stores/authStore';

export function ClubCustomizer() {
  const clubProExpiresAt = useAuthStore((s) => s.clubProExpiresAt);
  const isClubProActive = clubProExpiresAt ? new Date(clubProExpiresAt) > new Date() : false;

  if (!isClubProActive) return null;

  return (
    <div className="mt-4 rounded-lg bg-indigo-900/30 p-4">
      <h4 className="mb-2 text-sm font-semibold text-indigo-300">Club Pro Customization</h4>
      <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
        Customise Club
      </button>
    </div>
  );
}
