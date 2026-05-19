import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/site-url';

export default function robots(): MetadataRoute.Robots {
  const base = getSiteUrl().origin;

  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/admin/', '/api/'] },
      { userAgent: 'GPTBot', allow: '/', disallow: ['/admin/', '/api/'] },
      { userAgent: 'OAI-SearchBot', allow: '/', disallow: ['/admin/', '/api/'] },
      { userAgent: 'ChatGPT-User', allow: '/', disallow: ['/admin/', '/api/'] },
      { userAgent: 'ClaudeBot', allow: '/', disallow: ['/admin/', '/api/'] },
      { userAgent: 'Claude-Web', allow: '/', disallow: ['/admin/', '/api/'] },
      { userAgent: 'PerplexityBot', allow: '/', disallow: ['/admin/', '/api/'] },
      { userAgent: 'Google-Extended', allow: '/', disallow: ['/admin/', '/api/'] },
      { userAgent: 'Applebot-Extended', allow: '/', disallow: ['/admin/', '/api/'] },
      { userAgent: 'Bingbot', allow: '/', disallow: ['/admin/', '/api/'] },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
