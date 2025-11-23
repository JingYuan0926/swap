import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

// ERC-4337 EntryPoint v0.7 - same address on all chains
const ENTRYPOINT_ADDRESS = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";

export default buildModule("PaymasterModule", (m) => {
  // Get the deployer address as the initial owner
  const owner = m.getAccount(0);

  // Deploy the CustomPaymaster with EntryPoint and owner addresses
  const paymaster = m.contract("CustomPaymaster", [ENTRYPOINT_ADDRESS, owner]);

  // Return the deployed contract
  return { paymaster };
});
