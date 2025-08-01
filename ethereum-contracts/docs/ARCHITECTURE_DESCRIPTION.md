# Описание работы контрактов Hashed Time Lock Contract (HTLC) System

## Предисловие: Как работают контракты

**HTLC System** состоит из двух основных контрактов, которые работают вместе:

### LiquidityVault - Пул ликвидности
- **Задача**: Управляет пулом ETH и выдает "доли" (shares) пользователям
- **Как работает**: 
  - Пользователи вносят ETH и получают shares пропорционально их вкладу
  - Формула: `shares = (внесенный_ETH * общие_shares) / общий_ETH`
  - При выводе shares сжигаются и ETH возвращается пользователю
- **Дополнительно**: Хранит заблокированные средства от HashedTimeLock

### HashedTimeLock - Временные блокировки
- **Задача**: Создает временно заблокированные переводы ETH с секретными кодами
- **Как работает**:
  - Пользователь создает контракт с параметрами: получатель, хеш секрета, время истечения
  - ETH блокируется в LiquidityVault
  - Получатель может забрать ETH, предоставив правильный секрет
  - Если время истекло, отправитель может вернуть ETH
- **Безопасность**: Использует SHA256 хеширование для генерации lockId и проверки секретов

### Взаимодействие контрактов
1. **Создание HTLC**: ETH → HashedTimeLock → LiquidityVault (блокируется)
2. **Claim**: LiquidityVault → Receiver (освобождается при правильном секрете)
3. **Refund**: LiquidityVault → Sender (освобождается по истечении времени)

## Блок-схемы работы системы

### Ethereum: Два контракта

```
┌─────────────────────────────────────────────────────────────────┐
│                    Пользователи                                 │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                HashedTimeLock Contract                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  newContractETH │  │     claim       │  │     refund      │  │
│  │                 │  │                 │  │                 │  │
│  │ • Генерирует    │  │ • Проверяет     │  │ • Проверяет     │  │
│  │   lockId        │  │   preimage      │  │   время         │  │
│  │ • Создает       │  │ • Проверяет     │  │ • Проверяет     │  │
│  │   контракт      │  │   время         │  │   права         │  │
│  │ • Блокирует ETH │  │ • Освобождает   │  │ • Освобождает   │  │
│  └─────────────────┘  │   ETH           │  │   ETH           │  │
└─────────────────────┬─┴─────────────────┴─-┴─────────────────┴-─┘
                      │
                      ▼
┌────────────────────────────────────────────────────────────────┐
│                LiquidityVault Contract                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   depositETH    │  │  withdrawETH    │  │ depositLockedETH│ │
│  │                 │  │                 │  │                 │ │
│  │ • Рассчитывает  │  │ • Проверяет     │  │ • Блокирует     │ │
│  │   shares        │  │   баланс        │  │   ETH для       │ │
│  │ • Обновляет     │  │ • Сжигает       │  │   lockId        │ │
│  │   балансы       │  │   shares        │  │                 │ │
│  │ • Выдает shares │  │ • Переводит ETH │  └─────────────────┘ │
│  └─────────────────┘  └─────────────────┘                      │
│                                                                │
│  ┌─────────────────┐  ┌─────────────────┐                      │
│  │releaseLockedETH │  │   Управление    │                      │
│  │                 │  │   заблокирован. │                      │
│  │ • Освобождает   │  │   средствами    │                      │
│  │   ETH           │  │                 │                      │
│  │ • Переводит     │  │ • Хранит        │                      │
│  │   получателю    │  │   locked[lockId]│                      │
│  └─────────────────┘  └─────────────────┘                      │
└────────────────────────────────────────────────────────────────┘
```

### ICP: Один canister

