export interface RoninProvider {
  request: (args: { method: string; params?: any[] }) => Promise<any>;
}

declare global {
  interface Window {
    ronin?: {
      provider: RoninProvider;
    };
  }
}

export const connectRoninWallet = async (): Promise<string | null> => {
  if (typeof window === 'undefined') return null;

  if (!window.ronin) {
    alert('Please install the Ronin Wallet extension via the Chrome Web Store or Firefox Add-ons.');
    window.open('https://wallet.roninchain.com', '_blank');
    return null;
  }

  try {
    const accounts = await window.ronin.provider.request({
      method: 'eth_requestAccounts',
    });

    if (accounts && accounts.length > 0) {
      return accounts[0];
    }
  } catch (error) {
    console.error('User rejected connection or error occurred:', error);
  }

  return null;
};
