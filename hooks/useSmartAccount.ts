'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWalletClient, useAccount } from 'wagmi';
import { type Chain } from 'viem';
import {
  getSmartAccountAddress,
  isSmartAccountDeployed,
  SUPPORTED_CHAINS,
} from '@/lib/smart-account';
import { createMultiChainAccounts } from '@/lib/multi-chain';
import type { KernelAccountClient } from '@zerodev/sdk';

export interface SmartAccountState {
  address: string | null;
  isDeployed: Record<number, boolean>;
  clients: Record<number, KernelAccountClient<any, any> | null>;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook to manage smart accounts across multiple chains
 * Creates a smart account client for each supported chain
 */
export function useSmartAccount() {
  const { address: eoaAddress, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();

  const [state, setState] = useState<SmartAccountState>({
    address: null,
    isDeployed: {},
    clients: {},
    isLoading: false,
    error: null,
  });

  /**
   * Initialize smart accounts for all supported chains
   */
  const initializeSmartAccounts = useCallback(async () => {
    if (!walletClient || !isConnected) {
      setState({
        address: null,
        isDeployed: {},
        clients: {},
        isLoading: false,
        error: null,
      });
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Get smart account address (same across all chains due to CREATE2)
      const smartAccountAddress = await getSmartAccountAddress(
        SUPPORTED_CHAINS[0].chain,
        walletClient
      );

      // Check deployment status on each chain
      const deploymentStatus: Record<number, boolean> = {};
      for (const { chain } of SUPPORTED_CHAINS) {
        const deployed = await isSmartAccountDeployed(chain, smartAccountAddress);
        deploymentStatus[chain.id] = deployed;
      }

      // Create multi-chain accounts (all chains with one setup)
      const { accounts, clients } = await createMultiChainAccounts(walletClient);

      setState({
        address: smartAccountAddress,
        isDeployed: deploymentStatus,
        clients,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to initialize smart accounts';
      console.error('Smart account initialization error:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
    }
  }, [walletClient, isConnected]);

  /**
   * Reinitialize smart accounts (useful after configuration changes)
   */
  const reinitialize = useCallback(() => {
    initializeSmartAccounts();
  }, [initializeSmartAccounts]);

  // Initialize on mount and when wallet changes
  useEffect(() => {
    initializeSmartAccounts();
  }, [initializeSmartAccounts]);

  /**
   * Get client for a specific chain
   */
  const getClient = useCallback(
    (chainId: number) => {
      return state.clients[chainId] || null;
    },
    [state.clients]
  );

  /**
   * Check if all chains have clients ready
   */
  const allClientsReady = Object.keys(state.clients).length === SUPPORTED_CHAINS.length &&
    Object.values(state.clients).every(client => client !== null);

  return {
    // Smart account address (same across all chains)
    smartAccountAddress: state.address,
    // EOA address (connected wallet)
    eoaAddress,
    // Deployment status per chain
    isDeployed: state.isDeployed,
    // Clients per chain
    clients: state.clients,
    // Get specific client
    getClient,
    // Status flags
    isLoading: state.isLoading,
    isConnected,
    allClientsReady,
    // Error state
    error: state.error,
    // Actions
    reinitialize,
  };
}