```
┌─────────────────────────────────────────────────────────────────┐
│                    Пользователи                                 │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌────────────────────────────────────────────────────────────────┐
│                HashedTimeLock Canister                         │
│                                                                │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │  deposit_icp    │  │  withdraw_icp   │  │create_time_lock │ │
│  │                 │  │                 │  │   _contract     │ │
│  │ • Рассчитывает  │  │ • Проверяет     │  │                 │ │
│  │   shares        │  │   баланс        │  │ • Генерирует    │ │
│  │ • Обновляет     │  │ • Сжигает       │  │   lockId        │ │
│  │   балансы       │  │   shares        │  │ • Создает       │ │
│  │ • Выдает shares │  │ • Переводит ICP │  │   контракт      │ │
│  └─────────────────┘  └─────────────────┘  │ • Блокирует ICP │ │
│                                            └─────────────────┘ │
│                                                                │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │     claim       │  │     refund      │  │  transfer_icp   │ │
│  │                 │  │                 │  │                 │ │
│  │ • Проверяет     │  │ • Проверяет     │  │ • Вызывает      │ │
│  │   preimage      │  │   время         │  │   ledger        │ │
│  │ • Проверяет     │  │ • Проверяет     │  │ • Переводит     │ │
│  │   время         │  │   права         │  │   ICP           │ │
│  │ • Освобождает   │  │ • Освобождает   │  │                 │ │
│  │   ICP           │  │   ICP           │  └─────────────────┘ │
│  └─────────────────┘  └─────────────────┘                      │
│                                                               │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │              Внутреннее состояние                          │ │
│  │                                                             │ │
│  │ • total_shares: Amount                                     │ │
│  │ • total_icp: Amount                                        │ │
│  │ • balances: HashMap<Address, Amount>                       │ │
│  │ • shares: HashMap<Address, Amount>                         │ │
│  │ • contracts: HashMap<LockId, TimeLockContract>             │ │
│  │ • locked: HashMap<LockId, Amount>                          │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Сравнение архитектур

### Ethereum (2 контракта):
```
┌───────────────┐    ┌─────────────–┐
│HashedTimeLock │◄──►│LiquidityVault│
│               │    │              │
│ • HTLC логика │    │ • Пул ликв.  │
│ • Claim/Refund│    │ • Shares     │
│ • Безопасность│    │ • Заблок. ср.│
└───────────────┘    └─────────────–┘
       │                   │
       ▼                   ▼
┌───────────────┐    ┌───────────────┐
│  Пользователи |    │  Пользователи │
└───────────────┘    └───────────────┘
```

### ICP (1 canister):
```
┌─────────────────────────────────┐
│        HashedTimeLock           │
│                                 │
│ ┌─────────────┐ ┌─────────────┐ │
│ │HTLC функции │ │Ликвидность  │ │
│ │             │ │             │ │
│ │ • claim     │ │ • deposit   │ │
│ │ • refund    │ │ • withdraw  │ │
│ │ • create    │ │ • shares    │ │
│ └─────────────┘ └─────────────┘ │
│                                 │
│ ┌─────────────────────────────┐ │
│ │      Общее состояние        │ │
│ │                             │ │
│ │ • contracts                 │ │
│ │ • balances                  │ │
│ │ • shares                    │ │
│ │ • locked                    │ │
│ └─────────────────────────────┘ │
└─────────────────┬───────────────┘
                  │
                  ▼
        ┌──────────────┐
        │ Пользователи │
        └──────────────┘
```

## Почему в Ethereum именно 2 контракта?

### 1. Разделение ответственности (Separation of Concerns)

**LiquidityVault** отвечает за:
- Управление пулом ликвидности
- Выдачу shares пользователям
- Хранение заблокированных средств
- Расчет пропорций при депозитах/выводах

**HashedTimeLock** отвечает за:
- Создание временных блокировок
- Логику claim/refund
- Проверку секретов и времени
- Генерацию уникальных lockId

### 2. Безопасность и контроль доступа

Каждый контракт имеет свои модификаторы доступа

### 3. Газовые оптимизации

Разделение позволяет:
- Оптимизировать газовые затраты для каждого типа операций
- Избежать лишних проверок в каждом контракте
- Сократить размер кода каждого контракта
- Упростить аудит безопасности

### 4. Масштабируемость

- Можно обновлять логику ликвидности независимо от HTLC
- Можно добавлять новые типы временных блокировок
- Можно создавать разные пулы ликвидности для разных целей

## Детальная схема взаимодействия контрактов

### Сценарий 1: Создание HTLC
```
Пользователь → HashedTimeLock.newContractETH()
    ↓
HashedTimeLock создает контракт и генерирует lockId
    ↓
HashedTimeLock → LiquidityVault.depositLockedETH()
    ↓
LiquidityVault блокирует ETH для данного lockId
```

### Сценарий 2: Claim (успешное получение)
```
Получатель → HashedTimeLock.claim(lockId, preimage)
    ↓
HashedTimeLock проверяет preimage и время
    ↓
HashedTimeLock → LiquidityVault.releaseLockedETH(lockId, receiver)
    ↓
LiquidityVault освобождает ETH и переводит получателю
```

### Сценарий 3: Refund (возврат по истечении времени)
```
Отправитель → HashedTimeLock.refund(lockId)
    ↓
HashedTimeLock проверяет время и права отправителя
    ↓
