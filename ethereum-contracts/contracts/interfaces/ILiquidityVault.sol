// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title ILiquidityVault
 * @dev Interface for LiquidityVault contract functions used by HashedTimeLock
 */
interface ILiquidityVault {
    /**
     * @dev Called by HashedTimeLock to lock ETH for a specific lockId
     * @param lockId The unique identifier for the locked ETH
     */
    function depositLockedETH(bytes32 lockId) external payable;
    
    /**
     * @dev Called by HashedTimeLock to release locked ETH to a recipient
     * @param lockId The unique identifier for the locked ETH
     * @param to The address to receive the released ETH
     */
    function releaseLockedETH(bytes32 lockId, address to) external;
}
