import { JsonRpcProvider, Wallet, Contract, parseEther } from "ethers";
import * as fs from "fs";
import * as path from "path";

const PAYMASTER_ADDRESSES: Record<string, string> = {
  baseSepolia: "0x93EbD2447D409eEAbf01C86d665eaCAa32996c85",
  sepolia: "0x1508e3B458fE052f1b6BBb6373B10C6E5249bbf3",
  arbitrumSepolia: "0xCC8768f032A4098eA4d53C71BE124F7e86a0913d",
};

// YOUR SMART WALLET ADDRESS
const WALLET_TO_SPONSOR = "0x494b1c2408c5f2ea121a94b85288c4199ce71a3c";

async function main() {
  // Get network from command line args
  const networkArg = process.argv.find(arg => arg.startsWith('--network='))?.split('=')[1]
    || process.argv[process.argv.indexOf('--network') + 1];

  const networkName = networkArg || 'baseSepolia';

  console.log(`\n🎯 Sponsoring Smart Wallet`);
  console.log(`Network: ${networkName}`);
  console.log(`Wallet to sponsor: ${WALLET_TO_SPONSOR}\n`);

  // Get paymaster address
  const paymasterAddress = PAYMASTER_ADDRESSES[networkName];
  if (!paymasterAddress) {
    console.error(`❌ No paymaster address for network: ${networkName}`);
    process.exit(1);
  }

  // RPC URLs
  const RPC_URLS: Record<string, string> = {
    baseSepolia: process.env.BASE_RPC_URL || "https://sepolia.base.org",
    sepolia: process.env.SEPOLIA_RPC_URL || "https://rpc.sepolia.org",
    arbitrumSepolia: process.env.ARBITRUM_RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc",
  };

  const rpcUrl = RPC_URLS[networkName];
  const provider = new JsonRpcProvider(rpcUrl);

  if (!process.env.PRIVATE_KEY) {
    console.error("❌ PRIVATE_KEY not found in environment");
    process.exit(1);
  }

  const signer = new Wallet(process.env.PRIVATE_KEY, provider);
  console.log(`Your EOA: ${signer.address}\n`);

  // Load paymaster contract ABI
  const paymasterArtifactPath = path.join(process.cwd(), "artifacts/contracts/CustomPaymaster.sol/CustomPaymaster.json");
  const paymasterArtifact = JSON.parse(fs.readFileSync(paymasterArtifactPath, "utf-8"));

  // Get contract instance
  const paymaster = new Contract(paymasterAddress, paymasterArtifact.abi, signer);

  // Check if already sponsored
  const isAlreadySponsored = await paymaster.sponsoredWallets(WALLET_TO_SPONSOR);
  if (isAlreadySponsored) {
    console.log(`✅ Wallet is already sponsored!`);
    console.log(`Your smart wallet can now make gasless transactions.\n`);
    return;
  }

  // Sponsor the wallet
  console.log(`📝 Calling sponsorWallet()...`);
  console.log(`   This will cost gas once (paid by your EOA)`);
  console.log(`   After this, your smart wallet transactions will be gasless!\n`);

  const tx = await paymaster.sponsorWallet(WALLET_TO_SPONSOR);
  console.log(`   Transaction sent: ${tx.hash}`);
  console.log(`   Waiting for confirmation...`);

  await tx.wait();

  console.log(`\n✅ SUCCESS! Your smart wallet is now sponsored!`);
  console.log(`\n🎉 Next steps:`);
  console.log(`   1. Make sure your smart wallet is deployed`);
  console.log(`   2. Try executing a gasless batch transaction`);
  console.log(`   3. The paymaster will pay all gas fees!\n`);

  // Verify sponsorship
  const isSponsored = await paymaster.sponsoredWallets(WALLET_TO_SPONSOR);
  console.log(`Verification - Sponsored: ${isSponsored}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
