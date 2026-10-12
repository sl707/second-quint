"use client";

/* eslint-disable @next/next/no-img-element -- previews are local blob: URLs */

import Link from "next/link";
import { useActionState, useEffect, useState, useTransition, type FormEvent } from "react";
import { ACCEPTED_PICTURE_TYPES } from "@/domain/picture/picture";
import { PictureError, resizePicture, type ResizedPictureBlobs } from "@/lib/picture/resize";
import type { SimilarContestant } from "@/server/catalog";
import { findSimilarContestantsAction, saveContestantAction } from "./actions";

type Mode =
  | { kind: "add"; categoryId: string | null }
  | { kind: "edit"; contestant: { id: string; name: string; picture512Url: string } };

const fieldLabel = "text-sm font-medium uppercase tracking-wide text-zinc-500";

/** Adding a contestant, or editing one: a name and a picture shrunk in the browser before upload. */
export function ContestantForm({ mode }: { mode: Mode }) {
  const [state, formAction, saving] = useActionState(saveContestantAction, { error: null });
  const [, startTransition] = useTransition();
  const [name, setName] = useState(mode.kind === "edit" ? mode.contestant.name : "");
  const [picture, setPicture] = useState<ResizedPictureBlobs | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pictureError, setPictureError] = useState<string | null>(null);
  const [resizing, setResizing] = useState(false);
  const [similar, setSimilar] = useState<SimilarContestant[]>([]);

  useEffect(() => {
    if (mode.kind !== "add") return;
    let current = true;
    const timer = setTimeout(async () => {
      const found = name.trim() ? await findSimilarContestantsAction(name) : [];
      if (current) setSimilar(found);
    }, 300);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [name, mode.kind]);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  async function choosePicture(file: File | undefined) {
    setPictureError(null);
    setPicture(null);
    setPreview(null);
    if (!file) return;
    setResizing(true);
    try {
      const resized = await resizePicture(file);
      setPicture(resized);
      setPreview(URL.createObjectURL(resized.picture512));
    } catch (error) {
      setPictureError(error instanceof PictureError ? error.message : "That picture couldn't be used.");
    } finally {
      setResizing(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mode.kind === "add" && !picture) {
      setPictureError("Choose a picture.");
      return;
    }
    const data = new FormData();
    data.set("name", name);
    if (mode.kind === "edit") data.set("contestantId", mode.contestant.id);
    if (mode.kind === "add" && mode.categoryId) data.set("categoryId", mode.categoryId);
    if (picture) {
      const ext = picture.picture512.type === "image/webp" ? "webp" : "jpg";
      data.set("picture512", picture.picture512, `picture-512.${ext}`);
      data.set("picture128", picture.picture128, `picture-128.${ext}`);
    }
    startTransition(() => formAction(data));
  }

  const shown = preview ?? (mode.kind === "edit" ? mode.contestant.picture512Url : null);

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <label className="flex flex-col gap-2">
        <span className={fieldLabel}>Name</span>
        <input
          name="name"
          required
          maxLength={80}
          autoComplete="off"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-xl border border-zinc-300 bg-white px-4 py-3 text-lg"
        />
      </label>

      {similar.length > 0 && (
        <section aria-label="Similar contestants" className="flex flex-col gap-2 rounded-xl bg-amber-50 px-4 py-3">
          <p className="font-medium text-amber-900">Did you mean…?</p>
          <ul className="flex flex-col gap-1">
            {similar.map((c) => (
              <li key={c.id}>
                <Link href={`/contestants/${c.id}`} className="flex items-center gap-2 text-amber-900 underline">
                  <img src={c.picture128Url} alt="" width={32} height={32} className="size-8 rounded object-cover" />
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <label className="flex flex-col gap-2">
        <span className={fieldLabel}>Picture</span>
        <input
          type="file"
          name="picture"
          accept={ACCEPTED_PICTURE_TYPES.join(",")}
          onChange={(e) => choosePicture(e.target.files?.[0])}
          className="rounded-xl border border-dashed border-zinc-300 bg-white px-4 py-3 text-sm"
        />
        <span className="text-sm text-zinc-500">
          JPG, PNG, WebP, or GIF up to 5 MB. It&apos;s cropped to a square; GIFs keep only their first frame.
        </span>
      </label>

      {resizing && <p className="text-sm text-zinc-600">Shrinking picture…</p>}
      {shown && (
        <img
          src={shown}
          alt={preview ? "Picture preview" : "Current picture"}
          width={512}
          height={512}
          className="size-40 rounded-xl object-cover"
        />
      )}

      {(pictureError ?? state.error) && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-red-800">
          {pictureError ?? state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={saving || resizing}
        className="rounded-xl bg-zinc-900 px-4 py-3 text-lg font-medium text-white disabled:opacity-50"
      >
        {saving ? "Saving…" : mode.kind === "add" ? "Add contestant" : "Save changes"}
      </button>
    </form>
  );
}
