const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Simplified deployment script for low-gas scenarios
 * Deploys contracts individually instead of using factory
 */
async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = hre.network.name;

  console.log("=".repeat(60));
  console.log("ContractSafe Simple Deployment");
  console.log("=".repeat(60));
  console.log(`Network: ${network}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(
    `Balance: ${hre.ethers.formatEther(
      await hre.ethers.provider.getBalance(deployer.address),
    )} MATIC`,
  );
  console.log("=".repeat(60));

  const ENTRY_POINT = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";

  // Deploy RoleRegistry
  console.log("\n📦 Deploying RoleRegistry...");
  const RoleRegistry = await hre.ethers.getContractFactory("RoleRegistry");
  const roleRegistry = await RoleRegistry.deploy(deployer.address);
  await roleRegistry.waitForDeployment();
  const roleRegistryAddress = await roleRegistry.getAddress();
  console.log(`✅ RoleRegistry: ${roleRegistryAddress}`);

  // Deploy Treasury
  console.log("\n📦 Deploying Treasury...");
  const Treasury = await hre.ethers.getContractFactory("Treasury");
  const treasury = await Treasury.deploy(deployer.address);
  await treasury.waitForDeployment();
  const treasuryAddress = await treasury.getAddress();
  console.log(`✅ Treasury: ${treasuryAddress}`);

  // Deploy Paymaster
  console.log("\n📦 Deploying Paymaster...");
  const Paymaster = await hre.ethers.getContractFactory("Paymaster");
  const paymaster = await Paymaster.deploy(ENTRY_POINT, deployer.address);
  await paymaster.waitForDeployment();
  const paymasterAddress = await paymaster.getAddress();
  console.log(`✅ Paymaster: ${paymasterAddress}`);

  // Deploy EscrowContract
  console.log("\n📦 Deploying EscrowContract...");
  const EscrowContract = await hre.ethers.getContractFactory("EscrowContract");
  const escrow = await EscrowContract.deploy(
    treasuryAddress,
    roleRegistryAddress,
    paymasterAddress,
  );
  await escrow.waitForDeployment();
  const escrowAddress = await escrow.getAddress();
  console.log(`✅ EscrowContract: ${escrowAddress}`);

  // Wire contracts together
  console.log("\n🔗 Wiring contracts...");
  await treasury.authorizeContract(escrowAddress);
  console.log("✅ Treasury authorized EscrowContract");

  // Save addresses
  const addresses = {
    network: network,
    chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    contracts: {
      RoleRegistry: roleRegistryAddress,
      Treasury: treasuryAddress,
      Paymaster: paymasterAddress,
      EscrowContract: escrowAddress,
      EntryPoint: ENTRY_POINT,
    },
  };

  const addressesDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(addressesDir)) {
    fs.mkdirSync(addressesDir, { recursive: true });
  }

  const addressesFile = path.join(addressesDir, `${network}.json`);
  fs.writeFileSync(addressesFile, JSON.stringify(addresses, null, 2));
  console.log(`\n💾 Addresses saved to: ${addressesFile}`);

  console.log("\n" + "=".repeat(60));
  console.log("✅ Deployment Complete!");
  console.log("=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
