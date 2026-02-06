const hre = require("hardhat");

/**
 * Simple script to check deployer balance
 */
async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = hre.network.name;
  const balance = await hre.ethers.provider.getBalance(deployer.address);

  console.log("=".repeat(60));
  console.log("Account Balance Check");
  console.log("=".repeat(60));
  console.log(`Network: ${network}`);
  console.log(`Address: ${deployer.address}`);
  console.log(`Balance: ${hre.ethers.formatEther(balance)} ETH/MATIC`);
  console.log("=".repeat(60));

  // Warn if balance is low
  const minBalance = hre.ethers.parseEther("0.1");
  if (balance < minBalance) {
    console.log("\n⚠️  WARNING: Balance is low!");
    console.log("   You may not have enough funds for deployment.");
    console.log("   Get testnet funds from:");

    if (network === "mumbai") {
      console.log("   - https://faucet.polygon.technology/");
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
