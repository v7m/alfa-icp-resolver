// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title LiquidityVault
 * @dev A contract for managing liquidity pools and locked ETH from HashedTimeLock contracts.
 * Allows liquidity providers to deposit and withdraw ETH, while also handling
 * locked ETH from time-locked contracts.
 */
contract LiquidityVault {
    // ======= State variables =======
    address public owner;
    address public hashedTimeLockAddress;
    uint256 public totalShares;
    uint256 public totalETH;
    mapping(address => uint256) public balances;
    mapping(address => uint256) public shares;
    mapping(bytes32 => uint256) public locked;
    mapping(address => uint256) public claimBalances;

    // ======= Events =======
    event Deposited(address indexed provider, uint256 amount, uint256 sharesMinted);
    event Withdrawn(address indexed provider, uint256 amount, uint256 sharesBurned);
    event Locked(bytes32 indexed lockId, uint256 amount);
    event Unlocked(bytes32 indexed lockId, address to, uint256 amount);
    event Claimed(address indexed to, uint256 amount);
    event Sent(bytes32 indexed lockId, address to, uint256 amount);

    // ======= Errors =======
    error NotAuthorized();
    error InsufficientBalance(uint256 requested, uint256 available);
    error TransferFailed();
    error NothingLocked(bytes32 lockId);
    error HashedTimeLockAddressAlreadySet();

    // ======= Constructor =======
    /**
     * @dev Constructor for LiquidityVault contract
     * Sets the deployer as the owner
     */
    constructor() {
        owner = msg.sender;
    }

    // ======= Modifiers =======
    modifier onlyOwner() {
        if (msg.sender != owner) revert NotAuthorized();
        _;
    }

    modifier onlyHashedTimeLock() {
        if (msg.sender != hashedTimeLockAddress) revert NotAuthorized();
        _;
    }

    // ======= External functions for LP =======
    /**
     * @dev Allows liquidity providers to deposit ETH and receive shares
     * The number of shares minted is proportional to the ETH deposited
     */
    function depositETH() external payable {
        uint256 mintedShares;

        if (totalShares == 0 || totalETH == 0) {
            mintedShares = msg.value;
        } else {
            mintedShares = (msg.value * totalShares) / totalETH;
        }

        balances[msg.sender] += msg.value;
        shares[msg.sender] += mintedShares;
        totalShares += mintedShares;
        totalETH += msg.value;

        emit Deposited(msg.sender, msg.value, mintedShares);
    }

    /**
     * @dev Allows liquidity providers to withdraw ETH by burning shares
     * @param _amount The amount of ETH to withdraw
     */
    function withdrawETH(uint256 _amount) external {
        uint256 bal = balances[msg.sender];
        if (bal < _amount) revert InsufficientBalance(_amount, bal);

        uint256 burnedShares = (_amount * totalShares) / totalETH;

        balances[msg.sender] = bal - _amount;
        shares[msg.sender] -= burnedShares;
        totalShares -= burnedShares;
        totalETH -= _amount;

        _transfer(payable(msg.sender), _amount);

        emit Withdrawn(msg.sender, _amount, burnedShares);
    }

    // ======= External functions for HashedTimeLock =======
    /**
     * @dev Called by HashedTimeLock to lock ETH for a specific lockId
     * @param lockId The unique identifier for the locked ETH
     */
    function depositLockedETH(bytes32 lockId) external payable onlyHashedTimeLock {
        locked[lockId] += msg.value;

        emit Locked(lockId, msg.value);
    }

    /**
     * @dev Called by HashedTimeLock to release locked ETH to a recipient
     * @param lockId The unique identifier for the locked ETH
     * @param to The address to receive the released ETH
     */
    function releaseLockedETH(bytes32 lockId, address to) external onlyHashedTimeLock {
        uint256 amount = locked[lockId];
        if (amount == 0) revert NothingLocked(lockId);

        locked[lockId] = 0;

        _transfer(payable(to), amount);

        emit Sent(lockId, to, amount);
    }

    /**
     * @dev Sets the address of the HashedTimeLock contract
     * Can only be called once by the owner
     * @param _hashedTimeLockAddress The address of the HashedTimeLock contract
     */
    function setHashedTimeLockAddress(address _hashedTimeLockAddress) external onlyOwner {
        if (hashedTimeLockAddress != address(0)) revert HashedTimeLockAddressAlreadySet();

        hashedTimeLockAddress = _hashedTimeLockAddress;
    }

    // ======= Private functions =======
    /**
     * @dev Internal function to transfer ETH to a recipient
     * @param _to The address to receive the ETH
     * @param _amount The amount of ETH to transfer
     */
    function _transfer(address payable _to, uint256 _amount) private {
        (bool success, ) = _to.call{value: _amount}("");
        if (!success) revert TransferFailed();
    }
}
