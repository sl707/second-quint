import Link from "next/link";
import type { ComponentProps } from "react";

export type ButtonVariant = "primary" | "secondary" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-pink text-black shadow-[4px_4px_0_var(--color-orange)] hover:bg-pink-bright active:translate-x-1 active:translate-y-1 active:shadow-none",
  secondary: "border-2 border-edge bg-plate text-white hover:border-pink",
  danger: "bg-danger-deep text-white hover:bg-[#d01836]",
};

const sizes: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-base",
  md: "px-5 py-2.5 text-lg",
  lg: "px-6 py-4 text-2xl md:text-3xl",
};

/** The slanted arcade button look, for a `<button>` or a link; children go in an unslanted span. */
export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", className = "") {
  return `inline-flex items-center justify-center gap-2 -skew-x-12 font-display uppercase tracking-wider transition disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none ${variants[variant]} ${sizes[size]} ${className}`;
}

type Look = { variant?: ButtonVariant; size?: ButtonSize };

export function Button({ variant, size, className, children, type = "submit", ...props }: ComponentProps<"button"> & Look) {
  return (
    <button type={type} className={buttonClass(variant, size, className)} {...props}>
      <span className="inline-block skew-x-12">{children}</span>
    </button>
  );
}

export function ButtonLink({ variant, size, className, children, ...props }: ComponentProps<typeof Link> & Look) {
  return (
    <Link className={buttonClass(variant, size, className)} {...props}>
      <span className="inline-block skew-x-12">{children}</span>
    </Link>
  );
}

/** A plain text action: small, uppercase, underlined on hover. */
export const textActionClass =
  "text-sm font-semibold uppercase tracking-wider text-muted underline-offset-4 hover:text-orange-bright hover:underline";

/** An inline link inside running text. */
export const inlineLinkClass = "font-semibold text-orange-bright underline underline-offset-2 hover:text-white";
