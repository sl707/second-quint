import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { createVisitorClient } from "@/lib/supabase/server";
import { ensureVisitor, readVisitor } from "@/lib/visitor";
import type { Person, SignedInPlayer } from "@/server/game";
import { findPlayerByUser, type Player } from "@/server/profiles";

export type Session =
  | { status: "signed-out" }
  /** Signed in with Google but hasn't chosen a display name yet, so not a player. */
  | { status: "needs-display-name"; userId: string }
  | { status: "player"; userId: string; player: Player };

/** Who is signed in on this request, if anyone. */
export const getSession = cache(async (): Promise<Session> => {
  const { data } = await (await createVisitorClient()).auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) return { status: "signed-out" };
  const player = await findPlayerByUser(createAdminClient(), userId);
  return player ? { status: "player", userId, player } : { status: "needs-display-name", userId };
});

/** The signed-in player, or null for visitors and anyone who hasn't chosen a display name yet. */
export async function readSignedInPlayer(): Promise<SignedInPlayer | null> {
  const session = await getSession();
  return session.status === "player" ? { playerId: session.player.id } : null;
}

/** The player if signed in, else the signed-out visitor from their cookie, or null if neither has played. */
export async function readPerson(): Promise<Person | null> {
  const session = await getSession();
  if (session.status === "player") return { playerId: session.player.id };
  if (session.status === "needs-display-name") return null;
  return readVisitor();
}

/**
 * Like readPerson, but gives a signed-out browser a visitor ID if it has none, and sends someone
 * signed in without a display name to choose one. Server Functions only.
 */
export async function ensurePerson(): Promise<Person> {
  const session = await getSession();
  if (session.status === "player") return { playerId: session.player.id };
  if (session.status === "needs-display-name") redirect("/welcome");
  return ensureVisitor();
}
