const hre = require("hardhat");

/**
 * Simple script to check deployer balance
 */
async function main() {
  const signers = await hre.ethers.getSigners();

  if (signers.length === 0) {
    console.error("❌ ERROR: No signers found!");
    console.error("\nPlease check:");
    console.error("1. PRIVATE_KEY is set in contract/.env file");
    console.error("2. PRIVATE_KEY starts with 0x");
    console.error("3. PRIVATE_KEY is a valid 64-character hex string");
    console.error("\nTo generate a new wallet:");
    console.error("   npx hardhat run scripts/generate-wallet.js");
    process.exit(1);
  }

  const deployer = signers[0];
  const network = hre.network.name;
  const balance = await hre.ethers.provider.getBalance(deployer.address);

  console.log("=".repeat(60));
  console.log("Account Balance Check");
  console.log("=".repeat(60));
  console.log(`Network: ${network}`);
  console.log(`Address: ${deployer.address}`);
  console.log(`Balance: ${hre.ethers.formatEther(balance)} MATIC`);
  console.log("=".repeat(60));

  // Warn if balance is low
  const minBalance = hre.ethers.parseEther("0.1");
  if (balance < minBalance) {
    console.log("\n⚠️  WARNING: Balance is low!");
    console.log("   You may not have enough funds for deployment.");
    console.log("   Get testnet funds from:");

    if (network === "amoy") {
      console.log("   - https://faucet.polygon.technology/ (select Amoy)");
    } else if (network === "mumbai") {
      console.log("   - Mumbai is deprecated, use Amoy instead");
    } else if (network === "sepolia") {
      console.log("   - https://sepoliafaucet.com/");
    } else {
      console.log("   - Check your network's faucet");
    }
  } else {
    console.log("\n✅ Balance looks good for deployment!");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
