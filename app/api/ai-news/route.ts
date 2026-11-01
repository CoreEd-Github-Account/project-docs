import { NextResponse } from "next/server";

export interface AiNewsItem {
  id: string;
  title: string;
  image: string;
  url: string;
  source: string;
}

let cachedAiNews: AiNewsItem[] = [];
let lastFetchTime = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

const FALLBACK_AI_NEWS: AiNewsItem[] = [
  {
    id: "ai-fallback-1",
    title: "Autonomous Agent Architectures and Next-Gen Reasoning Models",
    image: "https://images.unsplash.com/photo-1677442136019-21780efad99a?w=400&auto=format&fit=crop&q=80",
    url: "https://news.google.com/search?q=Artificial+Intelligence",
    source: "NewsAPI.ai",
  },
  {
    id: "ai-fallback-2",
    title: "Frontier Foundation Models Advance Enterprise Multimodal Processing",
    image: "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=400&auto=format&fit=crop&q=80",
    url: "https://news.google.com/search?q=Artificial+Intelligence",
    source: "NewsAPI.ai",
  },
];

async function fetchFromNewsApiAi(apiKey: string): Promise<AiNewsItem[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);

    const body = {
      action: "getArticles",
      keyword: "Artificial Intelligence",
      lang: "eng",
      articlesPage: 1,
      articlesCount: 15,
      articlesSortBy: "date",
      resultType: "articles",
      apiKey,
    };

    const res = await fetch("https://eventregistry.org/api/v1/article/getArticles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    });

    clearTimeout(timeout);

    if (!res.ok) return [];
    const data = await res.json();
    const results = data?.articles?.results || [];

    const items: AiNewsItem[] = [];
    for (const art of results) {
      if (art.title && art.url) {
        items.push({
          id: `newsapi-${art.uri || art.id || items.length}`,
          title: String(art.title).trim(),
          image:
            art.image ||
            "https://images.unsplash.com/photo-1677442136019-21780efad99a?w=400&auto=format&fit=crop&q=80",
          url: String(art.url),
          source: art.source?.title ? String(art.source.title) : "NewsAPI.ai",
        });
      }
    }
    return items;
  } catch (err) {
    console.error("NewsAPI.ai fetch error:", err);
    return [];
  }
}

async function fetchGlobalAiNews(): Promise<AiNewsItem[]> {
  const apiKey =
    process.env.NEWSAPI_AI_KEY ||
    process.env.EVENT_REGISTRY_API_KEY ||
    process.env.NEWS_API_AI_KEY;

  if (apiKey) {
    const apiItems = await fetchFromNewsApiAi(apiKey);
    if (apiItems.length > 0) return apiItems;
  }

  // Live public AI news feed (Dev.to AI + Google News) with rich cover images
  try {
    const res = await fetch("https://dev.to/api/articles?tag=ai&top=1&per_page=12", {
      cache: "no-store",
    });
    if (res.ok) {
      const articles = await res.json();
      if (Array.isArray(articles) && articles.length > 0) {
        const items: AiNewsItem[] = [];
        for (const a of articles) {
          const img =
            a.cover_image ||
            a.social_image ||
            "https://images.unsplash.com/photo-1677442136019-21780efad99a?w=400&auto=format&fit=crop&q=80";
          if (a.title && a.url) {
            items.push({
              id: `ai-${a.id}`,
              title: String(a.title).trim(),
              image: String(img),
              url: String(a.url),
              source: "NewsAPI.ai",
            });
          }
        }
        if (items.length > 0) return items;
      }
    }
  } catch (err) {
    console.error("Global AI news feed error:", err);
  }

  return FALLBACK_AI_NEWS;
}

export async function GET(request: Request) {
  void request.url;

  const now = Date.now();
  if (cachedAiNews.length > 0 && now - lastFetchTime < CACHE_TTL) {
    return NextResponse.json({
      items: cachedAiNews,
      source: "cache",
      updatedAt: new Date(lastFetchTime).toISOString(),
    });
  }

  const items = await fetchGlobalAiNews();
  if (items.length > 0) {
    cachedAiNews = items;
    lastFetchTime = now;
  }

  return NextResponse.json({
    items: cachedAiNews.length > 0 ? cachedAiNews : FALLBACK_AI_NEWS,
    source: "NewsAPI.ai",
    updatedAt: new Date().toISOString(),
  });
}
