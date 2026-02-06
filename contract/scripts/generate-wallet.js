const { ethers } = require("hardhat");

/**
 * Generate a new wallet for testnet deployment
 *
 * ⚠️ WARNING: This wallet is for TESTNET ONLY!
 * Never use this wallet for mainnet or store real funds in it.
 */
async function main() {
  console.log("=".repeat(60));
  console.log("Generate New Testnet Wallet");
  console.log("=".repeat(60));
  console.log("\n⚠️  WARNING: This is for TESTNET ONLY!");
  console.log("   Never use this wallet for mainnet or real funds.\n");

  // Generate random wallet
  const wallet = ethers.Wallet.createRandom();

  console.log("✅ New wallet generated!\n");
  console.log("Address:", wallet.address);
  console.log("Private Key:", wallet.privateKey);
  console.log("\nMnemonic (12 words):");
  console.log(wallet.mnemonic.phrase);

  console.log("\n" + "=".repeat(60));
  console.log("Next Steps:");
  console.log("=".repeat(60));
  console.log("1. Copy the private key above");
  console.log("2. Add it to your .env file:");
  console.log(`   PRIVATE_KEY=${wallet.privateKey}`);
  console.log("\n3. Get testnet funds for this address:");
  console.log(`   Address: ${wallet.address}`);
  console.log("\n   Mumbai Faucet: https://faucet.polygon.technology/");
  console.log("   Sepolia Faucet: https://sepoliafaucet.com/");
  console.log(
    "\n4. Save the mnemonic phrase in a safe place (optional backup)",
  );
  console.log("\n⚠️  SECURITY REMINDER:");
  console.log("   - Never share your private key");
  console.log("   - Never commit .env file to git");
  console.log("   - Use this wallet for TESTNET ONLY");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
