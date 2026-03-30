import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const devApiTarget = env.VITE_DEV_API_TARGET || "http://localhost:8000";
  const devWsTarget = env.VITE_DEV_WS_TARGET || "ws://localhost:8000";

  return {
    plugins: [react()],

    server: {
      proxy: {
        "/api": {
          target: devApiTarget,
          changeOrigin: true,
        },

        // WebSocket proxy
        "/ws": {
          target: devWsTarget,
          ws: true,
          changeOrigin: true,
        },
      },
    },
  };
});
