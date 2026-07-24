const DEFAULT_PLACEHOLDER =
  "https://images.unsplash.com/photo-1525310072745-f49212b5ac6d?w=500&auto=format&fit=crop&q=60";

export function resolveCatalogImageUrl(path) {
  if (!path) return DEFAULT_PLACEHOLDER;
  const apiBase = import.meta.env.VITE_API_BASE_URL || "https://api-be.sekargumilangorchid.my.id";
  return path.startsWith("http") ? path : `${apiBase}${path}`;
}

export function getProductImages(product) {
  if (!product) return [];
  const list = [product.image_path, ...(product.images?.map((i) => i.image_path) || [])].filter(Boolean);
  return [...new Set(list)];
}

export function normalizeWaPhone(phone) {
  let digits = String(phone).replace(/\D/g, "");
  if (digits.startsWith("0")) digits = "62" + digits.slice(1);
  return digits;
}

export function getProductShareUrl(productId) {
  const origin = window.location.origin.replace(/\/$/, "");
  return `${origin}/product/${productId}`;
}
