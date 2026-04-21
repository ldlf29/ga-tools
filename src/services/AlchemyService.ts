/* eslint-disable @typescript-eslint/no-explicit-any */
import { EnhancedCard } from '@/types';

interface AlchemyNFT {
  contract: { address: string };
  id: {
    tokenId: string;
    tokenMetadata: { tokenType: string };
  };
  title: string;
  description: string;
  tokenUri: { raw: string; gateway: string };
  media: Array<{ raw: string; gateway: string; thumbnail: string }>;
  metadata: {
    name: string;
    description: string;
    image: string;
    external_url: string;
    attributes: Array<{
      value: string | number;
      trait_type: string;
    }>;
  };
  timeLastUpdated: string;
}

interface AlchemyResponse {
  ownedNfts: AlchemyNFT[];
  totalCount: number;
  pageKey?: string;
}

export class AlchemyService {
  private apiKey: string;
  private baseUrl: string;

  private static instance: AlchemyService;

  private constructor() {
    this.apiKey = process.env.ALCHEMY_API_KEY || '';
    if (!this.apiKey) {
      console.warn(
        '[AlchemyService] ALCHEMY_API_KEY is not defined in environment variables.'
      );
    }
    // Using the v3 endpoint as per Alchemy docs
    this.baseUrl = `https://ronin-mainnet.g.alchemy.com/v2/${this.apiKey}`;
  }

  public static getInstance(): AlchemyService {
    if (!AlchemyService.instance) {
      AlchemyService.instance = new AlchemyService();
    }
    return AlchemyService.instance;
  }

  /**
   * Fetches a single page of NFTs from Alchemy, given an optional pageKey.
   * This is used by the paginated server API to prevent 504 timeouts on massive whale wallets.
   */
  public async getWalletNFTsPage(
    walletAddress: string,
    contractAddress: string,
    pageKey?: string
  ): Promise<{ nfts: AlchemyNFT[]; nextPageKey?: string }> {
    if (!walletAddress || !contractAddress) return { nfts: [] };

    console.log(
      `[AlchemyService] Fetching NFT Page for wallet ${walletAddress} (Contract ${contractAddress}, Key: ${pageKey || 'Start'})`
    );

    try {
      const params = new URLSearchParams({
        owner: walletAddress,
        'contractAddresses[]': contractAddress,
        withMetadata: 'true',
      });

      if (pageKey && pageKey !== 'undefined') {
        params.append('pageKey', pageKey);
      }

      const url = `${this.baseUrl}/getNFTs/?${params.toString()}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Alchemy API error: ${response.status} ${errorText}`);
      }

      const data = (await response.json()) as AlchemyResponse;
      const nfts = data.ownedNfts || [];

      // Helper: check if an NFT is still missing image/name
      const isBlind = (nft: AlchemyNFT): boolean => {
        const md = nft.metadata || (nft as any).raw?.metadata;
        const img = (nft as any).image;
        return !(img?.cachedUrl || img?.originalUrl || md?.image) || !(md?.name || nft.title);
      };

