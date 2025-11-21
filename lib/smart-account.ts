import { createKernelAccount, createKernelAccountClient } from "@zerodev/sdk";
import { signerToEcdsaValidator } from "@zerodev/ecdsa-validator";
import { toMultiChainECDSAValidator } from "@zerodev/multi-chain-ecdsa-validator";
import { createPublicClient, http, type Chain, type WalletClient } from "viem";
import { baseSepolia, sepolia, arbitrumSepolia } from "viem/chains";
import { KERNEL_V3_1, getEntryPoint } from "@zerodev/sdk/constants";

// EntryPoint v0.7 - using the new API
export const ENTRYPOINT = getEntryPoint("0.7");
export const KERNEL_VERSION = KERNEL_V3_1;

// ZeroDev Project IDs - Get from https://dashboard.zerodev.app
// Create a new project and get the API keys for each chain
export const ZERODEV_PROJECT_IDS: Record<number, string> = {
  [baseSepolia.id]: process.env.NEXT_PUBLIC_ZERODEV_PROJECT_ID_BASE_SEPOLIA || "8c3781b5-003b-45b3-b65b-2d7eb95e0f88",
  [sepolia.id]: process.env.NEXT_PUBLIC_ZERODEV_PROJECT_ID_SEPOLIA || "8c3781b5-003b-45b3-b65b-2d7eb95e0f88",
  [arbitrumSepolia.id]: process.env.NEXT_PUBLIC_ZERODEV_PROJECT_ID_ARBITRUM_SEPOLIA || "8c3781b5-003b-45b3-b65b-2d7eb95e0f88",
};

// ZeroDev API v3 - same RPC for bundler and paymaster
// Format: https://rpc.zerodev.app/api/v3/{projectId}/chain/{chainId}
const getZeroDevRpcUrl = (projectId: string, chainId: number) =>
  `https://rpc.zerodev.app/api/v3/${projectId}/chain/${chainId}`;

/**
 * Create a smart account for a specific chain
 * @param chain The chain to create the account on
 * @param walletClient The user's wallet client (from Wagmi)
 * @returns Kernel account client
 */
export async function createSmartAccountClient(
  chain: Chain,
  walletClient: WalletClient
) {
  if (!walletClient.account) {
    throw new Error('Wallet client does not have an account attached');
  }

  const projectId = ZERODEV_PROJECT_IDS[chain.id];

  console.log('[createSmartAccountClient]', {
    chainName: chain.name,
    chainId: chain.id,
    projectId,
    accountAddress: walletClient.account.address
  });

  if (!projectId) {
    throw new Error(`ZeroDev Project ID not found for ${chain.name} (Chain ID: ${chain.id})`);
  }

  // Get ZeroDev RPC URL (v3 uses same URL for bundler and paymaster)
  const zeroDevRpc = getZeroDevRpcUrl(projectId, chain.id);

  // Create public client using ZeroDev RPC
  const publicClient = createPublicClient({
    transport: http(zeroDevRpc),
    chain,
  });

  // Create ECDSA validator from wallet client
  // Note: Pass the full walletClient, not just account, because wagmi's
  // walletClient.account is a JsonRpcAccount (only has address), but
  // ZeroDev needs the full client with signing methods
  const ecdsaValidator = await signerToEcdsaValidator(publicClient, {
    signer: walletClient as any, // Type assertion: we've already validated account exists
    entryPoint: ENTRYPOINT,
    kernelVersion: KERNEL_VERSION,
  });

  // Create kernel account
  const account = await createKernelAccount(publicClient, {
    plugins: {
      sudo: ecdsaValidator,
    },
    entryPoint: ENTRYPOINT,
    kernelVersion: KERNEL_VERSION,
  });

  // Create kernel account client without paymaster (smart account will pay its own gas)
  const kernelClient = createKernelAccountClient({
    account,
    chain,
    bundlerTransport: http(zeroDevRpc),
    client: publicClient, // Required - the public client
  });

  return kernelClient;
}

/**
 * Get smart account address without deploying
 * Uses deterministic address calculation
 */
export async function getSmartAccountAddress(
  chain: Chain,
  walletClient: WalletClient
): Promise<string> {
  if (!walletClient.account) {
    throw new Error('Wallet client does not have an account attached');
  }

  const projectId = ZERODEV_PROJECT_IDS[chain.id];

  console.log('[getSmartAccountAddress]', {
    chainName: chain.name,
    chainId: chain.id,
    projectId,
    accountAddress: walletClient.account.address,
    allProjectIds: ZERODEV_PROJECT_IDS
  });

  if (!projectId) {
    throw new Error(`ZeroDev Project ID not found for ${chain.name} (Chain ID: ${chain.id})`);
  }

  const zeroDevRpc = getZeroDevRpcUrl(projectId, chain.id);

  const publicClient = createPublicClient({
    transport: http(zeroDevRpc),
    chain,
  });

  // Use multi-chain validator to match the actual accounts created
  // This ensures the displayed address matches the address used in transactions
  const chainIds = SUPPORTED_CHAINS.map(({ chain }) => chain.id);
  const multiChainValidator = await toMultiChainECDSAValidator(publicClient, {
    signer: walletClient as any,
    entryPoint: ENTRYPOINT,
    kernelVersion: KERNEL_VERSION,
    multiChainIds: chainIds,
  });

  const account = await createKernelAccount(publicClient, {
    plugins: {
      sudo: multiChainValidator,
    },
    entryPoint: ENTRYPOINT,
    kernelVersion: KERNEL_VERSION,
  });

  return account.address;
}

/**
 * Check if smart account is deployed on a chain
 */
export async function isSmartAccountDeployed(
  chain: Chain,
  address: string
): Promise<boolean> {
  const publicClient = createPublicClient({
    transport: http(chain.rpcUrls.default.http[0]),
    chain,
  });

  const code = await publicClient.getBytecode({ address: address as `0x${string}` });
  return code !== undefined && code !== '0x';
}

/**
 * Supported chains configuration
 */
export const SUPPORTED_CHAINS = [
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
