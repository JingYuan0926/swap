import { toMultiChainECDSAValidator } from "@zerodev/multi-chain-ecdsa-validator";
import { createKernelAccount, createKernelAccountClient, createZeroDevPaymasterClient } from "@zerodev/sdk";
import { createPublicClient, http, type Chain, type WalletClient } from "viem";
import { ENTRYPOINT, KERNEL_VERSION, ZERODEV_PROJECT_IDS, SUPPORTED_CHAINS } from './smart-account';

// ZeroDev API v3 URL format
const getZeroDevRpcUrl = (projectId: string, chainId: number) =>
  `https://rpc.zerodev.app/api/v3/${projectId}/chain/${chainId}`;

/**
 * Create smart accounts across multiple chains with multi-chain signing
 * Allows signing all transactions with ONE signature
 */
export async function createMultiChainAccounts(walletClient: WalletClient) {
  if (!walletClient.account) {
    throw new Error('Wallet client does not have an account attached');
  }

  // Get all chain IDs for multi-chain validator
  const chainIds = SUPPORTED_CHAINS.map(({ chain }) => chain.id);

  const accounts: Record<number, any> = {};
  const clients: Record<number, any> = {};

  // Create multi-chain validator for each chain
  // All validators share the same signer and multiChainIds configuration
  for (const { chain } of SUPPORTED_CHAINS) {
    const projectId = ZERODEV_PROJECT_IDS[chain.id];

    if (!projectId || projectId.startsWith('YOUR_')) {
      throw new Error(`ZeroDev Project ID not configured for ${chain.name}`);
    }

    const zeroDevRpc = getZeroDevRpcUrl(projectId, chain.id);

    const publicClient = createPublicClient({
      transport: http(zeroDevRpc),
      chain,
    });

    // Create multi-chain ECDSA validator
    // This allows signing multiple UserOps from different chains with one signature
    const multiChainValidator = await toMultiChainECDSAValidator(publicClient, {
      signer: walletClient as any,
      entryPoint: ENTRYPOINT,
      kernelVersion: KERNEL_VERSION,
      multiChainIds: chainIds,
    });

    // Create kernel account with multi-chain validator
    const account = await createKernelAccount(publicClient, {
      plugins: {
        sudo: multiChainValidator,
      },
      entryPoint: ENTRYPOINT,
      kernelVersion: KERNEL_VERSION,
    });

    // Create paymaster client to sponsor gas fees
    const paymasterClient = createZeroDevPaymasterClient({
      chain,
      transport: http(zeroDevRpc),
    });

    // Create kernel client with paymaster
    const kernelClient = createKernelAccountClient({
      account,
      chain,
      bundlerTransport: http(zeroDevRpc),
      client: publicClient,
      paymaster: {
        getPaymasterData(userOperation) {
          return paymasterClient.sponsorUserOperation({ userOperation });
        },
      },
    });

    accounts[chain.id] = account;
    clients[chain.id] = kernelClient;
  }

  return { accounts, clients };
}
