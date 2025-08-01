// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./interfaces/ILiquidityVault.sol";

/**
 * @title HashedTimeLock
 * @dev A contract for creating time-locked ETH transfers using hashlock mechanisms.
 * Allows users to lock ETH for a specified duration with a hashlock that can be
 * claimed by providing the correct preimage or refunded after the timelock expires.
 */
contract HashedTimeLock {
    // ======= Structs =======
    /**
     * @dev Structure representing a time-locked contract
     * @param sender The address that created the time-locked contract
     * @param receiver The address that can claim the locked ETH
     * @param amount The amount of ETH locked in the contract
     * @param hashlock The hash of the preimage required to claim the ETH
     * @param timelock The timestamp when the contract expires
     * @param preimage The preimage revealed when claiming (initially zero)
     * @param withdrawn Whether the ETH has been claimed
     * @param refunded Whether the ETH has been refunded
     */
    struct TimeLockContract {
        address payable sender;
        address payable receiver;
        uint256 amount;
        bytes32 hashlock;
        uint256 timelock;
        bytes32 preimage;
        bool withdrawn;
        bool refunded;
    }

    // ======= State variables =======
    uint256 public immutable MIN_TIME_LOCK_DURATION;
    ILiquidityVault public liquidityVault;

    mapping(bytes32 => TimeLockContract) public contracts;

    // ======= Events =======
    event TimeLockContractCreated(
        bytes32 indexed lockId,
        address indexed sender,
        address indexed receiver,
        uint256 amount,
        bytes32 hashlock,
        uint256 timelock
    );
    event TimeLockContractClaimed(bytes32 indexed lockId, bytes32 preimage);
    event TimeLockContractRefunded(bytes32 indexed lockId);

    // ======= Errors =======
    error MinTimeLockMustBeGreaterThanZero();
    error InvalidTimeLock(uint256 provided, uint256 minimum);
    error ContractNotFound(bytes32 lockId);
    error HashlockMismatch(bytes32 expected, bytes32 provided);
    error TimeLockNotExpired(uint256 current, uint256 required);
    error TimeLockExpired(uint256 current, uint256 required);
    error ContractAlreadyExists(bytes32 lockId);
    error CallerNotReceiver();
    error CallerNotSender();
    error AlreadyWithdrawn();
    error AlreadyRefunded();
    error InvalidReceiver();
    error InvalidHashlock();
    error SenderIsReceiver();
    error InsufficientFunds();

    // ======= Modifiers =======
    modifier futureTimeLock(uint256 _time) {
        uint256 minimumTime = block.timestamp + MIN_TIME_LOCK_DURATION;
        if (_time <= minimumTime) revert InvalidTimeLock(_time, minimumTime);
        _;
    }

    modifier contractExists(bytes32 _lockId) {
        if (!hasContract(_lockId)) revert ContractNotFound(_lockId);
        _;
    }

    modifier hashlockMatches(bytes32 _lockId, bytes32 _x) {
        bytes32 expectedHash = contracts[_lockId].hashlock;
        bytes32 providedHash = sha256(abi.encodePacked(_x));
        if (expectedHash != providedHash) revert HashlockMismatch(expectedHash, providedHash);
        _;
    }

    modifier claimable(bytes32 _lockId) {
        if (contracts[_lockId].receiver != msg.sender) revert CallerNotReceiver();
        if (contracts[_lockId].withdrawn) revert AlreadyWithdrawn();
        uint256 currentTime = block.timestamp;
        uint256 lockExpiry = contracts[_lockId].timelock;
        if (lockExpiry <= currentTime) revert TimeLockExpired(currentTime, lockExpiry);
        _;
    }

    modifier refundable(bytes32 _lockId) {
        if (contracts[_lockId].sender != msg.sender) revert CallerNotSender();
        if (contracts[_lockId].refunded) revert AlreadyRefunded();
        if (contracts[_lockId].withdrawn) revert AlreadyWithdrawn();
        uint256 currentTime = block.timestamp;
        uint256 lockExpiry = contracts[_lockId].timelock;
        if (lockExpiry > currentTime) revert TimeLockNotExpired(currentTime, lockExpiry);
        _;
    }

    // ======= Constructor =======
    /**
     * @dev Constructor for HashedTimeLock contract
     * @param _minTimeLockDuration The minimum duration for time-locked contracts
     * @param _liquidityVaultAddress The address of the LiquidityVault contract
     */
    constructor(uint256 _minTimeLockDuration, address _liquidityVaultAddress) {
        if (_minTimeLockDuration == 0) revert MinTimeLockMustBeGreaterThanZero();

        MIN_TIME_LOCK_DURATION = _minTimeLockDuration;
        liquidityVault = ILiquidityVault(_liquidityVaultAddress);
    }

    // ======= External functions =======
    /**
     * @dev Creates a new time-locked ETH contract
     * @param _receiver The address that can claim the locked ETH
     * @param _hashlock The hash of the preimage required to claim the ETH
     * @param _timelock The timestamp when the contract expires
     * @return lockId The unique identifier for the created contract
     */
    function newContractETH(
        address payable _receiver,
        bytes32 _hashlock,
        uint256 _timelock
    )
        external
        payable
        futureTimeLock(_timelock)
        returns (bytes32 lockId)
    {
        if (msg.value == 0) revert InsufficientFunds();
        if (_receiver == address(0)) revert InvalidReceiver();
        if (_hashlock == bytes32(0)) revert InvalidHashlock();
        if (msg.sender == _receiver) revert SenderIsReceiver();

        lockId = sha256(
            abi.encodePacked(
                msg.sender,
                _receiver,
                msg.value,
                _hashlock,
                _timelock
            )
        );

        if (hasContract(lockId)) revert ContractAlreadyExists(lockId);

        contracts[lockId] = TimeLockContract({
            sender: payable(msg.sender),
            receiver: _receiver,
            amount: msg.value,
            hashlock: _hashlock,
            timelock: _timelock,
            preimage: bytes32(0),
            withdrawn: false,
            refunded: false
        });

        // send ETH to Liquidity Vault and mark as locked for this swap
        liquidityVault.depositLockedETH{value: msg.value}(lockId);

        emit TimeLockContractCreated(
            lockId,
            msg.sender,
            _receiver,
            msg.value,
            _hashlock,
            _timelock
        );
    }

    /**
     * @dev Allows the receiver to claim the locked ETH by providing the correct preimage
     * @param _lockId The unique identifier of the time-locked contract
     * @param _preimage The preimage that matches the hashlock
     * @return amount The amount of ETH claimed
     */
    function claim(bytes32 _lockId, bytes32 _preimage)
        external
        contractExists(_lockId)
        hashlockMatches(_lockId, _preimage)
        claimable(_lockId)
        returns (uint256 amount)
    {
        TimeLockContract storage c = contracts[_lockId];
        c.preimage = _preimage;
        c.withdrawn = true;

        liquidityVault.releaseLockedETH(_lockId, c.receiver);

        emit TimeLockContractClaimed(_lockId, _preimage);

        return c.amount;
    }

    /**
     * @dev Allows the sender to refund the locked ETH after the timelock expires
     * @param _lockId The unique identifier of the time-locked contract
     * @return amount The amount of ETH refunded
     */
    function refund(bytes32 _lockId)
        external
        contractExists(_lockId)
        refundable(_lockId)
        returns (uint256 amount)
    {
        TimeLockContract storage c = contracts[_lockId];
        c.refunded = true;

        liquidityVault.releaseLockedETH(_lockId, c.sender);

        emit TimeLockContractRefunded(_lockId);

        return c.amount;
    }

    /**
     * @dev Returns the preimage for a given lockId
     * @param _lockId The unique identifier of the time-locked contract
     * @return The preimage (will be zero if not yet claimed)
     */
    function getPreimage(bytes32 _lockId) external view returns (bytes32) {
        return contracts[_lockId].preimage;
    }

    // ======= Public functions =======
    /**
     * @dev Returns the complete TimeLockContract structure for a given lockId
     * @param _lockId The unique identifier of the time-locked contract
     * @return The complete TimeLockContract structure
     */
    function getContract(bytes32 _lockId) public view returns (TimeLockContract memory) {
        if (!hasContract(_lockId)) revert ContractNotFound(_lockId);

        return contracts[_lockId];
    }

    // ======= Internal functions =======
    /**
     * @dev Checks if a contract exists for the given lockId
     * @param _lockId The unique identifier to check
     * @return True if the contract exists, false otherwise
     */
    function hasContract(bytes32 _lockId) internal view returns (bool) {
        return contracts[_lockId].sender != address(0);
    }
}
