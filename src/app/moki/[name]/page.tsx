import { Metadata } from 'next';
import mokiMetadataRaw from '@/data/mokiMetadata.json';
import Link from 'next/link';
import Image from 'next/image';
import styles from '@/app/page.module.css';
import MokiLiveStats from '@/components/MokiLiveStats';

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

// 1. Generate Static Params for all 180 Mokis to build these pages at compile time
export async function generateStaticParams() {
  return Object.keys(mokiMetadata).map((name) => ({
    // We use encodeURIComponent to handle special characters if any, but names should be safe
    name: encodeURIComponent(name),
  }));
}

// 2. Generate Dynamic Metadata for SEO
export async function generateMetadata({
  params,
}: {
  params: Promise<{ name: string }>;
}): Promise<Metadata> {
  const p = await params;
  const decodedName = decodeURIComponent(p.name);

  // Find matching Moki (case-insensitive just in case)
  const mokiKey = Object.keys(mokiMetadata).find(
    (key) => key.toLowerCase() === decodedName.toLowerCase()
  );

  if (!mokiKey) {
    return {
      title: 'Moki Not Found | Grand Arena Tools',
      description: 'This Moki does not exist in our database.',
    };
  }

  const moki = mokiMetadata[mokiKey];

  // SEO Optimized Competitive Title
  const title = `${moki.name} Stats & Best Lineups | Grand Arena`;
  const description = `Discover the best team compositions, stats, and tier classification for ${moki.name} in Grand Arena. Maximize your win rate with our meta analysis.`;

  return {
    title,
    description,
    keywords: [
      `${moki.name} Grand Arena`,
      `${moki.name} best team`,
      `${moki.name} stats`,
      `Grand Arena Moki ${moki.name}`,
      `${moki.fur} Moki tier list`,
    ],
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

// 3. The Page Component
export default async function MokiPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const p = await params;
  const decodedName = decodeURIComponent(p.name);

  const mokiKey = Object.keys(mokiMetadata).find(
    (key) => key.toLowerCase() === decodedName.toLowerCase()
  );

  if (!mokiKey) {
    return (
      <div
        style={{
          padding: '40px',
          textAlign: 'center',
          color: 'white',
          fontFamily: 'var(--font-geist-sans)',
        }}
      >
        <h1>Moki Not Found</h1>
        <Link
          href="/?tab=champions"
          style={{ color: '#1ABF9E', textDecoration: 'underline' }}
        >
          Return to Champions
        </Link>
      </div>
    );
  }

  const moki = mokiMetadata[mokiKey];

  // JSON-LD Structured Data (Schema.org) for VideoGameCharacter
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'VideoGameCharacter',
    name: moki.name,
    image: moki.portraitUrl,
    url: `https://www.grandarena.tools/moki/${encodeURIComponent(mokiKey)}`,
    inLanguage: 'en',
    description: `Stats and competitive analysis for ${moki.name} in Grand Arena.`,
    isPartOf: {
      '@type': 'VideoGameSeries',
      name: 'Grand Arena',
    },
  };

  return (
    <main className={styles.mokiPageMain}>
      {/* Inject JSON-LD Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className={styles.mokiModalContainer}>
        <Link href="/?tab=champions" className={styles.backToChampions}>
          ← Back to Champions
        </Link>

        <div className={styles.mokiHeaderGroup}>
          {moki.portraitUrl && (
            <div
              style={{
                width: '160px',
                height: '160px',
                position: 'relative',
                borderRadius: '1rem',
                overflow: 'hidden',
                backgroundColor: 'rgba(0, 0, 0, 0.1)',
                border: '3px solid #333333',
                flexShrink: 0,
                boxShadow: '0 10px 20px rgba(0,0,0,0.2)',
              }}
            >
              <Image
                src={moki.portraitUrl}
                alt={`${moki.name} Portrait`}
                fill
                style={{ objectFit: 'contain' }}
                priority
              />
            </div>
          )}

          <div style={{ flex: 1, minWidth: '250px' }}>
            <div className={styles.mokiTitleRow}>
              <h1 className={styles.mokiTitle}>{moki.name}</h1>
              {moki.marketLink && (
                <a
                  href={moki.marketLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="View on Market"
                  className={styles.marketIconBtn}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                    <polyline points="15 3 21 3 21 9"></polyline>
                    <line x1="10" y1="14" x2="21" y2="3"></line>
                  </svg>
                </a>
              )}
            </div>

            <a
              href={`https://marketplace.roninchain.com/collections/0x9e8ed4ff354bd11602255b3d8e1ed13a1bb26b4b?Champion%20Token%20ID_max=${moki.id}&Champion%20Token%20ID_min=${moki.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.marketIconBtn}
              style={{
                width: 'auto',
                padding: '0.6rem 1.2rem',
                height: 'auto',
                fontWeight: 800,
                fontSize: '0.9rem',
                marginTop: '0.5rem',
                color: '#333',
              }}
            >
              VIEW MOKI #{moki.id} CARD ON MARKET
            </a>
          </div>
        </div>

        <MokiLiveStats moki={moki} />
      </div>
    </main>
  );
}
