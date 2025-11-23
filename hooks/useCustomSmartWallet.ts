'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, useWalletClient, usePublicClient } from 'wagmi';
import { type Address, type Hex, parseEther } from 'viem';
import {
  getSmartWalletAddress,
  isSmartWalletDeployed,
} from '@/lib/custom-wallet-client';
import { CUSTOM_WALLET_CHAINS, FACTORY_ADDRESSES, ENTRYPOINT_ADDRESS } from '@/lib/custom-wallet-config';
import SmartWalletABI from '@/lib/contracts/CustomSmartWallet.json';
import {
  buildExecuteBatchCallData,
  buildUserOp,
  getUserOpHash,
} from '@/lib/userop-builder';

export interface BatchCall {
  to: Address;
  value: bigint;
  data: Hex;
}

export function useCustomSmartWallet() {
  const { address: eoaAddress, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const [smartWalletAddress, setSmartWalletAddress] = useState<Address | null>(null);
  const [isDeployed, setIsDeployed] = useState<Record<number, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize smart wallet address
  useEffect(() => {
    async function init() {
      if (!isConnected || !eoaAddress) {
        setSmartWalletAddress(null);
        setIsDeployed({});
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Get smart wallet address (same on all chains due to CREATE2)
        const walletAddr = await getSmartWalletAddress(
          CUSTOM_WALLET_CHAINS[0].chain,
          eoaAddress
        );

        setSmartWalletAddress(walletAddr);

        // Check deployment status on each chain
        const deploymentStatus: Record<number, boolean> = {};

        await Promise.all(
          CUSTOM_WALLET_CHAINS.map(async ({ chain }) => {
            const deployed = await isSmartWalletDeployed(chain, walletAddr);
            deploymentStatus[chain.id] = deployed;
          })
        );

        setIsDeployed(deploymentStatus);
      } catch (err) {
        console.error('Failed to initialize smart wallet:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize');
      } finally {
        setIsLoading(false);
      }
    }

    init();
  }, [isConnected, eoaAddress]);

  /**
   * Deploy the smart wallet if not already deployed
   */
  const deployWallet = useCallback(
    async (chainId: number) => {
      if (!eoaAddress || !walletClient) {
        throw new Error('Wallet not connected');
      }

      const chain = CUSTOM_WALLET_CHAINS.find(c => c.chain.id === chainId);
      if (!chain) {
        throw new Error(`Unsupported chain: ${chainId}`);
      }

      const factoryAddress = FACTORY_ADDRESSES[chainId as keyof typeof FACTORY_ADDRESSES];
      if (!factoryAddress) {
        throw new Error(`No factory for chain ${chainId}`);
      }

      // Deploy using factory
      const hash = await walletClient.writeContract({
        address: factoryAddress,
        abi: [
          {
            name: 'createWalletForOwner',
            type: 'function',
            stateMutability: 'nonpayable',
            inputs: [{ name: 'owner', type: 'address' }],
            outputs: [{ name: 'wallet', type: 'address' }],
          },
        ],
        functionName: 'createWalletForOwner',
        args: [eoaAddress],
      });

      if (!publicClient) {
        throw new Error('Public client not available');
      }

      await publicClient.waitForTransactionReceipt({ hash });

      return hash;
    },
    [eoaAddress, walletClient, publicClient]
  );

  /**
   * Execute a batch of transactions
   * Note: User must be on the correct chain and wallet must be deployed before calling this
   */
  const executeBatch = useCallback(
    async (calls: BatchCall[], chainId: number) => {
      if (!smartWalletAddress || !walletClient) {
        throw new Error('Smart wallet not initialized');
      }

      if (!publicClient) {
        throw new Error('Public client not available');
      }

      // Execute the batch transaction directly through the wallet
      // Note: This bypasses ERC-4337 - for full AA, we'd need to create a UserOperation
      const hash = await walletClient.writeContract({
        address: smartWalletAddress,
        abi: SmartWalletABI.abi,
        functionName: 'executeBatch',
        args: [calls.map(c => ({ target: c.to, value: c.value, data: c.data }))],
      });

      // Wait for transaction receipt
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      return { hash, receipt };
    },
    [smartWalletAddress, walletClient, publicClient]
  );

  /**
   * Execute a single transaction
   * Note: User must be on the correct chain before calling this
   */
  const executeSingle = useCallback(
    async (to: Address, value: bigint, data: Hex = '0x') => {
      if (!smartWalletAddress || !walletClient) {
        throw new Error('Smart wallet not initialized');
      }

      if (!publicClient) {
        throw new Error('Public client not available');
      }

      const hash = await walletClient.writeContract({
        address: smartWalletAddress,
        abi: SmartWalletABI.abi,
        functionName: 'execute',
        args: [to, value, data],
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      return { hash, receipt };
    },
    [smartWalletAddress, walletClient, publicClient]
  );

  /**
   * Send ETH to an address (helper function)
   */
  const sendEth = useCallback(
    async (to: Address, amountInEth: string) => {
      return executeSingle(to, parseEther(amountInEth), '0x' as Hex);
    },
    [executeSingle]
  );

  /**
   * Send ETH to multiple addresses in a batch
   */
  const sendEthBatch = useCallback(
    async (chainId: number, recipients: Array<{ to: Address; amount: string }>) => {
      const calls: BatchCall[] = recipients.map(({ to, amount }) => ({
        to,
        value: parseEther(amount),
        data: '0x',
      }));

      return executeBatch(calls, chainId);
    },
    [executeBatch]
  );

  /**
   * Send ETH batch transaction using paymaster (GASLESS!)
   * This builds a UserOperation and submits it to EntryPoint
   */
  const sendEthBatchGasless = useCallback(
    async (chainId: number, recipients: Array<{ to: Address; amount: string }>) => {
      if (!smartWalletAddress || !walletClient || !publicClient || !eoaAddress) {
        throw new Error('Smart wallet not initialized');
      }

      if (!isDeployed[chainId]) {
        throw new Error('Smart wallet not deployed on this chain. Deploy it first!');
      }

      // 1. Build the calls
      const calls: BatchCall[] = recipients.map(({ to, amount }) => ({
        to,
        value: parseEther(amount),
        data: '0x' as Hex,
      }));

      // 2. Build callData for the smart wallet
      const callData = buildExecuteBatchCallData(calls);

      // 3. Get nonce from EntryPoint (ERC-4337 v0.7)
      const nonce = await publicClient.readContract({
        address: ENTRYPOINT_ADDRESS as Address,
        abi: [
          {
            name: 'getNonce',
            type: 'function',
            stateMutability: 'view',
            inputs: [
              { name: 'sender', type: 'address' },
              { name: 'key', type: 'uint192' },
            ],
            outputs: [{ name: 'nonce', type: 'uint256' }],
          },
        ],
        functionName: 'getNonce',
        args: [smartWalletAddress, 0n], // key = 0 for default nonce sequence
      }) as bigint;

      // 4. Get current gas prices
      const gasPrice = await publicClient.getGasPrice();
      const maxFeePerGas = gasPrice * 2n; // 2x for safety
      const maxPriorityFeePerGas = gasPrice / 10n; // 10% tip

      // 5. Build UserOperation with paymaster
      const userOp = buildUserOp({
        sender: smartWalletAddress,
        nonce,
        callData,
        chainId,
        maxFeePerGas,
        maxPriorityFeePerGas,
        usePaymaster: true, // This adds paymaster data
      });

      // 6. Get the hash to sign
      const userOpHash = getUserOpHash(userOp, chainId);

      // 7. Sign the hash with the EOA (smart wallet owner)
      const signature = await walletClient.signMessage({
        account: eoaAddress,
        message: { raw: userOpHash },
      });

      // 8. Add signature to UserOp
      userOp.signature = signature;

      // 9. Submit to EntryPoint via handleOps
      // Note: In production, you'd submit to a bundler instead
      const hash = await walletClient.writeContract({
        address: ENTRYPOINT_ADDRESS as Address,
        abi: [
          {
            name: 'handleOps',
            type: 'function',
            stateMutability: 'nonpayable',
            inputs: [
              {
                name: 'ops',
                type: 'tuple[]',
                components: [
                  { name: 'sender', type: 'address' },
                  { name: 'nonce', type: 'uint256' },
                  { name: 'initCode', type: 'bytes' },
                  { name: 'callData', type: 'bytes' },
                  { name: 'accountGasLimits', type: 'bytes32' },
                  { name: 'preVerificationGas', type: 'uint256' },
                  { name: 'gasFees', type: 'bytes32' },
                  { name: 'paymasterAndData', type: 'bytes' },
                  { name: 'signature', type: 'bytes' },
                ],
              },
              { name: 'beneficiary', type: 'address' },
            ],
            outputs: [],
          },
        ],
        functionName: 'handleOps',
        args: [[userOp], eoaAddress], // beneficiary = your EOA
      });

      // 10. Wait for transaction
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      return { hash, receipt, userOpHash };
    },
    [smartWalletAddress, walletClient, publicClient, eoaAddress, isDeployed]
  );

  return {
    // State
    smartWalletAddress,
    eoaAddress,
    isDeployed,
    isLoading,
    isConnected,
    error,

    // Functions
    deployWallet,
    executeBatch,
    executeSingle,
    sendEth,
    sendEthBatch,
    sendEthBatchGasless, // NEW: Gasless transactions with paymaster!

    // Helper
    allChainsDeployed: Object.keys(isDeployed).length === CUSTOM_WALLET_CHAINS.length &&
      Object.values(isDeployed).every(deployed => deployed),
  };
}
