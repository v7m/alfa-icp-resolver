use candid::{CandidType, Deserialize, Principal};
use ic_cdk::api::{caller, time};
use ic_cdk_macros::*;
use icrc_ledger_types::icrc1::transfer::BlockIndex;
use serde::{Serialize};
use std::collections::HashMap;
use std::cell::RefCell;
use sha2::{Sha256, Digest};
use hex;

pub mod transfer_service;

pub use transfer_service::*;

#[derive(CandidType, Deserialize, Clone, Debug, Serialize)]
pub struct TimeLockContract {
    pub sender: String,
    pub receiver: String,
    pub amount: u64,
    pub hashlock: String,
    pub timelock: u64,
    pub preimage: Option<String>,
    pub withdrawn: bool,
    pub refunded: bool,
    pub ledger_id: String,
}

#[derive(CandidType, Deserialize, Clone, Debug, Serialize)]
pub struct NewContractRequest {
    pub receiver: String,
    pub amount: u64,
    pub hashlock: String,
    pub timelock: u64,
    pub ledger_id: String,
}

#[derive(CandidType, Deserialize, Clone, Debug, Serialize)]
pub struct ClaimRequest {
    pub lock_id: String,
    pub preimage: String,
}

#[derive(CandidType, Deserialize, Clone, Debug, Serialize)]
pub struct RefundRequest {
    pub lock_id: String,
}

#[derive(CandidType, Deserialize, Clone, Debug, Serialize)]
pub struct ContractResponse {
    pub success: bool,
    pub message: String,
    pub lock_id: Option<String>,
    pub contract: Option<TimeLockContract>,
    pub transfer_result: Option<BlockIndex>,
}

thread_local! {
    static CONTRACTS: RefCell<HashMap<String, TimeLockContract>> = RefCell::new(HashMap::new());
}

fn generate_lock_id(
    sender: &str,
    receiver: &str,
    amount: u64,
    hashlock: &str,
    timelock: u64
) -> String {
    let mut hasher = Sha256::new();
    hasher.update(sender.as_bytes());
    hasher.update(receiver.as_bytes());
    hasher.update(&amount.to_le_bytes());
    hasher.update(hashlock.as_bytes());
    hasher.update(&timelock.to_le_bytes());
    hex::encode(hasher.finalize())
}

fn sha256_hash(input: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(input.as_bytes());
    hex::encode(hasher.finalize())
}

fn verify_preimage(preimage: &str, hashlock: &str) -> bool {
    sha256_hash(preimage) == hashlock
}

fn validate_new_contract_request(
    request: &NewContractRequest,
) -> Result<(), String> {
    if request.receiver.is_empty() {
        return Err("Receiver cannot be empty".to_string());
    }

    if request.amount == 0 {
        return Err("Amount must be greater than 0".to_string());
    }

    if request.hashlock.is_empty() {
        return Err("Hashlock cannot be empty".to_string());
    }

    if request.hashlock.len() != 64 {
        return Err("Hashlock must be a valid SHA-256 hash (64 characters)".to_string());
    }

    let current_time = time();
    if request.timelock <= current_time {
        return Err("Timelock must be in the future".to_string());
    }

    Ok(())
}


fn validate_claim_request(
    request: &ClaimRequest,
    contract: &TimeLockContract
) -> Result<(), String> {
    let current_time = time();
    if current_time >= contract.timelock {
        return Err("Timelock has expired".to_string());
    }

    if caller().to_string() != contract.receiver {
        return Err("Only receiver can claim".to_string());
    }

    if !verify_preimage(&request.preimage, &contract.hashlock) {
        return Err("Invalid preimage".to_string());
    }

    if contract.withdrawn {
        return Err("Already withdrawn".to_string());
    }

    if contract.refunded {
        return Err("Already refunded".to_string());
    }

    Ok(())
}

fn validate_refund_request(
    contract: &TimeLockContract
) -> Result<(), String> {
    let current_time = time();
    if current_time < contract.timelock {
        return Err("Timelock has not expired yet".to_string());
    }
    
    if caller().to_string() != contract.sender {
        return Err("Only sender can refund".to_string());
    }
    
    if contract.withdrawn {
        return Err("Already withdrawn".to_string());
    }
    
    if contract.refunded {
        return Err("Already refunded".to_string());
    }

    Ok(())
}

fn create_success_response(
    lock_id: String,
    contract: TimeLockContract,
    message: &str,
    transfer_result: Option<BlockIndex>
) -> ContractResponse {
    ContractResponse {
        success: true,
        message: message.to_string(),
        lock_id: Some(lock_id),
        contract: Some(contract),
        transfer_result,
    }
}

fn create_error_response(message: &str) -> ContractResponse {
    ContractResponse {
        success: false,
        message: message.to_string(),
        lock_id: None,
        contract: None,
        transfer_result: None,
    }
}

fn create_contract_not_found_response() -> ContractResponse {
    create_error_response("Contract not found")
}

