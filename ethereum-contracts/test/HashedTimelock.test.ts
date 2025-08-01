import { ethers } from "hardhat";
import { expect } from "chai";
import { HashedTimeLock, LiquidityVault } from "../typechain-types";
import { findEvent } from "./utils/event-helpers";

describe("HashedTimeLock", function () {
  let liquidityVault: LiquidityVault;
  let hashedTimeLock: HashedTimeLock;
  let owner: any;
  let sender: any;
  let receiver: any;

  const hour = 3600;

  beforeEach(async () => {
    [owner, sender, receiver] = await ethers.getSigners();

    // deploy LiquidityVault
    const LiquidityVault = await ethers.getContractFactory("LiquidityVault");
    liquidityVault = (await LiquidityVault.deploy()) as LiquidityVault;

    // deploy HashedTimeLock
    const HashedTimeLock = await ethers.getContractFactory("HashedTimeLock");
    hashedTimeLock = (await HashedTimeLock.deploy(hour, liquidityVault.target)) as HashedTimeLock;

    // set HashedTimeLock address in LiquidityVault
    await liquidityVault.setHashedTimeLockAddress(hashedTimeLock.target);
  });

  async function createTimeLockContractETH(secret: string = "secret", amount: string = "1") {
    const hashlock = ethers.sha256(ethers.encodeBytes32String(secret));
    // Use a timelock that's at least MIN_TIME_LOCK_DURATION seconds in the future
    const timelock = (await ethers.provider.getBlock("latest"))!.timestamp + hour + 10;

    const tx = await hashedTimeLock.connect(sender).newContractETH(
      receiver.address,
      hashlock,
      timelock,
      { value: ethers.parseEther(amount) }
    );
    const receipt = await tx.wait();
    expect(receipt).to.not.be.null;
    
    const event = findEvent(hashedTimeLock, receipt, "TimeLockContractCreated");
    expect(event).to.not.be.undefined;
    
    const parsedEvent = hashedTimeLock.interface.parseLog(event!);

    return {
      lockId: parsedEvent?.args?.lockId,
      secret: ethers.encodeBytes32String(secret),
      hashlock,
      timelock
    };
  }

  describe(".newContractETH()", () => {
    it("creates a new time lock contract", async () => {
      const secret = ethers.encodeBytes32String("secret");
      const hashlock = ethers.sha256(secret);
      const timelock = (await ethers.provider.getBlock("latest"))!.timestamp + hour + 10;

      await expect(
        hashedTimeLock.connect(sender).newContractETH(
          receiver.address,
          hashlock,
          timelock,
          { value: ethers.parseEther("1") }
        )
      ).to.emit(hashedTimeLock, "TimeLockContractCreated");

      const lockId = ethers.sha256(
        ethers.solidityPacked(
          ["address", "address", "uint256", "bytes32", "uint256"],
          [sender.address, receiver.address, ethers.parseEther("1"), hashlock, timelock]
        )
      );
      expect(await liquidityVault.locked(lockId)).to.equal(ethers.parseEther("1"));
    });

    it("reverts when no ETH is sent", async () => {
      const secret = ethers.encodeBytes32String("secret");
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
    });

    it("reverts when timelock is too short", async () => {
      const secret = ethers.encodeBytes32String("secret");
      const hashlock = ethers.sha256(secret);
      const timelock = (await ethers.provider.getBlock("latest"))!.timestamp + 1800; // 30 minutes

      await expect(
        hashedTimeLock.connect(sender).newContractETH(
          receiver.address,
          hashlock,
          timelock,
          { value: ethers.parseEther("1") }
        )
      ).to.be.revertedWithCustomError(hashedTimeLock, "InvalidTimeLock");
    });

    it("reverts when receiver is zero address", async () => {
      const secret = ethers.encodeBytes32String("secret");
      const hashlock = ethers.sha256(secret);
      const timelock = (await ethers.provider.getBlock("latest"))!.timestamp + hour + 10;

      await expect(
        hashedTimeLock.connect(sender).newContractETH(
          ethers.ZeroAddress,
          hashlock,
          timelock,
          { value: ethers.parseEther("1") }
        )
      ).to.be.revertedWithCustomError(hashedTimeLock, "InvalidReceiver");
    });
  });

  describe(".claim()", () => {
    it("allows receiver to claim funds", async () => {
      const { lockId, secret } = await createTimeLockContractETH();

      await expect(hashedTimeLock.connect(receiver).claim(lockId, secret))
        .to.emit(hashedTimeLock, "TimeLockContractClaimed")
        .withArgs(lockId, secret);
    });

    it("reverts when called with wrong preimage", async () => {
      const { lockId } = await createTimeLockContractETH();
      const wrongSecret = ethers.encodeBytes32String("wrong");

      await expect(
        hashedTimeLock.connect(receiver).claim(lockId, wrongSecret)
      ).to.be.revertedWithCustomError(hashedTimeLock, "HashlockMismatch");
    });

    it("reverts when called by non-receiver", async () => {
      const { lockId, secret } = await createTimeLockContractETH();

      await expect(
        hashedTimeLock.connect(sender).claim(lockId, secret)
      ).to.be.revertedWithCustomError(hashedTimeLock, "CallerNotReceiver");
    });

    it("reverts when contract doesn't exist", async () => {
      const fakeLockId = ethers.randomBytes(32);
      const secret = ethers.encodeBytes32String("secret");

      await expect(
        hashedTimeLock.connect(receiver).claim(fakeLockId, secret)
      ).to.be.revertedWithCustomError(hashedTimeLock, "ContractNotFound");
    });

    it("reverts when already claimed", async () => {
      const { lockId, secret } = await createTimeLockContractETH();

      await hashedTimeLock.connect(receiver).claim(lockId, secret);

      await expect(
        hashedTimeLock.connect(receiver).claim(lockId, secret)
      ).to.be.revertedWithCustomError(hashedTimeLock, "AlreadyWithdrawn");
    });
  });

  describe(".refund()", () => {
    it("reverts when timelock has not expired", async () => {
      const { lockId } = await createTimeLockContractETH();

      await expect(hashedTimeLock.connect(sender).refund(lockId))
        .to.be.revertedWithCustomError(hashedTimeLock, "TimeLockNotExpired");
    });

    it("allows sender to refund after timelock expires", async () => {
      const { lockId } = await createTimeLockContractETH();

      await ethers.provider.send("evm_increaseTime", [hour + 10]);
      await ethers.provider.send("evm_mine", []);

      await expect(hashedTimeLock.connect(sender).refund(lockId))
        .to.emit(hashedTimeLock, "TimeLockContractRefunded")
        .withArgs(lockId);
    });

    it("reverts when called by non-sender", async () => {
      const { lockId } = await createTimeLockContractETH();

      await ethers.provider.send("evm_increaseTime", [hour + 10]);
      await ethers.provider.send("evm_mine", []);

      await expect(
        hashedTimeLock.connect(receiver).refund(lockId)
      ).to.be.revertedWithCustomError(hashedTimeLock, "CallerNotSender");
    });

    it("reverts when contract doesn't exist", async () => {
      const fakeLockId = ethers.randomBytes(32);

      await expect(
        hashedTimeLock.connect(sender).refund(fakeLockId)
      ).to.be.revertedWithCustomError(hashedTimeLock, "ContractNotFound");
    });

    it("reverts when already refunded", async () => {
      const { lockId } = await createTimeLockContractETH();

      await ethers.provider.send("evm_increaseTime", [hour + 10]);
      await ethers.provider.send("evm_mine", []);
      await hashedTimeLock.connect(sender).refund(lockId);

      await expect(
        hashedTimeLock.connect(sender).refund(lockId)
      ).to.be.revertedWithCustomError(hashedTimeLock, "AlreadyRefunded");
    });

    it("reverts when already claimed", async () => {
      const { lockId, secret } = await createTimeLockContractETH();

      await hashedTimeLock.connect(receiver).claim(lockId, secret);
      await ethers.provider.send("evm_increaseTime", [hour + 10]);
      await ethers.provider.send("evm_mine", []);

      await expect(
        hashedTimeLock.connect(sender).refund(lockId)
      ).to.be.revertedWithCustomError(hashedTimeLock, "AlreadyWithdrawn");
    });
  });
});
