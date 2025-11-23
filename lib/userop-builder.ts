import {
  type Address,
  type Chain,
  type Hex,
  encodeFunctionData,
  concat,
  pad,
  toHex,
  keccak256,
  encodeAbiParameters,
  parseAbiParameters,
} from 'viem';
import { PAYMASTER_ADDRESSES, ENTRYPOINT_ADDRESS } from './custom-wallet-config';

/**
 * PackedUserOperation structure for ERC-4337 v0.7
 */
export interface PackedUserOperation {
  sender: Address;
  nonce: bigint;
  initCode: Hex;
  callData: Hex;
  accountGasLimits: Hex; // 16 bytes: verificationGasLimit (16 bytes) + callGasLimit (16 bytes)
  preVerificationGas: bigint;
  gasFees: Hex; // 16 bytes: maxPriorityFeePerGas (16 bytes) + maxFeePerGas (16 bytes)
  paymasterAndData: Hex; // paymaster address + verification gas limits + paymaster-specific data
  signature: Hex;
}

/**
 * Build call data for a single execute
 */
export function buildExecuteCallData(to: Address, value: bigint, data: Hex): Hex {
  return encodeFunctionData({
    abi: [
      {
        name: 'execute',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
          { name: 'target', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'data', type: 'bytes' },
        ],
        outputs: [],
      },
    ],
    functionName: 'execute',
    args: [to, value, data],
  });
}

/**
 * Build call data for a batch execute
 */
export function buildExecuteBatchCallData(calls: Array<{ to: Address; value: bigint; data: Hex }>): Hex {
  return encodeFunctionData({
    abi: [
      {
        name: 'executeBatch',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
          {
            name: 'calls',
            type: 'tuple[]',
            components: [
              { name: 'target', type: 'address' },
              { name: 'value', type: 'uint256' },
              { name: 'data', type: 'bytes' },
            ],
          },
        ],
        outputs: [],
      },
    ],
    functionName: 'executeBatch',
    args: [calls.map(c => ({ target: c.to, value: c.value, data: c.data }))],
  });
}

/**
 * Pack two uint128 values into a single bytes32
 */
function packUint128(high: bigint, low: bigint): Hex {
  const highHex = pad(toHex(high), { size: 16 });
  const lowHex = pad(toHex(low), { size: 16 });
  return concat([highHex, lowHex]);
}

/**
 * Build paymaster and data field
 * Format: paymaster address (20 bytes) + verificationGasLimit (16 bytes) + postOpGasLimit (16 bytes) + paymaster-specific data
 */
export function buildPaymasterAndData(
  chainId: number,
  paymasterVerificationGasLimit: bigint = 100000n,
  paymasterPostOpGasLimit: bigint = 50000n
): Hex {
  const paymasterAddress = PAYMASTER_ADDRESSES[chainId as keyof typeof PAYMASTER_ADDRESSES];
  if (!paymasterAddress) {
    throw new Error(`No paymaster address for chain ${chainId}`);
  }

  // Pack the gas limits into 32 bytes (16 bytes each)
  const gasLimits = packUint128(paymasterVerificationGasLimit, paymasterPostOpGasLimit);

  // Paymaster and data = address + gas limits + custom data (empty for now)
  return concat([paymasterAddress, gasLimits]);
}

/**
 * Build a UserOperation for a smart wallet
 */
export interface BuildUserOpParams {
  sender: Address;
  nonce: bigint;
  callData: Hex;
  chainId: number;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  verificationGasLimit?: bigint;
  callGasLimit?: bigint;
  preVerificationGas?: bigint;
  usePaymaster?: boolean;
}

export function buildUserOp({
  sender,
  nonce,
  callData,
  chainId,
  maxFeePerGas = 2000000000n, // 2 gwei default
  maxPriorityFeePerGas = 1000000000n, // 1 gwei default
  verificationGasLimit = 200000n,
  callGasLimit = 200000n,
  preVerificationGas = 50000n,
  usePaymaster = true,
}: BuildUserOpParams): PackedUserOperation {
  // Pack account gas limits (verification + call)
  const accountGasLimits = packUint128(verificationGasLimit, callGasLimit);

  // Pack gas fees (maxPriorityFee + maxFee)
  const gasFees = packUint128(maxPriorityFeePerGas, maxFeePerGas);

  // Build paymaster and data
  const paymasterAndData = usePaymaster ? buildPaymasterAndData(chainId) : '0x';

  return {
    sender,
    nonce,
    initCode: '0x', // Empty if wallet is already deployed
    callData,
    accountGasLimits,
    preVerificationGas,
    gasFees,
    paymasterAndData,
    signature: '0x', // Will be filled after signing
  };
}

/**
 * Pack a UserOperation for hashing (excluding signature)
 * According to ERC-4337 v0.7 PackedUserOperation format
 */
function packUserOp(userOp: PackedUserOperation): Hex {
  return encodeAbiParameters(
    parseAbiParameters('address, uint256, bytes32, bytes32, bytes32, uint256, bytes32, bytes32'),
    [
      userOp.sender,
      userOp.nonce,
      keccak256(userOp.initCode),
      keccak256(userOp.callData),
      userOp.accountGasLimits,
      userOp.preVerificationGas,
      userOp.gasFees,
      keccak256(userOp.paymasterAndData),
    ]
  );
}

/**
 * Get the hash of a UserOperation for signing
 * This hash is what the smart wallet owner signs
 */
export function getUserOpHash(userOp: PackedUserOperation, chainId: number): Hex {
  // 1. Pack and hash the UserOp
  const packedUserOp = packUserOp(userOp);
  const userOpHash = keccak256(packedUserOp);

  // 2. Encode with EntryPoint address and chain ID, then hash again
  const encoded = encodeAbiParameters(
    parseAbiParameters('bytes32, address, uint256'),
    [userOpHash, ENTRYPOINT_ADDRESS as Address, BigInt(chainId)]
  );

  return keccak256(encoded);
}
