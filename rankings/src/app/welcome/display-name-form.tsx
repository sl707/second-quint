"use client";

import { useActionState } from "react";
import { MAX_DISPLAY_NAME_LENGTH, MIN_DISPLAY_NAME_LENGTH } from "@/domain/profile/display-name";
import { Button } from "../ui/button";
import { Field, inputClass } from "../ui/field";
import { Alert } from "../ui/plate";
import { chooseDisplayNameAction } from "./actions";

export function DisplayNameForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(chooseDisplayNameAction, { error: null });

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="next" value={next} />
      <Field
        label="Display name"
        hint={
          <>
            {MIN_DISPLAY_NAME_LENGTH} to {MAX_DISPLAY_NAME_LENGTH} letters, digits, spaces, underscores, or hyphens. Shown on
            your profile instead of your real name. You can&apos;t change it later.
          </>
        }
      >
        <input
          name="displayName"
          required
          minLength={MIN_DISPLAY_NAME_LENGTH}
          maxLength={MAX_DISPLAY_NAME_LENGTH}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          className={`${inputClass} text-lg`}
        />
      </Field>

      {state.error && <Alert>{state.error}</Alert>}

      <Button size="lg" disabled={pending}>
        {pending ? "Saving…" : "Continue"}
      </Button>
    </form>
  );
}
