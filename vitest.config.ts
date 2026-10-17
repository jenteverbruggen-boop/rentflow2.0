import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    // Agent worktrees live under .claude/worktrees/ and carry their own copy
    // of the suite. Without this they get collected into every root-level
    // run, and fail with ERR_MODULE_NOT_FOUND because the generated Prisma
    // client is gitignored and never generated in those checkouts.
    exclude: ["**/node_modules/**", "**/dist/**", ".claude/**", "qa/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
