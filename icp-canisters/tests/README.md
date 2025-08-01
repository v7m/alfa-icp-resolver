# Tests for Alfa ICP HashedTimelock Contract

This directory contains Jest tests for verifying the functionality of the HashedTimelock contract and integration with the ICP ledger.

## Test Structure

```
tests/
├── setup.ts              # Test environment setup
├── ledger.test.ts        # ICP ledger integration tests
├── hashedtimelock.test.ts # HashedTimelock functionality tests
└── README.md            # This file
```

## Installing Dependencies

```bash
npm install
```

## Running Tests

### All Tests
```bash
npm test
```

### Tests in Watch Mode
```bash
npm run test:watch
```

### Tests with Coverage
```bash
npm run test:coverage
```

## What is Tested

### ledger.test.ts
- ✅ ICP ledger deployment
- ✅ Minting ICP tokens to resolver canister
- ✅ Balance verification
- ✅ Integration with canister functions
- ✅ Testing transfer_icrc1 function

### hashedtimelock.test.ts
- ✅ Creating swaps with validation
- ✅ Preimage hashing and verification
- ✅ Swap management (getting lists, filtering)
- ✅ Transfer integration
- ✅ Complete swap lifecycle

## Requirements

- DFX must be installed and configured
- Local ICP network must be available
- Node.js and npm must be installed

## Test Environment Setup

Tests automatically:
1. Start local DFX network (if not running)
2. Deploy ICP ledger
3. Deploy resolver canister
4. Mint ICP tokens for testing

## Test Examples

### ICP Minting Test
```typescript
test('should mint ICP to resolver canister', () => {
  const amount = '100000000'; // 0.1 ICP (8 decimals)
  
  expect(() => {
    mintICP(canisterId, amount);
  }).not.toThrow();
});
```

### Swap Creation Test
```typescript
test('should create a valid swap', () => {
  const createSwapRequest = {
    recipient: 'd46936bcaa8f3ffd87278bf2f4568d656a70e1713e2c705cc1ae9a9e387a6d49',
    amount: 50000000, // 0.5 ICP
    hashlock: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6',
    timelock: Date.now() + 7200000, // 2 hours in the future
    ledger_id: ledgerId
  };
  
  const output = runDfxCommand(`canister call ${canisterId} create_swap '(${JSON.stringify(createSwapRequest)})'`);
  
  expect(output).toContain('success');
});
```

## Debugging

If tests fail:

1. Check if DFX is running: `dfx ping`
2. Check canister status: `dfx canister status alfa_icp_resolver`
3. Check logs: `dfx canister call alfa_icp_resolver get_version`

## Adding New Tests

1. Create a new `.test.ts` file in the `tests/` folder
2. Import functions from `setup.ts`
3. Use `runDfxCommand()` to call canisters
4. Add descriptive test names

## Test File Structure

```typescript
import { runDfxCommand } from './setup';

describe('Your Test Suite', () => {
  let canisterId: string;
  let ledgerId: string;

  beforeAll(() => {
    canisterId = global.__CANISTER_ID__;
    ledgerId = global.__LEDGER_ID__;
  });

  test('should do something', () => {
    const output = runDfxCommand(`canister call ${canisterId} your_function`);
    expect(output).toContain('expected_result');
  });
});
``` 