import { NextResponse } from "next/server";

export interface TechNewsItem {
  id: string;
  title: string;
  image: string;
  url: string;
  category: "Cybersecurity";
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

// Fetch live Cybersecurity Events & Threats from The Hacker News RSS
async function fetchCybersecurityEvents(): Promise<TechNewsItem[]> {
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

    while ((match = itemRegex.exec(xml)) !== null && items.length < 15) {
      const block = match[1];
      const titleMatch = block.match(/<title>([\s\S]*?)<\/title>/i);
      const linkMatch = block.match(/<link>([\s\S]*?)<\/link>/i);
      const enclosureMatch = block.match(/<enclosure[^>]+url=["']([^"']+)["']/i);
      const mediaMatch = block.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i);

      const title = titleMatch ? decodeHtmlEntities(titleMatch[1]) : "";
      const url = linkMatch ? decodeHtmlEntities(linkMatch[1]) : "";
      const image =
        enclosureMatch?.[1] ||
        mediaMatch?.[1] ||
        "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=400&auto=format&fit=crop&q=80";

      if (title && url) {
        items.push({
          id: `cyber-${items.length}-${url.slice(-12)}`,
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

export async function GET(request: Request) {
  void request.url;

  const items = await fetchCybersecurityEvents();

  return NextResponse.json({
    items: items.length > 0 ? items : [
      {
        id: "cyber-default-1",
        title: "Critical Infrastructure Security & Global Cyber Attack Monitoring",
        image: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=400&auto=format&fit=crop&q=80",
        url: "https://thehackernews.com",
        category: "Cybersecurity" as const,
      }
    ],
    updatedAt: new Date().toISOString(),
  });
}
