const hre = require("hardhat");

/**
 * Estimate deployment gas costs
 */
async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = hre.network.name;

  console.log("=".repeat(60));
  console.log("Gas Estimation for ContractSafe Deployment");
  console.log("=".repeat(60));
  console.log(`Network: ${network}`);
  console.log(`Deployer: ${deployer.address}`);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`Current Balance: ${hre.ethers.formatEther(balance)} MATIC`);
  console.log("=".repeat(60));

  const ENTRY_POINT = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";

  try {
    // Get contract factories
    const RoleRegistry = await hre.ethers.getContractFactory("RoleRegistry");
    const Treasury = await hre.ethers.getContractFactory("Treasury");
    const Paymaster = await hre.ethers.getContractFactory("Paymaster");
    const EscrowContract = await hre.ethers.getContractFactory(
      "EscrowContract",
    );

    // Estimate deployment gas for each contract
    console.log("\n📊 Estimating deployment costs...\n");

    const roleRegistryGas = await hre.ethers.provider.estimateGas(
      await RoleRegistry.getDeployTransaction(deployer.address),
    );
    console.log(`RoleRegistry: ${roleRegistryGas.toString()} gas`);

    const treasuryGas = await hre.ethers.provider.estimateGas(
      await Treasury.getDeployTransaction(deployer.address),
    );
    console.log(`Treasury: ${treasuryGas.toString()} gas`);

    const paymasterGas = await hre.ethers.provider.estimateGas(
      await Paymaster.getDeployTransaction(ENTRY_POINT, deployer.address),
    );
    console.log(`Paymaster: ${paymasterGas.toString()} gas`);

    // For escrow, we need dummy addresses since we don't have the real ones yet
    const dummyAddress = "0x0000000000000000000000000000000000000001";
    const escrowGas = await hre.ethers.provider.estimateGas(
      await EscrowContract.getDeployTransaction(
        dummyAddress,
        dummyAddress,
        dummyAddress,
      ),
    );
    console.log(`EscrowContract: ${escrowGas.toString()} gas`);

    // Calculate total gas
    const totalGas = roleRegistryGas + treasuryGas + paymasterGas + escrowGas;
    console.log(`\nTotal Gas: ${totalGas.toString()}`);

    // Get current gas price
    const feeData = await hre.ethers.provider.getFeeData();
    const gasPrice = feeData.gasPrice;
    console.log(
      `Current Gas Price: ${hre.ethers.formatUnits(gasPrice, "gwei")} gwei`,
    );

    // Calculate cost in MATIC
    const estimatedCost = totalGas * gasPrice;
    const estimatedCostMatic = hre.ethers.formatEther(estimatedCost);
    console.log(`\nEstimated Cost: ${estimatedCostMatic} MATIC`);

    // Add 20% buffer for transactions (authorizeContract, etc)
    const withBuffer = (estimatedCost * 120n) / 100n;
    const withBufferMatic = hre.ethers.formatEther(withBuffer);
    console.log(`With 20% Buffer: ${withBufferMatic} MATIC`);

    console.log("\n" + "=".repeat(60));
    if (balance >= withBuffer) {
      console.log("✅ You have enough MATIC for deployment!");
    } else {
      const needed = withBuffer - balance;
      console.log("❌ Insufficient funds!");
      console.log(`   You need: ${hre.ethers.formatEther(needed)} more MATIC`);
      console.log(`   Total needed: ${withBufferMatic} MATIC`);
      console.log(
        `   Current balance: ${hre.ethers.formatEther(balance)} MATIC`,
      );
    }
    console.log("=".repeat(60));
  } catch (error) {
    console.error("\n❌ Error estimating gas:");
    console.error(error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
