import { z } from 'zod';
import { apiClient } from '@stackbluff/shared/api/client';

export const ProductDtoSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  price_eur: z.number().nonnegative(),
  price_stars: z.number().int().nonnegative(),
  type: z.enum(['chips', 'season_pass', 'club_pro']),
  chips_amount: z.number().int().nonnegative().optional(),
  duration_days: z.number().int().nonnegative().optional(),
});

export const ProductResponseSchema = z.object({
  products: z.array(ProductDtoSchema),
});

export const CreateIntentRequestSchema = z.object({
  product_id: z.string().min(1),
  provider: z.enum(['stripe', 'telegram_stars']),
});

export const CreateIntentResponseSchema = z.object({
  client_secret: z.string().optional(),
  redirect_url: z.string().url().optional(),
  invoice_link: z.string().url().optional(),
  payment_id: z.string().optional(),
});

export const UserMeSchema = z.object({
  balance: z.number().nonnegative(),
  season_pass_expires_at: z.string().nullable(),
  club_pro_expires_at: z.string().nullable(),
  is_club_owner: z.boolean(),
});

export type ProductDto = z.infer<typeof ProductDtoSchema>;
export type ProductResponse = z.infer<typeof ProductResponseSchema>;
export type CreateIntentRequest = z.infer<typeof CreateIntentRequestSchema>;
export type CreateIntentResponse = z.infer<typeof CreateIntentResponseSchema>;
export type UserMe = z.infer<typeof UserMeSchema>;

export async function fetchProducts(): Promise<ProductResponse> {
  const res = await apiClient.get('/shop/products');
  if (!res.ok) {
    const body = await res.text().catch(() => 'Unknown error');
    throw new Error(`Failed to fetch products: ${res.status} ${body}`);
  }
  const raw = await res.json();
  return ProductResponseSchema.parse(raw);
}

export async function createPaymentIntent(req: CreateIntentRequest): Promise<CreateIntentResponse> {
  const validated = CreateIntentRequestSchema.parse(req);
  const res = await apiClient.post('/payments/create-intent', validated);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Payment intent creation failed: ${res.status}`);
  }
  const raw = await res.json();
  return CreateIntentResponseSchema.parse(raw);
}

export async function fetchUserMe(): Promise<UserMe> {
  const res = await apiClient.get('/user/me');
  if (!res.ok) {
    const body = await res.text().catch(() => 'Unknown error');
    throw new Error(`Failed to fetch user profile: ${res.status} ${body}`);
  }
  const raw = await res.json();
  return UserMeSchema.parse(raw);
}
