# Metadata Flow Documentation / Документация потока метаданных

## English Version

### Overview
This document explains **structurally** how metadata flows through the backend system when creating SPL tokens on Solana, and why metadata might appear on Solana Explorer but not on Solscan.

### Complete Metadata Flow Architecture

```
CLIENT REQUEST
     ↓
┌────────────────────────────────────────────────────────────────┐
│  STEP 1: Generate Metadata (Optional but Recommended)          │
│  Endpoint: POST /api/generate-metadata                         │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Client sends:                                             │ │
│  │  - file: logo image (Buffer)                             │ │
│  │  - name: token name                                      │ │
│  │  - symbol: token symbol                                  │ │
│  │  - description: token description                        │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  Handler: metadata-generator.route.ts                         │
│     ↓                                                          │
│  Service: metadata-generator.service.ts                       │
│     ↓                                                          │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Process:                                                  │ │
│  │ 1. uploadToPinata(logoBuffer) → imageHash                │ │
│  │ 2. Create MetaplexMetadata object:                       │ │
│  │    {                                                      │ │
│  │      name: string                                        │ │
│  │      symbol: string                                      │ │
│  │      description: string                                 │ │
│  │      image: "https://gateway.pinata.cloud/ipfs/..."     │ │
│  │      attributes: []                                      │ │
│  │      properties: {                                       │ │
│  │        files: [{ uri, type }]                           │ │
│  │        category: "fungible"  ← CRITICAL for Solscan!   │ │
│  │      }                                                    │ │
│  │    }                                                      │ │
│  │ 3. uploadToPinata(metadataJSON) → metadataHash          │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  Response to Client:                                           │
│  {                                                             │
│    metadataUri: "https://gateway.pinata.cloud/ipfs/Qm..."    │
│    imageUri: "https://gateway.pinata.cloud/ipfs/Qm..."       │
│  }                                                             │
└────────────────────────────────────────────────────────────────┘
     ↓
┌────────────────────────────────────────────────────────────────┐
│  STEP 2: Create Token with Metadata                           │
│  Endpoint: POST /api/create-token                             │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Client sends:                                             │ │
│  │  - name: "Test Token"                                    │ │
│  │  - symbol: "TEST"                                        │ │
│  │  - uri: "https://gateway.pinata.cloud/ipfs/Qm..."       │ │
│  │  - supply: "1000000"                                     │ │
│  │  - decimals: "9"                                         │ │
│  │  - recipientWallet: "optional"                           │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  Handler: metadata-addition.controller.ts                     │
│     ↓                                                          │
│  1. Validate metadata URI                                     │
│     (metadata-validator.ts checks URI accessibility)          │
│     ↓                                                          │
│  Service: metadata-addition.service.ts                        │
│     ↓                                                          │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ createTokenAndMetadata():                                │ │
│  │                                                           │ │
│  │ 2. Initialize Umi SDK                                    │ │
│  │    - createUmi(rpcEndpoint)                             │ │
│  │    - use(mplTokenMetadata())                            │ │
│  │    - use(keypairIdentity(serviceWallet))                │ │
│  │                                                           │ │
│  │ 3. Generate mint signer                                  │ │
│  │    mint = generateSigner(umi)                            │ │
│  │                                                           │ │
│  │ 4. Execute createAndMint() - ATOMIC TRANSACTION          │ │
│  │    ┌─────────────────────────────────────────────────┐  │ │
│  │    │ This single transaction:                        │  │ │
│  │    │ a. Creates token mint account                   │  │ │
│  │    │ b. Creates metadata account (ON-CHAIN!)         │  │ │
│  │    │ c. Mints initial supply                         │  │ │
│  │    │                                                  │  │ │
│  │    │ Parameters passed:                               │  │ │
│  │    │ - mint: new mint address                        │  │ │
│  │    │ - authority: service wallet                     │  │ │
│  │    │ - name: token name                              │  │ │
│  │    │ - symbol: token symbol                          │  │ │
│  │    │ - uri: metadata IPFS URI ← LINKS TO METADATA    │  │ │
│  │    │ - sellerFeeBasisPoints: 0                       │  │ │
│  │    │ - decimals: 9                                   │  │ │
│  │    │ - tokenStandard: TokenStandard.Fungible         │  │ │
│  │    │ - isMutable: true                               │  │ │
│  │    │ - updateAuthority: service wallet               │  │ │
│  │    │ - amount: supply                                │  │ │
│  │    │ - tokenOwner: recipient wallet                  │  │ │
│  │    └─────────────────────────────────────────────────┘  │ │
│  │                                                           │ │
│  │ 5. Calculate Associated Token Account (ATA)              │ │
│  │    findAssociatedTokenPda(mint, owner)                  │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  Response to Client:                                           │
│  {                                                             │
│    mintAddress: "E6BSP6vd...",                                │
│    ata: "Associated Token Account Address",                   │
│    mintTx: "transaction signature",                           │
│    solscanTokenLink: "https://solscan.io/token/...",         │
│    solscanTxLink: "https://solscan.io/tx/..."                │
│  }                                                             │
└────────────────────────────────────────────────────────────────┘
     ↓
┌────────────────────────────────────────────────────────────────┐
│  ON-CHAIN STATE (Solana Blockchain)                           │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Mint Account (E6BSP6vd...)                               │ │
│  │  - Supply                                                │ │
│  │  - Decimals                                              │ │
│  │  - Mint Authority                                        │ │
│  │  - Freeze Authority                                      │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Metadata Account (PDA derived from mint)                 │ │
│  │  ⚠️ THIS IS THE CRITICAL ACCOUNT FOR SOLSCAN            │ │
│  │                                                           │ │
│  │  Structure:                                              │ │
│  │  - key: 4 (MetadataV1)                                  │ │
│  │  - updateAuthority: PublicKey                           │ │
│  │  - mint: PublicKey (E6BSP6vd...)                        │ │
│  │  - data:                                                 │ │
│  │    - name: "Test Token"                                 │ │
│  │    - symbol: "TEST"                                     │ │
│  │    - uri: "https://gateway.pinata.cloud/ipfs/Qm..."    │ │
│  │    - sellerFeeBasisPoints: 0                           │ │
│  │    - creators: null/undefined                           │ │
│  │  - primarySaleHappened: false                           │ │
│  │  - isMutable: true                                      │ │
│  │  - editionNonce: 255                                    │ │
│  │  - tokenStandard: 2 (Fungible)                         │ │
│  │  - collection: null                                     │ │
│  │  - uses: null                                           │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Associated Token Account                                  │ │
│  │  - Owner: recipient wallet                               │ │
│  │  - Mint: E6BSP6vd...                                     │ │
│  │  - Amount: initial supply                                │ │
│  └──────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
     ↓
┌────────────────────────────────────────────────────────────────┐
│  EXPLORER INDEXING                                             │
│                                                                │
│  Solana Explorer:                                              │
│  ✅ Reads metadata account directly from RPC                   │
│  ✅ Shows all on-chain data immediately                        │
│  ✅ Displays: name, symbol, uri, all metadata fields           │
│                                                                │
│  Solscan:                                                      │
│  ⚠️ Indexes data from blockchain with delay (1-5 minutes)     │
│  ⚠️ Fetches off-chain metadata from uri                       │
│  ⚠️ Validates metadata JSON structure                         │
│  ⚠️ Requires proper Metaplex format                           │
│                                                                │
│  If Solscan shows NO metadata:                                │
│  ❌ Possible issues:                                           │
│     1. Metadata URI not accessible                            │
│     2. JSON structure doesn't match Metaplex standard         │
│     3. Missing required fields (name, symbol, image)          │
│     4. Missing properties.category or wrong value             │
│     5. Indexing delay (wait 2-5 minutes)                      │
│     6. IPFS gateway timeout/unavailable                       │
└────────────────────────────────────────────────────────────────┘
```

