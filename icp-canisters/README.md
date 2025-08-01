# Alfa ICP HashedTimelock Contract

An Internet Computer Protocol (ICP) implementation for atomic swaps between Ethereum and ICP, enabling secure cross-chain token exchanges with time-based conditions.

## Description

This project implements the ICP side of the Alfa ICP Resolver, providing functionality for creating time-locked swaps with cryptographic hash verification. The canister supports ICRC-1 token transfers and includes comprehensive validation and monitoring capabilities for cross-chain atomic swaps.

## Project Structure

```
alfa-icp-resolver/
├── src/
│   ├── lib.rs                 # Main Rust canister implementation
│   ├── transfer_service.rs    # ICRC-1 transfer service
│   └── alfa_icp_resolver.did # Candid interface definition
├── tests/
│   ├── setup.ts              # Test environment setup
│   ├── ledger.test.ts        # ICP ledger integration tests
│   ├── hashedtimelock.test.ts # HashedTimelock functionality tests
│   └── README.md            # Test documentation
├── Cargo.toml               # Rust dependencies
├── dfx.json                 # DFX configuration
├── package.json             # Node.js dependencies
├── tsconfig.json           # TypeScript configuration
└── README.md              # This file
```

## Installation

### Prerequisites

- [DFX](https://internetcomputer.org/docs/current/developer-docs/setup/install/) - Internet Computer SDK
- [Rust](https://rustup.rs/) - Programming language
- [Node.js](https://nodejs.org/) - JavaScript runtime
- [npm](https://www.npmjs.com/) - Package manager

### Setup

1. Navigate to the ICP canisters directory:
```bash
cd icp-canisters
```

2. Install Rust dependencies:
```bash
cargo build
```

3. Install Node.js dependencies:
```bash
npm install
```

4. Start local DFX network:
```bash
dfx start --background
```

## Development

### Building the Canister

```bash
dfx build
```

### Deploying to Local Network

```bash
dfx deploy
```

### Running Tests

```bash
npm test
```

## API Documentation

### Core Functions

#### `new_contract(request: NewContractRequest) -> ContractResponse`
Creates a new time-locked contract with cryptographic verification.

**Parameters:**
- `receiver`: Principal ID of the contract receiver
- `amount`: Token amount in smallest units
- `hashlock`: SHA-256 hash of the preimage
- `timelock`: Unix timestamp when the contract expires
- `ledger_id`: Principal ID of the token ledger

#### `claim(request: ClaimRequest) -> ContractResponse`
Claims funds from a contract using the correct preimage.

**Parameters:**
- `lock_id`: Unique identifier of the contract
- `preimage`: Original data that produces the hashlock

#### `refund(request: RefundRequest) -> ContractResponse`
Refunds the contract to the original sender after timelock expiration.

**Parameters:**
- `lock_id`: Unique identifier of the contract

### Query Functions

#### `get_contract(lock_id: String) -> Option<TimeLockContract>`
Retrieves a specific contract by ID.

#### `get_all_contracts() -> Vec<(String, TimeLockContract)>`
Returns all contracts in the canister.

#### `get_contracts_by_sender(sender: String) -> Vec<(String, TimeLockContract)>`
Returns contracts created by a specific sender.

#### `get_contracts_by_receiver(receiver: String) -> Vec<(String, TimeLockContract)>`
Returns contracts where a specific address is the receiver.

#### `get_active_contracts() -> Vec<(String, TimeLockContract)>`
Returns all non-expired, non-claimed, non-refunded contracts.

#### `get_expired_contracts() -> Vec<(String, TimeLockContract)>`
Returns all expired contracts that haven't been claimed or refunded.

### Utility Functions

#### `hash_preimage(preimage: String) -> String`
Generates SHA-256 hash of the provided preimage.

#### `verify_preimage_hash(preimage: String, hashlock: String) -> bool`
Verifies if a preimage produces the specified hashlock.

#### `get_current_time() -> u64`
Returns the current timestamp.

#### `get_version() -> String`
Returns the contract version.

## Data Structures

### TimeLockContract
```rust
pub struct TimeLockContract {
    pub sender: String,           // Principal ID of contract creator
    pub receiver: String,         // Principal ID of contract receiver
    pub amount: u64,             // Token amount in smallest units
    pub hashlock: String,        // SHA-256 hash of preimage
    pub timelock: u64,          // Unix timestamp when contract expires
    pub withdrawn: bool,         // Whether funds have been claimed
    pub refunded: bool,          // Whether funds have been refunded
    pub preimage: Option<String>, // Original preimage (set after claim)
    pub ledger_id: String,       // Principal ID of token ledger
}
```

### ContractResponse
```rust
pub struct ContractResponse {
    pub success: bool,                    // Operation success status
    pub message: String,                  // Human-readable message
    pub lock_id: Option<String>,          // Unique contract identifier
    pub contract: Option<TimeLockContract>, // Contract data (if applicable)
    pub transfer_result: Option<u64>,    // Block index of transfer (if applicable)
}
```

## Security Considerations

### Hash Verification
- All hashlocks must be valid SHA-256 hashes (64 characters)
- Preimage verification is performed using cryptographic hashing
- Hash collisions are prevented by using SHA-256

### Time Validation
- Timelocks must be in the future when creating swaps
- Expired swaps cannot be withdrawn
- Refunds are only possible after timelock expiration

### Access Control
- Only the recipient can withdraw funds
- Only the sender can refund after expiration
- Caller verification is performed for all operations

### State Management
- Swaps cannot be withdrawn or refunded multiple times
- State changes are atomic and consistent
- Thread-local storage ensures thread safety

## Limitations

### Current Limitations
- Single-threaded execution (canister limitation)
- Limited storage capacity per canister
- Cross-chain swaps require coordination with Ethereum contracts
- ICRC-1 token transfers only

### Future Enhancements
- Support for multiple token standards
- Enhanced cross-chain swap coordination
- Advanced time-lock mechanisms
- Batch operations for multiple swaps

## Testing

The project includes comprehensive Jest tests covering:
- ICP ledger integration
- Swap creation and management
- Preimage hashing and verification
- Transfer functionality
- Error handling and edge cases

See `tests/README.md` for detailed testing documentation.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

[Add your license information here]

## Support

For questions and support, please open an issue on the project repository.
