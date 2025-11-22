import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

// ERC-4337 EntryPoint v0.7 - same address on all chains
const ENTRYPOINT_ADDRESS = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";

export default buildModule("SmartWalletModule", (m) => {
  // Deploy the SmartWalletFactory with EntryPoint address
  const factory = m.contract("SmartWalletFactory", [ENTRYPOINT_ADDRESS]);

  // Return the deployed contracts
  return { factory };
});
