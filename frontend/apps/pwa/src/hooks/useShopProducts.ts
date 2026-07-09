import { useQuery } from '@tanstack/react-query';
import { fetchProducts } from '../lib/shopApi';
import type { ProductDto } from '../lib/shopApi';

export function useShopProducts() {
  return useQuery<ProductDto[]>({
    queryKey: ['shop', 'products'],
    queryFn: fetchProducts,
    staleTime: 60 * 1000, // 1 minute
    retry: 2,
  });
}
