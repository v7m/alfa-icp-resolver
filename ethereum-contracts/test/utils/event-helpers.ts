import { ethers } from "hardhat";

/**
 * Finds an event in transaction receipt logs
 * @param contract - The contract instance
 * @param receipt - Transaction receipt
 * @param eventName - Name of the event to find
 * @returns The event log or undefined if not found
 */
export function findEvent(contract: any, receipt: any, eventName: string) {
  return receipt.logs.find((log: any) => {
    try {
      return contract.interface.parseLog(log)?.name === eventName;
    } catch {
      return false;
    }
  });
}

/**
 * Extracts lockId from TimeLockContractCreated event
 * @param hashedTimeLock - HashedTimeLock contract instance
 * @param receipt - Transaction receipt
 * @returns The lockId from the event
 */
export function extractLockIdFromEvent(hashedTimeLock: any, receipt: any): string {
  const event = findEvent(hashedTimeLock, receipt, "TimeLockContractCreated");
  if (!event) {
    throw new Error("TimeLockContractCreated event not found in receipt");
  }
  
  const parsedEvent = hashedTimeLock.interface.parseLog(event);
  return parsedEvent?.args?.lockId;
}

/**
 * Creates a timelock contract and returns the lockId
 * @param hashedTimeLock - HashedTimeLock contract instance
 * @param sender - Sender signer
 * @param receiver - Receiver address
 * @param secret - Secret string
 * @param amount - Amount in ETH (as string)
 * @param hour - Hour duration in seconds
 * @returns Object with lockId, secret, hashlock, and timelock
 */
export async function createTimeLockContractETH(
  hashedTimeLock: any,
  sender: any,
  receiver: any,
  secret: string = "secret",
  amount: string = "1",
  hour: number = 3600
) {
  const hashlock = ethers.sha256(ethers.encodeBytes32String(secret));
  const timelock = (await ethers.provider.getBlock("latest"))!.timestamp + hour + 10;

  const tx = await hashedTimeLock.connect(sender).newContractETH(
    receiver.address,
    hashlock,
    timelock,
    { value: ethers.parseEther(amount) }
  );
  
  const receipt = await tx.wait();
  const lockId = extractLockIdFromEvent(hashedTimeLock, receipt);
  
  return {
    lockId,
    secret: ethers.encodeBytes32String(secret),
    hashlock,
    timelock
  };
}

/**
 * Calculates the expected lockId for a timelock contract
 * @param sender - Sender address
 * @param receiver - Receiver address
 * @param amount - Amount in wei
 * @param hashlock - Hashlock bytes32
 * @param timelock - Timelock timestamp
 * @returns The calculated lockId
 */
export function calculateLockId(
  sender: string,
  receiver: string,
  amount: bigint,
  hashlock: string,
  timelock: number
): string {
  return ethers.sha256(
    ethers.solidityPacked(
      ["address", "address", "uint256", "bytes32", "uint256"],
      [sender, receiver, amount, hashlock, timelock]
    )
  );
}
