export type Headline = {
  title: string;
  url: string;
  source: string;
  summary: string;
  publishedAt: string | null;
};

type FeedSource = {
  name: string;
  url: string;
};

// Feeds abiertos, sin API key. Verificados contra los sitios en producción:
// otros medios chilenos (Emol, BioBio, Cooperativa, El Mostrador) responden
// 403/404 a peticiones de servidor, por eso no están acá.
const FEEDS: FeedSource[] = [
  { name: "La Tercera · Política", url: "https://www.latercera.com/arc/outboundfeeds/rss/category/politica/?outputType=xml" },
  { name: "La Tercera · Nacional", url: "https://www.latercera.com/arc/outboundfeeds/rss/category/nacional/?outputType=xml" },
  { name: "Ex-Ante", url: "https://www.ex-ante.cl/feed/" },
];

const FEED_TIMEOUT_MS = 8000;
const MAX_ITEMS_PER_FEED = 15;
const MAX_AGE_DAYS = 10;

function decodeEntities(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

function readTag(block: string, tag: string) {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return match ? decodeEntities(match[1]) : "";
}

function parseRss(xml: string, source: string): Headline[] {
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? [];

  return blocks.slice(0, MAX_ITEMS_PER_FEED).flatMap((block) => {
    const title = readTag(block, "title");
    const url = readTag(block, "link") || readTag(block, "guid");
    if (!title || !url) return [];

    const rawDate = readTag(block, "pubDate") || readTag(block, "dc:date");
    const parsedDate = rawDate ? new Date(rawDate) : null;
    const publishedAt = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : null;

    return [{
      title,
      url,
      source,
      summary: readTag(block, "description").slice(0, 400),
      publishedAt,
    }];
  });
}

async function fetchFeed(feed: FeedSource): Promise<Headline[]> {
  try {
    const response = await fetch(feed.url, {
      signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
      headers: { "user-agent": "Mozilla/5.0 (compatible; GradeLawStudy/1.0)", accept: "application/rss+xml, application/xml, text/xml" },
      cache: "no-store",
    });

    if (!response.ok) return [];
    return parseRss(await response.text(), feed.name);
  } catch {
    // Un medio caído no puede tumbar la coyuntura completa: se ignora y se sigue.
    return [];
  }
}

/**
 * Titulares recientes de política chilena, deduplicados por URL y ordenados
 * del más nuevo al más viejo. Devuelve [] si todos los feeds fallan.
 */
export async function fetchChileanPoliticalHeadlines(limit = 24): Promise<Headline[]> {
  const results = await Promise.all(FEEDS.map(fetchFeed));
  const oldestAllowed = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  const seen = new Set<string>();

  return results
    .flat()
    .filter((headline) => {
      if (seen.has(headline.url)) return false;
      seen.add(headline.url);
      if (!headline.publishedAt) return true;
      return new Date(headline.publishedAt).getTime() >= oldestAllowed;
    })
    .sort((a, b) => {
      if (!a.publishedAt || !b.publishedAt) return 0;
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    })
    .slice(0, limit);
}

export function feedSourceNames() {
  return FEEDS.map((feed) => feed.name);
}