      // Helper: run a metadata batch and merge results back into nfts[]
      const runBatch = async (indices: number[], refreshCache: boolean): Promise<void> => {
        const batchSize = refreshCache ? 20 : 100;
        for (let b = 0; b < indices.length; b += batchSize) {
          const chunk = indices.slice(b, b + batchSize);
          const tokens = chunk
            .map(i => ({ contractAddress, tokenId: nfts[i].id?.tokenId }))
            .filter(t => t.tokenId !== undefined);
          if (tokens.length === 0) continue;
          try {
            const res = await fetch(`${this.baseUrl}/getNFTMetadataBatch`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
              body: JSON.stringify({ tokens, refreshCache }),
            });
            if (!res.ok) continue;
            const batchData: AlchemyNFT[] = await res.json();
            const map = new Map<string, AlchemyNFT>();
            batchData.forEach(bn => { if (bn?.id?.tokenId) map.set(bn.id.tokenId, bn); });
            chunk.forEach(i => {
              const tid = nfts[i].id?.tokenId;
              if (tid && map.has(tid)) nfts[i] = map.get(tid)!;
            });
          } catch { /* skip failed sub-batch silently */ }
        }
      };

      // Pass 1: fast cached read (100/batch)
      const pass1 = nfts.map((n, i) => isBlind(n) ? i : -1).filter(i => i !== -1);
      if (pass1.length > 0) {
        console.log(`[AlchemyService] Pass 1: ${pass1.length} blind — reading Alchemy cache`);
        await runBatch(pass1, false);
      }

      // Pass 2: force re-index from blockchain for any still blind (20/batch, slower)
      const pass2 = nfts.map((n, i) => isBlind(n) ? i : -1).filter(i => i !== -1);
      if (pass2.length > 0) {
        console.log(`[AlchemyService] Pass 2: ${pass2.length} still blind — forcing Alchemy re-index`);
        await runBatch(pass2, true);
      }

      // Pass 3: Direct HTTP fetch for any still blind.
      // 166 or so tokens are stuck on `fantasy.grandarena.gg/api...`. Alchemy
      // caching blocks them. We can fetch these directly safely because they
      // aren't routing through IPFS gateways.
      const pass3 = nfts.map((n, i) => isBlind(n) ? i : -1).filter(i => i !== -1);
      if (pass3.length > 0) {
        console.log(`[AlchemyService] Pass 3: ${pass3.length} still blind — fetching native HTTP tokenURI direct`);
        await Promise.allSettled(
          pass3.map(async i => {
            const nft = nfts[i];
            const uri = nft.tokenUri?.raw || nft.tokenUri?.gateway;
            if (uri && uri.startsWith('http')) {
              try {
                const res = await fetch(uri, { signal: AbortSignal.timeout(3000) });
                if (res.ok) {
                  const fetchedMd = await res.json();
                  if (fetchedMd && (fetchedMd.name || fetchedMd.title)) {
                    nft.metadata = fetchedMd;
                  }
                }
              } catch {
                // Silently skip Direct HTTP fail
              }
            }
          })
        );
      }

      const finalBlind = nfts.filter(isBlind);
      if (finalBlind.length > 0) {
        console.warn(`[AlchemyService] ${finalBlind.length} ultimately unresolvable (probably broken contract states).`);
      }

      return {
        nfts,
        nextPageKey: data.pageKey,
      };
    } catch (error) {
      console.error('[AlchemyService] Error fetching NFT Page:', error);
      throw error;
    }
  }

  /**
   * Fetches all NFTs for a given wallet address from a specific contract.
   * Automatically handles pagination to retrieve the complete collection.
   */
  public async getWalletNFTs(
    walletAddress: string,
    contractAddress: string
  ): Promise<AlchemyNFT[]> {
    if (!walletAddress || !contractAddress) return [];

    let allNfts: AlchemyNFT[] = [];
    let pageKey = '';
    let hasMore = true;

    console.log(
      `[AlchemyService] Fetching NFTs for wallet ${walletAddress} on contract ${contractAddress}`
    );

    try {
      while (hasMore) {
        // Construct the URL with query parameters
        const params = new URLSearchParams({
          owner: walletAddress,
          'contractAddresses[]': contractAddress,
          withMetadata: 'true',
        });

        if (pageKey) {
          params.append('pageKey', pageKey);
        }

        // Note: getNFTsForOwner v3 uses the /getNFTs/ endpoint URL structure
        const url = `${this.baseUrl}/getNFTs/?${params.toString()}`;

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Alchemy API error: ${response.status} ${errorText}`);
        }

        const data = (await response.json()) as AlchemyResponse;

        if (data.ownedNfts && data.ownedNfts.length > 0) {
          allNfts = allNfts.concat(data.ownedNfts);
        }

        if (data.pageKey) {
          pageKey = data.pageKey;
        } else {
          hasMore = false;
        }
      }

      console.log(
        `[AlchemyService] Successfully fetched ${allNfts.length} NFTs.`
      );
      return allNfts;
    } catch (error) {
      console.error('[AlchemyService] Error fetching NFTs:', error);
      throw error;
    }
  }

  /**
   * Parses the raw Alchemy NFT data into our application's EnhancedCard format.
   */
  public parseAlchemyNFTs(nfts: AlchemyNFT[]): EnhancedCard[] {
    return nfts.map((nft) => {
      const metadata = nft.metadata || (nft as any).raw?.metadata;
      const attributes = metadata?.attributes || [];

      // Extract key attributes, case-insensitive
      const getAttr = (name: string) =>
        attributes
          .find((a) => a.trait_type?.toLowerCase() === name.toLowerCase())
          ?.value?.toString();

      const rarityValue = getAttr('rarity') || 'basic';
      const cardTypeValue = getAttr('card type') || 'champion';
      const categoryValue = getAttr('category') || '';
      const seriesValue = getAttr('series') || '';
      const editionValue = getAttr('edition') || '';
      const champStr = getAttr('champion token id');
      const championTokenId = champStr ? parseInt(champStr, 10) : undefined;

      // Try to find an explicit name attribute, fallback to metadata name, then top-level title
      const explicitName =
        metadata?.name ||
        getAttr('champion name') ||
        getAttr('card name') ||
        getAttr('name') ||
        nft.title ||
        'Unknown Card';

      // Ensure cardType is precisely mapped
      let finalCardType: 'champion' | 'scheme' = 'champion';
      const lowCardType = cardTypeValue.toLowerCase();
      if (lowCardType === 'scheme' || lowCardType === 'augment') {
        finalCardType = 'scheme';
      }

      // Get image from metadata or Alchemy v3 image object natively
      const alchemyImage = (nft as any).image;
      
      let imageUrl = 
        alchemyImage?.cachedUrl || 
        alchemyImage?.originalUrl || 
        alchemyImage?.thumbnailUrl || 
        metadata?.image || 
        '';

      if (!imageUrl && nft.media && nft.media.length > 0) {
        imageUrl = nft.media[0].gateway || nft.media[0].raw || '';
      }

      // Fallback adjustment for outdated Alchemy CDN metadata
      if (imageUrl) {
        imageUrl = imageUrl.replace(/season1-launch/gi, 'season1-v2');
      }

      // Extract Series Info ONLY if relevant special attributes exist (ignoring season)
      let seriesInfo = null;
      if (categoryValue || seriesValue || editionValue) {
        seriesInfo = {
          category: categoryValue || undefined,
          series: seriesValue || undefined,
          item: explicitName,
          edition: editionValue || undefined,
        };
      }

      // Convert tokenId from hex string "0x..." to decimal number string, or if already decimal just parse
      let numericTokenId = 0;
      const maybeTokenId = nft.id?.tokenId;

      if (maybeTokenId === undefined) {
        console.error(
          `[AlchemyService] MISSING tokenId on NFT item:`,
          JSON.stringify(nft).substring(0, 200)
        );
      } else if (
        typeof maybeTokenId === 'string' &&
        maybeTokenId.startsWith('0x')
      ) {
        numericTokenId = parseInt(maybeTokenId, 16);
      } else if (maybeTokenId) {
        numericTokenId = parseInt(maybeTokenId.toString(), 10);
      }

      return {
        // GrandArenaCard Base Needs
        name: explicitName,
        description: metadata?.description || '',
        image: imageUrl,
        external_url: metadata?.external_url || '',
        attributes: attributes,

        // EnhancedCard Additions
        id: `${nft.contract.address}_${numericTokenId}`,
        rarity: rarityValue.toUpperCase(),
        cardType: finalCardType as any,
        tokenId: numericTokenId,
        seriesInfo: seriesInfo,

        // Properties expected by frontend UI that were missing from our type matching
        cardName: explicitName,
        imageUrl: imageUrl,
        championTokenId: championTokenId,
        minted: true,
        custom: {
          stars: 0,
          class: finalCardType === 'scheme' ? 'Scheme' : '',
          fur: '',
          traits: [],
          imageUrl: imageUrl,
          characterImage: imageUrl,
        } as unknown as EnhancedCard['custom'], // Cast safely
        rank: 0,
        grade: 0,
      } as unknown as EnhancedCard;
    });
  }
}
