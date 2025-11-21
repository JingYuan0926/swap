import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { toPermissionValidator } from '@zerodev/permissions';
import { toECDSASigner } from '@zerodev/permissions/signers';
import { createKernelAccount, createKernelAccountClient } from '@zerodev/sdk';
import { type Chain, type WalletClient, createPublicClient, http, type Address, parseEther } from 'viem';
import { ENTRYPOINT, KERNEL_VERSION, ZERODEV_PROJECT_IDS } from './smart-account';
import { ParamOperator, toSudoPolicy } from '@zerodev/permissions/policies';

// ZeroDev API v3 URL format
const getZeroDevRpcUrl = (projectId: string, chainId: number) =>
  `https://rpc.zerodev.app/api/v3/${projectId}/chain/${chainId}`;

/**
 * Create a session key that can execute transfers on all chains with one signature
 */
export async function createSessionKeyAccount(
  chain: Chain,
  walletClient: WalletClient,
  recipient: Address,
  amount: string
) {
  const projectId = ZERODEV_PROJECT_IDS[chain.id];

  if (!projectId || projectId.startsWith('YOUR_')) {
    throw new Error(
      `ZeroDev Project ID not configured for ${chain.name}`
    );
  }

  const zeroDevRpc = getZeroDevRpcUrl(projectId, chain.id);

  // Create public client with the SPECIFIC chain
  const publicClient = createPublicClient({
    transport: http(zeroDevRpc),
    chain, // Important: use the specific chain for this client
  });

  // Create or get session key from localStorage
  const storageKey = `zerodev_session_key_${chain.id}`;
  let sessionPrivateKey = localStorage.getItem(storageKey);

  if (!sessionPrivateKey) {
    // Use a chain-specific session key to avoid chain ID conflicts
    sessionPrivateKey = generatePrivateKey();
    localStorage.setItem(storageKey, sessionPrivateKey);
  }

  const sessionKeySigner = privateKeyToAccount(sessionPrivateKey as `0x${string}`);

  // Convert to ECDSA signer for permissions - recreate for each chain
  const ecdsaSigner = await toECDSASigner({ signer: sessionKeySigner });

  // Create permission validator with sudo policy for THIS specific chain
  const permissionValidator = await toPermissionValidator(publicClient, {
    entryPoint: ENTRYPOINT,
    kernelVersion: KERNEL_VERSION,
    signer: ecdsaSigner,
    policies: [
      toSudoPolicy({}),
    ],
  });

  // Create master validator for THIS specific chain
  const { signerToEcdsaValidator } = await import('@zerodev/ecdsa-validator');
  const masterValidator = await signerToEcdsaValidator(publicClient, {
    signer: walletClient,
    entryPoint: ENTRYPOINT,
    kernelVersion: KERNEL_VERSION,
  });

  const account = await createKernelAccount(publicClient, {
    plugins: {
      sudo: masterValidator,
      regular: permissionValidator,
    },
    entryPoint: ENTRYPOINT,
    kernelVersion: KERNEL_VERSION,
  });

  // Create kernel account client
  const kernelClient = createKernelAccountClient({
    account,
    chain, // Important: use the specific chain
    bundlerTransport: http(zeroDevRpc),
    client: publicClient,
  });

  return kernelClient;
}

/**
 * Clear session key from storage
 */
export function clearSessionKey() {
  // Clear session keys for all chains
  const chains = [84532, 11155111, 421614]; // Base Sepolia, Sepolia, Arbitrum Sepolia
  chains.forEach(chainId => {
    localStorage.removeItem(`zerodev_session_key_${chainId}`);
  });
}
