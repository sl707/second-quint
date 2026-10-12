"use client";

import { useActionState } from "react";
import { MAX_DISPLAY_NAME_LENGTH, MIN_DISPLAY_NAME_LENGTH } from "@/domain/profile/display-name";
import type { BanStatus } from "@/server/admin";
import { banPlayerAction, renamePlayerAction, unbanPlayerAction } from "../../admin/actions";
import { Button } from "../../ui/button";
import { Field, inputClass } from "../../ui/field";
import { SectionTitle } from "../../ui/frame";
import { Alert, plateClass } from "../../ui/plate";

/** The admin's controls on a profile: rename the player, and ban or unban them. */
export function PlayerModeration({ playerId, displayName, status }: { playerId: string; displayName: string; status: BanStatus }) {
  const [state, rename, pending] = useActionState(renamePlayerAction.bind(null, playerId), { error: null });

  return (
    <section aria-label="Moderate player" className={plateClass("danger", "flex flex-col gap-4 p-4")}>
      <SectionTitle as="h2">Admin</SectionTitle>
      <form action={rename} className="flex flex-col gap-3">
        <Field label="Display name">
          <input
            name="displayName"
            required
            defaultValue={displayName}
            minLength={MIN_DISPLAY_NAME_LENGTH}
            maxLength={MAX_DISPLAY_NAME_LENGTH}
            autoComplete="off"
            className={inputClass}
          />
        </Field>
        {state.error && <Alert>{state.error}</Alert>}
        <Button variant="secondary" size="sm" disabled={pending} className="self-start">
          Rename
        </Button>
      </form>

      {status.banned ? (
        <form action={unbanPlayerAction.bind(null, playerId)} className="flex flex-col gap-3 border-t-2 border-edge pt-4">
          <p className="text-sm font-semibold text-danger">
            {displayName} is banned{status.matchesRemoved ? " and their matches are removed from rankings" : ""}.
          </p>
          <Button variant="secondary" size="sm" className="self-start">
            Unban {displayName}
          </Button>
        </form>
      ) : (
        <form action={banPlayerAction.bind(null, playerId)} className="flex flex-col gap-3 border-t-2 border-edge pt-4">
          <p className="text-sm text-zinc-100">A banned player can&apos;t play, add to the catalog, or report.</p>
          <label className="flex items-center gap-3 text-sm text-zinc-100">
            <input type="checkbox" name="removeMatches" className="size-5 accent-pink" />
            Also remove their matches from all rankings
          </label>
          <Button variant="danger" size="sm" className="self-start">
            Ban {displayName}
          </Button>
        </form>
      )}
    </section>
  );
}
