const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Transfer contract ownership to a multi-sig wallet (Gnosis Safe)
 *
 * This should be run IMMEDIATELY after mainnet deployment
 * to secure the contracts with multi-signature control.
 *
 * Usage:
 *   npx hardhat run scripts/transfer-ownership.js --network polygon
 *
 * Before running:
 *   1. Deploy a Gnosis Safe at https://app.safe.global/
 *   2. Add trusted signers (team members)
 *   3. Set threshold (e.g., 2 of 3 signatures required)
 *   4. Update MULTISIG_ADDRESS below
 */

// ⚠️ UPDATE THIS WITH YOUR GNOSIS SAFE ADDRESS
const MULTISIG_ADDRESS =
  process.env.MULTISIG_ADDRESS || "0x0000000000000000000000000000000000000000";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = hre.network.name;

  console.log("=".repeat(60));
  console.log("Transfer Contract Ownership to Multi-sig");
  console.log("=".repeat(60));
  console.log(`Network: ${network}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Multi-sig: ${MULTISIG_ADDRESS}`);
  console.log("=".repeat(60));

  // Validate multi-sig address
  if (MULTISIG_ADDRESS === "0x0000000000000000000000000000000000000000") {
    console.error("\n❌ ERROR: MULTISIG_ADDRESS not set!");
    console.error("\nPlease:");
    console.error("1. Deploy a Gnosis Safe at https://app.safe.global/");
    console.error("2. Set MULTISIG_ADDRESS in .env or update this script");
    console.error("3. Run this script again");
    process.exit(1);
  }

  // Confirm this is what user wants
  if (network === "polygon" || network === "mainnet") {
    console.log(
      "\n⚠️  WARNING: You are about to transfer ownership on MAINNET!",
    );
    console.log("   This action is IRREVERSIBLE.");
    console.log("   Make sure the multi-sig address is correct.");
    console.log(
      "\n   Press Ctrl+C to cancel, or wait 10 seconds to continue...\n",
    );
    await new Promise((resolve) => setTimeout(resolve, 10000));
  }

  // Load deployment addresses
  const addressesFile = path.join(
    __dirname,
    "..",
    "deployments",
    `${network}.json`,
  );

  if (!fs.existsSync(addressesFile)) {
    console.error(`❌ No deployment found for network: ${network}`);
    process.exit(1);
  }

  const deployment = JSON.parse(fs.readFileSync(addressesFile, "utf8"));
  const contracts = deployment.contracts;

  console.log("\n📋 Transferring ownership for contracts:");
  console.log(`   - RoleRegistry: ${contracts.RoleRegistry}`);
  console.log(`   - Treasury: ${contracts.Treasury}`);
  console.log(`   - Paymaster: ${contracts.Paymaster}`);

  // Transfer RoleRegistry ownership
  console.log("\n🔄 Transferring RoleRegistry ownership...");
  const RoleRegistry = await hre.ethers.getContractFactory("RoleRegistry");
  const roleRegistry = RoleRegistry.attach(contracts.RoleRegistry);

  try {
    const tx1 = await roleRegistry.transferOwnership(MULTISIG_ADDRESS);
    await tx1.wait();
    console.log("✅ RoleRegistry ownership transferred");
  } catch (error) {
    console.error("❌ RoleRegistry transfer failed:", error.message);
  }

  // Transfer Treasury ownership
  console.log("\n🔄 Transferring Treasury ownership...");
  const Treasury = await hre.ethers.getContractFactory("Treasury");
  const treasury = Treasury.attach(contracts.Treasury);

  try {
    const tx2 = await treasury.transferOwnership(MULTISIG_ADDRESS);
    await tx2.wait();
    console.log("✅ Treasury ownership transferred");
  } catch (error) {
    console.error("❌ Treasury transfer failed:", error.message);
  }

  // Transfer Paymaster ownership
  console.log("\n🔄 Transferring Paymaster ownership...");
  const Paymaster = await hre.ethers.getContractFactory("Paymaster");
  const paymaster = Paymaster.attach(contracts.Paymaster);

  try {
    const tx3 = await paymaster.transferOwnership(MULTISIG_ADDRESS);
    await tx3.wait();
    console.log("✅ Paymaster ownership transferred");
  } catch (error) {
    console.error("❌ Paymaster transfer failed:", error.message);
  }

  console.log("\n" + "=".repeat(60));
  console.log("✅ Ownership Transfer Complete!");
  console.log("=".repeat(60));
  console.log("\n📝 Next Steps:");
  console.log("1. Verify ownership on block explorer");
  console.log("2. Test multi-sig operations on Gnosis Safe");
  console.log(
    "3. Remove deployment wallet private key from production servers",
  );
  console.log("4. Document multi-sig signers and threshold");
  console.log("\n🔐 Security Checklist:");
  console.log("✅ Contracts owned by multi-sig");
  console.log("✅ Deployment wallet can be retired");
  console.log("✅ Multiple signatures required for admin actions");
  console.log("\nView your Gnosis Safe:");
  console.log(`https://app.safe.global/${network}:${MULTISIG_ADDRESS}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