### Critical Differences: Solana Explorer vs Solscan

| Aspect | Solana Explorer | Solscan |
|--------|-----------------|---------|
| **Data Source** | Reads directly from RPC node | Indexes blockchain + fetches off-chain metadata |
| **Speed** | Instant (after confirmation) | 1-5 minutes indexing delay |
| **Metadata Display** | Shows on-chain metadata account | Fetches and validates off-chain JSON from URI |
| **Requirements** | Only needs on-chain metadata | Needs valid off-chain JSON + proper format |
| **URI Validation** | Not validated | Must be accessible and valid |
| **JSON Format** | Not validated | Must match Metaplex standard exactly |

### Why Metadata Shows on Explorer but NOT on Solscan

#### Problem Scenario:
```
Solana Explorer: ✅ Shows all metadata
Solscan: ❌ Shows "No metadata"
```

#### Root Causes:

**1. Metadata URI is not accessible**
```javascript
// On-chain metadata account has:
uri: "https://gateway.pinata.cloud/ipfs/QmXXX..."

// But Solscan cannot fetch this URI because:
- IPFS gateway is down
- Network timeout
- Wrong URL format
- File was unpinned from IPFS
```

**2. JSON structure doesn't match Metaplex standard**
```javascript
// ❌ WRONG - Missing required fields
{
  "name": "Test Token",
  "symbol": "TEST"
  // Missing: image, properties
}

// ✅ CORRECT - Full Metaplex format
{
  "name": "Test Token",
  "symbol": "TEST",
  "description": "Description",
  "image": "https://gateway.pinata.cloud/ipfs/QmImage...",
  "attributes": [],
  "properties": {
    "files": [
      {
        "uri": "https://gateway.pinata.cloud/ipfs/QmImage...",
        "type": "image/png"
      }
    ],
    "category": "fungible"  // ← CRITICAL!
  }
}
```

