import {
  createPublicClient,
  createWalletClient,
  http,
  type Chain,
  type WalletClient,
  type Address,
  type Hex,
  encodeFunctionData,
  parseAbi,
} from "viem";
import { ENTRYPOINT_ADDRESS, FACTORY_ADDRESSES, getBundlerUrl } from "./custom-wallet-config";
import SmartWalletFactoryABI from "./contracts/SmartWalletFactory.json";
import CustomSmartWalletABI from "./contracts/CustomSmartWallet.json";

/**
 * Get the smart wallet address for an owner
 * Uses the factory's getAddressForOwner function
 */
export async function getSmartWalletAddress(
  chain: Chain,
  ownerAddress: Address
): Promise<Address> {
  const factoryAddress = FACTORY_ADDRESSES[chain.id as keyof typeof FACTORY_ADDRESSES];

  if (!factoryAddress) {
    throw new Error(`No factory address for chain ${chain.id}`);
  }

  const publicClient = createPublicClient({
    chain,
    transport: http(getBundlerUrl(chain.id)),
  });

  // Call getAddressForOwner on the factory
  const walletAddress = await publicClient.readContract({
    address: factoryAddress,
    abi: SmartWalletFactoryABI.abi,
    functionName: "getAddressForOwner",
    args: [ownerAddress],
  });

  return walletAddress as Address;
}

/**
 * Check if a smart wallet is deployed on a chain
 */
export async function isSmartWalletDeployed(
  chain: Chain,
  walletAddress: Address
): Promise<boolean> {
  const publicClient = createPublicClient({
    chain,
    transport: http(getBundlerUrl(chain.id)),
  });

  const code = await publicClient.getBytecode({ address: walletAddress });
  return code !== undefined && code !== "0x";
}

/**
 * Deploy a smart wallet using the factory
 * This will only work if called directly (not through ERC-4337)
 * For ERC-4337, the wallet is deployed automatically on first UserOp
 */
export async function deploySmartWallet(
  chain: Chain,
  walletClient: WalletClient,
  ownerAddress: Address
): Promise<Address> {
  const factoryAddress = FACTORY_ADDRESSES[chain.id as keyof typeof FACTORY_ADDRESSES];

  if (!factoryAddress) {
    throw new Error(`No factory address for chain ${chain.id}`);
  }

  // Call createWalletForOwner on the factory
  const hash = await walletClient.writeContract({
    address: factoryAddress,
    abi: SmartWalletFactoryABI.abi,
    functionName: "createWalletForOwner",
    args: [ownerAddress],
    chain,
  });

  // Wait for transaction
  const publicClient = createPublicClient({
    chain,
    transport: http(getBundlerUrl(chain.id)),
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  // Get wallet address from event or call getAddressForOwner
  const walletAddress = await getSmartWalletAddress(chain, ownerAddress);

  return walletAddress;
}

/**
 * Encode a batch of calls for the smart wallet
 */
export function encodeBatchCalls(calls: Array<{ to: Address; value: bigint; data: Hex }>) {
  // Transform calls to match the Call struct in the contract
  const formattedCalls = calls.map(call => ({
    target: call.to,
    value: call.value,
    data: call.data,
  }));

  return encodeFunctionData({
    abi: CustomSmartWalletABI.abi,
    functionName: "executeBatch",
    args: [formattedCalls],
  });
}

/**
 * Encode a single call for the smart wallet
 */
export function encodeSingleCall(to: Address, value: bigint, data: Hex) {
  return encodeFunctionData({
    abi: CustomSmartWalletABI.abi,
    functionName: "execute",
    args: [to, value, data],
  });
}

/**
 * Get init code for deploying the wallet (for ERC-4337)
 * This is used in the UserOperation when the wallet is not yet deployed
 */
export function getInitCode(ownerAddress: Address, chainId: number): Hex {
  const factoryAddress = FACTORY_ADDRESSES[chainId as keyof typeof FACTORY_ADDRESSES];

  if (!factoryAddress) {
    throw new Error(`No factory address for chain ${chainId}`);
  }

  // Encode the createWalletForOwner call
  const callData = encodeFunctionData({
    abi: SmartWalletFactoryABI.abi,
    functionName: "createWalletForOwner",
    args: [ownerAddress],
  });

  // Init code is factory address + calldata
  return `${factoryAddress}${callData.slice(2)}` as Hex;
}