#[update]
pub fn new_contract(request: NewContractRequest) -> ContractResponse {
    let sender = caller().to_string();
    
    if let Err(error) = validate_new_contract_request(&request) {
        return create_error_response(&error);
    }

    let lock_id = generate_lock_id(
        &sender,
        &request.receiver,
        request.amount,
        &request.hashlock,
        request.timelock
    );

    let contract_exists = CONTRACTS.with(|contracts| {
        contracts.borrow().contains_key(&lock_id)
    });

    if contract_exists {
        return create_error_response("Contract already exists");
    }

    let contract = TimeLockContract {
        sender: sender.clone(),
        receiver: request.receiver,
        amount: request.amount,
        hashlock: request.hashlock,
        timelock: request.timelock,
        withdrawn: false,
        refunded: false,
        preimage: None,
        ledger_id: request.ledger_id,
    };

    CONTRACTS.with(|contracts| {
        contracts.borrow_mut().insert(lock_id.clone(), contract.clone())
    });

    create_success_response(lock_id, contract, "Contract created successfully", None)
}

#[update]
pub async fn claim(request: ClaimRequest) -> ContractResponse {
    let contract_data = CONTRACTS.with(|contracts| {
        let contracts_borrow = contracts.borrow();
        contracts_borrow.get(&request.lock_id).cloned()
    });

    if contract_data.is_none() {
        return create_contract_not_found_response();
    }

    let contract = contract_data.unwrap();

    if let Err(error) = validate_claim_request(&request, &contract) {
        return create_error_response(&error);
    }

    let transfer_result = transfer_service::transfer_icrc1(
        Principal::from_text(contract.ledger_id.clone()).unwrap(),
        contract.amount,
        Principal::from_text(contract.receiver.clone()).unwrap(),
        None
    ).await;

    if let Ok((transfer_result, )) = transfer_result {
        if let TransferResult::Ok(block_index) = transfer_result {
            CONTRACTS.with(|contracts| {
                let mut contracts_borrow = contracts.borrow_mut();
                if let Some(contract_mut) =
                    contracts_borrow.get_mut(&request.lock_id)
                {
                    contract_mut.withdrawn = true;
                    contract_mut.preimage = Some(request.preimage.clone());
                }
            });

            return create_success_response(
                request.lock_id.clone(),
                contract,
                "Claim successful",
                Some(block_index)
            );
        } else {
            return create_error_response("Transfer failed");
        }
    } else {
        return create_error_response("Transfer failed");
    }
}

#[update]
pub fn refund(request: RefundRequest) -> ContractResponse {
    let result = CONTRACTS.with(|contracts| {
        let mut contracts_borrow = contracts.borrow_mut();

        let contract_data = contracts_borrow.get_mut(&request.lock_id);

        if contract_data.is_none() {
            return create_contract_not_found_response();
        }

        let contract = contract_data.unwrap();

        if let Err(error) = validate_refund_request(&contract) {
            return create_error_response(&error);
        }

        contract.refunded = true;

        create_success_response(
            request.lock_id.clone(),
            contract.clone(),
            "Refund successful",
            None
        )
    });
    
    result
}

#[query]
pub fn get_contract(lock_id: String) -> Option<TimeLockContract> {
    CONTRACTS.with(|contracts| {
        contracts.borrow().get(&lock_id).cloned()
    })
}

#[query]
pub fn get_all_contracts() -> Vec<(String, TimeLockContract)> {
    CONTRACTS.with(|contracts| {
        contracts
            .borrow()
            .iter()
            .map(|(k, v)| (k.clone(), v.clone()))
            .collect()
    })
}

#[query]
pub fn get_contracts_by_sender(sender: String) -> Vec<(String, TimeLockContract)> {
    CONTRACTS.with(|contracts| {
        contracts
            .borrow()
            .iter()
            .filter(|(_, contract)| contract.sender == sender)
            .map(|(k, v)| (k.clone(), v.clone()))
            .collect()
    })
}

#[query]
pub fn get_contracts_by_receiver(receiver: String) -> Vec<(String, TimeLockContract)> {
    CONTRACTS.with(|contracts| {
        contracts
            .borrow()
            .iter()
            .filter(|(_, contract)| contract.receiver == receiver)
            .map(|(k, v)| (k.clone(), v.clone()))
            .collect()
    })
}

#[query]
pub fn get_caller() -> String {
    caller().to_string()
}

#[query]
pub fn get_current_time() -> u64 {
    time()
}

#[query]
pub fn get_version() -> String {
    "1.0.0".to_string()
}

#[query]
pub fn hash_preimage(preimage: String) -> String {
    sha256_hash(&preimage)
}

#[query]
pub fn verify_preimage_hash(preimage: String, hashlock: String) -> bool {
    verify_preimage(&preimage, &hashlock)
}

#[query]
pub fn get_contract_count() -> u64 {
    CONTRACTS.with(|contracts| {
        contracts.borrow().len() as u64
    })
}

#[query]
pub fn get_active_contracts() -> Vec<(String, TimeLockContract)> {
    CONTRACTS.with(|contracts| {
        contracts
            .borrow()
            .iter()
            .filter(|(_, contract)| !contract.withdrawn && !contract.refunded)
            .map(|(k, v)| (k.clone(), v.clone()))
            .collect()
    })
}

#[query]
pub fn get_expired_contracts() -> Vec<(String, TimeLockContract)> {
    let current_time = time();
    CONTRACTS.with(|contracts| {
        contracts
            .borrow()
            .iter()
            .filter(|(_, contract)| {
                current_time >= contract.timelock &&
                !contract.withdrawn &&
                !contract.refunded
            })
            .map(|(k, v)| (k.clone(), v.clone()))
            .collect()
    })
}
