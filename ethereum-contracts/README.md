# Alfa Resolver Ethereum Contracts

A system for secure cryptocurrency exchange between blockchains using time-locked transfers with hashlock mechanisms.

## Contracts

- **HashedTimeLock** - creation of time-locked ETH transfers
- **LiquidityVault** - liquidity pool management

## Quick Start

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

```bash
# Install dependencies
npm install
```

### Testing

```bash
# Run all tests
npx hardhat test

# Run specific test file
npx hardhat test test/HashedTimelock.test.ts

# Run integration tests
npx hardhat test test/integration/
```

### Development

```bash
# Start local Hardhat node
npx hardhat node

# Compile contracts
npx hardhat compile

# Run tests with coverage
npx hardhat coverage
```

### Deployment

```bash
# Deploy to local network
npx hardhat node
npx hardhat ignition deploy ./ignition/modules/HTLCAndVaultModule.ts

# Deploy to testnet/mainnet
npx hardhat ignition deploy ./ignition/modules/HTLCAndVaultModule.ts --network <network-name>

# Verify contracts on Etherscan
npx hardhat verify --network <network-name> <contract-address>
```

### Scripts

```bash
# Run custom scripts
npx hardhat run scripts/deploy.ts --network <network-name>

# Get contract addresses
npx hardhat ignition deploy ./ignition/modules/HTLCAndVaultModule.ts --dry-run
```
