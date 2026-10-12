"use client";

/* eslint-disable @next/next/no-img-element -- small thumbnails in search results */

import { useEffect, useState, useTransition } from "react";
import type { SimilarContestant } from "@/server/catalog";
import { addToCategoryAction, searchContestantsAction } from "../actions";

/** Search the catalog and add existing contestants to a category. */
export function AddContestants({ categoryId, memberIds }: { categoryId: string; memberIds: string[] }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SimilarContestant[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const members = new Set(memberIds);

  useEffect(() => {
    let current = true;
    const timer = setTimeout(async () => {
      const found = query.trim() ? await searchContestantsAction(query) : [];
      if (current) setResults(found);
    }, 300);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [query]);

  function add(contestantId: string) {
    startTransition(async () => {
      setError((await addToCategoryAction(categoryId, contestantId)).error);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium uppercase tracking-wide text-zinc-500">Find a contestant</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
          placeholder="Name"
          className="rounded-xl border border-zinc-300 bg-white px-4 py-3"
        />
      </label>
      {results.length > 0 && (
        <ul aria-label="Search results" className="flex flex-col gap-1">
          {results.map((c) => (
            <li key={c.id} className="flex items-center gap-2 rounded-lg bg-white px-2 py-1.5">
              <img src={c.picture128Url} alt="" width={32} height={32} className="size-8 rounded object-cover" />
              <span className="flex-1">{c.name}</span>
              {members.has(c.id) ? (
                <span className="text-sm text-zinc-500">Already in</span>
              ) : (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => add(c.id)}
                  aria-label={`Add ${c.name}`}
                  className="rounded-lg bg-zinc-900 px-3 py-1 text-sm font-medium text-white disabled:opacity-50"
                >
                  Add
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-red-800">
          {error}
        </p>
      )}
    </div>
  );
}
