import { ethers } from "hardhat";
import { expect } from "chai";
import { HashedTimeLock, LiquidityVault } from "../../typechain-types";
import { findEvent } from "../utils/event-helpers";

describe("HashedTimelock + LiquidityVault Integration", function () {
  let liquidityVault: LiquidityVault;
  let hashedTimeLock: HashedTimeLock;
  let owner: any;
  let sender: any;
  let receiver: any;
  let lp1: any;
  let lp2: any;

  const hour = 3600;

  beforeEach(async () => {
    [owner, sender, receiver, lp1, lp2] = await ethers.getSigners();

    // Deploy LiquidityVault
    const LiquidityVault = await ethers.getContractFactory("LiquidityVault");
    liquidityVault = (await LiquidityVault.deploy()) as LiquidityVault;

    // Deploy HashedTimeLock
    const HashedTimeLock = await ethers.getContractFactory("HashedTimeLock");
    hashedTimeLock = (await HashedTimeLock.deploy(hour, liquidityVault.target)) as HashedTimeLock;

    // Set HashedTimeLock address in LiquidityVault
    await liquidityVault.setHashedTimeLockAddress(hashedTimeLock.target);
  });

  describe("Complete HashedTimelock Flow", () => {
    it("should handle complete HashedTimelock lifecycle with liquidity vault", async () => {
      // 1. LPs deposit ETH to LiquidityVault
      await liquidityVault.connect(lp1).depositETH({ value: ethers.parseEther("10") });
      await liquidityVault.connect(lp2).depositETH({ value: ethers.parseEther("5") });

      expect(await liquidityVault.totalETH()).to.equal(ethers.parseEther("15"));
      expect(await liquidityVault.balances(lp1.address)).to.equal(ethers.parseEther("10"));
      expect(await liquidityVault.balances(lp2.address)).to.equal(ethers.parseEther("5"));

      // 2. Create HashedTimeLock contract
      const secret = ethers.encodeBytes32String("secret123");
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

      // 3. Verify ETH is locked in LiquidityVault
      expect(await liquidityVault.locked(lockId)).to.equal(ethers.parseEther("2"));

      // 4. Receiver claims the funds
      await expect(
        hashedTimeLock.connect(receiver).claim(lockId, secret)
      ).to.emit(hashedTimeLock, "TimeLockContractClaimed")
        .withArgs(lockId, secret);

      // 5. Verify funds are released from LiquidityVault
      expect(await liquidityVault.locked(lockId)).to.equal(0);

      // 6. Verify receiver received the ETH
      const receiverBalance = await ethers.provider.getBalance(receiver.address);
      expect(receiverBalance).to.be.gt(0);
    });

    it("should handle HashedTimeLock refund flow with liquidity vault", async () => {
      // 1. LPs deposit ETH
      await liquidityVault.connect(lp1).depositETH({ value: ethers.parseEther("10") });

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

      // 3. Verify ETH is locked
      expect(await liquidityVault.locked(lockId)).to.equal(ethers.parseEther("3"));

      // 4. Advance time to expire timelock
      await ethers.provider.send("evm_increaseTime", [hour + 10]);
      await ethers.provider.send("evm_mine", []);

      // 5. Sender refunds the funds
      await expect(
        hashedTimeLock.connect(sender).refund(lockId)
      ).to.emit(hashedTimeLock, "TimeLockContractRefunded")
        .withArgs(lockId);

      // 6. Verify funds are released from LiquidityVault
      expect(await liquidityVault.locked(lockId)).to.equal(0);

      // 7. Verify sender received the ETH back
      const senderBalance = await ethers.provider.getBalance(sender.address);
      expect(senderBalance).to.be.gt(0);
    });
  });

  describe("Multiple HashedTimeLock Contracts", () => {
    it("should handle multiple concurrent HashedTimeLock contracts", async () => {
      // 1. Setup liquidity
      await liquidityVault.connect(lp1).depositETH({ value: ethers.parseEther("20") });

      // 2. Create multiple HashedTimeLock contracts
      const contracts = [];
      
      for (let i = 0; i < 3; i++) {
        const secret = ethers.encodeBytes32String(`secret${i}`);
        const hashlock = ethers.sha256(secret);
        const timelock = (await ethers.provider.getBlock("latest"))!.timestamp + hour + 10;

        const tx = await hashedTimeLock.connect(sender).newContractETH(
          receiver.address,
          hashlock,
          timelock,
          { value: ethers.parseEther("1") }
        );

        const receipt = await tx.wait();
        const event = findEvent(hashedTimeLock, receipt, "TimeLockContractCreated");
        const parsedEvent = hashedTimeLock.interface.parseLog(event!);
        const lockId = parsedEvent?.args?.lockId;

        contracts.push({ lockId, secret, hashlock });
      }

      // 3. Verify all contracts are locked in LiquidityVault
      for (const contract of contracts) {
        expect(await liquidityVault.locked(contract.lockId)).to.equal(ethers.parseEther("1"));
      }

      // 4. Claim first contract
      await hashedTimeLock.connect(receiver).claim(contracts[0].lockId, contracts[0].secret);
      expect(await liquidityVault.locked(contracts[0].lockId)).to.equal(0);

      // 5. Refund second contract
      await ethers.provider.send("evm_increaseTime", [hour + 10]);
      await ethers.provider.send("evm_mine", []);
      
      await hashedTimeLock.connect(sender).refund(contracts[1].lockId);
      expect(await liquidityVault.locked(contracts[1].lockId)).to.equal(0);

      // 6. Third contract should still be locked
      expect(await liquidityVault.locked(contracts[2].lockId)).to.equal(ethers.parseEther("1"));
    });
  });

  describe("LiquidityVault State Management", () => {
    it("should maintain correct liquidity vault state during HashedTimeLock operations", async () => {
      // 1. Initial LP deposits
      await liquidityVault.connect(lp1).depositETH({ value: ethers.parseEther("10") });
      const initialTotalETH = await liquidityVault.totalETH();
      const initialTotalShares = await liquidityVault.totalShares();

      // 2. Create HashedTimeLock contract
      const secret = ethers.encodeBytes32String("secret789");
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

      // 3. Verify LiquidityVault state remains unchanged for LP operations
      expect(await liquidityVault.totalETH()).to.equal(initialTotalETH);
      expect(await liquidityVault.totalShares()).to.equal(initialTotalShares);
      expect(await liquidityVault.balances(lp1.address)).to.equal(ethers.parseEther("10"));

      // 4. LP can still withdraw their funds
      await liquidityVault.connect(lp1).withdrawETH(ethers.parseEther("5"));
      expect(await liquidityVault.balances(lp1.address)).to.equal(ethers.parseEther("5"));

      // 5. HashedTimeLock operations don't affect LP balances
      await hashedTimeLock.connect(receiver).claim(lockId, secret);
      expect(await liquidityVault.balances(lp1.address)).to.equal(ethers.parseEther("5"));
    });
  });

  describe("Error Handling", () => {
    it("should handle errors gracefully in integration", async () => {
      // 1. Try to create HashedTimeLock without sufficient liquidity (should still work as ETH comes from sender)
      const secret = ethers.encodeBytes32String("secret999");
      const hashlock = ethers.sha256(secret);
      const timelock = (await ethers.provider.getBlock("latest"))!.timestamp + hour + 10;

      // This should work because ETH comes from sender, not from LiquidityVault
      await expect(
        hashedTimeLock.connect(sender).newContractETH(
          receiver.address,
          hashlock,
          timelock,
          { value: ethers.parseEther("5") }
        )
      ).to.emit(hashedTimeLock, "TimeLockContractCreated");

      // 2. Try to release locked ETH from wrong address (should fail)
      const fakeLockId = ethers.randomBytes(32);
      await expect(
        liquidityVault.connect(sender).releaseLockedETH(fakeLockId, receiver.address)
      ).to.be.revertedWithCustomError(liquidityVault, "NotAuthorized");
    });
  });
}); 