HashedTimeLock → LiquidityVault.releaseLockedETH(lockId, sender)
    ↓
LiquidityVault освобождает ETH и переводит отправителю
```

### Сценарий 4: Депозит в пул ликвидности
```
LP → LiquidityVault.depositETH()
    ↓
LiquidityVault рассчитывает shares
    ↓
LiquidityVault обновляет балансы и выдает shares
```

### Сценарий 5: Вывод из пула ликвидности
```
LP → LiquidityVault.withdrawETH(amount)
    ↓
LiquidityVault проверяет баланс и рассчитывает shares для сжигания
    ↓
LiquidityVault сжигает shares и переводит ETH
```

## Почему в ICP один canister?

### 1. Архитектурные различия
- **Ethereum**: Контракты изолированы, межконтрактные вызовы дороги
- **ICP**: Canister'ы могут быть большими, меж-canister вызовы дешевле

### 2. Простота разработки
- Один canister проще в развертывании и управлении
- Нет необходимости в интерфейсах между контрактами
- Атомарность всех операций

### 3. Производительность
- Нет меж-canister вызовов
- Меньше накладных расходов
- Более быстрые операции

---

## 1. LiquidityVault - Детальный механизм ликвидности и shares

### Ключевые переменные состояния:
```solidity
uint256 public totalShares;        // Общее количество shares в пуле
uint256 public totalETH;           // Общее количество ETH в пуле
mapping(address => uint256) public balances;  // Баланс ETH каждого пользователя
mapping(address => uint256) public shares;    // Количество shares каждого пользователя
mapping(bytes32 => uint256) public locked;    // Заблокированные средства по lockId
```

### Алгоритм расчета shares при депозите:

```solidity
function depositETH() external payable {
    uint256 mintedShares;

    if (totalShares == 0 || totalETH == 0) {
        // Первый депозит: shares = количество ETH
        mintedShares = msg.value;
    } else {
        // Последующие депозиты: shares = (ETH * totalShares) / totalETH
        mintedShares = (msg.value * totalShares) / totalETH;
    }

    balances[msg.sender] += msg.value;
    shares[msg.sender] += mintedShares;
    totalShares += mintedShares;
    totalETH += msg.value;
}
```

**Логика расчета shares:**
1. **Первый депозит**: Если пул пустой, то количество shares = количеству внесенного ETH
2. **Последующие депозиты**: Используется формула `(deposited_eth * total_shares) / total_eth`

**Пример:**
- Первый пользователь депозит 100 ETH → получает 100 shares
- Второй пользователь депозит 50 ETH → получает `(50 * 100) / 100 = 50 shares`
- Третий пользователь депозит 25 ETH → получает `(25 * 150) / 150 = 25 shares`

### Алгоритм вывода ETH:

```solidity
function withdrawETH(uint256 _amount) external {
    uint256 bal = balances[msg.sender];
    if (bal < _amount) revert InsufficientBalance(_amount, bal);

    // Рассчитываем количество shares для сжигания
    uint256 burnedShares = (_amount * totalShares) / totalETH;

    balances[msg.sender] = bal - _amount;
    shares[msg.sender] -= burnedShares;
    totalShares -= burnedShares;
    totalETH -= _amount;

    _transfer(payable(msg.sender), _amount);
}
```

**Логика вывода:**
1. Проверяется, что у пользователя достаточно средств
2. Рассчитывается количество shares для сжигания: `(withdraw_amount * total_shares) / total_eth`
3. Обновляются балансы и общие показатели
4. ETH переводится пользователю

## 2. HashedTimeLock - Детальный механизм временных блокировок

### Структура контракта:
```solidity
struct TimeLockContract {
    address payable sender;    // Отправитель
    address payable receiver;  // Получатель
    uint256 amount;           // Сумма ETH
    bytes32 hashlock;         // Хеш от preimage
    uint256 timelock;         // Время истечения
    bytes32 preimage;         // Preimage (изначально 0)
    bool withdrawn;           // Забрано ли
    bool refunded;            // Возвращено ли
}
```

### Создание контракта:

```solidity
function newContractETH(
    address payable _receiver,
    bytes32 _hashlock,
    uint256 _timelock
) external payable returns (bytes32 lockId) {
    // Генерируем уникальный lockId
    lockId = sha256(abi.encodePacked(
        msg.sender,
        _receiver,
        msg.value,
        _hashlock,
        _timelock
    ));

    // Создаем контракт
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

    // Отправляем ETH в LiquidityVault
    liquidityVault.depositLockedETH{value: msg.value}(lockId);
}
```

**Ключевые моменты:**
1. **lockId** генерируется как SHA256 от всех параметров контракта
2. ETH сразу отправляется в LiquidityVault и блокируется
3. Время блокировки должно быть больше минимального периода

### Claim (забор средств):

```solidity
function claim(bytes32 _lockId, bytes32 _preimage) external returns (uint256 amount) {
    // Проверяем, что preimage соответствует hashlock
    bytes32 expectedHash = contracts[_lockId].hashlock;
    bytes32 providedHash = sha256(abi.encodePacked(_preimage));
    require(expectedHash == providedHash, "Hashlock mismatch");

    TimeLockContract storage c = contracts[_lockId];
    c.preimage = _preimage;
    c.withdrawn = true;

    // Освобождаем ETH из LiquidityVault
    liquidityVault.releaseLockedETH(_lockId, c.receiver);
}
```

### Refund (возврат средств):

```solidity
function refund(bytes32 _lockId) external returns (uint256 amount) {
    TimeLockContract storage c = contracts[_lockId];
    c.refunded = true;

    // Освобождаем ETH из LiquidityVault
    liquidityVault.releaseLockedETH(_lockId, c.sender);
}
```

## 3. Интеграция между контрактами

### Поток данных:
1. **Создание HTLC**: ETH → HashedTimeLock → LiquidityVault (блокируется)
2. **Claim**: LiquidityVault → Receiver (освобождается)
3. **Refund**: LiquidityVault → Sender (освобождается)

### Управление заблокированными средствами:
```solidity
// В LiquidityVault
function depositLockedETH(bytes32 lockId) external payable onlyHashedTimeLock {
    locked[lockId] += msg.value;  // Увеличиваем заблокированную сумму
}

