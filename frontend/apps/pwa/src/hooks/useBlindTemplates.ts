import { apiClient } from '@stackbluff/shared/api/client';
import { useQuery } from '@tanstack/react-query';
import { logger } from '@/lib/logger';

export interface BlindLevel {
  level: number;
  small_blind: number;
  big_blind: number;
  ante: number;
  duration_seconds: number;
}

export interface BlindTemplate {
  id: string;
  name: string;
  description?: string;
  levels: BlindLevel[];
}

export function useBlindTemplates() {
  return useQuery<BlindTemplate[]>({
    queryKey: ['blind-templates'],
    queryFn: async () => {
      logger.info('Fetching blind templates');
      // If the endpoint is not available yet, we can return mock data
      // but we'll try to fetch from the backend
      try {
        const data = await apiClient<BlindTemplate[]>('/tournaments/blind-templates');
        return data;
      } catch (error) {
        logger.warn('Failed to fetch blind templates, using mock data', error);
        // Fallback mock data for development
        return [
          {
            id: 'standard',
            name: 'Standard (20 min levels)',
            description: 'Gradual blind increases every 20 minutes',
            levels: [
              { level: 1, small_blind: 10, big_blind: 20, ante: 0, duration_seconds: 1200 },
              { level: 2, small_blind: 20, big_blind: 40, ante: 0, duration_seconds: 1200 },
              { level: 3, small_blind: 40, big_blind: 80, ante: 0, duration_seconds: 1200 },
              { level: 4, small_blind: 80, big_blind: 160, ante: 0, duration_seconds: 1200 },
            ],
          },
          {
            id: 'turbo',
            name: 'Turbo (10 min levels)',
            description: 'Fast-paced blind increases every 10 minutes',
            levels: [
              { level: 1, small_blind: 10, big_blind: 20, ante: 0, duration_seconds: 600 },
              { level: 2, small_blind: 25, big_blind: 50, ante: 0, duration_seconds: 600 },
              { level: 3, small_blind: 50, big_blind: 100, ante: 0, duration_seconds: 600 },
              { level: 4, small_blind: 100, big_blind: 200, ante: 0, duration_seconds: 600 },
            ],
          },
          {
            id: 'deep-stack',
            name: 'Deep Stack (30 min levels)',
            description: 'Slow blind increases for deeper play',
            levels: [
              { level: 1, small_blind: 10, big_blind: 20, ante: 0, duration_seconds: 1800 },
              { level: 2, small_blind: 20, big_blind: 40, ante: 0, duration_seconds: 1800 },
              { level: 3, small_blind: 40, big_blind: 80, ante: 0, duration_seconds: 1800 },
              { level: 4, small_blind: 80, big_blind: 160, ante: 0, duration_seconds: 1800 },
            ],
          },
          {
            id: 'hyper-turbo',
            name: 'Hyper Turbo (5 min levels)',
            description: 'Extremely fast blinds, ideal for short games',
            levels: [
              { level: 1, small_blind: 10, big_blind: 20, ante: 0, duration_seconds: 300 },
              { level: 2, small_blind: 30, big_blind: 60, ante: 0, duration_seconds: 300 },
              { level: 3, small_blind: 60, big_blind: 120, ante: 0, duration_seconds: 300 },
              { level: 4, small_blind: 120, big_blind: 240, ante: 0, duration_seconds: 300 },
            ],
          },
        ];
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });
}
