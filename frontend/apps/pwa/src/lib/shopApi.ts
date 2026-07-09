import { z } from 'zod';

export const ProductDtoSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string(),
  price_eur: z.number().nonnegative(),
  price_stars: z.number().int().nonnegative(),
  product_type: z.enum(['chips', 'season_pass', 'club_pro']),
  chips_amount: z.number().int().nonnegative().optional(),
  duration_days: z.number().int().nonnegative().optional(),
});

export const ProductResponseSchema = z.array(ProductDtoSchema);

export async function fetchProducts(): Promise<ProductDto[]> {
  const res = await fetch('/api/shop/products');
  if (!res.ok) {
    const body = await res.text().catch(() => 'Unknown error');
    throw new Error(`Failed to fetch products: ${res.status} ${body}`);
  }
  const raw = await res.json();
  return ProductResponseSchema.parse(raw);
}

export type ProductDto = z.infer<typeof ProductDtoSchema>;

export const CreateIntentRequestSchema = z.object({
  product_id: z.string().min(1),
  provider: z.enum(['stripe', 'telegram_stars']),
});

export const CreateIntentResponseSchema = z.object({
  client_secret: z.string().optional(),
  checkout_url: z.string().url().optional(),
  redirect_url: z.string().url().optional(),
  invoice_link: z.string().url().optional(),
  payment_id: z.string().optional(),
});

export type CreateIntentRequest = z.infer<typeof CreateIntentRequestSchema>;
export type CreateIntentResponse = z.infer<typeof CreateIntentResponseSchema>;

export async function createPaymentIntent(req: CreateIntentRequest): Promise<CreateIntentResponse> {
  const validated = CreateIntentRequestSchema.parse(req);
  const res = await fetch('/payments/create-intent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(validated),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Payment intent creation failed: ${res.status}`);
  }
  const raw = await res.json();
  return CreateIntentResponseSchema.parse(raw);
}
