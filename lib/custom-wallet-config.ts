import { baseSepolia, sepolia, arbitrumSepolia } from "viem/chains";

// ERC-4337 EntryPoint v0.7 - same address on all chains
export const ENTRYPOINT_ADDRESS = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";

// Factory addresses from deployment
export const FACTORY_ADDRESSES = {
  [baseSepolia.id]: "0x90da4b4B5DeC86d0059eC0161fB269B9d56C334F", // Updated for ERC-4337 v0.7
  [sepolia.id]: "0x5aE9692E5C2F3D489f9204B3a3CE8afaeC1c5d0d",
  [arbitrumSepolia.id]: "0x214048ed98230e586f649a495653F78DE9b1d97e",
} as const;

// Paymaster addresses from deployment
export const PAYMASTER_ADDRESSES = {
  [baseSepolia.id]: "0x93EbD2447D409eEAbf01C86d665eaCAa32996c85",
  [sepolia.id]: "0x1508e3B458fE052f1b6BBb6373B10C6E5249bbf3",
  [arbitrumSepolia.id]: "0xCC8768f032A4098eA4d53C71BE124F7e86a0913d",
} as const;

// Supported chains
export const CUSTOM_WALLET_CHAINS = [
  {
    chain: baseSepolia,
    name: "Base Sepolia",
    explorer: "https://sepolia.basescan.org",
  },
  {
    chain: sepolia,
    name: "Sepolia",
    explorer: "https://sepolia.etherscan.io",
  },
  {
    chain: arbitrumSepolia,
    name: "Arbitrum Sepolia",
    explorer: "https://sepolia.arbiscan.io",
  },
] as const;

// ZeroDev bundler URLs (we'll use ZeroDev's bundler infrastructure)
export const ZERODEV_PROJECT_IDS = {
  [baseSepolia.id]: process.env.NEXT_PUBLIC_ZERODEV_PROJECT_ID_BASE_SEPOLIA || "8c3781b5-003b-45b3-b65b-2d7eb95e0f88",
  [sepolia.id]: process.env.NEXT_PUBLIC_ZERODEV_PROJECT_ID_SEPOLIA || "8c3781b5-003b-45b3-b65b-2d7eb95e0f88",
  [arbitrumSepolia.id]: process.env.NEXT_PUBLIC_ZERODEV_PROJECT_ID_ARBITRUM_SEPOLIA || "8c3781b5-003b-45b3-b65b-2d7eb95e0f88",
} as const;

export const getBundlerUrl = (chainId: number) => {
  const projectId = ZERODEV_PROJECT_IDS[chainId as keyof typeof ZERODEV_PROJECT_IDS];
  return `https://rpc.zerodev.app/api/v3/${projectId}/chain/${chainId}`;
};
