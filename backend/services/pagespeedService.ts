export interface PageSpeedResult {
  performanceScore: number;
  fcp: number;
  lcp: number;
  cls: number;
  tbt: number;
  tti: number;
  speedIndex: number;
  opportunities: Array<{ id: string; title: string; description: string; savings?: number }>;
  diagnostics: Array<{ id: string; title: string; description: string }>;
}

export async function runPageSpeed(url: string, strategy: 'mobile' | 'desktop' = 'mobile'): Promise<PageSpeedResult | null> {
  const apiKey = process.env.PAGESPEED_API_KEY;
  if (!apiKey) return null;

  try {
    const endpoint = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=${strategy}&key=${apiKey}&category=performance`;
    const response = await fetch(endpoint, { signal: AbortSignal.timeout(30000) });

    if (!response.ok) return null;

    const data = await response.json() as any;
    const cats = data.lighthouseResult?.categories;
    const audits = data.lighthouseResult?.audits || {};

    const score = Math.round((cats?.performance?.score || 0) * 100);

    const getMetric = (key: string) => {
      const metric = audits[key];
      return metric?.numericValue ? Math.round(metric.numericValue) : 0;
    };

    const opportunities = Object.values(audits as Record<string, any>)
      .filter((a: any) => a.details?.type === 'opportunity' && a.score !== null && a.score < 0.9)
      .map((a: any) => ({
        id: a.id,
        title: a.title,
        description: a.description,
        savings: a.details?.overallSavingsMs,
      }))
      .slice(0, 5);

    const diagnostics = Object.values(audits as Record<string, any>)
      .filter((a: any) => a.details?.type === 'table' && a.score !== null && a.score < 0.9)
      .map((a: any) => ({
        id: a.id,
        title: a.title,
        description: a.description,
      }))
      .slice(0, 5);

    return {
      performanceScore: score,
      fcp: getMetric('first-contentful-paint'),
      lcp: getMetric('largest-contentful-paint'),
      cls: audits['cumulative-layout-shift']?.numericValue || 0,
      tbt: getMetric('total-blocking-time'),
      tti: getMetric('interactive'),
      speedIndex: getMetric('speed-index'),
      opportunities,
      diagnostics,
    };
  } catch (err) {
    console.error('PageSpeed error:', err);
    return null;
  }
}
