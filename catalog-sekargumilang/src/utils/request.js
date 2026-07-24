import { api } from "./api";

export const request = {
  get: async (url, config = {}) => {
    const response = await api.get(url, config);
    return response.data;
  },
  post: async (url, data, config = {}) => {
    const response = await api.post(url, data, config);
    return response.data;
  },
  put: async (url, data, config = {}) => {
    const response = await api.put(url, data, config);
    return response.data;
  },
  delete: async (url, config = {}) => {
    const response = await api.delete(url, config);
    return response.data;
  },
};
