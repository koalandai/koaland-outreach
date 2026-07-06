import * as cheerio from 'cheerio';

export interface CrawlResult {
  url: string;
  title: string;
  metaDescription: string;
  headings: string[];
  bodyText: string;
  ctaTexts: string[];
  bookingLinks: string[];
  contactLinks: string[];
  emailsFound: string[];
  faqText: string;
  schemaTypes: string[];
  robotsHints: string;
  navLinks: string[];
  hasSitemap: boolean;
  crawledAt: string;
}

const FETCH_TIMEOUT = 15000;

async function fetchWithTimeout(url: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; KoalandBot/1.0; +https://koaland.ai)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    clearTimeout(timeoutId);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.text();
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.origin + u.pathname;
  } catch {
    return url;
  }
}

function extractEmails(text: string): string[] {
  const regex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  return [...new Set(text.match(regex) || [])].filter(
    e => !e.includes('example.com') && !e.includes('domain.com')
  );
}

function extractBookingLinks($: cheerio.CheerioAPI, baseUrl: string): string[] {
  const bookingKeywords = ['book', 'reserve', 'reservation', 'booking', 'rates', 'availability', 'check-in', 'stay'];
  const links: string[] = [];

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text().toLowerCase().trim();
    const hrefLower = href.toLowerCase();

    if (bookingKeywords.some(kw => text.includes(kw) || hrefLower.includes(kw))) {
      try {
        const full = href.startsWith('http') ? href : new URL(href, baseUrl).href;
        links.push(full);
      } catch { /* skip */ }
    }
  });

  return [...new Set(links)].slice(0, 10);
}

function extractFaqText($: cheerio.CheerioAPI): string {
  const faqSelectors = ['#faq', '.faq', '[class*="faq"]', '[id*="faq"]', '[class*="accordion"]'];
  for (const sel of faqSelectors) {
    const el = $(sel);
    if (el.length) return el.text().slice(0, 2000);
  }
  return '';
}

function extractSchemaTypes($: cheerio.CheerioAPI): string[] {
  const types: string[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).html() || '{}');
      if (data['@type']) types.push(data['@type']);
      if (data['@graph']) {
        for (const node of data['@graph']) {
          if (node['@type']) types.push(node['@type']);
        }
      }
    } catch { /* skip */ }
  });
  return [...new Set(types)];
}

export async function crawlWebsite(url: string): Promise<CrawlResult> {
  let html: string;
  try {
    html = await fetchWithTimeout(url);
  } catch (err: any) {
    throw new Error(`Failed to fetch ${url}: ${err.message}`);
  }

  const $ = cheerio.load(html);

  // Remove script/style to get clean text
  $('script, style, noscript, iframe').remove();

  const title = $('title').first().text().trim();
  const metaDescription = $('meta[name="description"]').attr('content')?.trim() || '';

  const headings: string[] = [];
  $('h1, h2, h3').each((_, el) => {
    const text = $(el).text().trim();
    if (text) headings.push(text);
  });

  const bodyText = $('body').text().replace(/\s+/g, ' ').trim();

  const ctaTexts: string[] = [];
  $('a, button, [class*="cta"], [class*="btn"]').each((_, el) => {
    const text = $(el).text().trim();
    if (text && text.length < 100) ctaTexts.push(text);
  });

  const bookingLinks = extractBookingLinks($, url);

  const contactLinks: string[] = [];
  $('a[href^="mailto:"], a[href*="contact"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (href) contactLinks.push(href);
  });

  const emailsFound = extractEmails(html);
  const faqText = extractFaqText($);
  const schemaTypes = extractSchemaTypes($);

  const navLinks: string[] = [];
  $('nav a, header a').each((_, el) => {
    const text = $(el).text().trim();
    if (text && text.length < 50) navLinks.push(text);
  });

  // Check for sitemap and robots hints
  let robotsHints = '';
  try {
    const robotsHtml = await fetch(`${new URL(url).origin}/robots.txt`).then(r => r.text()).catch(() => '');
    robotsHints = robotsHtml ? 'robots.txt found' : 'No robots.txt';
    if (robotsHtml.toLowerCase().includes('sitemap')) {
      robotsHints += ' | Sitemap referenced';
    }
  } catch {
    robotsHints = 'Could not fetch robots.txt';
  }

  const hasSitemap = robotsHints.includes('Sitemap');

  return {
    url,
    title,
    metaDescription,
    headings: [...new Set(headings)].slice(0, 50),
    bodyText: bodyText.slice(0, 8000),
    ctaTexts: [...new Set(ctaTexts)].slice(0, 20),
    bookingLinks,
    contactLinks: [...new Set(contactLinks)].slice(0, 10),
    emailsFound,
    faqText,
    schemaTypes,
    robotsHints,
    navLinks: [...new Set(navLinks)].slice(0, 20),
    hasSitemap,
    crawledAt: new Date().toISOString(),
  };
}
