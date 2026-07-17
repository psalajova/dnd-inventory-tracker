# DnD Tracker

Multi-character D&D inventory tracker. Static frontend on GitHub Pages, data in Supabase.

**Stack:** Vite · TypeScript · Supabase

## Supabase (one-time)

1. [SQL Editor](https://supabase.com/dashboard/project/thtliczcznbzxvvwigqe/sql/new) → paste & run `supabase/schema.sql`
2. **Authentication → Providers** → enable **Email**

## Local dev

```bash
cp .env.example .env.local   # paste your anon key from Project Settings → API
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173).

## Production build

```bash
npm run build   # output → dist/
```

## GitHub Pages

Deploy the **`dist/`** folder (GitHub Actions is the usual approach).

Env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) must be set **at build time** — Vite bakes them into the bundle. For a private solo repo you can commit `.env.local`; otherwise inject them in CI.
