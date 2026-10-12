import Link from "next/link";
import type { Contributor } from "@/server/catalog";

/** "Added by …", linking to the contributor's profile. Sample catalog entries have no contributor. */
export function AddedBy({ by }: { by: Contributor }) {
  if (!by) return null;
  return (
    <p className="text-sm text-zinc-600">
      Added by{" "}
      <Link href={`/players/${encodeURIComponent(by.displayName)}`} className="font-medium text-zinc-900 underline">
        {by.displayName}
      </Link>
    </p>
  );
}
