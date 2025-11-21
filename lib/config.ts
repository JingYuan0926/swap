import { createWeb3Modal, defaultWagmiConfig } from '@web3modal/wagmi/react';
import { baseSepolia, sepolia, arbitrumSepolia } from 'viem/chains';
import { http } from 'viem';

// Get a project ID from https://cloud.walletconnect.com
export const projectId = '2e8f8b4a251c4d3e8a9c0b5f6d7e8f9a'; // Demo ID - replace with your own

// Define chains
export const chains = [baseSepolia, sepolia, arbitrumSepolia] as const;

// Create wagmiConfig
export const wagmiConfig = defaultWagmiConfig({
  chains,
  projectId,
  metadata: {
    name: 'Multi-Chain Transfer',
    description: 'Transfer ETH on multiple chains with one click',
    url: 'https://localhost:3000',
    icons: ['']
  },
  transports: {
    [baseSepolia.id]: http(),
    [sepolia.id]: http(),
    [arbitrumSepolia.id]: http(),
  }
});

// Create modal
createWeb3Modal({
  wagmiConfig,
  projectId,
  chains: chains as any,
  themeMode: 'light'
});
