/** The "now loading" screen shown while a page streams in. */
export function LoadingScreen() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-5 py-16">
      <p role="status" className="font-display text-3xl tracking-wider uppercase italic">
        <span className="animate-neon">Now loading</span>
        <span aria-hidden className="text-orange-bright motion-safe:animate-pulse">
          …
        </span>
      </p>
      <div aria-hidden className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <span key={i} className="size-3 -skew-x-12 bg-pink motion-safe:animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
        ))}
      </div>
    </main>
  );
}
