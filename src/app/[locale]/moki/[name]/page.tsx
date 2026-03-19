import { Metadata } from 'next';
import mokiMetadataRaw from '@/data/mokiMetadata.json';
import MokiPage from '../../../moki/[name]/page';

const LOCALES = ['es', 'pt', 'vi', 'tl', 'ja', 'zh-hk'];

// Interface for Moki Metadata
interface MokiMetadata {
  id: string;
  name: string;
  portraitUrl: string;
  fur: string;
  traits: string[];
  marketLink: string;
}

const mokiMetadata = mokiMetadataRaw as Record<string, MokiMetadata>;

const translations: Record<string, { descSuffix: string }> = {
  es: {
    descSuffix:
      'Descubre las mejores composiciones y tier list competitiva para aumentar tu win rate.',
  },
  pt: {
    descSuffix:
      'Descubra as melhores composições e tier list competitiva para aumentar sua taxa de vitória.',
  },
  vi: {
    descSuffix:
      'Khám phá đội hình tốt nhất và danh sách xếp hạng để tăng tỷ lệ thắng của bạn.',
  },
  tl: {
    descSuffix:
      'Tuklasin ang pinakamagandang comps at tier list para mapataas ang win rate mo.',
  },
  ja: { descSuffix: '最高の構成とTierリストを見つけて勝率を上げましょう。' },
  'zh-hk': { descSuffix: '發掘最強陣容與階級表，助你提升排行勝率。' },
};

export async function generateStaticParams() {
  const params: { locale: string; name: string }[] = [];

  LOCALES.forEach((locale) => {
    Object.keys(mokiMetadata).forEach((name) => {
      params.push({
        locale,
        name: encodeURIComponent(name),
      });
    });
  });

  return params;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; name: string }>;
}): Promise<Metadata> {
  const p = await params;
  const decodedName = decodeURIComponent(p.name);
  const locale = p.locale;

  const mokiKey = Object.keys(mokiMetadata).find(
    (key) => key.toLowerCase() === decodedName.toLowerCase()
  );

  if (!mokiKey) {
    return {
      title: 'Moki Not Found | Grand Arena Tools',
    };
  }

  const moki = mokiMetadata[mokiKey];
  const t = translations[locale] || translations['es'];

  const title = `${moki.name} Stats & Best Lineups | Grand Arena`;
  const description = `Stats and analysis for ${moki.name}. ${t.descSuffix}`;

  return {
    title,
    description,
    alternates: {
      canonical: `https://www.grandarena.tools/${locale}/moki/${encodeURIComponent(mokiKey)}`,
    },
    openGraph: {
      title,
      description,
      images: moki.portraitUrl ? [{ url: moki.portraitUrl }] : [],
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: moki.portraitUrl ? [moki.portraitUrl] : [],
    },
  };
}

// Re-using the exact layout/component from the English version, just injecting the JSON-LD implicitly.
export default async function LocalizedMokiPage({
  params,
}: {
  params: Promise<{ locale: string; name: string }>;
}) {
  // The inner component expects a Promise mapping just the 'name' parameter.
  // We create a mock promise to pass down exactly what MokiPage expects.
  const mappedParams = params.then((p) => ({ name: p.name }));
  return <MokiPage params={mappedParams} />;
}
