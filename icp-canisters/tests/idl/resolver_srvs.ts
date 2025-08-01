import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface ClaimRequest { 'lock_id' : string, 'preimage' : string }
export interface ContractResponse {
  'lock_id' : [] | [string],
  'contract' : [] | [TimeLockContract],
  'transfer_result' : [] | [bigint],
  'message' : string,
  'success' : boolean,
}
export interface NewContractRequest {
  'hashlock' : string,
  'ledger_id' : string,
  'amount' : bigint,
  'receiver' : string,
  'timelock' : bigint,
}
export interface RefundRequest { 'lock_id' : string }
export interface TimeLockContract {
  'hashlock' : string,
  'refunded' : boolean,
  'sender' : string,
  'ledger_id' : string,
  'preimage' : [] | [string],
  'withdrawn' : boolean,
  'amount' : bigint,
  'receiver' : string,
  'timelock' : bigint,
}
export interface TransferRequest {
  'to' : string,
  'fee' : [] | [bigint],
  'memo' : [] | [Uint8Array | number[]],
  'ledger_id' : string,
  'created_at_time' : [] | [bigint],
  'amount' : bigint,
}
export interface TransferResponse {
  'block_index' : [] | [bigint],
  'transfer_id' : [] | [string],
  'message' : string,
  'success' : boolean,
}
export interface _SERVICE {
  'claim' : ActorMethod<[ClaimRequest], ContractResponse>,
  'get_active_contracts' : ActorMethod<[], Array<[string, TimeLockContract]>>,
  'get_all_contracts' : ActorMethod<[], Array<[string, TimeLockContract]>>,
  'get_caller' : ActorMethod<[], string>,
  'get_contract' : ActorMethod<[string], [] | [TimeLockContract]>,
  'get_contract_count' : ActorMethod<[], bigint>,
  'get_contracts_by_receiver' : ActorMethod<
    [string],
    Array<[string, TimeLockContract]>
  >,
  'get_contracts_by_sender' : ActorMethod<
    [string],
    Array<[string, TimeLockContract]>
  >,
  'get_current_time' : ActorMethod<[], bigint>,
  'get_expired_contracts' : ActorMethod<[], Array<[string, TimeLockContract]>>,
  'get_version' : ActorMethod<[], string>,
  'hash_preimage' : ActorMethod<[string], string>,
  'new_contract' : ActorMethod<[NewContractRequest], ContractResponse>,
  'refund' : ActorMethod<[RefundRequest], ContractResponse>,
  'transfer_icrc1' : ActorMethod<[TransferRequest], TransferResponse>,
  'verify_preimage_hash' : ActorMethod<[string, string], boolean>,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
