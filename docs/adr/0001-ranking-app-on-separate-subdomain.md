# Ranking app on a separate subdomain, homepage stays on GitHub Pages

Global rankings and per-account daily limits need sign-in and a server-side database, which GitHub Pages can't provide. We build the ranking app as a separate Next.js app in `rankings/`, deployed on Vercel at `rankings.secondquint.com`, with Supabase for the database, Google sign-in, and picture storage. The GIF homepage stays a static page on GitHub Pages and only links to the app. All three services are free at small scale, in line with keeping running costs as low as possible.

## Considered Options

- **Move the whole site to Vercel** (building on the `feat/nextjs-setup` branch) and serve the app at `secondquint.com/rankings`. One app instead of two, but it migrates the homepage's hosting for no benefit to the homepage.
