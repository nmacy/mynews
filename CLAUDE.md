# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Dev server on port 3001
npm run build        # Production build
npm run lint         # ESLint
npx tsc --noEmit     # Type check (no test suite exists)
```

**Prisma** (needs DATABASE_URL):
```bash
DATABASE_URL="file:./dev.db" npx prisma db push    # Sync schema to SQLite
DATABASE_URL="file:./dev.db" npx prisma generate    # Regenerate client
```

**Docker** (always linux/amd64):
```bash
docker buildx build --platform linux/amd64 -t ghcr.io/nmacy/mynews:latest --push .
```

## Environment Variables

Copy `.env.example` → `.env.local`. Required: `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `ENCRYPTION_SECRET`.

## Architecture

**MyNews** is a personalized RSS news aggregator: Next.js 16 App Router, React 19, TypeScript, SQLite/Prisma, Tailwind CSS.

### Data Flow

1. **ConfigProvider** loads user sources from localStorage (guests) or server (`/api/user/settings`), with admin defaults from `/api/default-sources` as fallback
2. **Home page** (`src/app/page.tsx`) calls `/api/feeds?sources=...` with the user's enabled sources
3. **Feeds API** fetches RSS in parallel via `rss-parser`, deduplicates by URL, caches 15 min, persists articles to SQLite (7-day retention), fills OG images in background
4. **Article detail** calls `/api/article/extract?url=...` which tries 5 extraction strategies with fallback chain
5. **Background refresh** via `src/instrumentation.ts` re-fetches feeds every 5 minutes

### Key Providers (wrap app in `layout.tsx`)

- **ConfigProvider** (`src/components/ConfigProvider.tsx`) — User config context. Dual persistence: localStorage always + server when authenticated. Debounced server saves (500ms). Admin defaults fetched on mount.
- **ThemeProvider** — Dark/light/system mode + accent color palettes. Uses CSS variables (`--mn-accent`, `--mn-card`, `--mn-border`, `--mn-muted`, etc.)
- **TagProvider** — Tag definitions context for filtering

### Auth

NextAuth v5 with credentials provider (username/password, bcrypt). JWT strategy with role refresh from DB every 5 minutes. Middleware (`src/middleware.ts`) protects `/api/user/*` and `/api/admin/*`. Admin routes additionally checked via `requireAdmin()` in each handler.

### API Route Patterns

All routes use `export const dynamic = "force-dynamic"`. Admin routes follow this pattern:
```typescript
const session = await auth();
const denied = requireAdmin(session);
if (denied) return denied;
```

### Admin vs User Settings

- **User settings**: per-user sources, tags, theme, accent — stored in `UserSettings` model
- **Admin settings**: server-wide AI API keys (`ServerApiKey`), default sources for guests/new users (`ServerDefaultSources`), custom tags (`CustomTag`)

### Article Extraction Fallback Chain

`/api/article/extract` tries in order: @extractus/article-extractor → CSS selectors + Readability → Google AMP cache → Jina Reader API → Wayback Machine. Results cached in `CachedExtraction` (7-day TTL).

### Tagging

Keyword-based tagging (`src/lib/tagger.ts`) with 40+ predefined tags. Optional AI batch tagging via Anthropic/OpenAI/Gemini/OpenRouter (admin configures API key). Custom tags stored in `CustomTag` model.

### Source Library

`src/config/source-library.ts` contains 80+ curated RSS sources by category. `src/config/sources.json` is the hardcoded fallback for when no admin defaults are configured.

## Conventions

- CSS styling uses inline `style` props with CSS variables (e.g., `style={{ color: "var(--mn-muted)" }}`), not Tailwind for theme-dependent colors
- Settings sub-sections are separate components in `src/components/settings/` with consistent card styling (rounded-2xl, `--mn-card` background, `--mn-border` border)
- Prisma models store JSON arrays as `String @default("[]")` — parse/stringify manually
- The Docker entrypoint runs `prisma db push --skip-generate` on startup, so schema changes deploy automatically
- Git remote: `origin` → `https://github.com/nmacy/mynews.git`, branch: `main`
