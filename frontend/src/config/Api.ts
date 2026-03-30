const fromEnv = import.meta.env.VITE_API_BASE_URL?.trim();

// Default to same-origin API path so nginx/docker deployments work out of the box.
export const API_BASE_URL = fromEnv || "/api";
