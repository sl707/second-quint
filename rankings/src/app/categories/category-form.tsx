"use client";

import { useActionState, useState } from "react";
import { MAX_CATEGORY_DESCRIPTION_LENGTH } from "@/domain/catalog/permissions";
import { saveCategoryAction } from "./actions";

const fieldLabel = "text-sm font-medium uppercase tracking-wide text-zinc-500";

/** Creating a category, or editing one's name and description. */
export function CategoryForm({ category }: { category?: { id: string; name: string; description: string } }) {
  const [state, action, pending] = useActionState(saveCategoryAction, { error: null });
  const [description, setDescription] = useState(category?.description ?? "");

  return (
    <form action={action} className="flex flex-col gap-5">
      {category && <input type="hidden" name="categoryId" value={category.id} />}
      <label className="flex flex-col gap-2">
        <span className={fieldLabel}>Name</span>
        <input
          name="name"
          required
          maxLength={80}
          autoComplete="off"
          defaultValue={category?.name}
          className="rounded-xl border border-zinc-300 bg-white px-4 py-3 text-lg"
        />
      </label>
      <label className="flex flex-col gap-2">
        <span className={fieldLabel}>Description</span>
        <textarea
          name="description"
          rows={3}
          maxLength={MAX_CATEGORY_DESCRIPTION_LENGTH}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="rounded-xl border border-zinc-300 bg-white px-4 py-3"
        />
        <span className="text-right text-xs text-zinc-500">
          {description.length}/{MAX_CATEGORY_DESCRIPTION_LENGTH}
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
        {pending ? "Saving…" : category ? "Save changes" : "Create category"}
      </button>
    </form>
  );
}