**3. Wrong category or missing properties**
```javascript
// ❌ WRONG - Will show as NFT, not token
{
  "properties": {
    "category": "image"  // Makes Solscan think it's an NFT
  }
}

// ✅ CORRECT - Fungible token
{
  "properties": {
    "category": "fungible"  // Tells Solscan it's a token
  }
}
```

### Backend Implementation Details

#### File: `metadata-generator.service.ts`
**Purpose:** Generates properly formatted metadata JSON

```typescript
// This ensures Solscan compatibility
const metadata: MetaplexMetadata = {
    name: params.name,
    symbol: params.symbol,
    description: params.description,
    image: imageUri,
    attributes: [],
    properties: {
        files: [
            {
                uri: imageUri,
                type: params.logoMimetype,  // e.g., "image/png"
            }
        ],
        category: "fungible",  // ← Tells Solscan this is a token
    }
};
```

#### File: `metadata-addition.service.ts`
**Purpose:** Creates token with on-chain metadata using Metaplex

```typescript
// Single atomic transaction that:
// 1. Creates mint
// 2. Creates metadata account (ON-CHAIN)
// 3. Mints tokens
const result = await createAndMint(umi, {
    mint,
    authority: payer,
    name: details.name,           // Stored on-chain
    symbol: details.symbol,       // Stored on-chain
    uri: details.uri,             // ← Links to off-chain JSON
    sellerFeeBasisPoints: percentAmount(0),
    decimals: decimalsNumber,
    tokenStandard: TokenStandard.Fungible,  // ← Token, not NFT
    isMutable: true,
    updateAuthority: payer.publicKey,
    amount: supplyBigInt,
    tokenOwner: tokenOwnerPubkey,
}).sendAndConfirm(umi);
```

### Debugging Checklist

When metadata doesn't show on Solscan:

```
□ 1. Check Solana Explorer first
   → If it shows metadata, on-chain creation succeeded ✅
   → If not, token creation failed ❌

□ 2. Verify metadata URI is accessible
   → Visit the URI in browser
   → Should return valid JSON
   → Check IPFS gateway is responding

□ 3. Validate metadata JSON structure
   → Must have: name, symbol, image, properties
   → properties.category must be "fungible"
   → properties.files must be array with uri and type

□ 4. Wait 2-5 minutes for Solscan indexing
   → Solscan is slower than Explorer
   → Try refreshing the page

□ 5. Check IPFS gateway
   → Try different gateway:
     - gateway.pinata.cloud
     - ipfs.io
     - dweb.link

□ 6. Verify image URI is accessible
   → Image must load in browser
   → Check file type is supported
```

### API Endpoints and Data Flow

