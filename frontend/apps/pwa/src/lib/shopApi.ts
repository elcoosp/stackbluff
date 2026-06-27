import { apiClient } from '@stackbluff/shared/api/client';

export interface ProductDto {
  id: string;
  name: string;
  price_eur: number;
  price_stars: number;
  type: 'chips' | 'season_pass' | 'club_pro';
  chips_amount?: number;
  duration_days?: number;
}

export interface ProductResponse {
  products: ProductDto[];
}

export interface CreateIntentRequest {
  product_id: string;
  provider: 'stripe' | 'telegram_stars';
}

export interface CreateIntentResponse {
  client_secret?: string;
  redirect_url?: string;
  invoice_link?: string;
  payment_id?: string;
}

export async function fetchProducts(): Promise<ProductResponse> {
  const res = await apiClient.get('/shop/products');
  if (!res.ok) throw new Error('Failed to fetch products');
  return res.json();
}

export async function createPaymentIntent(req: CreateIntentRequest): Promise<CreateIntentResponse> {
  const res = await apiClient.post('/payments/create-intent', req);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Payment intent creation failed');
  }
  return res.json();
}

export async function fetchUserMe(): Promise<{
  balance: number;
  season_pass_expires_at: string | null;
  club_pro_expires_at: string | null;
  is_club_owner: boolean;
}> {
  const res = await apiClient.get('/user/me');
  if (!res.ok) throw new Error('Failed to fetch user profile');
  return res.json();
}
