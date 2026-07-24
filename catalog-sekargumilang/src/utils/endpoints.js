export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: "/api/auth/login",
    PROFILE: "/api/auth/me",
  },
  CATALOG: {
    CATEGORIES: "/api/catalog/categories",
    PRODUCTS: "/api/catalog/products",
    PRODUCT_DETAIL: (id) => `/api/catalog/products/${id}`,
    SOCIAL: "/api/catalog/social-media",
  },
  ADMIN: {
    CATEGORIES: "/api/catalog/admin/categories",
    SUBCATEGORIES: "/api/catalog/admin/subcategories",
    PRODUCTS: "/api/catalog/admin/products",
    SOCIAL: "/api/catalog/admin/social-media",
    UPLOAD_IMAGES: (id) => `/api/catalog/admin/products/${id}/images`,
    DELETE_IMAGE: (prodId, imgId) => `/api/catalog/admin/products/${prodId}/images/${imgId}`,
    REORDER_PRODUCTS: "/api/catalog/admin/products/reorder",
    REORDER_IMAGES: (id) => `/api/catalog/admin/products/${id}/images/reorder`,
  }
};
