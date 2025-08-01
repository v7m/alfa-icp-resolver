use candid::Principal;
use ic_cdk::api::call::CallResult;
use candid::CandidType;
use ic_cdk::call;
use ic_cdk::trap;
use icrc_ledger_types::icrc1;
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc1::account::Subaccount;
use icrc_ledger_types::icrc1::transfer::{BlockIndex, NumTokens, TransferError};
use serde::{Deserialize, Serialize};

#[derive(CandidType, Deserialize, Serialize, Clone, Debug)]
pub enum TransferResult { Ok(BlockIndex), Err(TransferError) }

pub async fn transfer_icrc1(
    icrc1_canister: Principal, 
    amount: u64, 
    to_owner: Principal, 
    subaccount: Option<Subaccount>
) -> CallResult<(TransferResult, )> {
    let amount_nat = NumTokens::from(amount);
    let args = icrc1::transfer::TransferArg {
        to: Account { owner: to_owner, subaccount },
        fee: None,
        created_at_time: None,
        memo: None,
        amount: amount_nat,
        from_subaccount: None,
    };

    let result: CallResult<(TransferResult, )> =
        call(icrc1_canister, "icrc1_transfer", (args, )).await;

    result
}

pub fn to_array<T>(v: Vec<T>) -> [T; 32] {
    v.try_into()
        .unwrap_or_else(|v: Vec<T>| {
            trap(&format!("Expected a Vec of length {} but it was {}", 32, v.len()))
        })
}
