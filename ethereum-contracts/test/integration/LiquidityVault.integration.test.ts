import { ethers } from "hardhat";
import { expect } from "chai";
import { HashedTimeLock, LiquidityVault } from "../../typechain-types";
import { findEvent } from "../utils/event-helpers";

describe("LiquidityVault Integration Scenarios", function () {
  let liquidityVault: LiquidityVault;
  let hashedTimeLock: HashedTimeLock;
  let owner: any;
  let sender: any;
  let receiver: any;
  let lp1: any;
  let lp2: any;
  let lp3: any;

  const hour = 3600;

  beforeEach(async () => {
    [owner, sender, receiver, lp1, lp2, lp3] = await ethers.getSigners();

    // Deploy LiquidityVault
    const LiquidityVault = await ethers.getContractFactory("LiquidityVault");
    liquidityVault = (await LiquidityVault.deploy()) as LiquidityVault;

    // Deploy HashedTimeLock
    const HashedTimeLock = await ethers.getContractFactory("HashedTimeLock");
    hashedTimeLock = (await HashedTimeLock.deploy(hour, liquidityVault.target)) as HashedTimeLock;

    // Set HashedTimeLock address in LiquidityVault
    await liquidityVault.setHashedTimeLockAddress(hashedTimeLock.target);
  });

  describe("Liquidity Pool Management", () => {
    it("should handle LP deposits and withdrawals with HashedTimeLock operations", async () => {
      // 1. Multiple LPs deposit ETH
      await liquidityVault.connect(lp1).depositETH({ value: ethers.parseEther("10") });
      await liquidityVault.connect(lp2).depositETH({ value: ethers.parseEther("20") });
      await liquidityVault.connect(lp3).depositETH({ value: ethers.parseEther("5") });

      expect(await liquidityVault.totalETH()).to.equal(ethers.parseEther("35"));
      expect(await liquidityVault.totalShares()).to.equal(ethers.parseEther("35"));

      // 2. Create multiple HashedTimeLock contracts
      const hashedTimeLockContracts = [];
      for (let i = 0; i < 3; i++) {
        const secret = ethers.encodeBytes32String(`secret${i}`);
        const hashlock = ethers.sha256(secret);
        const timelock = (await ethers.provider.getBlock("latest"))!.timestamp + hour + 10;

        const tx = await hashedTimeLock.connect(sender).newContractETH(
          receiver.address,
          hashlock,
          timelock,
          { value: ethers.parseEther("2") }
        );

        const receipt = await tx.wait();
        const event = findEvent(hashedTimeLock, receipt, "TimeLockContractCreated");

        const parsedEvent = hashedTimeLock.interface.parseLog(event!);
        const lockId = parsedEvent?.args?.lockId;

        hashedTimeLockContracts.push({ lockId, secret });
      }

      // 3. Verify total locked amount
      let totalLocked = ethers.parseEther("0");
      for (const contract of hashedTimeLockContracts) {
        totalLocked = totalLocked + await liquidityVault.locked(contract.lockId);
      }
      expect(totalLocked).to.equal(ethers.parseEther("6"));

      // 4. LPs can still withdraw their funds (HashedTimeLock doesn't affect LP operations)
      await liquidityVault.connect(lp1).withdrawETH(ethers.parseEther("5"));
      expect(await liquidityVault.balances(lp1.address)).to.equal(ethers.parseEther("5"));

      // 5. Claim some HashedTimeLock contracts
      await hashedTimeLock
        .connect(receiver)
        .claim(hashedTimeLockContracts[0].lockId, hashedTimeLockContracts[0].secret);

      await hashedTimeLock
        .connect(receiver)
        .claim(hashedTimeLockContracts[1].lockId, hashedTimeLockContracts[1].secret);

      // 6. LP operations still work normally
      await liquidityVault.connect(lp2).withdrawETH(ethers.parseEther("10"));
      expect(await liquidityVault.balances(lp2.address)).to.equal(ethers.parseEther("10"));
    });

    it("should handle share calculations correctly with HashedTimeLock operations", async () => {
      // 1. Initial LP deposits
      await liquidityVault.connect(lp1).depositETH({ value: ethers.parseEther("10") });
      await liquidityVault.connect(lp2).depositETH({ value: ethers.parseEther("10") });

      const initialShares1 = await liquidityVault.shares(lp1.address);
      const initialShares2 = await liquidityVault.shares(lp2.address);

      // 2. Create HashedTimeLock contract
      const secret = ethers.encodeBytes32String("secret123");
      const hashlock = ethers.sha256(secret);
      const timelock = (await ethers.provider.getBlock("latest"))!.timestamp + hour + 10;

      const tx = await hashedTimeLock.connect(sender).newContractETH(
        receiver.address,
        hashlock,
        timelock,
        { value: ethers.parseEther("5") }
      );

      const receipt = await tx.wait();
      const event = findEvent(hashedTimeLock, receipt, "TimeLockContractCreated");
      const parsedEvent = hashedTimeLock.interface.parseLog(event!);
      const lockId = parsedEvent?.args?.lockId;

      // 3. Verify LP shares remain unchanged
      expect(await liquidityVault.shares(lp1.address)).to.equal(initialShares1);
      expect(await liquidityVault.shares(lp2.address)).to.equal(initialShares2);

      // 4. LP withdraws some funds
      await liquidityVault.connect(lp1).withdrawETH(ethers.parseEther("5"));
      
      // 5. Shares should be reduced proportionally
      expect(await liquidityVault.shares(lp1.address)).to.be.lt(initialShares1);
      expect(await liquidityVault.shares(lp2.address)).to.equal(initialShares2);

      // 6. HashedTimeLock operations don't affect shares
      await hashedTimeLock.connect(receiver).claim(lockId, secret);
      expect(await liquidityVault.shares(lp1.address)).to.be.lt(initialShares1);
      expect(await liquidityVault.shares(lp2.address)).to.equal(initialShares2);
    });
  });

  describe("Concurrent Operations", () => {
    it("should handle concurrent LP and HashedTimeLock operations", async () => {
      // 1. Setup initial liquidity
      await liquidityVault.connect(lp1).depositETH({ value: ethers.parseEther("20") });
      await liquidityVault.connect(lp2).depositETH({ value: ethers.parseEther("10") });

      // 2. Create HashedTimeLock contract
      const secret = ethers.encodeBytes32String("secret456");
      const hashlock = ethers.sha256(secret);
      const timelock = (await ethers.provider.getBlock("latest"))!.timestamp + hour + 10;

      const tx = await hashedTimeLock.connect(sender).newContractETH(
        receiver.address,
        hashlock,
        timelock,
        { value: ethers.parseEther("3") }
      );

      const receipt = await tx.wait();
      const event = findEvent(hashedTimeLock, receipt, "TimeLockContractCreated");
      const parsedEvent = hashedTimeLock.interface.parseLog(event!);
      const lockId = parsedEvent?.args?.lockId;

      // 3. LP3 deposits while HashedTimeLock is active
      await liquidityVault.connect(lp3).depositETH({ value: ethers.parseEther("15") });

      // 4. Verify all operations work correctly
      expect(await liquidityVault.totalETH()).to.equal(ethers.parseEther("45"));
      expect(await liquidityVault.locked(lockId)).to.equal(ethers.parseEther("3"));
      expect(await liquidityVault.balances(lp3.address)).to.equal(ethers.parseEther("15"));

      // 5. LP1 withdraws while HashedTimeLock is still active
      await liquidityVault.connect(lp1).withdrawETH(ethers.parseEther("10"));
      expect(await liquidityVault.balances(lp1.address)).to.equal(ethers.parseEther("10"));

      // 6. Claim HashedTimeLock
      await hashedTimeLock.connect(receiver).claim(lockId, secret);
      expect(await liquidityVault.locked(lockId)).to.equal(0);

      // 7. All LP operations still work
      await liquidityVault.connect(lp2).withdrawETH(ethers.parseEther("5"));
      expect(await liquidityVault.balances(lp2.address)).to.equal(ethers.parseEther("5"));
    });
  });

  describe("Edge Cases", () => {
    it("should handle zero amount operations correctly", async () => {
      // 1. LP deposits
      await liquidityVault.connect(lp1).depositETH({ value: ethers.parseEther("10") });

      // 2. Create HashedTimeLock with zero ETH (should fail)
      const secret = ethers.encodeBytes32String("secret789");
      const hashlock = ethers.sha256(secret);
      const timelock = (await ethers.provider.getBlock("latest"))!.timestamp + hour + 10;

      await expect(
        hashedTimeLock.connect(sender).newContractETH(
          receiver.address,
          hashlock,
          timelock,
          { value: 0 }
        )
      ).to.be.revertedWithCustomError(hashedTimeLock, "InsufficientFunds");

      // 3. LP can withdraw zero amount (should work)
      await expect(
        liquidityVault.connect(lp1).withdrawETH(0)
      ).to.emit(liquidityVault, "Withdrawn")
        .withArgs(lp1.address, 0, 0);
    });

    it("should handle multiple deposits for same lockId", async () => {
      // 1. Create HashedTimeLock contract
      const secret = ethers.encodeBytes32String("secret999");
      const hashlock = ethers.sha256(secret);
      const timelock = (await ethers.provider.getBlock("latest"))!.timestamp + hour + 10;

      const tx = await hashedTimeLock.connect(sender).newContractETH(
        receiver.address,
        hashlock,
        timelock,
        { value: ethers.parseEther("2") }
      );

      const receipt = await tx.wait();
      const event = findEvent(hashedTimeLock, receipt, "TimeLockContractCreated");

      const parsedEvent = hashedTimeLock.interface.parseLog(event!);
      const lockId = parsedEvent?.args?.lockId;

      // 2. Verify initial lock
      expect(await liquidityVault.locked(lockId)).to.equal(ethers.parseEther("2"));

      // 3. Try to create another HashedTimeLock contract with EXACTLY the same parameters (should fail)
      await expect(
        hashedTimeLock.connect(sender).newContractETH(
          receiver.address,
          hashlock, // Same hashlock
          timelock, // Same timelock
          { value: ethers.parseEther("2") } // Same value
        )
      ).to.be.revertedWithCustomError(hashedTimeLock, "ContractAlreadyExists");

      // 4. Verify original lock is still intact
      expect(await liquidityVault.locked(lockId)).to.equal(ethers.parseEther("2"));

      // 5. Claim the original HashedTimeLock
      await hashedTimeLock.connect(receiver).claim(lockId, secret);
      expect(await liquidityVault.locked(lockId)).to.equal(0);
    });
  });
}); 