#### POST /api/generate-metadata
```
Input:  multipart/form-data (file, name, symbol, description)
        ↓
Process: Upload image → Create JSON → Upload JSON
        ↓
Output: { metadataUri, imageUri }
```

#### POST /api/create-token
```
Input:  JSON (name, symbol, uri, supply, decimals)
        ↓
Validate: Check URI accessibility
        ↓
Process: createAndMint() → Creates mint + metadata account
        ↓
Output: { mintAddress, ata, mintTx, solscanLinks }
```

### Best Practices for Guaranteed Solscan Visibility

1. **Always use `/api/generate-metadata` endpoint**
   - Ensures proper JSON format
   - Handles IPFS upload
   - Validates structure

2. **Wait for IPFS propagation**
   - After generating metadata, wait 30 seconds
   - Verify URI is accessible before creating token

3. **Use reliable IPFS gateway**
   - Pinata gateway is pre-configured
   - Consider pinning important files

4. **Match name and symbol**
   - Use same name/symbol in generate-metadata and create-token
   - Inconsistency may confuse explorers

5. **Allow indexing time**
   - Wait 2-5 minutes after token creation
   - Refresh Solscan page if needed

---

## Русская версия

### Обзор
Этот документ объясняет **структурно**, как метаданные проходят через систему бэкенда при создании SPL токенов на Solana, и почему метаданные могут отображаться на Solana Explorer, но не на Solscan.

### Почему метаданные видны на Explorer, но не на Solscan

#### Проблемная ситуация:
```
Solana Explorer: ✅ Показывает все метаданные
Solscan: ❌ Показывает "Нет метаданных"
```

#### Основные причины:

**1. URI метаданных недоступен**
- IPFS шлюз не отвечает
- Файл был откреплен от IPFS
- Неправильный формат URL

**2. JSON структура не соответствует стандарту Metaplex**
- Отсутствуют обязательные поля: image, properties
- Неправильное значение properties.category
- Отсутствует массив properties.files

**3. Задержка индексации Solscan**
- Solscan индексирует блокчейн с задержкой 1-5 минут
- Нужно подождать и обновить страницу

### Поток данных метаданных

1. **Клиент → `/api/generate-metadata`**
   - Отправка: файл логотипа + название + символ
   - Процесс: загрузка на IPFS + создание JSON
   - Ответ: metadataUri (ссылка на JSON)

2. **Клиент → `/api/create-token`**
   - Отправка: name, symbol, uri, supply, decimals
   - Процесс: создание токена + on-chain метаданных
   - Ответ: mintAddress, ссылки на Solscan

3. **Блокчейн**
   - Создается mint аккаунт
   - Создается metadata аккаунт (on-chain)
   - Метаданные записываются на блокчейн

4. **Индексация**
   - Explorer: читает напрямую из RPC ✅
   - Solscan: индексирует + загружает JSON по URI ⏳

### Чек-лист для диагностики

```
☐ 1. Проверить Solana Explorer
   → Если показывает метаданные - токен создан правильно ✅

☐ 2. Проверить доступность URI метаданных
   → Открыть URI в браузере
   → Должен вернуться валидный JSON

☐ 3. Проверить структуру JSON
   → Обязательные поля: name, symbol, image, properties
   → properties.category должно быть "fungible"

☐ 4. Подождать 2-5 минут
   → Solscan индексирует с задержкой
   → Обновить страницу

☐ 5. Проверить IPFS шлюз
   → gateway.pinata.cloud должен отвечать
   → Попробовать другой шлюз: ipfs.io
```

### Рекомендации для гарантированной видимости на Solscan

1. **Используйте `/api/generate-metadata`**
   - Автоматически создает правильный формат
   - Загружает на IPFS
   - Валидирует структуру

2. **Подождите распространения IPFS**
   - После генерации метаданных подождите 30 секунд
   - Проверьте доступность URI

3. **Используйте надежный IPFS шлюз**
   - Pinata настроен по умолчанию
   - Рассмотрите закрепление важных файлов

4. **Сопоставляйте name и symbol**
   - Используйте одинаковые значения в обоих эндпоинтах

5. **Дайте время на индексацию**
   - Подождите 2-5 минут после создания токена
   - Обновите страницу Solscan
