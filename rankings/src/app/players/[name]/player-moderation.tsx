"use client";

import { useActionState } from "react";
import { MAX_DISPLAY_NAME_LENGTH, MIN_DISPLAY_NAME_LENGTH } from "@/domain/profile/display-name";
import type { BanStatus } from "@/server/admin";
import { banPlayerAction, renamePlayerAction, unbanPlayerAction } from "../../admin/actions";

/** The admin's controls on a profile: rename the player, and ban or unban them. */
export function PlayerModeration({ playerId, displayName, status }: { playerId: string; displayName: string; status: BanStatus }) {
  const [state, rename, pending] = useActionState(renamePlayerAction.bind(null, playerId), { error: null });

  return (
    <section aria-label="Moderate player" className="flex flex-col gap-3 rounded-xl border border-red-200 bg-white px-4 py-3">
      <form action={rename} className="flex flex-col gap-2">
        <label className="flex flex-col gap-1 text-sm text-zinc-700">
          <span>Display name</span>
          <input
            name="displayName"
            required
            defaultValue={displayName}
            minLength={MIN_DISPLAY_NAME_LENGTH}
            maxLength={MAX_DISPLAY_NAME_LENGTH}
            autoComplete="off"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900"
          />
        </label>
        {state.error && (
          <p role="alert" className="text-sm text-red-800">
            {state.error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="self-start rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 disabled:opacity-50"
        >
          Rename
        </button>
      </form>

      {status.banned ? (
        <form action={unbanPlayerAction.bind(null, playerId)} className="flex flex-col gap-2 border-t border-zinc-200 pt-3">
          <p className="text-sm text-red-800">
            {displayName} is banned{status.matchesRemoved ? " and their matches are removed from rankings" : ""}.
          </p>
          <button type="submit" className="self-start rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800">
            Unban {displayName}
          </button>
        </form>
      ) : (
        <form action={banPlayerAction.bind(null, playerId)} className="flex flex-col gap-2 border-t border-zinc-200 pt-3">
          <p className="text-sm text-zinc-600">A banned player can&apos;t play, add to the catalog, or report.</p>
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input type="checkbox" name="removeMatches" />
            Also remove their matches from all rankings
          </label>
          <button type="submit" className="self-start rounded-lg bg-red-700 px-3 py-1.5 text-sm font-medium text-white">
            Ban {displayName}
          </button>
        </form>
      )}
    </section>
  );
}
