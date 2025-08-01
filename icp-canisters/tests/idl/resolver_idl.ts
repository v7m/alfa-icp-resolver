export const idlFactory = ({ IDL } : any) => {
  const ClaimRequest = IDL.Record({
    'lock_id' : IDL.Text,
    'preimage' : IDL.Text,
  });
  const TimeLockContract = IDL.Record({
    'hashlock' : IDL.Text,
    'refunded' : IDL.Bool,
    'sender' : IDL.Text,
    'ledger_id' : IDL.Text,
    'preimage' : IDL.Opt(IDL.Text),
    'withdrawn' : IDL.Bool,
    'amount' : IDL.Nat64,
    'receiver' : IDL.Text,
    'timelock' : IDL.Nat64,
  });
  const ContractResponse = IDL.Record({
    'lock_id' : IDL.Opt(IDL.Text),
    'contract' : IDL.Opt(TimeLockContract),
    'transfer_result' : IDL.Opt(IDL.Nat),
    'message' : IDL.Text,
    'success' : IDL.Bool,
  });
  const NewContractRequest = IDL.Record({
    'hashlock' : IDL.Text,
    'ledger_id' : IDL.Text,
    'amount' : IDL.Nat64,
    'receiver' : IDL.Text,
    'timelock' : IDL.Nat64,
  });
  const RefundRequest = IDL.Record({ 'lock_id' : IDL.Text });
  const TransferRequest = IDL.Record({
    'to' : IDL.Text,
    'fee' : IDL.Opt(IDL.Nat64),
    'memo' : IDL.Opt(IDL.Vec(IDL.Nat8)),
    'ledger_id' : IDL.Text,
    'created_at_time' : IDL.Opt(IDL.Nat64),
    'amount' : IDL.Nat64,
  });
  const TransferResponse = IDL.Record({
    'block_index' : IDL.Opt(IDL.Nat),
    'transfer_id' : IDL.Opt(IDL.Text),
    'message' : IDL.Text,
    'success' : IDL.Bool,
  });
  return IDL.Service({
    'claim' : IDL.Func([ClaimRequest], [ContractResponse], []),
    'get_active_contracts' : IDL.Func(
        [],
        [IDL.Vec(IDL.Tuple(IDL.Text, TimeLockContract))],
        ['query'],
      ),
    'get_all_contracts' : IDL.Func(
        [],
        [IDL.Vec(IDL.Tuple(IDL.Text, TimeLockContract))],
        ['query'],
      ),
    'get_caller' : IDL.Func([], [IDL.Text], ['query']),
    'get_contract' : IDL.Func(
        [IDL.Text],
        [IDL.Opt(TimeLockContract)],
        ['query'],
      ),
    'get_contract_count' : IDL.Func([], [IDL.Nat64], ['query']),
    'get_contracts_by_receiver' : IDL.Func(
        [IDL.Text],
        [IDL.Vec(IDL.Tuple(IDL.Text, TimeLockContract))],
        ['query'],
      ),
    'get_contracts_by_sender' : IDL.Func(
        [IDL.Text],
        [IDL.Vec(IDL.Tuple(IDL.Text, TimeLockContract))],
        ['query'],
      ),
    'get_current_time' : IDL.Func([], [IDL.Nat64], ['query']),
    'get_expired_contracts' : IDL.Func(
        [],
        [IDL.Vec(IDL.Tuple(IDL.Text, TimeLockContract))],
        ['query'],
      ),
    'get_version' : IDL.Func([], [IDL.Text], ['query']),
    'hash_preimage' : IDL.Func([IDL.Text], [IDL.Text], ['query']),
    'new_contract' : IDL.Func([NewContractRequest], [ContractResponse], []),
    'refund' : IDL.Func([RefundRequest], [ContractResponse], []),
    'transfer_icrc1' : IDL.Func([TransferRequest], [TransferResponse], []),
    'verify_preimage_hash' : IDL.Func(
        [IDL.Text, IDL.Text],
        [IDL.Bool],
        ['query'],
      ),
  });
};