import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export interface Product {
  id: string;
  name: string;
  description: string;
  priceEur: number;
  priceStars: number;
  type: 'chips' | 'season_pass' | 'club_pro';
  chipsAmount?: number;
  durationDays?: number;
}

export interface Toast {
  message: string;
  type: 'success' | 'error';
}

interface ShopState {
  products: Product[];
  isLoading: boolean;
  error: string | null;
  selectedProduct: Product | null;
  isDialogOpen: boolean;
  isPurchasing: boolean;
  toast: Toast | null;
  setProducts: (products: Product[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  selectProduct: (product: Product | null) => void;
  setDialogOpen: (open: boolean) => void;
  setPurchasing: (purchasing: boolean) => void;
  setToast: (toast: Toast | null) => void;
}

export const useShopStore = create<ShopState>()(
  devtools(
    (set) => ({
      products: [],
      isLoading: false,
      error: null,
      selectedProduct: null,
      isDialogOpen: false,
      isPurchasing: false,
      toast: null,
      setProducts: (products) => set({ products }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
      selectProduct: (selectedProduct) => set({ selectedProduct }),
      setDialogOpen: (isDialogOpen) => set({ isDialogOpen }),
      setPurchasing: (isPurchasing) => set({ isPurchasing }),
      setToast: (toast) => set({ toast }),
    }),
    { name: 'shop-store' }
  )
);
