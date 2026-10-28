import { NextResponse } from "next/server";

export interface TechNewsItem {
  id: string;
  title: string;
  image: string;
  url: string;
  category: "Cybersecurity" | "AI Agents" | "IT & Cloud";
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

// 1. Fetch Cybersecurity & Hacker Attack news from The Hacker News RSS (includes <enclosure> images)
async function fetchHackerNewsSecurity(): Promise<TechNewsItem[]> {
  try {
    const res = await fetch("https://feeds.feedburner.com/TheHackersNews", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const items: TechNewsItem[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match: RegExpExecArray | null;

    while ((match = itemRegex.exec(xml)) !== null && items.length < 6) {
      const block = match[1];
      const titleMatch = block.match(/<title>([\s\S]*?)<\/title>/i);
      const linkMatch = block.match(/<link>([\s\S]*?)<\/link>/i);
      const enclosureMatch = block.match(/<enclosure[^>]+url=["']([^"']+)["']/i);
      const mediaMatch = block.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i);

      const title = titleMatch ? decodeHtmlEntities(titleMatch[1]) : "";
      const url = linkMatch ? decodeHtmlEntities(linkMatch[1]) : "";
      const image = enclosureMatch?.[1] || mediaMatch?.[1] || "";

      if (title && url && image) {
        items.push({
          id: `thn-${items.length}-${url.slice(-12)}`,
          title,
          image,
          url,
          category: "Cybersecurity",
        });
      }
    }
    return items;
  } catch {
    return [];
  }
}

// 2. Fetch AI Agents & IT news from Dev.to public JSON API (includes cover_image / social_image)
async function fetchAiAndItNews(): Promise<TechNewsItem[]> {
  try {
    const [aiRes, secRes] = await Promise.all([
      fetch("https://dev.to/api/articles?tag=ai&top=1&per_page=5", {
        cache: "no-store",
      }),
      fetch("https://dev.to/api/articles?tag=cybersecurity&top=2&per_page=4", {
        cache: "no-store",
      }),
    ]);

    const items: TechNewsItem[] = [];

    if (aiRes.ok) {
      const aiArticles = await aiRes.json();
      if (Array.isArray(aiArticles)) {
        for (const a of aiArticles) {
          const img = a.cover_image || a.social_image;
          if (a.title && a.url && img) {
            items.push({
              id: `dev-ai-${a.id}`,
              title: String(a.title).trim(),
              image: String(img),
              url: String(a.url),
              category: "AI Agents",
            });
          }
        }
      }
    }

    if (secRes.ok) {
      const secArticles = await secRes.json();
      if (Array.isArray(secArticles)) {
        for (const a of secArticles) {
          const img = a.cover_image || a.social_image;
          if (a.title && a.url && img) {
            items.push({
              id: `dev-sec-${a.id}`,
              title: String(a.title).trim(),
              image: String(img),
              url: String(a.url),
              category: "Cybersecurity",
            });
          }
        }
      }
    }

    return items;
  } catch {
    return [];
  }
}

export async function GET(request: Request) {
  void request.url;

  const [securityItems, aiItems] = await Promise.all([
    fetchHackerNewsSecurity(),
    fetchAiAndItNews(),
  ]);

  // Interleave Cybersecurity/Hacker Attacks and AI Agents/IT articles for a balanced feed
  const combined: TechNewsItem[] = [];
  const maxLen = Math.max(securityItems.length, aiItems.length);
  for (let i = 0; i < maxLen; i++) {
    if (securityItems[i]) combined.push(securityItems[i]);
    if (aiItems[i]) combined.push(aiItems[i]);
  }

  return NextResponse.json({
    items: combined.slice(0, 10),
    updatedAt: new Date().toISOString(),
  });
}

