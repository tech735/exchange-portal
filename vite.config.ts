import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  // Dev/preview servers listen on this machine only, not the whole network.
  server: {
    host: "localhost",
    port: 8080,
  },
  preview: {
    port: 8080,
    host: "localhost",
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Libraries change far less often than app code: keep them in their own
        // files so browsers reuse the cached copy after each deploy.
        manualChunks: {
          // React Query calls React.createContext at load, so it must share React's chunk
          // (in a separate chunk it can evaluate before React and crash the app).
          react: ["react", "react-dom", "react-router-dom", "@tanstack/react-query"],
          supabase: ["@supabase/supabase-js"],
          ui: ["@radix-ui/react-dialog", "@radix-ui/react-dropdown-menu", "@radix-ui/react-select", "@radix-ui/react-popover", "@radix-ui/react-tooltip", "@radix-ui/react-checkbox", "cmdk"],
          dates: ["date-fns"],
          charts: ["recharts"],
        },
      },
    },
  },
});
