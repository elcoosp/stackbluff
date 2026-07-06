import { useQuery } from '@tanstack/react-query';
import { fetchProducts } from '../lib/shopApi';

export function useShopProducts() {
  return useQuery({
    queryKey: ['shop-products'],
    queryFn: fetchProducts,
    staleTime: 1000 * 60 * 5,
  });
}
