"use client";

import { useActionState, useState } from "react";
import { MAX_CATEGORY_DESCRIPTION_LENGTH } from "@/domain/catalog/permissions";
import { Button } from "../ui/button";
import { Field, inputClass } from "../ui/field";
import { Alert } from "../ui/plate";
import { saveCategoryAction } from "./actions";

/** Creating a category, or editing one's name and description. */
export function CategoryForm({ category }: { category?: { id: string; name: string; description: string } }) {
  const [state, action, pending] = useActionState(saveCategoryAction, { error: null });
  const [description, setDescription] = useState(category?.description ?? "");

  return (
    <form action={action} className="flex flex-col gap-5">
      {category && <input type="hidden" name="categoryId" value={category.id} />}
      <Field label="Name">
        <input name="name" required maxLength={80} autoComplete="off" defaultValue={category?.name} className={`${inputClass} text-lg`} />
      </Field>
      <Field
        label="Description"
        hint={
          <span className="block text-right text-xs">
            {description.length}/{MAX_CATEGORY_DESCRIPTION_LENGTH}
          </span>
        }
      >
        <textarea
          name="description"
          rows={3}
          maxLength={MAX_CATEGORY_DESCRIPTION_LENGTH}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={inputClass}
        />
      </Field>
      {state.error && <Alert>{state.error}</Alert>}
      <Button size="lg" disabled={pending}>
        {pending ? "Saving…" : category ? "Save changes" : "Create category"}
      </Button>
    </form>
  );
}
