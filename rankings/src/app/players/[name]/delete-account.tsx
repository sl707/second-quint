"use client";

import { useActionState } from "react";
import { deleteAccountAction } from "../../auth/actions";
import { Button } from "../../ui/button";
import { inputClass } from "../../ui/field";
import { Alert, Disclosure } from "../../ui/plate";

/** On the player's own profile: delete their account, confirmed by typing their display name. */
export function DeleteAccount({ displayName }: { displayName: string }) {
  const [state, action, pending] = useActionState(deleteAccountAction, { error: null });

  return (
    <Disclosure summary="Delete account" tone="danger">
      <form action={action} className="flex flex-col gap-3">
        <p className="text-sm text-zinc-100">
          Your profile, display name, tournaments, and personal rankings are deleted for good, and you&apos;re signed out. Your
          matches keep counting in global rankings, and contestants and categories you added stay, shown as added by a
          deleted player.
        </p>
        <label className="flex flex-col gap-2 text-sm text-zinc-100">
          <span>Type your display name to confirm</span>
          <input name="confirm" required autoComplete="off" placeholder={displayName} className={inputClass} />
        </label>
        <Alert>{state.error}</Alert>
        <Button variant="danger" size="sm" disabled={pending} className="self-start">
          Delete my account
        </Button>
      </form>
    </Disclosure>
  );
}
