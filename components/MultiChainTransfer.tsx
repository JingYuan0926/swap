'use client';

import { useState } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { parseEther, getAddress } from 'viem';
import { prepareAndSignUserOperations } from '@zerodev/multi-chain-ecdsa-validator';
import { useSmartAccount } from '@/hooks/useSmartAccount';
import { SUPPORTED_CHAINS } from '@/lib/smart-account';
import type { KernelAccountClient } from '@zerodev/sdk';

interface TransferResult {
  chain: string;
  hash?: string;
  error?: string;
  status: 'success' | 'failed' | 'pending';
  explorer?: string;
}

export default function MultiChainTransfer() {
  const { isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const {
    smartAccountAddress,
    eoaAddress,
    isDeployed,
    clients,
    isLoading: accountLoading,
    allClientsReady,
    error: accountError,
  } = useSmartAccount();

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [results, setResults] = useState<TransferResult[]>([]);

  // Recipient address - updated to your address
  const RECIPIENT = getAddress("0x9787cfF89D30bB6Ae87Aaad9B3a02E77B5caA8f1");
  const AMOUNT = "0.001"; // ETH

  const executeMultiChainTransfer = async () => {
    if (!allClientsReady || !walletClient) {
      alert('Smart accounts are not ready. Please wait...');
      return;
    }

    setLoading(true);
    setResults([]);
    setStatus('Preparing multi-chain transfer...');

    try {
      // Prepare user operations for all chains
      setStatus('Preparing transactions for all chains...');

      // IMPORTANT: Build arrays in the same order as SUPPORTED_CHAINS
      const clientsArray = SUPPORTED_CHAINS.map(({ chain }) => clients[chain.id]);

      const userOps = await Promise.all(
        SUPPORTED_CHAINS.map(async ({ chain }) => {
          const client = clients[chain.id];
          return {
            callData: await client.account.encodeCalls([{
              to: RECIPIENT,
              value: parseEther(AMOUNT),
              data: '0x',
            }]),
          };
        })
      );

      // Add chainId to each user operation
      const userOpParams = SUPPORTED_CHAINS.map(({ chain }, index) => ({
        ...userOps[index],
        chainId: chain.id,
      }));

      console.log('Preparing to sign with:', {
        clientChainIds: clientsArray.map(c => c.chain?.id),
        userOpChainIds: userOpParams.map(u => u.chainId),
      });

      // Sign all user operations with ONE signature
      setStatus('Please sign in your wallet (1 signature for all 3 chains)...');
      const signedUserOps = await prepareAndSignUserOperations(
        clientsArray as any,
        userOpParams
      );

      // Send all signed user operations in parallel
      setStatus('Sending transactions to all chains...');
      const transferPromises = SUPPORTED_CHAINS.map(async ({ chain, name, explorer }, index) => {
        const client = clients[chain.id];

        if (!client) {
          return {
            chain: name,
            status: 'failed' as const,
            error: 'Client not available',
          };
        }

        try {
          setStatus(`Sending transaction on ${name}...`);

          // Send the pre-signed UserOperation
          const userOpHash = await client.sendUserOperation(signedUserOps[index]);

          setStatus(`Waiting for confirmation on ${name}...`);

          // Wait for transaction to be mined
          const receipt = await client.waitForUserOperationReceipt({
            hash: userOpHash,
          });

          return {
            chain: name,
            hash: receipt.receipt.transactionHash,
            status: 'success' as const,
            explorer: `${explorer}/tx/${receipt.receipt.transactionHash}`,
          };
        } catch (error) {
          console.error(`Error on ${name}:`, error);
          return {
            chain: name,
            error: error instanceof Error ? error.message : 'Unknown error',
            status: 'failed' as const,
          };
        }
      });

      // Wait for all transfers to complete
      const completedResults = await Promise.all(transferPromises);
      setResults(completedResults);
      setStatus('All transactions complete!');
    } catch (error) {
      console.error('Multi-chain transfer error:', error);
      setStatus('Error during multi-chain transfer');

      // Show error for all chains
      const errorResults = SUPPORTED_CHAINS.map(({ name }) => ({
        chain: name,
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 'failed' as const,
      }));
      setResults(errorResults);
    }

    setLoading(false);
  };

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8 text-center">
        Multi-Chain ETH Transfer with Smart Accounts
      </h1>

      {!isConnected ? (
        <div className="text-center">
          <p className="mb-4 text-gray-600">
            Connect your wallet to transfer ETH across multiple chains
          </p>
          <w3m-button />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Account Information */}
          <div className="bg-gray-100 p-4 rounded-lg space-y-2">
            <div>
              <p className="text-xs text-gray-600">EOA (Your MetaMask Wallet):</p>
              <p className="font-mono text-sm">{eoaAddress}</p>
            </div>
            {smartAccountAddress && (
              <div>
                <p className="text-xs text-gray-600">Smart Account:</p>
                <p className="font-mono text-sm">{smartAccountAddress}</p>
              </div>
            )}
          </div>

          {/* Smart Account Status */}
          {accountLoading ? (
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm">⏳ Initializing smart accounts...</p>
            </div>
          ) : accountError ? (
            <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
              <p className="text-sm text-red-600">❌ Error: {accountError}</p>
              <p className="text-xs text-red-500 mt-2">
                Make sure to configure ZeroDev Project IDs in lib/smart-account.ts
              </p>
            </div>
          ) : (
            <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
              <p className="text-sm font-semibold mb-2">✅ Smart Accounts Ready</p>
              <div className="space-y-1 text-xs">
                {SUPPORTED_CHAINS.map(({ chain, name }) => (
                  <div key={chain.id} className="flex items-center justify-between">
                    <span>{name}:</span>
                    <span className={isDeployed[chain.id] ? 'text-green-600' : 'text-yellow-600'}>
                      {isDeployed[chain.id] ? 'Deployed ✓' : 'Will deploy on first use'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Transfer Details */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-semibold mb-2">Transfer Details:</h3>
            <p className="text-sm">Amount: {AMOUNT} ETH per chain</p>
            <p className="text-sm">Total: {Number(AMOUNT) * SUPPORTED_CHAINS.length} ETH</p>
            <p className="text-sm">Recipient: {RECIPIENT.slice(0, 6)}...{RECIPIENT.slice(-4)}</p>
            <p className="text-sm">Chains: {SUPPORTED_CHAINS.map(c => c.name).join(', ')}</p>
          </div>

          {/* Transfer Button */}
          <button
            onClick={executeMultiChainTransfer}
            disabled={loading || accountLoading || !allClientsReady}
            className={`w-full py-3 px-6 rounded-lg font-semibold text-white transition-colors
              ${loading || accountLoading || !allClientsReady
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
              }`}
          >
            {loading ? status : accountLoading ? 'Initializing...' : `Transfer ${AMOUNT} ETH (1 Signature)`}
          </button>

          {/* Results */}
          {results.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold">Transaction Results:</h3>
              {results.map((result, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg ${result.status === 'success'
                      ? 'bg-green-50 border border-green-200'
                      : result.status === 'pending'
                      ? 'bg-yellow-50 border border-yellow-200'
                      : 'bg-red-50 border border-red-200'
                    }`}
                >
                  <p className="font-semibold">{result.chain}</p>
                  {result.status === 'success' ? (
                    <div>
                      <p className="text-xs text-gray-600 break-all">
                        Hash: {result.hash}
                      </p>
                      <a
                        href={result.explorer}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline text-sm"
                      >
                        View on Explorer →
                      </a>
                    </div>
                  ) : result.status === 'pending' ? (
                    <p className="text-yellow-600 text-sm">⏳ Pending...</p>
                  ) : (
                    <p className="text-red-600 text-sm">{result.error}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Info Banner */}
          <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
            <p className="text-sm text-purple-800 font-semibold mb-1">
              🚀 Using MetaMask + ERC-4337 Smart Accounts + Multi-Chain Signing
            </p>
            <p className="text-xs text-purple-700">
              • ✨ Only 1 signature for all 3 chains!<br />
              • 💸 Gasless transactions (sponsored by ZeroDev)<br />
              • Transactions execute in parallel across all chains<br />
              • Same smart account address on all chains
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
