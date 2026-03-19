import { MetadataRoute } from 'next';
import mokiMetadataRaw from '@/data/mokiMetadata.json';

// Interface for Moki Metadata
interface MokiMetadata {
  id: string;
  name: string;
}

const mokiMetadata = mokiMetadataRaw as Record<string, MokiMetadata>;
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

  // Add all 180 Mokis to the sitemap
  const mokiEntries: MetadataRoute.Sitemap = Object.keys(mokiMetadata).map(
    (name) => ({
      url: `${baseUrl}/moki/${encodeURIComponent(name)}`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    })
  );

  // Add localized routes
  const LOCALES = ['es', 'pt', 'vi', 'tl', 'ja', 'zh-hk'];
  const localizedHomeEntries: MetadataRoute.Sitemap = LOCALES.map((locale) => ({
    url: `${baseUrl}/${locale}`,
    lastModified: new Date(),
    changeFrequency: 'daily',
    priority: 0.9,
  }));

  const localizedMokiEntries: MetadataRoute.Sitemap = [];
  LOCALES.forEach((locale) => {
    Object.keys(mokiMetadata).forEach((name) => {
      localizedMokiEntries.push({
        url: `${baseUrl}/${locale}/moki/${encodeURIComponent(name)}`,
        lastModified: new Date(),
        changeFrequency: 'weekly',
        priority: 0.7,
      });
    });
  });

  return [
    ...sitemapEntries,
    ...mokiEntries,
    ...localizedHomeEntries,
    ...localizedMokiEntries,
  ];
}
