import { useQuery } from "@tanstack/react-query";

export interface Badge {
  badge_type: string;
  awarded_at?: string;
}

export interface BadgesResponse {
  badges: Badge[];
  founding_member_progress?: {
    completed: number;
    required: number;
  };
}

async function fetchBadges(): Promise<BadgesResponse> {
  const res = await fetch("/api/users/me/badges", {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch badges");
  return res.json();
}

export function useBadges() {
  return useQuery<BadgesResponse>({
    queryKey: ["badges", "me"],
    queryFn: fetchBadges,
    staleTime: 5 * 60 * 1000,
  });
}

export function useHasBadge(badgeType: string, badges?: Badge[]) {
  return badges?.some((b) => b.badge_type === badgeType) ?? false;
}
