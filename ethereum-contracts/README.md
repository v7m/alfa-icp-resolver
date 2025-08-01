# Alfa Resolver Ethereum Contracts

A system for secure cryptocurrency exchange between blockchains using time-locked transfers with hashlock mechanisms.

## Contracts

- **HashedTimeLock** - creation of time-locked ETH transfers
- **LiquidityVault** - liquidity pool management

## Testing

```bash
npm install
npx hardhat test
```

## Deploy

```bash
# Deploy to local network
npx hardhat node
npx hardhat ignition deploy ./ignition/modules/HTLCAndVaultModule.ts

# Deploy to testnet/mainnet
npx hardhat ignition deploy ./ignition/modules/HTLCAndVaultModule.ts --network <network-name>
```
