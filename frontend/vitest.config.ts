import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config.ts";

// Tests run in a simulated browser (happy-dom) against mock data, so no backend is needed.
// Run: npm test   (watch mode: npm run test:watch)
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "happy-dom",
      setupFiles: ["./src/test/setup.ts"],
      include: ["src/**/*.test.{ts,tsx}"],
      css: false,
      // Always test against mock data, even if a developer's .env.local points at a live backend.
      env: { VITE_USE_MOCK: "true" },
    },
  }),
);
