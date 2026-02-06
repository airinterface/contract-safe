const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Verification script for ContractSafe contracts
 *
 * This script verifies all deployed contracts on the block explorer (Polygonscan)
 * It reads deployment addresses from the deployments directory
 */
async function main() {
  const network = hre.network.name;

  console.log("=".repeat(60));
  console.log("ContractSafe Contract Verification");
  console.log("=".repeat(60));
  console.log(`Network: ${network}`);
  console.log("=".repeat(60));

  // Load deployment addresses
  const addressesFile = path.join(
    __dirname,
    "..",
    "deployments",
    `${network}.json`,
  );

  if (!fs.existsSync(addressesFile)) {
    console.error(`❌ No deployment found for network: ${network}`);
    console.error(`   Expected file: ${addressesFile}`);
    console.error(`\n   Please deploy contracts first using:`);
    console.error(`   npx hardhat run scripts/deploy.js --network ${network}`);
    process.exit(1);
  }

  const deployment = JSON.parse(fs.readFileSync(addressesFile, "utf8"));
  const contracts = deployment.contracts;

  console.log("\n📋 Loaded deployment addresses:");
  console.log(`   Deployed at: ${deployment.deployedAt}`);
  console.log(`   Chain ID: ${deployment.chainId}`);

  // Verify ContractFactory
  console.log("\n🔍 Verifying ContractFactory...");
  try {
    await hre.run("verify:verify", {
      address: contracts.ContractFactory,
      constructorArguments: [],
    });
    console.log(`✅ ContractFactory verified`);
  } catch (error) {
    if (error.message.includes("Already Verified")) {
      console.log(`✅ ContractFactory already verified`);
    } else {
      console.error(`❌ ContractFactory verification failed:`, error.message);
    }
  }

  // Verify RoleRegistry
  console.log("\n🔍 Verifying RoleRegistry...");
  try {
    await hre.run("verify:verify", {
      address: contracts.RoleRegistry,
      constructorArguments: [deployment.deployer],
    });
    console.log(`✅ RoleRegistry verified`);
  } catch (error) {
    if (error.message.includes("Already Verified")) {
      console.log(`✅ RoleRegistry already verified`);
    } else {
      console.error(`❌ RoleRegistry verification failed:`, error.message);
    }
  }

  // Verify Treasury
  console.log("\n🔍 Verifying Treasury...");
  try {
    await hre.run("verify:verify", {
      address: contracts.Treasury,
      constructorArguments: [deployment.deployer],
    });
    console.log(`✅ Treasury verified`);
  } catch (error) {
    if (error.message.includes("Already Verified")) {
      console.log(`✅ Treasury already verified`);
    } else {
      console.error(`❌ Treasury verification failed:`, error.message);
    }
  }

  // Verify Paymaster
  console.log("\n🔍 Verifying Paymaster...");
  try {
    await hre.run("verify:verify", {
      address: contracts.Paymaster,
      constructorArguments: [contracts.EntryPoint, deployment.deployer],
    });
    console.log(`✅ Paymaster verified`);
  } catch (error) {
    if (error.message.includes("Already Verified")) {
      console.log(`✅ Paymaster already verified`);
    } else {
      console.error(`❌ Paymaster verification failed:`, error.message);
    }
  }

  // Verify EscrowContract
  console.log("\n🔍 Verifying EscrowContract...");
  try {
    await hre.run("verify:verify", {
      address: contracts.EscrowContract,
      constructorArguments: [
        contracts.Treasury,
        contracts.RoleRegistry,
        contracts.Paymaster,
      ],
    });
    console.log(`✅ EscrowContract verified`);
  } catch (error) {
    if (error.message.includes("Already Verified")) {
      console.log(`✅ EscrowContract already verified`);
    } else {
      console.error(`❌ EscrowContract verification failed:`, error.message);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("✅ Verification Complete!");
  console.log("=".repeat(60));
  console.log("\nView contracts on block explorer:");

  const explorerUrl = getExplorerUrl(network);
  if (explorerUrl) {
    console.log(
      `\nContractFactory: ${explorerUrl}/address/${contracts.ContractFactory}`,
    );
    console.log(
      `RoleRegistry: ${explorerUrl}/address/${contracts.RoleRegistry}`,
    );
    console.log(`Treasury: ${explorerUrl}/address/${contracts.Treasury}`);
    console.log(`Paymaster: ${explorerUrl}/address/${contracts.Paymaster}`);
    console.log(
      `EscrowContract: ${explorerUrl}/address/${contracts.EscrowContract}`,
    );
  }
}

function getExplorerUrl(network) {
  const explorers = {
    mumbai: "https://mumbai.polygonscan.com",
    polygon: "https://polygonscan.com",
    sepolia: "https://sepolia.etherscan.io",
    mainnet: "https://etherscan.io",
    arbitrum: "https://arbiscan.io",
    "arbitrum-goerli": "https://goerli.arbiscan.io",
    optimism: "https://optimistic.etherscan.io",
    "optimism-goerli": "https://goerli-optimism.etherscan.io",
    base: "https://basescan.org",
    "base-goerli": "https://goerli.basescan.org",
  };
  return explorers[network] || null;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
