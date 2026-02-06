# ContractSafe Deployment Guide

## Prerequisites

1. **Node.js and npm** installed
2. **Private key** with testnet funds (Mumbai MATIC)
3. **API keys** for block explorer verification (optional but recommended)

## Getting Testnet Funds

### Mumbai (Polygon Testnet)

- Faucet: https://faucet.polygon.technology/
- You'll need Mumbai MATIC for gas fees

## Environment Setup

1. Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

2. Update `.env` with your credentials:

```env
# Required for deployment
PRIVATE_KEY=your_private_key_here
MUMBAI_RPC_URL=https://rpc-mumbai.maticvigil.com

# Optional for verification
POLYGONSCAN_API_KEY=your_polygonscan_api_key
```

## Deployment Steps

### 1. Compile Contracts

```bash
cd contract
npm run compile
```

### 2. Deploy to Mumbai Testnet

```bash
npx hardhat run scripts/deploy.js --network mumbai
```

This will:

- Deploy ContractFactory
- Deploy the full contract suite (RoleRegistry, Treasury, Paymaster, EscrowContract)
- Save deployment addresses to `deployments/mumbai.json`
- Save addresses to `../web/src/contracts/addresses.json` (if web folder exists)

### 3. Verify Contracts (Optional)

```bash
npx hardhat run scripts/verify.js --network mumbai
```

This will verify all contracts on Polygonscan Mumbai.

## Deployment Output

After successful deployment, you'll find:

- `deployments/mumbai.json` - Contract addresses and deployment info
- `../web/src/contracts/addresses.json` - Frontend-ready addresses

Example `mumbai.json`:

```json
{
  "network": "mumbai",
  "chainId": "80001",
  "deployer": "0x...",
  "deployedAt": "2026-02-06T...",
  "contracts": {
    "ContractFactory": "0x...",
    "RoleRegistry": "0x...",
    "Treasury": "0x...",
    "Paymaster": "0x...",
    "EscrowContract": "0x...",
    "EntryPoint": "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789"
  }
}
```

## Testing Deployment

### Run Tests Against Deployed Contracts

```bash
npm test
```

### Interact with Contracts

You can use Hardhat console to interact with deployed contracts:

```bash
npx hardhat console --network mumbai
```

Example interaction:

```javascript
const escrowAddress = "0x..."; // From deployments/mumbai.json
const Escrow = await ethers.getContractFactory("EscrowContract");
const escrow = Escrow.attach(escrowAddress);

// Get next task ID
const nextTaskId = await escrow.nextTaskId();
console.log("Next Task ID:", nextTaskId.toString());
```

## Troubleshooting

### Insufficient Funds

If you get "insufficient funds" error:

- Get more Mumbai MATIC from the faucet
- Check your balance: `npx hardhat run scripts/check-balance.js --network mumbai`

### RPC Issues

If RPC connection fails:

- Try alternative Mumbai RPC: `https://matic-mumbai.chainstacklabs.com`
- Update `MUMBAI_RPC_URL` in `.env`

### Verification Fails

If contract verification fails:

- Ensure you have a valid `POLYGONSCAN_API_KEY`
- Wait a few minutes after deployment before verifying
- Check if contracts are already verified

## Next Steps

After deployment:

1. ✅ Verify contracts on Polygonscan
2. ✅ Update frontend with new contract addresses
3. ✅ Test contract interactions
4. ✅ Set up Goldsky subgraph indexing
5. ✅ Deploy orchestrator service
6. ✅ Deploy frontend

## Useful Links

- Mumbai Polygonscan: https://mumbai.polygonscan.com/
- Polygon Faucet: https://faucet.polygon.technology/
- Hardhat Documentation: https://hardhat.org/docs

## Production Deployment Best Practices

### Security Architecture

**For Mainnet Production:**

1. **Create Dedicated Deployment Wallet**

   - Generate new wallet (separate from personal MetaMask)
   - Fund with ONLY enough for deployment (~$50-100)
   - Use this wallet ONLY for deployment

2. **Deploy Contracts**

   ```bash
   npx hardhat run scripts/deploy.js --network polygon
   ```

3. **Create Gnosis Safe Multi-sig**

   - Go to https://app.safe.global/
   - Create new Safe on Polygon
   - Add 3-5 trusted signers (team members)
   - Set threshold (e.g., 2 of 3 signatures required)

4. **Transfer Ownership to Multi-sig**

   ```bash
   # Add multi-sig address to .env
   MULTISIG_ADDRESS=0x...

   # Transfer ownership
   npx hardhat run scripts/transfer-ownership.js --network polygon
   ```

5. **Secure Deployment Wallet**
   - Remove private key from production servers
   - Store securely offline (hardware wallet recommended)
   - Deployment wallet no longer needed for operations

### Why Multi-sig?

✅ **Benefits:**

- Requires multiple team members to approve critical actions
- No single point of failure
- Protects against compromised keys
- Industry standard for production contracts

❌ **Single Wallet Risks:**

- If private key leaks, attacker has full control
- No recovery if key is lost
- Single point of failure

### Wallet Strategy Summary

```
Testnet (Mumbai):
└─ Generated wallet (scripts/generate-wallet.js)
   └─ Use for testing only

Production (Polygon Mainnet):
├─ Deployment Wallet (one-time use)
│  └─ Deploys contracts, pays gas
└─ Gnosis Safe Multi-sig (permanent)
   └─ Owns contracts, requires 2+ signatures
```

## Security Checklist

Before Mainnet Deployment:

- [ ] Audit smart contracts (professional audit recommended)
- [ ] Test thoroughly on Mumbai testnet
- [ ] Create dedicated deployment wallet
- [ ] Fund deployment wallet with minimal amount
- [ ] Set up Gnosis Safe multi-sig
- [ ] Add trusted signers to multi-sig
- [ ] Document deployment process
- [ ] Prepare rollback plan

After Mainnet Deployment:

- [ ] Verify contracts on Polygonscan
- [ ] Transfer ownership to multi-sig
- [ ] Test multi-sig operations
- [ ] Remove deployment key from servers
- [ ] Monitor contract activity
- [ ] Set up alerts for unusual activity
