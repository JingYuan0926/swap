'use client';

import { useState } from 'react';
import { useCustomSmartWallet } from '@/hooks/useCustomSmartWallet';
import { baseSepolia } from 'viem/chains';
import { type Address } from 'viem';
import { useSwitchChain, useChainId } from 'wagmi';

export default function CustomWalletDemo() {
  const {
    smartWalletAddress,
    eoaAddress,
    isDeployed,
    isLoading,
    isConnected,
    error,
    deployWallet,
    sendEthBatch,
    sendEthBatchGasless,
  } = useCustomSmartWallet();

  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [results, setResults] = useState<any[]>([]);

  const TARGET_CHAIN_ID = baseSepolia.id; // 84532
  const isOnCorrectChain = chainId === TARGET_CHAIN_ID;

  // Demo: Send 0.001 ETH to recipient address
  const RECIPIENT = "0x9787cfF89D30bB6Ae87Aaad9B3a02E77B5caA8f1" as Address;
  const AMOUNT = "0.001"; // ETH per transfer

  const handleSwitchChain = async () => {
    try {
      await switchChain({ chainId: TARGET_CHAIN_ID });
    } catch (err) {
      console.error('Failed to switch chain:', err);
      alert('Please switch to Base Sepolia network in your wallet');
    }
  };

  const executeBatchTransaction = async () => {
    if (!smartWalletAddress) {
      alert('Smart wallet not initialized');
      return;
    }

    if (!isOnCorrectChain) {
      alert('Please switch to Base Sepolia network first');
      return;
    }

    setLoading(true);
    setResults([]);

    try {
      // Check if wallet is deployed, deploy if not
      if (!isDeployed[TARGET_CHAIN_ID]) {
        setStatus('Deploying smart wallet...');

        try {
          const deployHash = await deployWallet(TARGET_CHAIN_ID);

          setResults([{
            chain: 'Base Sepolia',
            hash: deployHash,
            status: 'success',
            explorer: `https://sepolia.basescan.org/tx/${deployHash}`,
            message: '✅ Smart wallet deployed! Refresh the page, send 0.003 ETH to your wallet address above, then click the button again.',
          }]);

          setStatus('Wallet deployed! Refresh page, fund it, and try again.');
          setLoading(false);
          return; // Stop here, let user fund and try again
        } catch (deployError: any) {
          // If deployment failed, it might already be deployed
          const errorMsg = deployError.message || String(deployError);

          setResults([{
            chain: 'Base Sepolia',
            error: `Deployment failed: ${errorMsg}. The wallet might already be deployed. Try refreshing the page and clicking again.`,
            status: 'failed',
          }]);

          setStatus('Deployment failed - check if wallet already exists');
          setLoading(false);
          return;
        }
      }

      // Example: Send ETH to 3 different addresses in one transaction
      const recipients = [
        { to: RECIPIENT, amount: AMOUNT },
        { to: RECIPIENT, amount: AMOUNT },
        { to: RECIPIENT, amount: AMOUNT },
      ];

      // Execute on Base Sepolia
      setStatus('Sending batch transaction on Base Sepolia...');

      const { hash, receipt } = await sendEthBatch(TARGET_CHAIN_ID, recipients);

      setStatus('Transaction successful!');
      setResults([{
        chain: 'Base Sepolia',
        hash,
        status: 'success',
        explorer: `https://sepolia.basescan.org/tx/${hash}`,
      }]);

    } catch (err) {
      console.error('Batch transaction error:', err);
      setStatus('Error: ' + (err instanceof Error ? err.message : 'Unknown error'));
      setResults([{
        chain: 'Base Sepolia',
        error: err instanceof Error ? err.message : 'Unknown error',
        status: 'failed',
      }]);
    } finally {
      setLoading(false);
    }
  };

  const executeGaslessTransaction = async () => {
    if (!smartWalletAddress) {
      alert('Smart wallet not initialized');
      return;
    }

    if (!isOnCorrectChain) {
      alert('Please switch to Base Sepolia network first');
      return;
    }

    if (!isDeployed[TARGET_CHAIN_ID]) {
      alert('Smart wallet not deployed yet! Deploy it first with the button above.');
      return;
    }

    setLoading(true);
    setResults([]);

    try {
      // Example: Send ETH to 3 different addresses in one gasless transaction
      const recipients = [
        { to: RECIPIENT, amount: AMOUNT },
        { to: RECIPIENT, amount: AMOUNT },
        { to: RECIPIENT, amount: AMOUNT },
      ];

      // Execute GASLESS transaction via paymaster!
      setStatus('Building UserOperation with paymaster...');

      const { hash, receipt, userOpHash } = await sendEthBatchGasless(TARGET_CHAIN_ID, recipients);

      setStatus('Gasless transaction successful!');
      setResults([{
        chain: 'Base Sepolia',
        hash,
        userOpHash,
        status: 'success',
        explorer: `https://sepolia.basescan.org/tx/${hash}`,
        message: '🎉 GASLESS! The paymaster paid all gas fees!',
      }]);

    } catch (err) {
      console.error('Gasless transaction error:', err);
      setStatus('Error: ' + (err instanceof Error ? err.message : 'Unknown error'));
      setResults([{
        chain: 'Base Sepolia',
        error: err instanceof Error ? err.message : 'Unknown error',
        status: 'failed',
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8 text-center">
        Custom Smart Wallet Demo
      </h1>

      {!isConnected ? (
        <div className="text-center">
          <p className="mb-4 text-gray-600">
            Connect your wallet to use your custom smart wallet
          </p>
          <w3m-button />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Account Information */}
          <div className="bg-gray-100 p-4 rounded-lg space-y-2">
            <div>
              <p className="text-xs text-gray-600">Your EOA (MetaMask):</p>
              <p className="font-mono text-sm">{eoaAddress}</p>
            </div>
            {smartWalletAddress && (
              <div>
                <p className="text-xs text-gray-600">Custom Smart Wallet:</p>
                <p className="font-mono text-sm">{smartWalletAddress}</p>
              </div>
            )}
          </div>

          {/* Network Check */}
          {!isOnCorrectChain ? (
            <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
              <p className="text-sm font-semibold mb-2">⚠️ Wrong Network</p>
              <p className="text-sm text-yellow-800 mb-3">
                Please switch to Base Sepolia to use this demo
              </p>
              <button
                onClick={handleSwitchChain}
                className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg text-sm font-semibold"
              >
                Switch to Base Sepolia
              </button>
            </div>
          ) : isLoading ? (
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm">⏳ Loading smart wallet...</p>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
              <p className="text-sm text-red-600">❌ Error: {error}</p>
            </div>
          ) : (
            <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
              <p className="text-sm font-semibold mb-2">✅ Custom Smart Wallet Ready on Base Sepolia</p>
              <div className="space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span>Base Sepolia:</span>
                  <span className={isDeployed[TARGET_CHAIN_ID] ? 'text-green-600' : 'text-yellow-600'}>
                    {isDeployed[TARGET_CHAIN_ID] ? 'Deployed ✓' : 'Will deploy on first use'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Batch Transaction Demo */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-semibold mb-2">Batch Transaction Demo:</h3>
            <p className="text-sm">Send {AMOUNT} ETH to {RECIPIENT.slice(0, 6)}...{RECIPIENT.slice(-4)}</p>
            <p className="text-sm">3 transfers in a single transaction!</p>
            <div className="mt-2 text-sm space-y-1">
              <p className="font-semibold">Steps:</p>
              <ol className="list-decimal list-inside space-y-1 text-xs">
                <li>Click button below (will deploy wallet if needed)</li>
                <li>Send at least 0.003 ETH to your smart wallet address above</li>
                <li>Click button again to execute batch transaction</li>
              </ol>
            </div>
          </div>

          {/* Execute Button */}
          <button
            onClick={executeBatchTransaction}
            disabled={loading || isLoading || !smartWalletAddress || !isOnCorrectChain}
            className={`w-full py-3 px-6 rounded-lg font-semibold text-white transition-colors
              ${loading || isLoading || !smartWalletAddress || !isOnCorrectChain
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
              }`}
          >
            {!isOnCorrectChain
              ? 'Switch to Base Sepolia First'
              : loading
              ? status
              : isLoading
              ? 'Initializing...'
              : 'Execute Batch Transaction'}
          </button>

          {/* Gasless Transaction Button */}
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-300 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">⚡</span>
              <h3 className="font-bold text-purple-900">Gasless Transaction (Paymaster Sponsored!)</h3>
            </div>
            <p className="text-sm text-purple-800 mb-3">
              Same batch transaction, but the paymaster pays ALL gas fees!
            </p>
            <button
              onClick={executeGaslessTransaction}
              disabled={loading || isLoading || !smartWalletAddress || !isOnCorrectChain || !isDeployed[TARGET_CHAIN_ID]}
              className={`w-full py-3 px-6 rounded-lg font-semibold text-white transition-colors
                ${loading || isLoading || !smartWalletAddress || !isOnCorrectChain || !isDeployed[TARGET_CHAIN_ID]
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700'
                }`}
            >
              {!isOnCorrectChain
                ? 'Switch to Base Sepolia First'
                : !isDeployed[TARGET_CHAIN_ID]
                ? 'Deploy Wallet First (Button Above)'
                : loading
                ? status
                : isLoading
                ? 'Initializing...'
                : '⚡ Execute GASLESS Batch Transaction'}
            </button>
            {isDeployed[TARGET_CHAIN_ID] && (
              <p className="text-xs text-purple-700 mt-2 text-center">
                💡 Your EOA signs the UserOp, paymaster sponsors the gas!
              </p>
            )}
          </div>

          {/* Results */}
          {results.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold">Transaction Results:</h3>
              {results.map((result, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg ${result.status === 'success'
                      ? 'bg-green-50 border border-green-200'
                      : 'bg-red-50 border border-red-200'
                    }`}
                >
                  <p className="font-semibold">{result.chain}</p>
                  {result.status === 'success' ? (
                    <div>
                      {result.message && (
                        <p className="text-sm mb-2 font-semibold">{result.message}</p>
                      )}
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
              🎯 Custom ERC-4337 Smart Wallet
            </p>
            <p className="text-xs text-purple-700">
              • 📦 Batch multiple transactions into one<br />
              • 🔑 Controlled by your MetaMask<br />
              • 🌐 Same address on all chains (CREATE2)<br />
              • ⚡ Next: Add paymaster for gasless transactions
            </p>
          </div>

          {/* Warning */}
          <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg text-sm">
            <p className="font-semibold mb-1">⚠️ Important Notes:</p>
            <ul className="list-disc list-inside space-y-1 text-yellow-800">
              <li>Your smart wallet address: <code className="bg-yellow-100 px-1">{smartWalletAddress?.slice(0, 10)}...</code></li>
              <li>Fund this address on Base Sepolia to execute transactions</li>
              <li>Current version: Direct contract calls (not using bundlers yet)</li>
              <li>Phase 3 will add full ERC-4337 with paymasters for gasless transactions</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
