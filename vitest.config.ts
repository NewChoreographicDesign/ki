import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      // Next's webpack build swaps this for a no-op when compiling server
      // code (it only throws in a client bundle); Vitest has no such
      // aliasing, so a lib file that imports "server-only" would otherwise
      // throw the moment a test imports it, even though the test itself
      // never runs in a browser.
      "server-only": path.resolve(__dirname, "./lib/__tests__/server-only-stub.ts"),
    },
  },
  test: {
    environment: "node",
  },
});
