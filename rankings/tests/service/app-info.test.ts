import { describe, expect, it } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAppName } from "@/server/app-info";

describe("app info", () => {
  it("reads the app name from the database", async () => {
    expect(await getAppName(createAdminClient())).toBe("Second Quint Rankings");
  });
});
