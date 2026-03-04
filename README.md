# MyNews

A personalized news reader that aggregates RSS feeds into a clean, categorized interface. Customize your categories, choose your sources, and read full articles — all from one place.

## Features

- **Customizable categories** — Add, remove, and color-code your own news categories
- **Flexible sources** — Add any RSS feed, assign it to multiple categories, toggle sources on/off
- **Full article reading** — Click any article to read the extracted full content in-app
- **Paywall tracking** — Mark sources as paywalled; status is toggleable as sites change their model
- **Dark mode** — Automatic detection with manual toggle, fully themed
- **Persistent settings** — All customizations saved to localStorage, survives refreshes
- **Mobile-friendly** — Responsive layout, works down to 375px viewports

## Getting Started

### Prerequisites

- Node.js 20+
- npm

### Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser.

### Build for production

```bash
npm run build
npm start
```

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── article/extract/   # Full article content extraction endpoint
│   │   └── feeds/             # RSS feed aggregation endpoint
│   ├── article/[id]/          # Article detail page
│   ├── category/[slug]/       # Category listing page
│   ├── settings/              # Settings page (categories & sources)
│   └── page.tsx               # Home page (Top Stories)
├── components/
│   ├── ConfigProvider.tsx      # User config context + localStorage sync
│   ├── ThemeProvider.tsx       # Dark/light mode context
│   ├── articles/               # ArticleCard, HeroArticle, ArticleGrid
│   ├── layout/                 # Header, CategoryTabs, ThemeToggle
│   └── ui/                     # CategoryBadge, PaywallBadge, TimeAgo
├── config/
│   └── sources.json            # Default categories and RSS sources
├── lib/
│   ├── feeds.ts                # RSS fetching, caching, deduplication
│   ├── article-store.ts        # sessionStorage for article pass-through
│   ├── articles.ts             # ID generation, HTML stripping, truncation
│   ├── cache.ts                # In-memory cache with TTL
│   └── image-extractor.ts      # Media/OG image extraction
└── types/
    └── index.ts                # TypeScript interfaces
```

## How It Works

1. **Default config** lives in `src/config/sources.json` — 8 categories, 15 RSS sources
2. **ConfigProvider** merges localStorage overrides with defaults and exposes the config via React context
3. **Pages** fetch articles client-side through `/api/feeds`, passing the user's enabled sources
4. **Article extraction** uses `@extractus/article-extractor` to pull full readable content from source URLs
5. **Caching** — server-side 15-minute TTL prevents excessive RSS fetching

## Tech Stack

- [Next.js 16](https://nextjs.org) (App Router)
- [React 19](https://react.dev)
- [TypeScript 5](https://www.typescriptlang.org)
- [Tailwind CSS 4](https://tailwindcss.com) with Typography plugin
- [rss-parser](https://github.com/rbren/rss-parser) for RSS/Atom feed parsing
- [@extractus/article-extractor](https://github.com/extractus/article-extractor) for full article content
- [open-graph-scraper](https://github.com/jshemas/openGraphScraper) for fallback article images

## License

MIT
