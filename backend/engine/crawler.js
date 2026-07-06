/**
 * Website crawler shared by research, audits, and manual endpoints.
 * Extracted from local-server.js — behavior unchanged.
 */

let cheerio;
try { cheerio = require('cheerio'); } catch { cheerio = null; }

async function crawlWebsite(url) {
  if (!cheerio) throw new Error('cheerio not available');
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  let html;
  try {
    const resp = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KoalandBot/1.0)', 'Accept': 'text/html', 'Accept-Language': 'en-US,en;q=0.9' } });
    clearTimeout(t);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    html = await resp.text();
  } catch (err) { clearTimeout(t); throw err; }

  const $ = cheerio.load(html);
  $('script,style,noscript,iframe').remove();
  const title = $('title').first().text().trim();
  const metaDescription = $('meta[name="description"]').attr('content')?.trim() || '';
  const headings = []; $('h1,h2,h3').each((_, el) => { const t2 = $(el).text().trim(); if (t2) headings.push(t2); });
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
  const ctaTexts = []; $('a,button,[class*="cta"],[class*="btn"]').each((_, el) => { const t2 = $(el).text().trim(); if (t2 && t2.length < 80) ctaTexts.push(t2); });
  const bkw = ['book', 'reserve', 'reservation', 'booking', 'rates', 'availability'];
  const bookingLinks = []; $('a[href]').each((_, el) => { const h = $(el).attr('href') || '', t2 = $(el).text().toLowerCase(); if (bkw.some(k => t2.includes(k) || h.toLowerCase().includes(k))) { try { bookingLinks.push(h.startsWith('http') ? h : new URL(h, url).href); } catch {} } });
  const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  const emailsFound = [...new Set(html.match(emailRegex) || [])].filter(e => !e.includes('example.com'));
  const schemaTypes = []; $('script[type="application/ld+json"]').each((_, el) => { try { const d = JSON.parse($(el).html() || '{}'); if (d['@type']) schemaTypes.push(d['@type']); } catch {} });
  return { url, title, metaDescription, headings: [...new Set(headings)].slice(0, 50), bodyText: bodyText.slice(0, 8000), ctaTexts: [...new Set(ctaTexts)].slice(0, 20), bookingLinks: [...new Set(bookingLinks)].slice(0, 10), contactLinks: [], emailsFound, faqText: '', schemaTypes: [...new Set(schemaTypes)], robotsHints: 'N/A', navLinks: [], hasSitemap: false, crawledAt: new Date().toISOString() };
}

module.exports = { crawlWebsite };
