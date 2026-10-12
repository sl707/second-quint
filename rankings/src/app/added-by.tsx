import Link from "next/link";
import type { Contributor } from "@/server/catalog";
import { inlineLinkClass } from "./ui/button";

/** "Added by …", linking to the contributor's profile. Sample catalog entries have no contributor. */
export function AddedBy({ by }: { by: Contributor }) {
  if (!by) return null;
  if (by === "deleted") return <p className="text-sm text-muted">Added by a deleted player</p>;
  return (
    <p className="text-sm text-muted">
      Added by{" "}
      <Link href={`/players/${encodeURIComponent(by.displayName)}`} className={inlineLinkClass}>
        {by.displayName}
      </Link>
    </p>
  );
}
