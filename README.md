# Contract Safe (Transparent Escrow built for creators)

<img width="300" height="300" alt="logo" src="https://github.com/user-attachments/assets/8cca3fbe-de05-4c48-a5ce-9a0ad6841197" />

A **task-based escrow system** for tasks, where contributors submit work, validators approve or reject, and funds are automatically released or refunded. All interactions are **gasless for users** via ERC-4337 account abstraction and a Paymaster.

This repo is structured as a **monorepo**, with separate folders for smart contracts, frontend, and scripts.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Folder Structure](#folder-structure)
- [Getting Started](#getting-started)
- [Usage](#usage)
- [MVP vs Future](#mvp-vs-future)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

This project enables:

- **Gasless interactions**: contributors, validators, and task creators can interact without holding ETH.
- **Escrow for tasks**: funds are locked until a validator approves or rejects.
- **Automatic refunds**: rejected tasks refund the creator automatically.
- **Transparency**: all task states, submissions, approvals, and rejections are recorded on-chain.

---

## Features ( P1 )

- Single-task, single-contributor MVP
- Validator approval or rejection
- Refunds on rejection
- Gasless via ERC-4337 and Paymaster
- Minimal frontend UI for task creation, submission, and validation

---

## Architecture

```mermaid
graph LR

User[User]
UI[UI]
AA[AccountAbstraction]
Bundler[Bundler]
Paymaster[Paymaster]
Escrow[EscrowContract]
Registry[RoleRegistry]
Treasury[Treasury]
Indexer[EventIndexer]
Oracle[OracleService]
Uniswap[UniswapV4]

User --> UI
UI --> AA
AA --> Bundler
Bundler --> Escrow
Paymaster --> Bundler

Escrow --> Treasury
Escrow --> Registry
Escrow --> Indexer

Indexer --> User
User --> Oracle
User --> Escrow

Treasury --> AA
Treasury --> Uniswap
```

---

## Development Scripts

### 1. Compiling for Environment

#### Compile Protobuf

```bash
# Generate protobuf files for Go API
./script/generate_protobuf
```

#### Compile Smart Contracts

```bash
# Navigate to contract directory
cd contract

# Install dependencies
npm install

# Compile contracts
npx hardhat compile
```

### 2. Deploying Contracts

```bash
# Deploy to local network
cd contract
npx hardhat run scripts/deploy.js --network localhost

# Deploy to testnet (e.g., Sepolia)
npx hardhat run scripts/deploy.js --network sepolia

# Deploy to mainnet
npx hardhat run scripts/deploy.js --network mainnet
```

### 3. Startup Dev Environment

```bash
# Start all services using Docker Compose
docker-compose up

# Or start individual services:

# Start local blockchain node
cd contract
npx hardhat node

# Start API service
cd api
go run main.go

# Start frontend
cd web
npm install
npm run dev
```

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
