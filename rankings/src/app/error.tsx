"use client";

import { Button, ButtonLink } from "./ui/button";
import { Screen } from "./ui/screen";

export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <Screen code="Oops" title="Something went wrong">
      <p className="text-zinc-100">That didn&apos;t work. Try again, or go back to the start.</p>
      {error.digest && <p className="text-xs text-muted">Error {error.digest}</p>}
      <div className="flex flex-wrap justify-center gap-3">
        <Button type="button" onClick={() => retry()}>
          Try again
        </Button>
        <ButtonLink href="/" variant="secondary">
          Back to the start
        </ButtonLink>
      </div>
    </Screen>
  );
}
