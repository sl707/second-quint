"use client";

import { useActionState } from "react";
import { MAX_DISPLAY_NAME_LENGTH, MIN_DISPLAY_NAME_LENGTH } from "@/domain/profile/display-name";
import { chooseDisplayNameAction } from "./actions";

export function DisplayNameForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(chooseDisplayNameAction, { error: null });

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium uppercase tracking-wide text-zinc-500">Display name</span>
        <input
          name="displayName"
          required
          minLength={MIN_DISPLAY_NAME_LENGTH}
          maxLength={MAX_DISPLAY_NAME_LENGTH}
          pattern="[A-Za-z0-9_\-]+"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          className="rounded-xl border border-zinc-300 bg-white px-4 py-3 text-lg"
        />
        <span className="text-sm text-zinc-500">
          {MIN_DISPLAY_NAME_LENGTH} to {MAX_DISPLAY_NAME_LENGTH} letters, digits, underscores, or hyphens. Shown on your
          profile instead of your real name. You can&apos;t change it later.
        </span>
      </label>

      {state.error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-red-800">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-zinc-900 px-4 py-3 text-lg font-medium text-white disabled:opacity-50"
      >
        {pending ? "Saving…" : "Continue"}
      </button>
    </form>
  );
}
