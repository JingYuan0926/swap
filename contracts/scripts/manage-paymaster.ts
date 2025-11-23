import hre from "hardhat";
import { JsonRpcProvider, Wallet, Contract, parseEther, formatEther } from "ethers";
import * as fs from "fs";
import * as path from "path";

const PAYMASTER_ADDRESSES: Record<string, string> = {
  baseSepolia: "0x93EbD2447D409eEAbf01C86d665eaCAa32996c85",
  sepolia: "0x1508e3B458fE052f1b6BBb6373B10C6E5249bbf3",
  arbitrumSepolia: "0xCC8768f032A4098eA4d53C71BE124F7e86a0913d",
};

const ENTRYPOINT_ADDRESS = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";

// Smart wallet to sponsor (update this with your wallet address)
const WALLET_TO_SPONSOR = "0x494b1c2408c5f2ea121a94b85288c4199ce71a3c";

async function main() {
  // Get network from command line args
  const networkArg = process.argv.find(arg => arg.startsWith('--network='))?.split('=')[1]
    || process.argv[process.argv.indexOf('--network') + 1];

  const networkName = networkArg || 'baseSepolia';

  console.log(`\n🔧 Paymaster Management Tool`);
  console.log(`Network: ${networkName}`);

  // Get paymaster address for current network
  const paymasterAddress = PAYMASTER_ADDRESSES[networkName];
  if (!paymasterAddress) {
    console.error(`❌ No paymaster address for network: ${networkName}`);
    console.log(`Available networks: ${Object.keys(PAYMASTER_ADDRESSES).join(', ')}`);
    process.exit(1);
  }

  // RPC URLs from hardhat.config.ts
  const RPC_URLS: Record<string, string> = {
    baseSepolia: process.env.BASE_RPC_URL || "https://sepolia.base.org",
    sepolia: process.env.SEPOLIA_RPC_URL || "https://rpc.sepolia.org",
    arbitrumSepolia: process.env.ARBITRUM_RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc",
  };

  const rpcUrl = RPC_URLS[networkName];
  if (!rpcUrl) {
    console.error(`❌ No RPC URL for network: ${networkName}`);
    process.exit(1);
  }

  // Setup provider and signer
  const provider = new JsonRpcProvider(rpcUrl);

  if (!process.env.PRIVATE_KEY) {
    console.error("❌ PRIVATE_KEY not found in environment");
    process.exit(1);
  }
  const deployer = new Wallet(process.env.PRIVATE_KEY, provider);
  console.log(`Deployer: ${deployer.address}\n`);

  // Load contract ABIs
  const paymasterArtifactPath = path.join(process.cwd(), "artifacts/contracts/CustomPaymaster.sol/CustomPaymaster.json");
  const paymasterArtifact = JSON.parse(fs.readFileSync(paymasterArtifactPath, "utf-8"));

  // Minimal IEntryPoint ABI - just the functions we need
  const entryPointABI = [
    "function balanceOf(address account) view returns (uint256)",
    "function getDepositInfo(address account) view returns (tuple(uint256 deposit, bool staked, uint112 stake, uint32 unstakeDelaySec, uint48 withdrawTime))",
  ];

  // Get contract instances
  const paymaster = new Contract(paymasterAddress, paymasterArtifact.abi, deployer);
  const entryPoint = new Contract(ENTRYPOINT_ADDRESS, entryPointABI, deployer);

  // Check current balances
  const paymasterBalance = await entryPoint.balanceOf(paymasterAddress);
  const paymasterStake = await entryPoint.getDepositInfo(paymasterAddress);

  console.log(`📊 Current Status:`);
  console.log(`   Paymaster Address: ${paymasterAddress}`);
  console.log(`   Balance in EntryPoint: ${formatEther(paymasterBalance)} ETH`);
  console.log(`   Stake: ${formatEther(paymasterStake.stake)} ETH`);
  console.log(`   Staked: ${paymasterStake.staked}`);
  console.log(`   Unstake Delay: ${paymasterStake.unstakeDelaySec}s`);
  console.log(`   Withdraw Time: ${paymasterStake.withdrawTime}\n`);

  // Deposit funds to paymaster
  const DEPOSIT_AMOUNT = "0.01"; // 0.01 ETH
  console.log(`💰 Depositing ${DEPOSIT_AMOUNT} ETH to paymaster...`);
  const depositTx = await paymaster.deposit({ value: parseEther(DEPOSIT_AMOUNT) });
  console.log(`   Transaction sent: ${depositTx.hash}`);
  await depositTx.wait();
  console.log(`   ✅ Deposit confirmed!\n`);

  // Add stake (required for paymaster to operate)
  const STAKE_AMOUNT = "0.01"; // 0.01 ETH
  const UNSTAKE_DELAY = 86400; // 1 day in seconds
  console.log(`🔒 Adding ${STAKE_AMOUNT} ETH stake (unstake delay: ${UNSTAKE_DELAY}s)...`);
  const stakeTx = await paymaster.addStake(UNSTAKE_DELAY, { value: parseEther(STAKE_AMOUNT) });
  console.log(`   Transaction sent: ${stakeTx.hash}`);
  await stakeTx.wait();
  console.log(`   ✅ Stake confirmed!\n`);

  // Sponsor the smart wallet
  if (WALLET_TO_SPONSOR && WALLET_TO_SPONSOR !== "0x0000000000000000000000000000000000000000") {
    console.log(`🎯 Sponsoring smart wallet: ${WALLET_TO_SPONSOR}...`);

    // Check if already sponsored
    const isAlreadySponsored = await paymaster.sponsoredWallets(WALLET_TO_SPONSOR);
    if (isAlreadySponsored) {
      console.log(`   ℹ️  Wallet is already sponsored!\n`);
    } else {
      const sponsorTx = await paymaster.sponsorWallet(WALLET_TO_SPONSOR);
      console.log(`   Transaction sent: ${sponsorTx.hash}`);
      await sponsorTx.wait();
      console.log(`   ✅ Wallet sponsored!\n`);
    }

    // Verify sponsorship
    const isSponsored = await paymaster.sponsoredWallets(WALLET_TO_SPONSOR);
    console.log(`   Verification - Sponsored: ${isSponsored}\n`);
  }

  // Final status
  const finalBalance = await entryPoint.balanceOf(paymasterAddress);
  const finalStake = await entryPoint.getDepositInfo(paymasterAddress);
  console.log(`\n✅ Final Status:`);
  console.log(`   Paymaster Balance: ${formatEther(finalBalance)} ETH`);
  console.log(`   Paymaster Stake: ${formatEther(finalStake.stake)} ETH`);
  console.log(`   Ready to sponsor transactions: ${finalStake.staked}`);
  if (WALLET_TO_SPONSOR && WALLET_TO_SPONSOR !== "0x0000000000000000000000000000000000000000") {
    const isSponsoredFinal = await paymaster.sponsoredWallets(WALLET_TO_SPONSOR);
    console.log(`   Smart Wallet ${WALLET_TO_SPONSOR} sponsored: ${isSponsoredFinal}`);
  }
  console.log();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
