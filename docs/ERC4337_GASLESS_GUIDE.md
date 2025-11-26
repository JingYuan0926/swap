# ERC-4337 Gasless Smart Wallet System

## 📋 Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Contract Addresses](#contract-addresses)
4. [Components Deep Dive](#components-deep-dive)
5. [Transaction Flow](#transaction-flow)
6. [Code Explanations](#code-explanations)
7. [Usage Guide](#usage-guide)
8. [Troubleshooting](#troubleshooting)

---

## Overview

This project implements a **fully functional ERC-4337 Account Abstraction system** with **gasless transactions** using a custom paymaster. Users can execute batch transactions without paying gas fees.

### What You Built:
✅ **Custom ERC-4337 v0.7 compliant smart wallet**
✅ **Batch transaction support** (send multiple transactions in one)
✅ **Custom paymaster** for gasless transaction sponsorship
✅ **Direct EntryPoint integration** (no centralized bundler needed)
✅ **CREATE2 factory** for deterministic addresses across chains

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    ERC-4337 Architecture                     │
└─────────────────────────────────────────────────────────────┘

    ┌──────────────┐
    │   Your EOA   │  (MetaMask)
    │  0x9787...   │  Signs UserOps
    └──────┬───────┘
           │ 1. Sign UserOperation
           ▼
    ┌──────────────────────────────────────┐
    │         EntryPoint v0.7              │
    │  0x0000000071727De22E5E9d8BAf0ed... │
    │  (Official ERC-4337 contract)        │
    └──────┬───────────────────────────────┘
           │ 2. Validate & Execute
           ├────────────────┬─────────────┐
           ▼                ▼             ▼
    ┌─────────────┐  ┌──────────────┐  ┌────────────┐
    │ Smart Wallet│  │  Paymaster   │  │  Factory   │
    │ 0x494b1c... │  │  0x93EbD2... │  │ 0x90da4b...│
    │ (Your impl) │  │ (Your impl)  │  │ (Deployer) │
    └─────────────┘  └──────────────┘  └────────────┘
           │                │
           │                │ 3. Pay gas fee
           │                └──────────────►
           │ 4. Execute batch
           └────────────►  [Transactions]
```

---

## Contract Addresses

### Base Sepolia Testnet

| Component | Address | Type |
|-----------|---------|------|
| **Your EOA** | `0x9787cfF89D30bB6Ae87Aaad9B3a02E77B5caA8f1` | Externally Owned Account |
| **Smart Wallet** | `0x494b1c2408C5F2eA121a94B85288c4199cE71A3c` | Custom Contract |
| **Paymaster** | `0x93EbD2447D409eEAbf01C86d665eaCAa32996c85` | Custom Contract |
| **Factory** | `0x90da4b4B5DeC86d0059eC0161fB269B9d56C334F` | Custom Contract |
| **EntryPoint** | `0x0000000071727De22E5E9d8BAf0edAc6f37da032` | Official v0.7 |

### Other Networks (Sepolia, Arbitrum Sepolia)

See `lib/custom-wallet-config.ts` for all deployed addresses.

---

## Components Deep Dive

### 1. EntryPoint (Official Contract)

**Address**: `0x0000000071727De22E5E9d8BAf0edAc6f37da032`

The **EntryPoint** is the core of ERC-4337. It's deployed by the Ethereum Foundation and exists at the same address on all chains.

**Key Functions**:
- `handleOps(PackedUserOperation[] ops, address beneficiary)` - Executes user operations
- `getNonce(address sender, uint192 key)` - Gets nonce for a smart wallet
- `balanceOf(address account)` - Gets paymaster/wallet balance
- `depositTo(address account)` - Deposits ETH for gas payments

**Role**:
1. Receives signed UserOperations from your EOA
2. Validates the UserOp by calling your smart wallet's `validateUserOp()`
3. Checks if paymaster will sponsor the transaction
4. Executes the transaction
5. Charges gas to the paymaster (or wallet if no paymaster)

---

### 2. Smart Wallet (CustomSmartWallet.sol)

**Address**: `0x494b1c2408C5F2eA121a94B85288c4199cE71A3c`
**Source**: `contracts/contracts/CustomSmartWallet.sol`

Your programmable wallet that you control with your MetaMask.

#### Key Code Sections:

##### a) Constructor & Ownership
```solidity
address public owner;  // Your MetaMask address
address public immutable entryPoint;  // EntryPoint contract

constructor(address _owner, address _entryPoint) {
    owner = _owner;
    entryPoint = _entryPoint;
}
```
- **Owner**: Your EOA that controls this wallet
- **EntryPoint**: The only address allowed to execute transactions via `validateUserOp()`

##### b) ERC-4337 Validation
```solidity
function validateUserOp(
    PackedUserOperation calldata userOp,
    bytes32 userOpHash,
    uint256 missingAccountFunds
) external onlyEntryPoint returns (uint256 validationData) {
    // 1. Verify signature is from owner
    bytes32 hash = ECDSA.toEthSignedMessageHash(userOpHash);
    address signer = ECDSA.recover(hash, userOp.signature);

    if (signer != owner) {
        return 1; // SIG_VALIDATION_FAILED
    }

    // 2. Pay EntryPoint if needed (when not using paymaster)
    if (missingAccountFunds > 0) {
        (bool success,) = payable(msg.sender).call{value: missingAccountFunds}("");
        require(success, "Payment failed");
    }

    return 0; // Success
}
```

**What happens here**:
1. EntryPoint calls this function with the UserOperation
2. Wallet verifies the signature matches the owner
3. If no paymaster, wallet pays EntryPoint for gas
4. Returns 0 (success) or 1 (failure)

##### c) Batch Execution
```solidity
struct Call {
    address target;
    uint256 value;
    bytes data;
}

function executeBatch(Call[] calldata calls) external onlyOwnerOrEntryPoint {
    uint256 batchId = _nonce++;

    for (uint256 i = 0; i < calls.length; i++) {
        _call(calls[i].target, calls[i].value, calls[i].data);
    }

    emit BatchExecuted(batchId, calls.length);
}
```

**What this enables**:
- Send multiple transactions in a single on-chain transaction
- Example: Send ETH to 3 different addresses at once
- Saves gas compared to 3 separate transactions

---

### 3. Paymaster (CustomPaymaster.sol)

**Address**: `0x93EbD2447D409eEAbf01C86d665eaCAa32996c85`
**Source**: `contracts/contracts/CustomPaymaster.sol`

Your custom paymaster that sponsors gas fees for whitelisted wallets.

#### Key Code Sections:

##### a) Wallet Whitelist
```solidity
mapping(address => bool) public sponsoredWallets;

function sponsorWallet(address wallet) external {
    sponsoredWallets[wallet] = true;
    emit WalletSponsored(wallet, true);
}
```
- **Public function**: Anyone can call to whitelist a wallet
- **Owner-only function**: `setSponsoredWallet()` for admin control
- Your wallet `0x494b1c24...` is whitelisted ✅

##### b) Validation & Sponsorship
```solidity
function _validatePaymasterUserOp(
    PackedUserOperation calldata userOp,
    bytes32 userOpHash,
    uint256 maxCost
) internal view override returns (bytes memory context, uint256 validationData) {
    address wallet = userOp.sender;

    // Check if wallet is sponsored
    require(sponsoredWallets[wallet], "Wallet not sponsored");

    // Check paymaster has enough funds
    require(paymasterBalance() >= maxCost, "Paymaster: insufficient funds");

    return ("", 0);  // Approve sponsorship
}
```

**What happens here**:
1. EntryPoint asks: "Will you sponsor this transaction?"
2. Paymaster checks if wallet is whitelisted
3. Paymaster checks if it has enough ETH deposited
4. Returns approval (or reverts if not sponsored)

##### c) Funding & Staking
```solidity
// Inherited from BasePaymaster
function deposit() public payable;
function addStake(uint32 unstakeDelaySec) external payable onlyOwner;
```

**Current Status**:
- **Deposit**: 0.03 ETH (used to pay gas fees)
- **Stake**: 0.02 ETH (required by EntryPoint for trust)
- **Staked**: ✅ Yes
- **Unstake Delay**: 86400 seconds (1 day)

---

### 4. Factory (SmartWalletFactory.sol)

**Address**: `0x90da4b4B5DeC86d0059eC0161fB269B9d56C334F`
**Source**: `contracts/contracts/SmartWalletFactory.sol`

Deploys smart wallets using CREATE2 for deterministic addresses.

#### Key Code:

```solidity
function createWallet(address owner, bytes32 salt) public returns (address wallet) {
    bytes memory bytecode = abi.encodePacked(
        type(CustomSmartWallet).creationCode,
        abi.encode(owner, entryPoint)
    );

    assembly {
        wallet := create2(0, add(bytecode, 32), mload(bytecode), salt)
    }

    emit WalletCreated(wallet, owner, salt);
}
```

**CREATE2 Benefits**:
- Same wallet address across all chains (if using same salt)
- Wallet address is predictable before deployment
- Can compute address off-chain using `getAddress()`

---

### 5. Bundler (The Relayer)

**Location**: `packages/bundler`
**Beneficiary Address**: `0x9787cfF89D30bB6Ae87Aaad9B3a02E77B5caA8f1` (Receives gas refunds)
**Signer Address**: `0x4E3D79046314e7Ed6e8B782cA7A50E58569410bB` (Signs transactions, pays gas initially)

The **Bundler** is a specialized node that listens for UserOperations, validates them, and relays them to the blockchain. It acts as the "miner" for Account Abstraction, ensuring that UserOps are valid before submitting them to the EntryPoint.

#### Key Code Sections:

##### a) Bundle Management (`BundleManager.ts`)
This is the core logic that decides when and what to bundle.

```typescript
// packages/bundler/src/modules/BundleManager.ts

async sendNextBundle(): Promise<SendBundleReturn | undefined> {
  // 1. Check if we have enough UserOps (autoBundleMempoolSize)
  // 2. Create a bundle (array of UserOps)
  const [bundle] = await this.createBundle(0, 0, 0);
  
  // 3. Submit to EntryPoint
  const ret = await this.sendBundle(bundle, [], beneficiary, storageMap);
  
  // 4. Cache tx hash for instant receipt lookup
  for (const userOpHash of hashes) {
    this.userOpToTxHash.set(userOpHash, ret.transactionHash);
  }
}
```

##### b) Validation (`MethodHandlerERC4337.ts`)
Before accepting a UserOp, the bundler simulates it off-chain to ensure it won't revert (which would cost the bundler gas).

```typescript
// packages/bundler/src/MethodHandlerERC4337.ts

async _validateParameters(userOp, entryPointInput) {
  // 1. Check basic fields (sender, nonce, etc.)
  // 2. Simulate validation on-chain (eth_call)
  // 3. Check if paymaster has enough deposit
  // 4. Check if sender has enough stake (if required)
}
```

#### Configuration Deep Dive:

The bundler is configured via `localconfig/bundler.base-sepolia.config.json`. Here's what the settings mean:

```json
{
  "network": "https://sepolia-preconf.base.org",  // RPC Endpoint
  "entryPoint": "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
  "beneficiary": "0x9787cfF89D30bB6Ae87Aaad9B3a02E77B5caA8f1", // Your EOA
  "minBalance": "0.1",           // Minimum ETH signer needs
  "autoBundleMempoolSize": 1,    // CRITICAL: Send bundle immediately (1 UserOp)
  "autoBundleInterval": 3,       // Check mempool every 3 seconds
  "unsafe": true,                // Allow local debugging/bypass some checks
  "paymasterAddresses": ["0x93EbD2..."], // Whitelisted paymasters
  "mnemonic": "./localconfig/mnemonic.txt" // Signer's private key source
}
```

- **`autoBundleMempoolSize: 1`**: We set this to 1 for testing so transactions send immediately. In production, you might set this higher (e.g., 10) to batch more UserOps and save gas.
- **`beneficiary`**: This address receives the "profit" (unused gas) from the EntryPoint.
- **`unsafe: true`**: Disables some strict ERC-4337 checks (like storage rules) which is useful for testing on testnets.

#### Running the Bundler:

To start the bundler service:

```bash
cd packages/bundler
node ../../node_modules/ts-node/dist/bin.js ./src/exec.ts --config ./localconfig/bundler.base-sepolia.config.json
```

**What happens when it runs:**
1. Connects to Base Sepolia RPC.
2. Loads your EOA signer from `mnemonic.txt`.
3. Starts an RPC server at `http://localhost:4337`.
4. Polls the mempool every 3 seconds (`autoBundleInterval`).
5. When a UserOp arrives, it validates it, bundles it, and sends the transaction.
6. It caches the transaction hash so your frontend gets an instant receipt.

---

## Transaction Flow

### Gasless Batch Transaction (Step-by-Step)

#### 1. Frontend: Build UserOperation
**File**: `lib/userop-builder.ts`

```typescript
export function buildUserOp({
  sender,          // Smart wallet address
  nonce,           // From EntryPoint.getNonce()
  callData,        // Encoded executeBatch() call
  chainId,
  usePaymaster = true,
}: BuildUserOpParams): PackedUserOperation {
  // Pack gas limits (16 bytes each)
  const accountGasLimits = packUint128(verificationGasLimit, callGasLimit);

  // Pack gas fees (16 bytes each)
  const gasFees = packUint128(maxPriorityFeePerGas, maxFeePerGas);

  // Build paymaster data
  const paymasterAndData = usePaymaster
    ? buildPaymasterAndData(chainId)  // Include paymaster address + gas limits
    : '0x';

  return {
    sender,
    nonce,
    initCode: '0x',  // Empty if wallet already deployed
    callData,
    accountGasLimits,
    preVerificationGas: 50000n,
    gasFees,
    paymasterAndData,
    signature: '0x',  // Will be filled after signing
  };
}
```

#### 2. Frontend: Sign UserOp Hash
**File**: `hooks/useCustomSmartWallet.ts`

```typescript
// Get the hash that needs to be signed
const userOpHash = getUserOpHash(userOp, chainId);

// Sign with MetaMask
const signature = await walletClient.signMessage({
  account: eoaAddress,
  message: { raw: userOpHash },
});

// Add signature to UserOp
userOp.signature = signature;
```

**Hash Calculation**:
```typescript
export function getUserOpHash(userOp: PackedUserOperation, chainId: number): Hex {
  // 1. Pack UserOp (hash all fields except signature)
  const packedUserOp = packUserOp(userOp);
  const userOpHash = keccak256(packedUserOp);

  // 2. Add EntryPoint address and chainId (prevents replay attacks)
  const encoded = encodeAbiParameters(
    parseAbiParameters('bytes32, address, uint256'),
    [userOpHash, ENTRYPOINT_ADDRESS, BigInt(chainId)]
  );

  return keccak256(encoded);
}
```

**Why this hash?**
- Includes ALL UserOp data (sender, nonce, callData, gas limits, etc.)
- Includes EntryPoint address (prevents replay on different EntryPoint)
- Includes chainId (prevents replay across chains)
- This is what you sign with your EOA

#### 3. Frontend: Submit to EntryPoint
```typescript
const hash = await walletClient.writeContract({
  address: ENTRYPOINT_ADDRESS,
  abi: entryPointAbi,
  functionName: 'handleOps',
  args: [[userOp], eoaAddress],  // Array of UserOps, beneficiary (gets refunded gas)
});
```

#### 4. EntryPoint: Validate UserOp
**On-chain sequence**:

```
EntryPoint.handleOps()
  ├─► 1. Loop through UserOps
  ├─► 2. For each UserOp:
  │     ├─► Call SmartWallet.validateUserOp()
  │     │     ├─► Verify signature
  │     │     └─► Return 0 (success) or 1 (fail)
  │     │
  │     ├─► If paymaster specified:
  │     │     └─► Call Paymaster._validatePaymasterUserOp()
  │     │           ├─► Check if wallet is sponsored
  │     │           └─► Return approval
  │     │
  │     ├─► Execute SmartWallet.executeBatch()
  │     │     └─► Send ETH / Call contracts
  │     │
  │     └─► Charge gas to Paymaster
  │           └─► Deduct from Paymaster's EntryPoint deposit
  └─► 3. Refund excess gas to beneficiary (your EOA)
```

#### 5. On-Chain Execution

**What the transaction looks like**:

| Field | Value |
|-------|-------|
| **From** | Your EOA (0x9787...) |
| **To** | EntryPoint (0x00000000...) |
| **Function** | `handleOps([UserOp], beneficiary)` |
| **Gas Paid By** | Your EOA (for the handleOps call) |
| **Internal Gas Paid By** | Paymaster (for the actual execution) |

**Internal Transactions**:
1. EntryPoint → SmartWallet: `validateUserOp()` ✅
2. EntryPoint → Paymaster: `_validatePaymasterUserOp()` ✅
3. EntryPoint → SmartWallet: `executeBatch()` ✅
   - SmartWallet → Address1: 0.001 ETH
   - SmartWallet → Address2: 0.001 ETH
   - SmartWallet → Address3: 0.001 ETH
4. Paymaster → EntryPoint: Gas payment deducted from deposit
5. EntryPoint → Your EOA: Refund excess gas

---

## Code Explanations

### UserOperation Packing (ERC-4337 v0.7)

**Why packing?**
ERC-4337 v0.7 uses **packed data** to save gas. Instead of separate fields for gas limits and fees, they're combined into single 32-byte values.

#### Gas Limits Packing
```typescript
function packUint128(high: bigint, low: bigint): Hex {
  const highHex = pad(toHex(high), { size: 16 });  // 16 bytes
  const lowHex = pad(toHex(low), { size: 16 });    // 16 bytes
  return concat([highHex, lowHex]);                // 32 bytes total
}

// Example:
accountGasLimits = packUint128(
  verificationGasLimit,  // 200000 (for validateUserOp)
  callGasLimit          // 200000 (for executeBatch)
);
// Result: 0x00030d4000000000000000000000000000030d40
```

#### Paymaster Data Format
```typescript
function buildPaymasterAndData(chainId: number): Hex {
  const paymasterAddress = PAYMASTER_ADDRESSES[chainId];  // 20 bytes
  const gasLimits = packUint128(
    paymasterVerificationGasLimit,  // 100000
    paymasterPostOpGasLimit        // 50000
  );  // 32 bytes

  return concat([paymasterAddress, gasLimits]);
  // Total: 52 bytes (20 + 32)
}
```

**Structure**:
- Bytes 0-19: Paymaster address
- Bytes 20-35: Verification gas limit (16 bytes)
- Bytes 36-51: Post-op gas limit (16 bytes)
- Bytes 52+: Custom paymaster data (empty in our case)

---

### Signature Validation

#### On-Chain (Solidity)
```solidity
function validateUserOp(
    PackedUserOperation calldata userOp,
    bytes32 userOpHash,  // Already hashed by EntryPoint
    uint256 missingAccountFunds
) external onlyEntryPoint returns (uint256 validationData) {
    // 1. Add Ethereum signed message prefix
    bytes32 hash = ECDSA.toEthSignedMessageHash(userOpHash);
    // Result: keccak256("\x19Ethereum Signed Message:\n32" + userOpHash)

    // 2. Recover signer from signature
    address signer = ECDSA.recover(hash, userOp.signature);

    // 3. Check if signer is the owner
    if (signer != owner) {
        return 1; // SIG_VALIDATION_FAILED
    }

    return 0; // SUCCESS
}
```

#### Off-Chain (TypeScript)
```typescript
// Sign the hash with MetaMask
const signature = await walletClient.signMessage({
  account: eoaAddress,
  message: { raw: userOpHash },  // MetaMask adds the prefix automatically
});
```

**Important**: MetaMask automatically adds `"\x19Ethereum Signed Message:\n32"` prefix when signing. The smart contract must use `toEthSignedMessageHash()` to match this.

---

## Usage Guide

### Setup (Already Done)

1. ✅ Deployed CustomSmartWallet factory
2. ✅ Deployed CustomPaymaster
3. ✅ Funded paymaster with 0.03 ETH
4. ✅ Staked paymaster with 0.02 ETH
5. ✅ Deployed your smart wallet
6. ✅ Sponsored your wallet in paymaster

### Executing Gasless Transactions

#### Via UI:
1. Open `http://localhost:3000`
2. Connect MetaMask (Base Sepolia)
3. Click **"⚡ Execute GASLESS Batch Transaction"**
4. Sign the UserOp (just a signature, not a transaction)
5. Wait for confirmation ✅

#### Via Code:
```typescript
import { useCustomSmartWallet } from '@/hooks/useCustomSmartWallet';

const { sendEthBatchGasless } = useCustomSmartWallet();

// Execute gasless batch
const result = await sendEthBatchGasless(84532, [
  { to: '0x...address1', amount: '0.001' },
  { to: '0x...address2', amount: '0.001' },
  { to: '0x...address3', amount: '0.001' },
]);

console.log('Transaction hash:', result.hash);
console.log('UserOp hash:', result.userOpHash);
```

### Adding More Sponsored Wallets

#### Option 1: Public Self-Service
Any user can sponsor their own wallet:

```bash
cd contracts
npx hardhat run scripts/sponsor-wallet.ts --network baseSepolia
```

Update `WALLET_TO_SPONSOR` in the script first.

#### Option 2: Owner Batch Sponsorship
```typescript
// In paymaster contract (owner only)
await paymaster.batchSetSponsoredWallets(
  [wallet1, wallet2, wallet3],
  true  // sponsored = true
);
```

### Funding the Paymaster

When paymaster runs low on ETH:

```bash
cd contracts
npx hardhat run scripts/manage-paymaster.ts --network baseSepolia
```

This will:
- Deposit more ETH
- Add more stake if needed
- Show current status

---

## Troubleshooting

### Issue 1: "Wallet not sponsored"

**Error**: Transaction reverts with "Wallet not sponsored"

**Solution**:
```bash
# Check if wallet is sponsored
cast call 0x93EbD2447D409eEAbf01C86d665eaCAa32996c85 \
  "sponsoredWallets(address)(bool)" \
  0x494b1c2408C5F2eA121a94B85288c4199cE71A3c \
  --rpc-url https://sepolia.base.org

# If false, sponsor it:
cd contracts
npx hardhat run scripts/sponsor-wallet.ts --network baseSepolia
```

### Issue 2: "Paymaster: insufficient funds"

**Error**: Transaction reverts because paymaster doesn't have enough ETH

**Check balance**:
```bash
cast call 0x0000000071727De22E5E9d8BAf0edAc6f37da032 \
  "balanceOf(address)(uint256)" \
  0x93EbD2447D409eEAbf01C86d665eaCAa32996c85 \
  --rpc-url https://sepolia.base.org
```

**Fund paymaster**:
```bash
cd contracts
npx hardhat run scripts/manage-paymaster.ts --network baseSepolia
```

### Issue 3: "Invalid signature" (SIG_VALIDATION_FAILED)

**Error**: validateUserOp returns 1

**Possible causes**:
1. Wrong UserOp hash calculation
2. Signing with wrong account
3. Missing Ethereum signed message prefix

**Debug**:
```typescript
// Check who signed
const userOpHash = getUserOpHash(userOp, chainId);
const hash = hashMessage({ raw: userOpHash });
const signer = await recoverMessageAddress({
  message: { raw: userOpHash },
  signature: userOp.signature,
});

console.log('Expected signer (owner):', smartWalletOwner);
console.log('Actual signer:', signer);
```

### Issue 4: "execution reverted" but transaction succeeds

**Situation**: Transaction on BaseScan shows "Success" but internal execution failed

**Why**: EntryPoint.handleOps() succeeded, but the actual UserOp execution failed (e.g., smart wallet has no ETH to transfer)

**Check**:
1. Go to "Internal Txns" tab on BaseScan
2. Look for failed internal calls
3. Common issue: Smart wallet trying to send ETH but has 0 balance

**Solution for ETH transfers**:
```bash
# Fund your smart wallet
# Send ETH to: 0x494b1c2408C5F2eA121a94B85288c4199cE71A3c
```

**Note**: For pure gasless contract calls (no ETH value), wallet doesn't need funding!

### Issue 5: "AA10 sender already constructed"

**Error**: Cannot deploy wallet that already exists

**Solution**: Wallet is already deployed! Just use it. Check deployment status:
```typescript
const code = await publicClient.getBytecode({
  address: smartWalletAddress,
});

if (code && code !== '0x') {
  console.log('Wallet already deployed ✅');
}
```

---

## Key Takeaways

### What's "Gasless"?

**Paymaster pays**: Gas fees for the transaction execution
**Wallet still needs**: ETH if it's transferring ETH (the actual value being sent)

**Example 1** (needs ETH):
```typescript
// Smart wallet sends 0.003 ETH to 3 addresses
// Paymaster pays: ~0.00001 ETH (gas)
// Wallet needs: 0.003 ETH (the actual transfers)
```

**Example 2** (truly gasless):
```typescript
// Smart wallet calls ERC-20 approve() or any contract function with value=0
// Paymaster pays: ~0.00001 ETH (gas)
// Wallet needs: 0 ETH ✅ Completely free!
```

### ERC-4337 Benefits

1. **Account Abstraction**: Wallets are smart contracts, not just key pairs
2. **Gasless Transactions**: Paymasters sponsor users
3. **Batch Operations**: Multiple actions in one transaction
4. **Social Recovery**: Implement multi-sig, guardians, etc.
5. **Session Keys**: Temporary permissions for dApps
6. **Custom Logic**: Any validation logic (not just ECDSA signatures)

### Your Implementation

**What makes it special**:
- ✅ No centralized bundler (direct EntryPoint integration)
- ✅ Full control over paymaster logic (whitelist, limits, etc.)
- ✅ Custom wallet features (batch transactions, ownership transfer)
- ✅ Production-ready on Base Sepolia
- ✅ Extensible for more features

---

## Next Steps

### Potential Enhancements

1. **Multi-Chain Support**:
   - Deploy same wallet address on Sepolia, Arbitrum Sepolia
   - Use same factory on all chains
   - Single wallet, multiple networks

2. **Session Keys**:
   - Allow dApps temporary permissions
   - User approves once, dApp can act within limits

3. **Social Recovery**:
   - Add guardian addresses
   - Recover wallet if you lose private key

4. **Spending Limits**:
   - Daily/weekly spending caps
   - Automatic risk management

5. **Bundler Integration**:
   - Use bundlers like Pimlico or Alchemy for mempool relay
   - Better UX (no need for EOA to submit transactions)

6. **Paymaster Improvements**:
   - ERC-20 token payments (pay gas in USDC)
   - Rate limiting
   - Per-wallet spending limits
   - Time-based sponsorship (e.g., 10 free transactions per day)

---

## Resources

### Official Documentation
- [ERC-4337 Specification](https://eips.ethereum.org/EIPS/eip-4337)
- [Account Abstraction Official Site](https://www.erc4337.io/)
- [EntryPoint Contract](https://github.com/eth-infinitism/account-abstraction/tree/develop/contracts/core)

### Your Contract Files
- Smart Wallet: `contracts/contracts/CustomSmartWallet.sol`
- Paymaster: `contracts/contracts/CustomPaymaster.sol`
- Factory: `contracts/contracts/SmartWalletFactory.sol`
- Frontend Hook: `hooks/useCustomSmartWallet.ts`
- UserOp Builder: `lib/userop-builder.ts`

### Useful Commands

```bash
# Check paymaster balance
cast call 0x0000000071727De22E5E9d8BAf0edAc6f37da032 \
  "balanceOf(address)(uint256)" \
  0x93EbD2447D409eEAbf01C86d665eaCAa32996c85 \
  --rpc-url https://sepolia.base.org

# Check if wallet is sponsored
cast call 0x93EbD2447D409eEAbf01C86d665eaCAa32996c85 \
  "sponsoredWallets(address)(bool)" \
  0x494b1c2408C5F2eA121a94B85288c4199cE71A3c \
  --rpc-url https://sepolia.base.org

# Get smart wallet owner
cast call 0x494b1c2408C5F2eA121a94B85288c4199cE71A3c \
  "owner()(address)" \
  --rpc-url https://sepolia.base.org

# Get nonce from EntryPoint
cast call 0x0000000071727De22E5E9d8BAf0edAc6f37da032 \
  "getNonce(address,uint192)(uint256)" \
  0x494b1c2408C5F2eA121a94B85288c4199cE71A3c 0 \
  --rpc-url https://sepolia.base.org
```

---

## Success Metrics

Your working gasless transaction:
- **Transaction Hash**: `0xb4efcd00db9e2f65ae7b8e9fa1a9cc2b6cf17059576fbe075a8061b744e43235`
- **Status**: ✅ Success
- **Gas Paid by Paymaster**: 0.000012 ETH
- **ETH Transferred**: 3x 0.001 ETH = 0.003 ETH
- **Your Cost**: $0.00 🎉

**BaseScan**: [View Transaction](https://sepolia.basescan.org/tx/0xb4efcd00db9e2f65ae7b8e9fa1a9cc2b6cf17059576fbe075a8061b744e43235)

---

## Questions?

If you need to reference this in the future or build upon it:

1. All code is in this repository
2. All contracts are deployed and verified on Base Sepolia
3. Paymaster is funded and staked
4. Your wallet is whitelisted

Just run `npm run dev` and start building! 🚀

---

**Built with**: Solidity ^0.8.28, Hardhat, Next.js, Viem, ERC-4337 v0.7
**Network**: Base Sepolia Testnet
**Date**: November 2025
