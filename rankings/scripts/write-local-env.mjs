// Writes .env.local from the running local Supabase so the app and tests can reach it.
import { execSync } from "node:child_process";
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
];
writeFileSync(new URL("../.env.local", import.meta.url), lines.join("\n") + "\n");
console.log("Wrote .env.local for local Supabase");
