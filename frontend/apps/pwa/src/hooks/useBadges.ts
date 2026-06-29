import { useQuery } from "@tanstack/react-query";

export interface Badge {
  badge_type: string;
  awarded_at: string;
}

export function useBadges() {
  return useQuery<Badge[]>({
    queryKey: ["badges"],
    queryFn: async () => {
      const res = await fetch("/api/users/me/badges", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch badges");
      const data = await res.json();
      return data.badges;
    },
  });
}

export function useUserBadges(userId: string) {
  return useQuery<Badge[]>({
    queryKey: ["badges", userId],
    queryFn: async () => {
      const res = await fetch(`/api/users/${userId}/badges`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch user badges");
      const data = await res.json();
      return data.badges;
    },
  });
}