function releaseLockedETH(bytes32 lockId, address to) external onlyHashedTimeLock {
    uint256 amount = locked[lockId];
    locked[lockId] = 0;           // Обнуляем заблокированную сумму
    _transfer(payable(to), amount); // Переводим получателю
}
```

## 4. Реализация на ICP (Internet Computer)

### Основные компоненты для ICP:

#### 1. Canister структура на Rust:
```rust
use candid::{CandidType, Deserialize, Principal};
use ic_cdk::api::call::call_with_payment;
use sha2::{Sha256, Digest};
use std::collections::HashMap;

// Типы данных
type LockId = Vec<u8>;
type Address = Principal;
type Amount = u64;

// Структура HTLC контракта
#[derive(CandidType, Deserialize, Clone)]
struct TimeLockContract {
    sender: Address,
    receiver: Address,
    amount: Amount,
    hashlock: Vec<u8>,
    timelock: i64,
    preimage: Vec<u8>,
    withdrawn: bool,
    refunded: bool,
}

// Один canister для всего функционала
#[derive(Default)]
struct HashedTimeLock {
    // === Состояние для ликвидности ===
    total_shares: Amount,
    total_icp: Amount,
    balances: HashMap<Address, Amount>,
    shares: HashMap<Address, Amount>,
    
    // === Состояние для HTLC ===
    contracts: HashMap<LockId, TimeLockContract>,
    locked: HashMap<LockId, Amount>,
}

impl HashedTimeLock {
    // === Функции ликвидности ===
    #[ic_cdk::update]
    async fn deposit_icp() -> Result<Amount, String> {
        let caller = ic_cdk::caller();
        let amount = ic_cdk::msg_value();
        
        let minted_shares = if self.total_shares == 0 || self.total_icp == 0 {
            amount
        } else {
            (amount * self.total_shares) / self.total_icp
        };
        
        // Обновляем состояние
        *self.balances.entry(caller).or_insert(0) += amount;
        *self.shares.entry(caller).or_insert(0) += minted_shares;
        self.total_shares += minted_shares;
        self.total_icp += amount;
        
        Ok(minted_shares)
    }
    
    #[ic_cdk::update]
    async fn withdraw_icp(amount: Amount) -> Result<Amount, String> {
        let caller = ic_cdk::caller();
        let bal = self.balances.get(&caller).unwrap_or(&0);
        
        if *bal < amount {
            return Err("Insufficient balance".to_string());
        }
        
        let burned_shares = (amount * self.total_shares) / self.total_icp;
        
        *self.balances.get_mut(&caller).unwrap() -= amount;
        *self.shares.get_mut(&caller).unwrap() -= burned_shares;
        self.total_shares -= burned_shares;
        self.total_icp -= amount;
        
        // Перевод ICP пользователю
        self.transfer_icp(caller, amount).await?;
        
        Ok(burned_shares)
    }
    
