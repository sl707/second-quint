"use client";

/* eslint-disable @next/next/no-img-element -- small thumbnails in search results */

import { useEffect, useState, useTransition } from "react";
import type { SimilarContestant } from "@/server/catalog";
import { Button } from "../../ui/button";
import { Field, inputClass } from "../../ui/field";
import { Alert } from "../../ui/plate";
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
      <Field label="Find a contestant">
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" placeholder="Name" className={inputClass} />
      </Field>
      {results.length > 0 && (
        <ul aria-label="Search results" className="flex flex-col gap-1">
          {results.map((c) => (
            <li key={c.id} className="flex items-center gap-3 border-l-4 border-edge bg-raised px-2 py-1.5">
              <img src={c.picture128Url} alt="" width={32} height={32} className="size-8 -skew-x-6 object-cover" />
              <span className="min-w-0 flex-1 font-semibold">{c.name}</span>
              {members.has(c.id) ? (
                <span className="text-[13px] text-muted">Already in</span>
              ) : (
                <Button type="button" size="sm" disabled={pending} onClick={() => add(c.id)} aria-label={`Add ${c.name}`}>
                  Add
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {error && <Alert>{error}</Alert>}
    </div>
  );
}
