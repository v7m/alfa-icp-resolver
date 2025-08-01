# Alfa ICP HashedTimelock Contract

An Internet Computer Protocol (ICP) implementation of the Ethereum HashedTimelock contract, enabling secure atomic swaps with time-based conditions.

## Description

This project implements a HashedTimelock contract for the Internet Computer blockchain, providing functionality for creating time-locked swaps with cryptographic hash verification. The contract supports ICRC-1 token transfers and includes comprehensive validation and monitoring capabilities.

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

1. Clone the repository:
```bash
git clone <repository-url>
cd alfa-icp-resolver
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

#### `create_swap(request: CreateSwapRequest) -> SwapResponse`
Creates a new time-locked swap with cryptographic verification.

**Parameters:**
- `recipient`: Principal ID of the swap recipient
- `amount`: Token amount in smallest units
- `hashlock`: SHA-256 hash of the preimage
- `timelock`: Unix timestamp when the swap expires
- `ledger_id`: Principal ID of the token ledger

#### `withdraw(request: WithdrawRequest) -> SwapResponse`
Withdraws funds from a swap using the correct preimage.

**Parameters:**
- `swap_id`: Unique identifier of the swap
- `preimage`: Original data that produces the hashlock

#### `refund(request: RefundRequest) -> SwapResponse`
Refunds the swap to the original sender after timelock expiration.

**Parameters:**
- `swap_id`: Unique identifier of the swap

### Query Functions

#### `get_swap(swap_id: String) -> Option<Swap>`
Retrieves a specific swap by ID.

#### `get_all_swaps() -> Vec<(String, Swap)>`
Returns all swaps in the contract.

#### `get_swaps_by_sender(sender: String) -> Vec<(String, Swap)>`
Returns swaps created by a specific sender.

#### `get_swaps_by_recipient(recipient: String) -> Vec<(String, Swap)>`
Returns swaps where a specific address is the recipient.

#### `get_active_swaps() -> Vec<(String, Swap)>`
Returns all non-expired, non-withdrawn, non-refunded swaps.

#### `get_expired_swaps() -> Vec<(String, Swap)>`
Returns all expired swaps that haven't been withdrawn or refunded.

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

### Swap
```rust
pub struct Swap {
    pub sender: String,           // Principal ID of swap creator
    pub recipient: String,        // Principal ID of swap recipient
    pub amount: u64,             // Token amount in smallest units
    pub hashlock: String,        // SHA-256 hash of preimage
    pub timelock: u64,          // Unix timestamp when swap expires
    pub withdrawn: bool,         // Whether funds have been withdrawn
    pub refunded: bool,          // Whether funds have been refunded
    pub preimage: Option<String>, // Original preimage (set after withdrawal)
    pub ledger_id: String,       // Principal ID of token ledger
}
```

### SwapResponse
```rust
pub struct SwapResponse {
    pub success: bool,                    // Operation success status
    pub message: String,                  // Human-readable message
    pub swap_id: Option<String>,          // Unique swap identifier
    pub swap: Option<Swap>,              // Swap data (if applicable)
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
- No support for cross-chain swaps
- ICRC-1 token transfers only

### Future Enhancements
- Support for multiple token standards
- Cross-chain swap capabilities
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