    // === Функции HTLC ===
    #[ic_cdk::update]
    async fn create_time_lock_contract(
        receiver: Address,
        hashlock: Vec<u8>,
        timelock: i64,
        amount: Amount,
    ) -> Result<LockId, String> {
        let caller = ic_cdk::caller();
        
        // Генерируем lockId
        let mut hasher = Sha256::new();
        hasher.update(&caller.as_slice());
        hasher.update(&receiver.as_slice());
        hasher.update(&amount.to_le_bytes());
        hasher.update(&hashlock);
        hasher.update(&timelock.to_le_bytes());
        let lock_id = hasher.finalize().to_vec();
        
        // Создаем контракт
        let contract = TimeLockContract {
            sender: caller,
            receiver,
            amount,
            hashlock,
            timelock,
            preimage: vec![],
            withdrawn: false,
            refunded: false,
        };
        
        self.contracts.insert(lock_id.clone(), contract);
        
        // Блокируем ICP в том же canister
        self.locked.insert(lock_id.clone(), amount);
        
        Ok(lock_id)
    }
    
    #[ic_cdk::update]
    async fn claim(lock_id: LockId, preimage: Vec<u8>) -> Result<Amount, String> {
        let caller = ic_cdk::caller();
        let contract = self.contracts.get_mut(&lock_id)
            .ok_or("Contract not found")?;
        
        // Проверяем preimage
        let mut hasher = Sha256::new();
        hasher.update(&preimage);
        let expected_hash = hasher.finalize().to_vec();
        
        if contract.hashlock != expected_hash {
            return Err("Hashlock mismatch".to_string());
        }
        
        if contract.receiver != caller {
            return Err("Not receiver".to_string());
        }
        
        if contract.withdrawn {
            return Err("Already withdrawn".to_string());
        }
        
        let current_time = ic_cdk::api::time();
        if contract.timelock <= current_time {
            return Err("Time expired".to_string());
        }
        
        // Обновляем состояние
        contract.preimage = preimage;
        contract.withdrawn = true;
        
        // Освобождаем ICP из того же canister
        let amount = self.locked.remove(&lock_id)
            .ok_or("Nothing locked")?;
        
        // Перевод получателю
        self.transfer_icp(contract.receiver, amount).await?;
        
        Ok(amount)
    }
    
    #[ic_cdk::update]
    async fn refund(lock_id: LockId) -> Result<Amount, String> {
        let caller = ic_cdk::caller();
        let contract = self.contracts.get_mut(&lock_id)
            .ok_or("Contract not found")?;
        
        if contract.sender != caller {
            return Err("Not sender".to_string());
        }
        
        if contract.refunded {
            return Err("Already refunded".to_string());
        }
        
        if contract.withdrawn {
            return Err("Already withdrawn".to_string());
        }
        
        let current_time = ic_cdk::api::time();
        if contract.timelock > current_time {
            return Err("Time not expired".to_string());
        }
        
        // Обновляем состояние
        contract.refunded = true;
        
        // Освобождаем ICP из того же canister
        let amount = self.locked.remove(&lock_id)
            .ok_or("Nothing locked")?;
        
        // Перевод отправителю
        self.transfer_icp(contract.sender, amount).await?;
        
        Ok(amount)
    }
    
    // === Вспомогательные функции ===
    async fn transfer_icp(to: Address, amount: Amount) -> Result<(), String> {
        // Логика перевода ICP
        // Здесь будет вызов ledger canister для перевода ICP
        Ok(())
    }
}
```

### Ключевые отличия Rust реализации:

1. **Типы данных**: Используем `Vec<u8>` вместо `Blob`, `Principal` вместо `address`
2. **Хеширование**: Используем `sha2` crate для SHA256
3. **Время**: Используем `i64` для временных меток
4. **Память**: Используем `HashMap` из стандартной библиотеки Rust
5. **Асинхронность**: Используем `async/await` для операций с переводами
6. **Безопасность**: Используем `Result<T, String>` для обработки ошибок
7. **Единый canister**: Весь функционал в одном canister'е

### Структура проекта на ICP с Rust:
```
src/
├── lib.rs                    // Основной canister
├── types.rs                  // Типы данных
├── liquidity.rs              // Функции ликвидности
├── htlc.rs                   // Функции HTLC
└── utils.rs                  // Утилиты
```

### Cargo.toml зависимости:
```toml
[dependencies]
candid = "0.10"
ic-cdk = "0.12"
ic-cdk-macros = "0.8"
sha2 = "0.10"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
``` 