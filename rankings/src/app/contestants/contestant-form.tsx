"use client";

/* eslint-disable @next/next/no-img-element -- previews are local blob: URLs */

import Link from "next/link";
import { useActionState, useEffect, useState, useTransition, type FormEvent } from "react";
import { ACCEPTED_PICTURE_TYPES } from "@/domain/picture/picture";
import { PictureError, resizePicture, type ResizedPictureBlobs } from "@/lib/picture/resize";
import type { SimilarContestant } from "@/server/catalog";
import { Button, inlineLinkClass } from "../ui/button";
import { Field, inputClass } from "../ui/field";
import { eyebrowClass } from "../ui/frame";
import { Alert, plateClass } from "../ui/plate";
import { copyPictureFromLinkAction, findSimilarContestantsAction, saveContestantAction } from "./actions";

type Mode =
  | { kind: "add"; categoryId: string | null }
  | { kind: "edit"; contestant: { id: string; name: string; picture512Url: string } };

/**
 * Adding a contestant, or editing one: a name and a picture, uploaded or copied from a link, shrunk
 * in the browser before upload.
 */
export function ContestantForm({ mode }: { mode: Mode }) {
  const [state, formAction, saving] = useActionState(saveContestantAction, { error: null });
  const [, startTransition] = useTransition();
  const [name, setName] = useState(mode.kind === "edit" ? mode.contestant.name : "");
  const [picture, setPicture] = useState<ResizedPictureBlobs | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pictureError, setPictureError] = useState<string | null>(null);
  const [resizing, setResizing] = useState(false);
  const [link, setLink] = useState("");
  const [copying, setCopying] = useState(false);
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

  async function choosePicture(file: Blob | undefined) {
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

  async function copyFromLink() {
    if (!link.trim()) {
      setPictureError("Paste a link to a picture.");
      return;
    }
    setPictureError(null);
    setCopying(true);
    try {
      const copied = await copyPictureFromLinkAction(link);
      if (copied.ok) await choosePicture(new Blob([copied.bytes as Uint8Array<ArrayBuffer>], { type: copied.type }));
      else setPictureError(copied.error);
    } catch {
      setPictureError("That picture couldn't be copied. Try again, or upload it instead.");
    } finally {
      setCopying(false);
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
      <Field label="Name">
        <input
          name="name"
          required
          maxLength={80}
          autoComplete="off"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={`${inputClass} text-lg`}
        />
      </Field>

      {similar.length > 0 && (
        <section aria-label="Similar contestants" className={plateClass("warn", "flex flex-col gap-2 px-4 py-3")}>
          <p className="font-display text-lg tracking-wide text-orange-bright uppercase">Did you mean…?</p>
          <ul className="flex flex-col gap-1.5">
            {similar.map((c) => (
              <li key={c.id}>
                <Link href={`/contestants/${c.id}`} className={`flex items-center gap-2 ${inlineLinkClass}`}>
                  <img src={c.picture128Url} alt="" width={32} height={32} className="size-8 -skew-x-6 object-cover" />
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Field label="Picture" hint={<>JPG, PNG, WebP, or GIF up to 5 MB. It&apos;s cropped to a square; GIFs keep only their first frame.</>}>
        <input
          type="file"
          name="picture"
          accept={ACCEPTED_PICTURE_TYPES.join(",")}
          onChange={(e) => choosePicture(e.target.files?.[0])}
          className="w-full border-2 border-dashed border-edge bg-plate px-4 py-3 text-sm text-zinc-100 file:mr-3 file:-skew-x-12 file:border-0 file:bg-pink file:px-3 file:py-1.5 file:font-display file:tracking-wider file:text-black file:uppercase"
        />
      </Field>

      <div className="flex flex-col gap-2">
        <label htmlFor="picture-link" className={eyebrowClass}>
          Or paste an image link
        </label>
        <div className="flex gap-2">
          <input
            id="picture-link"
            type="url"
            inputMode="url"
            autoComplete="off"
            placeholder="https://…"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                copyFromLink();
              }
            }}
            className={`${inputClass} flex-1 text-sm`}
          />
          <Button type="button" variant="secondary" size="sm" onClick={copyFromLink} disabled={copying || resizing} className="shrink-0">
            {copying ? "Copying…" : "Copy picture"}
          </Button>
        </div>
        <span className="text-sm text-muted">Up to 4 MB. The picture is copied once; the link isn&apos;t kept.</span>
      </div>

      {resizing && <p className="text-sm text-muted">Shrinking picture…</p>}
      {shown && (
        <img
          src={shown}
          alt={preview ? "Picture preview" : "Current picture"}
          width={512}
          height={512}
          className="size-40 -skew-x-6 border-4 border-white object-cover shadow-[6px_6px_0_var(--color-pink)]"
        />
      )}

      {(pictureError ?? state.error) && <Alert>{pictureError ?? state.error}</Alert>}

      <Button size="lg" disabled={saving || resizing || copying}>
        {saving ? "Saving…" : mode.kind === "add" ? "Add contestant" : "Save changes"}
      </Button>
    </form>
  );
}
