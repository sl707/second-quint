"use client";

import { useActionState } from "react";
import { deleteAccountAction } from "../../auth/actions";

/** On the player's own profile: delete their account, confirmed by typing their display name. */
export function DeleteAccount({ displayName }: { displayName: string }) {
  const [state, action, pending] = useActionState(deleteAccountAction, { error: null });

  return (
    <details className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
      <summary className="cursor-pointer text-sm font-medium text-zinc-700">Delete account</summary>
      <form action={action} className="mt-3 flex flex-col gap-3">
        <p className="text-sm text-zinc-600">
          Your profile, display name, tournaments, and personal rankings are deleted for good, and you&apos;re signed out. Your
          matches keep counting in global rankings, and contestants and categories you added stay, shown as added by a
          deleted player.
        </p>
        <label className="flex flex-col gap-1 text-sm text-zinc-700">
          <span>Type your display name to confirm</span>
          <input
            name="confirm"
            required
            autoComplete="off"
            placeholder={displayName}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900"
          />
        </label>
        <p role="alert" className="text-sm text-red-800">
          {state.error}
        </p>
        <button
          type="submit"
          disabled={pending}
          className="self-start rounded-lg bg-red-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          Delete my account
        </button>
      </form>
    </details>
  );
}
