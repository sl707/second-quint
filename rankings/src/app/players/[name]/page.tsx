import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/server/profiles";

const loadProfile = cache((name: string) => getProfile(createAdminClient(), decodeURIComponent(name)));

export async function generateMetadata({ params }: PageProps<"/players/[name]">): Promise<Metadata> {
  const player = await loadProfile((await params).name);
  return { title: player?.displayName ?? "Player not found" };
}

export default async function ProfilePage({ params }: PageProps<"/players/[name]">) {
  const player = await loadProfile((await params).name);
  if (!player) notFound();

  const joined = new Date(player.createdAt).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "America/New_York",
  });

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-2 px-5 py-8">
      <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">Player</p>
      <h1 className="text-3xl font-semibold tracking-tight">{player.displayName}</h1>
      <p className="text-zinc-600">Joined {joined}</p>
    </main>
  );
}
