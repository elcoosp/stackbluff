// Generate a slug from the product name for image filenames.
// Expect images in /images/products/<slug>.png
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function getProductImageUrl(productId: string, productName: string): string {
  const slug = slugify(productName);
  return `/images/products/${slug}.png`;
}
