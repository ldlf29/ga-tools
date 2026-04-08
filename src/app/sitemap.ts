import { MetadataRoute } from 'next';

const baseUrl = 'https://www.grandarena.tools';

export default function sitemap(): MetadataRoute.Sitemap {
  const sitemapEntries: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
  ];

  // Add localized routes
  const LOCALES = ['es', 'pt', 'vi', 'tl', 'ja', 'zh-hk'];
  const localizedHomeEntries: MetadataRoute.Sitemap = LOCALES.map((locale) => ({
    url: `${baseUrl}/${locale}`,
    lastModified: new Date(),
    changeFrequency: 'daily',
    priority: 0.9,
  }));

  return [
    ...sitemapEntries,
    ...localizedHomeEntries,
  ];
}
