// Writes .env.local from the running local Supabase so the app and tests can reach it.
import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";

const raw = execSync("npx supabase status -o env", { encoding: "utf8" });
const env = Object.fromEntries(
  raw
    .split("\n")
    .map((line) => line.match(/^([A-Z_]+)="(.*)"$/))
    .filter(Boolean)
    .map(([, key, value]) => [key, value]),
);

const lines = [
  `NEXT_PUBLIC_SUPABASE_URL=${env.API_URL}`,
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${env.PUBLISHABLE_KEY}`,
  `SUPABASE_SECRET_KEY=${env.SECRET_KEY}`,
  `SUPABASE_DB_URL=${env.DB_URL}`,
  `RANKINGS_REFRESH_SECRET=${randomBytes(24).toString("hex")}`,
  // Cloudflare's Turnstile test keys: the widget always passes and siteverify accepts its dummy token.
  `NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA`,
  `TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA`,
];
writeFileSync(new URL("../.env.local", import.meta.url), lines.join("\n") + "\n");
console.log("Wrote .env.local for local Supabase");
