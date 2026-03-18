import { Metadata } from 'next';
import Home from '../page';

const LOCALES = ['es', 'pt', 'vi', 'tl', 'ja', 'zh-hk'];

const translations: Record<string, { title: string; description: string }> = {
  es: {
    title: "Herramientas Grand Arena | Meta, Auto Lineup Builder y Stats",
    description: "Las mejores herramientas para Grand Arena Web3. Descubre los mejores equipos de Moki, constructor automático de alineaciones, calculadoras de sinergia y tier list competitiva para aumentar tu win rate."
  },
  pt: {
    title: "Ferramentas Grand Arena | Meta, Auto Lineup Builder e Stats",
    description: "As melhores ferramentas para Grand Arena Web3. Descubra os melhores times de Moki, construtor automático de escalações, calculadoras de sinergia e tier list competitiva para aumentar sua taxa de vitória."
  },
  vi: {
    title: "Công cụ Grand Arena | Meta, Auto Lineup Builder & Số liệu",
    description: "Công cụ tối thượng cho Grand Arena Web3. Khám phá đội hình Moki tốt nhất, xây dựng đội hình tự động, tính toán hiệp lực và danh sách xếp hạng để tăng tỷ lệ thắng của bạn."
  },
  tl: {
    title: "Grand Arena Tools | Meta, Auto Lineup Builder at Stats",
    description: "Ang pinakamahusay na mga tool para sa Grand Arena Web3. Tuklasin ang pinakamagandang Moki teams, auto lineup builder, synergy calculators, at tier list para mapataas ang win rate mo."
  },
  ja: {
    title: "Grand Arena Tools | メタ、自動ラインナップビルダー＆統計",
    description: "究極のGrand Arena Web3ツール。最高のMokiチーム、自動ラインナップビルダー、シナジー計算機、Tierリストを見つけて勝率を上げましょう。"
  },
  'zh-hk': {
    title: "Grand Arena Tools | Meta、自動陣容建立器與統計",
    description: "終極 Grand Arena Web3 遊戲工具。發掘最強 Moki 隊伍、自動陣容建立器、協同效應計算機以及階級表，助你提升排行勝率。"
  }
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const p = await params;
  const locale = p.locale;
  const t = translations[locale]; 
  
  if (!t) {
      return {
          title: "Grand Arena Tools",
          description: "Advanced Lineup Builder Tools, Champions, Stats and Analytics for Moku Grand Arena"
      };
  }

  return {
    title: t.title,
    description: t.description,
    alternates: {
      canonical: `https://www.grandarena.tools/${locale}`
    },
    openGraph: {
      title: t.title,
      description: t.description,
      url: `https://www.grandarena.tools/${locale}`,
    }
  };
}

export function generateStaticParams() {
  return LOCALES.map((locale) => ({
    locale,
  }));
}

export default function LocalePage() {
  return <Home />;
}
