import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const MIN_TIME_LOCK_DURATION = 3600;

const HashedTimeLockAndVaultModule = buildModule("HashedTimeLockAndVaultModule", (m) => {
  // === Step 1: Deploy LiquidityVault ===
  const liquidityVault = m.contract("LiquidityVault", []);

  // === Step 2: Deploy HashedTimeLock (fixed timelock duration) ===
  const hashedTimeLock = m.contract("HashedTimeLock", [
    MIN_TIME_LOCK_DURATION,
    liquidityVault
  ]);

  // --- Step 3: Link HashedTimeLock to LiquidityVault
  m.call(liquidityVault, "setHashedTimeLockAddress", [hashedTimeLock]);

  return { liquidityVault, hashedTimeLock };
});

export default HashedTimeLockAndVaultModule;
