export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: "/api/auth/login",
    PROFILE: "/api/auth/profile",
  },
  PRODUCTS: {
    LIST: "/api/products",
    DETAIL: (id) => `/api/products/${id}`,
    IMAGE: (id) => `/api/products/${id}/image`,
  },
  CUSTOMERS: {
    LIST: "/api/customers",
    DETAIL: (id) => `/api/customers/${id}`,
    POINTS_HISTORY: (id) => `/api/customers/${id}/points-history`,
    ADJUST_POINTS: (id) => `/api/customers/${id}/adjust-points`,
  },
  TRANSACTIONS: {
    LIST: "/api/transactions",
    CREATE: "/api/transactions",
    DETAIL: (id) => `/api/transactions/${id}`,
  },
  SETTINGS: {
    GET_PUT: "/api/settings",
  },
};
