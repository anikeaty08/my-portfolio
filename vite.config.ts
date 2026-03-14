import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Use IPv4 explicitly to avoid IPv6 ::1 connection issues on some Windows setups.
      "/api": "http://127.0.0.1:5174",
    },
  },
});
