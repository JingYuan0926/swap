# Custom Smart Wallet Contracts

ERC-4337 compliant smart wallet with batch transaction support using **Hardhat v3**.

## 📁 Project Structure

```
contracts/
├── contracts/                  # Solidity smart contracts
│   ├── CustomSmartWallet.sol  # Main ERC-4337 wallet with batch support
│   └── SmartWalletFactory.sol # CREATE2 factory for deterministic deployment
├── ignition/
│   └── modules/
│       └── SmartWallet.ts     # Hardhat Ignition deployment module
├── hardhat.config.ts          # Hardhat v3 configuration
├── package.json               # Dependencies
└── .env                       # Environment variables (create from .env.example)
```

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd contracts
npm install
```

### 2. Set Up Environment

```bash
cp .env.example .env
```

Edit `.env` and add your private key:
```bash
PRIVATE_KEY=your_private_key_here
```

### 3. Compile Contracts

```bash
npm run build
```

### 4. Deploy Contracts

**Deploy to all 3 testnets:**
```bash
npm run deploy:all
```

**Or deploy to individual chains:**
```bash
npm run deploy:base      # Base Sepolia
npm run deploy:sepolia   # Sepolia
npm run deploy:arbitrum  # Arbitrum Sepolia
```

## 📦 Smart Contracts

### CustomSmartWallet.sol

ERC-4337 compliant smart wallet with:
- ✅ **Batch Transactions** - Execute multiple calls in one transaction
- ✅ **ECDSA Validation** - MetaMask compatible signature validation
- ✅ **Owner Control** - Only owner or EntryPoint can execute
- ✅ **Event Logging** - Track all executions and batch operations

**Key Functions:**
- `execute(target, value, data)` - Execute single transaction
- `executeBatch(calls[])` - Execute multiple transactions
- `validateUserOp(...)` - ERC-4337 signature validation
- `transferOwnership(newOwner)` - Change wallet owner

### SmartWalletFactory.sol

Factory contract that:
- ✅ **CREATE2 Deployment** - Deterministic addresses across chains
- ✅ **Counterfactual Addresses** - Get address before deployment
- ✅ **Owner-based Salt** - Uses owner address for predictable deployment

**Key Functions:**
- `createWallet(owner, salt)` - Deploy new wallet
- `createWalletForOwner(owner)` - Deploy using owner as salt
- `getAddress(owner, salt)` - Get counterfactual address
- `getAddressForOwner(owner)` - Get address using owner as salt

## 🌐 Networks Configuration

| Network | Chain ID | RPC URL | Type |
|---------|----------|---------|------|
| **Base Sepolia** | 84532 | https://sepolia.base.org | L2 Testnet |
| **Sepolia** | 11155111 | https://rpc.sepolia.org | L1 Testnet |
| **Arbitrum Sepolia** | 421614 | https://sepolia-rollup.arbitrum.io/rpc | L2 Testnet |

### EntryPoint Address

ERC-4337 EntryPoint v0.7 (same on all chains):
```
0x0000000071727De22E5E9d8BAf0edAc6f37da032
```

## 🛠️ Common Commands

### Compilation
```bash
# Build contracts
npm run build

# Build with production optimization
npx hardhat build --profile production

# Force rebuild
npx hardhat build --force

# Clean artifacts
npx hardhat clean
```

### Deployment
```bash
# Deploy to Base Sepolia
npm run deploy:base

# Deploy to Sepolia
npm run deploy:sepolia

# Deploy to Arbitrum Sepolia
npm run deploy:arbitrum

# Deploy to all chains
npm run deploy:all
```

### Testing
```bash
# Run all tests
npm test

# Run only Solidity tests
npx hardhat test solidity

# Run only TypeScript tests
npx hardhat test nodejs
```

## 📋 Deployment Output

After deployment, you'll see:

```
SmartWalletModule successfully deployed 🚀

Deployed Addresses
SmartWalletModule#SmartWalletFactory - 0x...
```

The deployment info is automatically saved in `ignition/deployments/` directory.

## 🔑 Getting Testnet ETH

- **Base Sepolia**: https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet
- **Sepolia**: https://sepoliafaucet.com/
- **Arbitrum Sepolia**: https://faucet.quicknode.com/arbitrum/sepolia

## ✅ Verification

To verify contracts on block explorers:

```bash
# Verify on Base Sepolia
npx hardhat ignition verify baseSepolia

# Verify on Sepolia
npx hardhat ignition verify sepolia

# Verify on Arbitrum Sepolia
npx hardhat ignition verify arbitrumSepolia
```

## 🎯 Key Features

### 1. Batch Transactions
Execute multiple transactions in a single call:
```solidity
Call[] memory calls = new Call[](2);
calls[0] = Call(recipient1, 0.001 ether, "0x");
calls[1] = Call(recipient2, 0.001 ether, "0x");

wallet.executeBatch(calls);
```

### 2. Multi-Chain Deployment
Same wallet address on all chains thanks to CREATE2:
```javascript
// Deploy factory on all chains
// Use same owner address
// Get same wallet address everywhere!
```

### 3. ERC-4337 Compatible
Works with any ERC-4337 bundler and paymaster:
- Gas sponsorship support
- UserOperation validation
- Signature verification

## 🔄 Next Steps

1. ✅ **Deploy Contracts** - Use `npm run deploy:all`
2. ✅ **Save Addresses** - Note factory addresses from each chain
3. ✅ **Fund Wallets** - Get testnet ETH for your smart wallet
4. 🚧 **Frontend Integration** - Connect to your app
5. 🚧 **Paymaster Setup** - Add gas sponsorship (Phase 3)

## 📚 Resources

- [Hardhat v3 Documentation](https://hardhat.org/hardhat-runner/docs/getting-started)
- [Hardhat Ignition Docs](https://hardhat.org/ignition/docs/getting-started)
- [ERC-4337 Specification](https://eips.ethereum.org/EIPS/eip-4337)
- [Account Abstraction Guide](https://www.erc4337.io/)

## 🐛 Troubleshooting

### Compilation Errors
```bash
npx hardhat clean
npm run build
```

### Network Connection Issues
- Check `.env` file has correct `PRIVATE_KEY`
- Verify RPC URLs are accessible
- Ensure you have testnet ETH

### Deployment Failures
- Check you have enough ETH for gas
- Verify network is correct
- Check `ignition/deployments/` for existing deployments

## 💡 Tips

1. **Use Production Profile** for mainnet: `npx hardhat build --profile production`
2. **Keep Deployments** - The `ignition/deployments/` folder tracks all deployments
3. **Verify Contracts** - Always verify after deployment for transparency
4. **Test Locally First** - Use `npx hardhat ignition deploy ignition/modules/SmartWallet.ts` (no --network flag)

---

**Built with Hardhat v3 🚀**
