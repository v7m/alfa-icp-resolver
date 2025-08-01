# 🐺⛓️🪙 Alfa ICP Resolver

Project for performing swaps between Ethereum and Internet Computer Protocol (ICP) using atomic swaps.

## Project Structure

The project consists of two main components:

### Ethereum Contracts (`ethereum-contracts/`)
- Solidity smart contracts for Ethereum network
- Hashed Timelock Contracts (HTLC) for atomic swaps
- Liquidity Vault for liquidity management
- Tests and documentation

### ICP Canisters (`icp-canisters/`)
- Rust canisters for Internet Computer
- Transfer service for processing transactions
- Integration with ICP Ledger
- Tests and DFX configuration

## Quick Start

1. **Ethereum contracts:**
   ```bash
   cd ethereum-contracts
   npm install
   npx hardhat test
   ```

2. **ICP canisters:**
   ```bash
   cd icp-canisters
   dfx start --background
   dfx deploy
   ```

## Architecture

The project implements atomic swaps between Ethereum and ICP, providing secure token exchange between blockchains without the need to trust a third party.
