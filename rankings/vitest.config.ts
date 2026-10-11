import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { defineConfig } from "vitest/config";

config({ path: ".env.local" });

const alias = { "@": fileURLToPath(new URL("./src", import.meta.url)) };

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: { name: "unit", include: ["src/**/*.test.ts"], environment: "node" },
      },
      {
        resolve: { alias: { ...alias, "server-only": fileURLToPath(new URL("./tests/server-only-stub.ts", import.meta.url)) } },
        test: {
          name: "service",
          include: ["tests/service/**/*.test.ts"],
          environment: "node",
          fileParallelism: false,
        },
      },
    ],
  },
});
