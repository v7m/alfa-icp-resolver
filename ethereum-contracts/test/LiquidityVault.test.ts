import { ethers } from "hardhat";
import { expect } from "chai";
import { LiquidityVault } from "../typechain-types";

describe("LiquidityVault", function () {
  let liquidityVault: LiquidityVault;
  let owner: any;
  let hashedTimeLock: any;
  let lp1: any;
  let lp2: any;
  let user: any;

  beforeEach(async () => {
    [owner, hashedTimeLock, lp1, lp2, user] = await ethers.getSigners();

    // deploy LiquidityVault
    const LiquidityVault = await ethers.getContractFactory("LiquidityVault");
    liquidityVault = (await LiquidityVault.deploy()) as LiquidityVault;

    // owner sets HashedTimeLock address
    await liquidityVault.connect(owner).setHashedTimeLockAddress(hashedTimeLock.address);
  });

  describe(".depositETH()", () => {
    it("allows LP to deposit ETH and mint shares", async () => {
      await expect(
        liquidityVault.connect(lp1).depositETH({ value: ethers.parseEther("1") })
      ).to.emit(liquidityVault, "Deposited")
        .withArgs(lp1.address, ethers.parseEther("1"), ethers.parseEther("1"));

      expect(await liquidityVault.balances(lp1.address)).to.equal(ethers.parseEther("1"));
      expect(await liquidityVault.totalShares()).to.equal(ethers.parseEther("1"));
    });

    it("allows multiple LPs to deposit ETH", async () => {
      await liquidityVault.connect(lp1).depositETH({ value: ethers.parseEther("1") });
      
      await expect(
        liquidityVault.connect(lp2).depositETH({ value: ethers.parseEther("2") })
      ).to.emit(liquidityVault, "Deposited")
        .withArgs(lp2.address, ethers.parseEther("2"), ethers.parseEther("2"));

      expect(await liquidityVault.balances(lp2.address)).to.equal(ethers.parseEther("2"));
      expect(await liquidityVault.totalShares()).to.equal(ethers.parseEther("3"));
    });
  });

  describe(".withdrawETH()", () => {
    it("allows LP to withdraw ETH and burn shares", async () => {
      await liquidityVault.connect(lp1).depositETH({ value: ethers.parseEther("1") });
      
      await expect(
        liquidityVault.connect(lp1).withdrawETH(ethers.parseEther("0.5"))
      ).to.emit(liquidityVault, "Withdrawn")
        .withArgs(lp1.address, ethers.parseEther("0.5"), ethers.parseEther("0.5"));

      expect(await liquidityVault.balances(lp1.address)).to.equal(ethers.parseEther("0.5"));
    });

    it("reverts when withdrawing more than balance", async () => {
      await liquidityVault.connect(lp1).depositETH({ value: ethers.parseEther("1") });
      
      await expect(
        liquidityVault.connect(lp1).withdrawETH(ethers.parseEther("2"))
      ).to.be.revertedWithCustomError(liquidityVault, "InsufficientBalance");
    });

    it("allows withdrawing zero amount", async () => {
      await liquidityVault.connect(lp1).depositETH({ value: ethers.parseEther("1") });
      
      await expect(
        liquidityVault.connect(lp1).withdrawETH(0)
      ).to.emit(liquidityVault, "Withdrawn")
        .withArgs(lp1.address, 0, 0);
      
      expect(await liquidityVault.balances(lp1.address)).to.equal(ethers.parseEther("1"));
    });

    it("reverts when user has no balance", async () => {
      await expect(
        liquidityVault.connect(user).withdrawETH(ethers.parseEther("1"))
      ).to.be.revertedWithCustomError(liquidityVault, "InsufficientBalance");
    });
  });

  describe(".depositLockedETH()", () => {
    it("locks ETH from HashedTimeLock", async () => {
      const lockId = ethers.encodeBytes32String("test-lock-1");
      
      await expect(
        liquidityVault
          .connect(hashedTimeLock)
          .depositLockedETH(lockId, { value: ethers.parseEther("1") })
      ).to.emit(liquidityVault, "Locked")
        .withArgs(lockId, ethers.parseEther("1"));
      
      expect(await liquidityVault.locked(lockId)).to.equal(ethers.parseEther("1"));
    });

        it("allows multiple deposits for same lockId", async () => {
      const lockId = ethers.encodeBytes32String("test-lock-2");
      
      await liquidityVault.connect(hashedTimeLock).depositLockedETH(
        lockId,
        { value: ethers.parseEther("1") }
      );
      
      await expect(
        liquidityVault
          .connect(hashedTimeLock)
          .depositLockedETH(lockId, { value: ethers.parseEther("2") })
      ).to.emit(liquidityVault, "Locked")
        .withArgs(lockId, ethers.parseEther("2"));
      
      expect(await liquidityVault.locked(lockId)).to.equal(ethers.parseEther("3"));
    });

    it("reverts when called by non-HashedTimeLock", async () => {
      const lockId = ethers.encodeBytes32String("test-lock-3");
      
      await expect(
        liquidityVault
          .connect(user)
          .depositLockedETH(lockId, { value: ethers.parseEther("1") })
      ).to.be.revertedWithCustomError(liquidityVault, "NotAuthorized");
    });

    it("allows deposit with zero ETH", async () => {
      const lockId = ethers.encodeBytes32String("test-lock-4");
      
      await expect(
        liquidityVault
          .connect(hashedTimeLock)
          .depositLockedETH(lockId, { value: 0 })
      ).to.emit(liquidityVault, "Locked")
        .withArgs(lockId, 0);
      
      expect(await liquidityVault.locked(lockId)).to.equal(0);
    });
  });

  describe(".releaseLockedETH()", () => {
    it("releases locked ETH from HashedTimeLock to a user", async () => {
      const lockId = ethers.encodeBytes32String("test-lock-5");

      await liquidityVault
        .connect(hashedTimeLock)
        .depositLockedETH(lockId, { value: ethers.parseEther("1") });

      const beforeBalance = await ethers.provider.getBalance(user.address);

      await expect(
        liquidityVault.connect(hashedTimeLock).releaseLockedETH(lockId, user.address)
      ).to.emit(liquidityVault, "Sent")
        .withArgs(lockId, user.address, ethers.parseEther("1"));

      const afterBalance = await ethers.provider.getBalance(user.address);

      expect(afterBalance - beforeBalance).to.equal(ethers.parseEther("1"));
    });

    it("releases all locked ETH for a lockId", async () => {
      const lockId = ethers.encodeBytes32String("test-lock-6");

      await liquidityVault
        .connect(hashedTimeLock)
        .depositLockedETH(lockId, { value: ethers.parseEther("1") });

      await liquidityVault
        .connect(hashedTimeLock)
        .depositLockedETH(lockId, { value: ethers.parseEther("2") });

      const beforeBalance = await ethers.provider.getBalance(user.address);
      
      await expect(
        liquidityVault.connect(hashedTimeLock).releaseLockedETH(lockId, user.address)
      ).to.emit(liquidityVault, "Sent")
        .withArgs(lockId, user.address, ethers.parseEther("3"));

      const afterBalance = await ethers.provider.getBalance(user.address);

      expect(afterBalance - beforeBalance).to.equal(ethers.parseEther("3"));
      expect(await liquidityVault.locked(lockId)).to.equal(0);
    });

    it("reverts when called by non-HashedTimeLock", async () => {
      const lockId = ethers.encodeBytes32String("test-lock-7");

      await liquidityVault
        .connect(hashedTimeLock)
        .depositLockedETH(lockId, { value: ethers.parseEther("1") });

      await expect(
        liquidityVault.connect(user).releaseLockedETH(lockId, user.address)
      ).to.be.revertedWithCustomError(liquidityVault, "NotAuthorized");
    });

    it("reverts when no ETH is locked for lockId", async () => {
      const lockId = ethers.encodeBytes32String("test-lock-8");

      await expect(
        liquidityVault.connect(hashedTimeLock).releaseLockedETH(lockId, user.address)
      ).to.be.revertedWithCustomError(liquidityVault, "NothingLocked");
    });

    it("reverts when trying to release already released lockId", async () => {
      const lockId = ethers.encodeBytes32String("test-lock-9");

      await liquidityVault
        .connect(hashedTimeLock)
        .depositLockedETH(lockId, { value: ethers.parseEther("1") });

      await liquidityVault.connect(hashedTimeLock).releaseLockedETH(lockId, user.address);

      await expect(
        liquidityVault.connect(hashedTimeLock).releaseLockedETH(lockId, user.address)
      ).to.be.revertedWithCustomError(liquidityVault, "NothingLocked");
    });
  });
    

  describe(".setHashedTimeLockAddress()", () => {
    it("reverts when trying to set address when already set", async () => {
      const newHashedTimeLock = ethers.Wallet.createRandom();
      
      await expect(
        liquidityVault.connect(owner).setHashedTimeLockAddress(newHashedTimeLock.address)
      ).to.be.revertedWithCustomError(liquidityVault, "HashedTimeLockAddressAlreadySet");
    });

    it("reverts when called by non-owner", async () => {
      const newHashedTimeLock = ethers.Wallet.createRandom();
      
      await expect(
        liquidityVault.connect(user).setHashedTimeLockAddress(newHashedTimeLock.address)
      ).to.be.revertedWithCustomError(liquidityVault, "NotAuthorized");
    });

    it("reverts when trying to set address twice", async () => {
      const newHashedTimeLock = ethers.Wallet.createRandom();

      await expect(
        liquidityVault.connect(owner).setHashedTimeLockAddress(newHashedTimeLock.address)
      ).to.be.revertedWithCustomError(liquidityVault, "HashedTimeLockAddressAlreadySet");
    });

        it("reverts if someone else tries to call HashedTimeLock-only function", async () => {
      const lockId = ethers.encodeBytes32String("test-lock-10");
      
      await expect(
        liquidityVault.connect(user).depositLockedETH(lockId, { value: ethers.parseEther("1") })
      ).to.be.revertedWithCustomError(liquidityVault, "NotAuthorized");
    });
  });
});
