# MetroReach Media

Premium social media marketing agency website. Built to the quality standards of a top-tier agency — fast, polished, and conversion-focused.

## Tech Stack

- **Framework:** TanStack Start (React + Vite)
- **Styling:** Tailwind CSS
- **Runtime:** Bun
- **Deployment:** Vercel

## Build & Deploy

```bash
bun install
bun run build     # produces dist/client (static) + dist/server (SSR)
```

For Vercel production deployment:

```bash
bash build-vercel.sh   # assembles .vercel/output (Build Output API v3)
```

## Local Development

```bash
bun run dev       # starts Vite dev server
bun run publish   # builds and serves on port 3000
```
