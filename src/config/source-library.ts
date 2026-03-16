import type { LibrarySource } from "@/types";

export const SOURCE_CATEGORIES = [
  "Major News",
  "Technology",
  "Science",
  "Business",
  "World",
  "Sports",
  "Entertainment",
  "Gaming",
  "Health",
] as const;

export const SOURCE_LIBRARY: LibrarySource[] = [
  // ── Major News ─────────────────────────────────────────────
  { id: "reuters", name: "Reuters", url: "https://www.reuters.com/arc/outboundfeeds/news-sitemap/?outputType=xml", priority: 1, type: "sitemap", category: "Major News" },
  { id: "ap-news", name: "AP News", url: "https://feedx.net/rss/ap.xml", priority: 1, category: "Major News" },
  { id: "al-jazeera", name: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml", priority: 1, category: "Major News" },
  { id: "pbs-newshour", name: "PBS NewsHour", url: "https://www.pbs.org/newshour/feeds/rss/headlines", priority: 1, category: "Major News" },
  { id: "cnn", name: "CNN", url: "https://www.cnn.com", priority: 1, type: "web", category: "Major News" },
  { id: "abc-news", name: "ABC News", url: "https://abcnews.go.com/abcnews/topstories", priority: 2, category: "Major News" },
  { id: "bbc-news", name: "BBC News", url: "https://feeds.bbci.co.uk/news/rss.xml", priority: 1, category: "Major News" },
  { id: "the-guardian", name: "The Guardian", url: "https://www.theguardian.com/world/rss", priority: 1, category: "Major News" },
  { id: "npr", name: "NPR", url: "https://feeds.npr.org/1001/rss.xml", priority: 1, category: "Major News" },
  { id: "nyt-technology", name: "NYT Technology", url: "https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml", priority: 1, paywalled: true, category: "Major News" },
  { id: "nyt-world", name: "NYT World", url: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml", priority: 1, paywalled: true, category: "Major News" },
  { id: "nyt-business", name: "NYT Business", url: "https://rss.nytimes.com/services/xml/rss/nyt/Business.xml", priority: 1, paywalled: true, category: "Major News" },
  { id: "nyt-science", name: "NYT Science", url: "https://rss.nytimes.com/services/xml/rss/nyt/Science.xml", priority: 2, paywalled: true, category: "Major News" },
  { id: "nbc-news", name: "NBC News", url: "https://feeds.nbcnews.com/nbcnews/public/news", priority: 1, category: "Major News" },
  { id: "fox-news", name: "Fox News", url: "https://moxie.foxnews.com/google-publisher/latest.xml", priority: 2, category: "Major News" },
  { id: "the-hill", name: "The Hill", url: "https://thehill.com/feed/", priority: 2, paywalled: true, category: "Major News" },
  { id: "axios", name: "Axios", url: "https://api.axios.com/feed/", priority: 2, paywalled: true, category: "Major News" },
  { id: "politico", name: "Politico", url: "https://rss.politico.com/politics-news.xml", priority: 2, category: "Major News" },
  { id: "propublica", name: "ProPublica", url: "https://feeds.propublica.org/propublica/main", priority: 2, category: "Major News" },
  { id: "the-atlantic", name: "The Atlantic", url: "https://www.theatlantic.com/feed/all/", priority: 2, paywalled: true, category: "Major News" },
  { id: "vox", name: "Vox", url: "https://www.vox.com/rss/index.xml", priority: 2, category: "Major News" },
  { id: "slate", name: "Slate", url: "https://slate.com/feeds/all.rss", priority: 2, category: "Major News" },
  { id: "the-intercept", name: "The Intercept", url: "https://theintercept.com/feed/?rss", priority: 2, category: "Major News" },
  { id: "salon", name: "Salon", url: "https://www.salon.com/feed/", priority: 3, category: "Major News" },
  { id: "the-daily-beast", name: "The Daily Beast", url: "https://www.thedailybeast.com/arc/outboundfeeds/rss/", priority: 2, category: "Major News" },
  { id: "usa-today", name: "USA Today", url: "https://www.usatoday.com/news/", priority: 1, type: "web", category: "Major News" },
  { id: "semafor", name: "Semafor", url: "https://www.semafor.com", priority: 2, type: "web", category: "Major News" },

  // ── Technology ─────────────────────────────────────────────
  { id: "techcrunch", name: "TechCrunch", url: "https://techcrunch.com/feed/", priority: 2, category: "Technology" },
  { id: "engadget", name: "Engadget", url: "https://www.engadget.com/rss.xml", priority: 2, category: "Technology" },
  { id: "cnet", name: "CNET", url: "https://www.cnet.com/rss/news/", priority: 2, category: "Technology" },
  { id: "mit-tech-review", name: "MIT Tech Review", url: "https://www.technologyreview.com/feed/", priority: 2, paywalled: true, category: "Technology" },
  { id: "9to5mac", name: "9to5Mac", url: "https://9to5mac.com/feed/", priority: 3, category: "Technology" },
  { id: "9to5google", name: "9to5Google", url: "https://9to5google.com/feed/", priority: 3, category: "Technology" },
  { id: "android-central", name: "Android Central", url: "https://www.androidcentral.com/feed", priority: 3, category: "Technology" },
  { id: "toms-hardware", name: "Tom's Hardware", url: "https://www.tomshardware.com/feeds/all", priority: 3, category: "Technology" },
  { id: "hacker-news", name: "Hacker News", url: "https://hnrss.org/frontpage", priority: 2, category: "Technology" },
  { id: "the-verge", name: "The Verge", url: "https://www.theverge.com/rss/index.xml", priority: 2, category: "Technology" },
  { id: "wired", name: "Wired", url: "https://www.wired.com/feed/rss", priority: 2, paywalled: true, category: "Technology" },
  { id: "ars-technica", name: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/index", priority: 2, category: "Technology" },
  { id: "bbc-technology", name: "BBC Technology", url: "https://feeds.bbci.co.uk/news/technology/rss.xml", priority: 2, category: "Technology" },
  { id: "the-guardian-technology", name: "The Guardian Technology", url: "https://www.theguardian.com/technology/rss", priority: 2, category: "Technology" },
  { id: "techradar", name: "TechRadar", url: "https://www.techradar.com/rss", priority: 2, category: "Technology" },
  { id: "zdnet", name: "ZDNet", url: "https://www.zdnet.com/news/rss.xml", priority: 2, category: "Technology" },
  { id: "venturebeat", name: "VentureBeat", url: "https://venturebeat.com/feed/", priority: 2, category: "Technology" },
  { id: "the-register", name: "The Register", url: "https://www.theregister.com/headlines.atom", priority: 3, category: "Technology" },
  { id: "gizmodo", name: "Gizmodo", url: "https://gizmodo.com/feed", priority: 3, category: "Technology" },
  { id: "lifehacker", name: "Lifehacker", url: "https://lifehacker.com/feed/rss", priority: 3, category: "Technology" },

  // ── Science ────────────────────────────────────────────────
  { id: "scientific-american", name: "Scientific American", url: "http://rss.sciam.com/ScientificAmerican-Global", priority: 2, category: "Science" },
  { id: "new-scientist", name: "New Scientist", url: "https://www.newscientist.com/section/news/feed/", priority: 2, paywalled: true, category: "Science" },
  { id: "space-com", name: "Space.com", url: "https://www.space.com/feeds/all", priority: 2, category: "Science" },
  { id: "phys-org", name: "Phys.org", url: "https://phys.org/rss-feed/", priority: 3, category: "Science" },
  { id: "live-science", name: "Live Science", url: "https://www.livescience.com/feeds/all", priority: 3, category: "Science" },
  { id: "nature", name: "Nature", url: "https://www.nature.com/nature.rss", priority: 1, paywalled: true, category: "Science" },
  { id: "national-geographic", name: "National Geographic", url: "https://www.nationalgeographic.com", priority: 2, type: "web", category: "Science" },
  { id: "popular-science", name: "Popular Science", url: "https://www.popsci.com/feed/", priority: 2, category: "Science" },
  { id: "popular-mechanics", name: "Popular Mechanics", url: "https://www.popularmechanics.com/rss/", priority: 3, category: "Science" },
  { id: "smithsonian-magazine", name: "Smithsonian Magazine", url: "https://www.smithsonianmag.com/rss/latest_articles/", priority: 2, category: "Science" },

  // ── Business ───────────────────────────────────────────────
  { id: "cnbc", name: "CNBC", url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114", priority: 1, category: "Business" },
  { id: "marketwatch", name: "MarketWatch", url: "http://feeds.marketwatch.com/marketwatch/topstories/", priority: 2, paywalled: true, category: "Business" },

  { id: "business-insider", name: "Business Insider", url: "https://markets.businessinsider.com/rss/news", priority: 2, paywalled: true, category: "Business" },
  { id: "bloomberg", name: "Bloomberg", url: "https://feeds.bloomberg.com/markets/news.rss", priority: 1, paywalled: true, category: "Business" },
  { id: "wsj", name: "Wall Street Journal", url: "https://feeds.content.dowjones.io/public/rss/RSSWorldNews", priority: 1, paywalled: true, category: "Business" },
  { id: "financial-times", name: "Financial Times", url: "https://www.ft.com/?format=rss", priority: 1, paywalled: true, category: "Business" },
  { id: "washington-post", name: "Washington Post", url: "https://feeds.washingtonpost.com/rss/national", priority: 1, paywalled: true, category: "Business" },
  { id: "quartz", name: "Quartz", url: "https://qz.com/feed", priority: 2, category: "Business" },
  { id: "fast-company", name: "Fast Company", url: "https://www.fastcompany.com/latest/rss", priority: 2, paywalled: true, category: "Business" },
  { id: "inc", name: "Inc.", url: "https://www.inc.com/rss/", priority: 3, category: "Business" },
  { id: "entrepreneur", name: "Entrepreneur", url: "https://www.entrepreneur.com/latest.rss", priority: 3, category: "Business" },
  { id: "the-economist", name: "The Economist", url: "https://www.economist.com/latest/rss.xml", priority: 1, paywalled: true, category: "Business" },
  { id: "bbc-business", name: "BBC Business", url: "https://feeds.bbci.co.uk/news/business/rss.xml", priority: 2, category: "Business" },

  // ── World ──────────────────────────────────────────────────
  { id: "france24", name: "France 24", url: "https://www.france24.com/en/rss", priority: 2, category: "World" },
  { id: "dw", name: "Deutsche Welle", url: "https://rss.dw.com/rdf/rss-en-all", priority: 2, category: "World" },

  // ── Sports ─────────────────────────────────────────────────
  { id: "espn", name: "ESPN", url: "https://www.espn.com/espn/rss/news", priority: 1, category: "Sports" },
  { id: "cbs-sports", name: "CBS Sports", url: "https://www.cbssports.com/rss/headlines/", priority: 2, category: "Sports" },
  { id: "bleacher-report", name: "Bleacher Report", url: "https://bleacherreport.com", priority: 2, type: "web", category: "Sports" },

  // ── Entertainment ──────────────────────────────────────────
  { id: "variety", name: "Variety", url: "https://variety.com/feed/", priority: 2, paywalled: true, category: "Entertainment" },
  { id: "hollywood-reporter", name: "The Hollywood Reporter", url: "https://www.hollywoodreporter.com/feed/", priority: 2, category: "Entertainment" },
  { id: "deadline", name: "Deadline", url: "https://deadline.com/feed/", priority: 2, category: "Entertainment" },
  { id: "rolling-stone", name: "Rolling Stone", url: "https://www.rollingstone.com/feed/", priority: 3, category: "Entertainment" },
  { id: "the-new-yorker", name: "The New Yorker", url: "https://www.newyorker.com/feed/everything", priority: 2, paywalled: true, category: "Entertainment" },
  { id: "pitchfork", name: "Pitchfork", url: "https://pitchfork.com/feed/feed-news/rss", priority: 3, category: "Entertainment" },
  { id: "the-av-club", name: "The A.V. Club", url: "https://www.avclub.com/rss", priority: 3, category: "Entertainment" },
  { id: "bbc-entertainment", name: "BBC Entertainment", url: "https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml", priority: 2, category: "Entertainment" },

  // ── Gaming ─────────────────────────────────────────────────
  { id: "ign", name: "IGN", url: "https://feeds.ign.com/ign/all", priority: 2, category: "Gaming" },
  { id: "kotaku", name: "Kotaku", url: "https://kotaku.com/rss", priority: 2, category: "Gaming" },
  { id: "polygon", name: "Polygon", url: "https://www.polygon.com/rss/index.xml", priority: 2, category: "Gaming" },
  { id: "pc-gamer", name: "PC Gamer", url: "https://www.pcgamer.com/rss/", priority: 2, category: "Gaming" },
  { id: "eurogamer", name: "Eurogamer", url: "https://www.eurogamer.net/feed", priority: 2, category: "Gaming" },
  { id: "rock-paper-shotgun", name: "Rock Paper Shotgun", url: "https://www.rockpapershotgun.com/feed", priority: 3, category: "Gaming" },
  { id: "destructoid", name: "Destructoid", url: "https://www.destructoid.com/feed/", priority: 3, category: "Gaming" },
  { id: "nintendo-life", name: "Nintendo Life", url: "https://www.nintendolife.com/feeds/latest", priority: 3, category: "Gaming" },

  // ── Health ─────────────────────────────────────────────────
  { id: "medical-news-today", name: "Medical News Today", url: "https://www.medicalnewstoday.com/news-1.xml", priority: 2, type: "sitemap", category: "Health" },
  { id: "healthline", name: "Healthline", url: "https://www.healthline.com/rss/health-news", priority: 3, category: "Health" },
  { id: "bbc-health", name: "BBC Health", url: "https://feeds.bbci.co.uk/news/health/rss.xml", priority: 2, category: "Health" },

  // ── Other ──────────────────────────────────────────────────
  { id: "the-drive", name: "The Drive", url: "https://www.thedrive.com/feed", priority: 3, category: "Other" },
];
