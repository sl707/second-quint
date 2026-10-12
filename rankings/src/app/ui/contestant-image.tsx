import Image from "next/image";
import type { ReactNode } from "react";

const thumbSizes = {
  xs: "size-6",
  sm: "size-8",
  md: "size-12",
  lg: "size-14",
};

/** A contestant's small square picture, slightly slanted. Decorative: the name is always shown next to it. */
export function ContestantThumb({
  src,
  size = "md",
  framed = false,
  dimmed = false,
}: {
  src: string;
  size?: keyof typeof thumbSizes;
  framed?: boolean;
  dimmed?: boolean;
}) {
  return (
    <Image
      src={src}
      alt=""
      width={128}
      height={128}
      className={`shrink-0 -skew-x-6 object-cover ${thumbSizes[size]} ${framed ? "border-2 border-white" : ""} ${dimmed ? "opacity-40" : ""}`}
    />
  );
}

/**
 * A contestant's large picture with a scrim fading into a solid plate, where the caption sits; text
 * never sits on the picture itself.
 */
export function ContestantPortrait({
  src,
  alt,
  priority = false,
  caption,
  className = "",
}: {
  src: string;
  alt: string;
  priority?: boolean;
  caption?: ReactNode;
  className?: string;
}) {
  return (
    <figure className={`relative flex flex-col overflow-hidden border-2 border-edge bg-black ${className}`}>
      <div className="relative aspect-square w-full">
        <Image src={src} alt={alt} fill priority={priority} sizes="(min-width: 768px) 24rem, 100vw" className="object-cover" />
        <div aria-hidden className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-pink to-orange" />
        {caption && <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black to-transparent" />}
      </div>
      {caption && <figcaption className="bg-black px-4 pt-1 pb-4">{caption}</figcaption>}
    </figure>
  );
}
