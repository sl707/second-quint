import type { ComponentProps, ReactNode } from "react";
import { eyebrowClass } from "./frame";

export const inputClass =
  "w-full min-w-0 border-2 border-edge bg-raised px-4 py-3 text-base text-white placeholder:text-zinc-400 focus:border-pink focus:outline-none";

/** A labelled form control with an optional hint under it. */
export function Field({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-2">
      <span className={eyebrowClass}>{label}</span>
      {children}
      {hint && <span className="text-sm text-muted">{hint}</span>}
    </label>
  );
}

/** A checkbox with its label on a plate row. */
export function CheckboxRow({ children, ...props }: ComponentProps<"input"> & { children: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 border-2 border-edge bg-plate px-4 py-3 has-checked:border-pink">
      <input type="checkbox" className="size-5 shrink-0 accent-pink" {...props} />
      <span>{children}</span>
    </label>
  );
}

/** The look of a selectable option card (radio or checkbox inside a label). */
export const optionClass =
  "flex cursor-pointer items-center gap-3 border-2 border-edge bg-plate px-4 py-3 has-checked:border-pink has-checked:bg-raised has-checked:shadow-[4px_4px_0_var(--color-pink)]";
