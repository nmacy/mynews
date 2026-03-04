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
  // Major News
  { id: "reuters", name: "Reuters", url: "https://www.reutersagency.com/feed/", priority: 1, category: "Major News" },
  { id: "ap-news", name: "AP News", url: "https://rsshub.app/apnews/topics/apf-topnews", priority: 1, category: "Major News" },
  { id: "al-jazeera", name: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml", priority: 1, category: "Major News" },
  { id: "pbs-newshour", name: "PBS NewsHour", url: "https://www.pbs.org/newshour/feeds/rss/headlines", priority: 1, category: "Major News" },
  { id: "usa-today", name: "USA Today", url: "http://rssfeeds.usatoday.com/UsatodaycomNation-TopStories", priority: 2, category: "Major News" },
  { id: "abc-news", name: "ABC News", url: "https://abcnews.go.com/abcnews/topstories", priority: 2, category: "Major News" },

  // Technology
  { id: "techcrunch", name: "TechCrunch", url: "https://techcrunch.com/feed/", priority: 2, category: "Technology" },
  { id: "engadget", name: "Engadget", url: "https://www.engadget.com/rss.xml", priority: 2, category: "Technology" },
  { id: "cnet", name: "CNET", url: "https://www.cnet.com/rss/news/", priority: 2, category: "Technology" },
  { id: "mit-tech-review", name: "MIT Tech Review", url: "https://www.technologyreview.com/feed/", priority: 2, paywalled: true, category: "Technology" },
  { id: "9to5mac", name: "9to5Mac", url: "https://9to5mac.com/feed/", priority: 3, category: "Technology" },
  { id: "9to5google", name: "9to5Google", url: "https://9to5google.com/feed/", priority: 3, category: "Technology" },
  { id: "android-central", name: "Android Central", url: "https://www.androidcentral.com/feed", priority: 3, category: "Technology" },
  { id: "toms-hardware", name: "Tom's Hardware", url: "https://www.tomshardware.com/feeds/all", priority: 3, category: "Technology" },
  { id: "hacker-news", name: "Hacker News", url: "https://hnrss.org/frontpage", priority: 2, category: "Technology" },

  // Science
  { id: "scientific-american", name: "Scientific American", url: "http://rss.sciam.com/ScientificAmerican-Global", priority: 2, category: "Science" },
  { id: "new-scientist", name: "New Scientist", url: "https://www.newscientist.com/section/news/feed/", priority: 2, paywalled: true, category: "Science" },
  { id: "space-com", name: "Space.com", url: "https://www.space.com/feeds/all", priority: 2, category: "Science" },
  { id: "phys-org", name: "Phys.org", url: "https://phys.org/rss-feed/", priority: 3, category: "Science" },
  { id: "live-science", name: "Live Science", url: "https://www.livescience.com/feeds/all", priority: 3, category: "Science" },

  // Business
  { id: "cnbc", name: "CNBC", url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114", priority: 1, category: "Business" },
  { id: "marketwatch", name: "MarketWatch", url: "http://feeds.marketwatch.com/marketwatch/topstories/", priority: 2, category: "Business" },
  { id: "forbes", name: "Forbes", url: "https://www.forbes.com/innovation/feed2", priority: 2, category: "Business" },
  { id: "business-insider", name: "Business Insider", url: "https://markets.businessinsider.com/rss/news", priority: 2, paywalled: true, category: "Business" },

  // World
  { id: "france24", name: "France 24", url: "https://www.france24.com/en/rss", priority: 2, category: "World" },
  { id: "dw", name: "Deutsche Welle", url: "https://rss.dw.com/rdf/rss-en-all", priority: 2, category: "World" },

  // Sports
  { id: "cbs-sports", name: "CBS Sports", url: "https://www.cbssports.com/rss/headlines/", priority: 2, category: "Sports" },
  { id: "bleacher-report", name: "Bleacher Report", url: "https://bleacherreport.com/articles/feed", priority: 2, category: "Sports" },

  // Entertainment
  { id: "variety", name: "Variety", url: "https://variety.com/feed/", priority: 2, paywalled: true, category: "Entertainment" },
  { id: "hollywood-reporter", name: "The Hollywood Reporter", url: "https://www.hollywoodreporter.com/feed/", priority: 2, category: "Entertainment" },
  { id: "deadline", name: "Deadline", url: "https://deadline.com/feed/", priority: 2, category: "Entertainment" },
  { id: "rolling-stone", name: "Rolling Stone", url: "https://www.rollingstone.com/feed/", priority: 3, category: "Entertainment" },

  // Gaming
  { id: "ign", name: "IGN", url: "https://feeds.ign.com/ign/all", priority: 2, category: "Gaming" },
  { id: "kotaku", name: "Kotaku", url: "https://kotaku.com/rss", priority: 2, category: "Gaming" },
  { id: "polygon", name: "Polygon", url: "https://www.polygon.com/rss/index.xml", priority: 2, category: "Gaming" },
  { id: "pc-gamer", name: "PC Gamer", url: "https://www.pcgamer.com/rss/", priority: 2, category: "Gaming" },
  { id: "eurogamer", name: "Eurogamer", url: "https://www.eurogamer.net/feed", priority: 2, category: "Gaming" },
  { id: "rock-paper-shotgun", name: "Rock Paper Shotgun", url: "https://www.rockpapershotgun.com/feed", priority: 3, category: "Gaming" },
  { id: "destructoid", name: "Destructoid", url: "https://www.destructoid.com/feed/", priority: 3, category: "Gaming" },
  { id: "nintendo-life", name: "Nintendo Life", url: "https://www.nintendolife.com/feeds/latest", priority: 3, category: "Gaming" },

  // Health
  { id: "webmd", name: "WebMD", url: "https://rssfeeds.webmd.com/rss/rss.aspx?RSSSource=RSS_PUBLIC", priority: 2, category: "Health" },
  { id: "medical-news-today", name: "Medical News Today", url: "https://www.medicalnewstoday.com/newsrss", priority: 2, category: "Health" },
  { id: "healthline", name: "Healthline", url: "https://www.healthline.com/rss", priority: 3, category: "Health" },
];
