const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Deployment script for ContractSafe on Polygon Mumbai testnet
 *
 * This script:
 * 1. Deploys ContractFactory
 * 2. Deploys the full contract suite (RoleRegistry, Treasury, Paymaster, EscrowContract)
 * 3. Saves deployment addresses to addresses.json
 */
async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = hre.network.name;

  console.log("=".repeat(60));
  console.log("ContractSafe Deployment");
  console.log("=".repeat(60));
  console.log(`Network: ${network}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(
    `Balance: ${hre.ethers.formatEther(
      await hre.ethers.provider.getBalance(deployer.address),
    )} ETH`,
  );
  console.log("=".repeat(60));

  // Mock EntryPoint address for ERC-4337 (use actual EntryPoint on mainnet)
  // For testnet, we'll use a placeholder or deploy a mock
  const ENTRY_POINT = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789"; // Standard EntryPoint v0.6

  console.log("\n📦 Deploying ContractFactory...");
  const ContractFactory = await hre.ethers.getContractFactory(
    "ContractFactory",
  );
  const contractFactory = await ContractFactory.deploy();
  await contractFactory.waitForDeployment();
  const factoryAddress = await contractFactory.getAddress();
  console.log(`✅ ContractFactory deployed to: ${factoryAddress}`);

  console.log("\n📦 Deploying contract suite via ContractFactory...");
  const tx = await contractFactory.deployContractSuite(
    deployer.address,
    ENTRY_POINT,
  );
  const receipt = await tx.wait();

  // Parse events to get deployed contract addresses
  const deployedEvent = receipt.logs.find((log) => {
    try {
      const parsed = contractFactory.interface.parseLog(log);
      return parsed && parsed.name === "ContractSuiteDeployed";
    } catch {
      return false;
    }
  });

  if (!deployedEvent) {
    throw new Error("ContractSuiteDeployed event not found");
  }

  const parsedEvent = contractFactory.interface.parseLog(deployedEvent);
  const { escrow, treasury, roleRegistry, paymaster } = parsedEvent.args;

  console.log("\n✅ Contract Suite Deployed:");
  console.log(`   - RoleRegistry: ${roleRegistry}`);
  console.log(`   - Treasury: ${treasury}`);
  console.log(`   - Paymaster: ${paymaster}`);
  console.log(`   - EscrowContract: ${escrow}`);

  // Save addresses to file
  const addresses = {
    network: network,
    chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    contracts: {
      ContractFactory: factoryAddress,
      RoleRegistry: roleRegistry,
      Treasury: treasury,
      Paymaster: paymaster,
      EscrowContract: escrow,
      EntryPoint: ENTRY_POINT,
    },
  };

  // Create addresses directory if it doesn't exist
  const addressesDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(addressesDir)) {
    fs.mkdirSync(addressesDir, { recursive: true });
  }

  // Save to network-specific file
  const addressesFile = path.join(addressesDir, `${network}.json`);
  fs.writeFileSync(addressesFile, JSON.stringify(addresses, null, 2));
  console.log(`\n💾 Addresses saved to: ${addressesFile}`);

  // Also save to web/src/contracts/addresses.json for frontend
  const webAddressesDir = path.join(
    __dirname,
    "..",
    "..",
    "web",
    "src",
    "contracts",
  );
  if (fs.existsSync(path.join(__dirname, "..", "..", "web"))) {
    if (!fs.existsSync(webAddressesDir)) {
      fs.mkdirSync(webAddressesDir, { recursive: true });
    }
    const webAddressesFile = path.join(webAddressesDir, "addresses.json");

    // Load existing addresses if file exists
    let allAddresses = {};
    if (fs.existsSync(webAddressesFile)) {
      allAddresses = JSON.parse(fs.readFileSync(webAddressesFile, "utf8"));
    }

    // Update with new deployment
    allAddresses[network] = addresses;

    fs.writeFileSync(webAddressesFile, JSON.stringify(allAddresses, null, 2));
    console.log(`💾 Addresses also saved to: ${webAddressesFile}`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("✅ Deployment Complete!");
  console.log("=".repeat(60));
  console.log("\nNext steps:");
  console.log("1. Verify contracts on block explorer");
  console.log("2. Test contract interactions");
  console.log("3. Update frontend with new addresses");
  console.log("\nTo verify contracts, run:");
  console.log(`   npx hardhat verify --network ${network} ${factoryAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
