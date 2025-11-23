import { type Chain, type Address, type Hex } from 'viem';
import { PAYMASTER_ADDRESSES, ENTRYPOINT_ADDRESS } from './custom-wallet-config';

/**
 * Simple paymaster client that returns paymaster data for sponsored transactions
 */
export function createPaymasterClient(chainId: number) {
  const paymasterAddress = PAYMASTER_ADDRESSES[chainId as keyof typeof PAYMASTER_ADDRESSES];

  if (!paymasterAddress) {
    throw new Error(`No paymaster address for chain ${chainId}`);
  }

  return {
    /**
     * Get paymaster and data for a UserOperation
     * This is called by permissionless to get paymaster sponsorship
     */
    async getPaymasterAndData(): Promise<{
      paymaster: Address;
      paymasterData: Hex;
      paymasterVerificationGasLimit: bigint;
      paymasterPostOpGasLimit: bigint;
    }> {
      return {
        paymaster: paymasterAddress,
        paymasterData: '0x' as Hex, // No custom data needed
        paymasterVerificationGasLimit: 100000n,
        paymasterPostOpGasLimit: 50000n,
      };
    },

    paymasterAddress,
  };
}
