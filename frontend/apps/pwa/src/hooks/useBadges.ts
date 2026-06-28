import { useQuery } from "@tanstack/react-query";

export interface Badge {
  badge_type: string;
  awarded_at?: string;
}

export interface FoundingMemberProgress {
  completed: number;
  required: number;
}

export interface BadgesResponse {
  badges: Badge[];
  founding_member_progress?: FoundingMemberProgress;
}

async function fetchBadges(): Promise<BadgesResponse> {
  const res = await fetch("/api/users/me/badges", {
    credentials: "include",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "Unknown error");
    throw new Error(`Failed to fetch badges: ${res.status} ${body}`);
  }
  return res.json();
}

export function useBadges() {
  return useQuery<BadgesResponse, Error>({
    queryKey: ["badges", "me"],
    queryFn: fetchBadges,
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
}

export function useHasBadge(badgeType: string, badges?: Badge[]) {
  return badges?.some((b) => b.badge_type === badgeType) ?? false;
}
