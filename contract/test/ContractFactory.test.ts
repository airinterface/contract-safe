import { expect } from "chai";
import { ethers } from "hardhat";
import { ContractFactory as ContractFactoryContract } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("ContractFactory", function () {
  let factory: ContractFactoryContract;
  let admin: SignerWithAddress;
  let entryPoint: SignerWithAddress;
  let deployer: SignerWithAddress;

  beforeEach(async function () {
    [admin, entryPoint, deployer] = await ethers.getSigners();

    const FactoryFactory = await ethers.getContractFactory("ContractFactory");
    factory = await FactoryFactory.deploy();
    await factory.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should deploy successfully", async function () {
      expect(await factory.getAddress()).to.be.properAddress;
    });
  });

  describe("Deploy Contract Suite", function () {
    it("Should deploy all contracts in correct order", async function () {
      const tx = await factory
        .connect(deployer)
        .deployContractSuite(admin.address, entryPoint.address);

      const receipt = await tx.wait();

      // Check for all ContractInitialized events
      const initEvents = receipt!.logs.filter((log: any) => {
        try {
          const parsed = factory.interface.parseLog({
            topics: log.topics as string[],
            data: log.data,
          });
          return parsed?.name === "ContractInitialized";
        } catch {
          return false;
        }
      });

      expect(initEvents.length).to.equal(4); // RoleRegistry, Treasury, Paymaster, EscrowContract
    });

    it("Should emit ContractSuiteDeployed event", async function () {
      await expect(
        factory
          .connect(deployer)
          .deployContractSuite(admin.address, entryPoint.address),
      ).to.emit(factory, "ContractSuiteDeployed");
    });

    it("Should return deployed contract addresses", async function () {
      const tx = await factory
        .connect(deployer)
        .deployContractSuite(admin.address, entryPoint.address);

      const receipt = await tx.wait();
      const event = receipt!.logs.find((log: any) => {
        try {
          const parsed = factory.interface.parseLog({
            topics: log.topics as string[],
            data: log.data,
          });
          return parsed?.name === "ContractSuiteDeployed";
        } catch {
          return false;
        }
      });

      expect(event).to.not.be.undefined;

      const parsed = factory.interface.parseLog({
        topics: event!.topics as string[],
        data: event!.data,
      });

      expect(parsed!.args.deployer).to.equal(deployer.address);
      expect(parsed!.args.escrow).to.be.properAddress;
      expect(parsed!.args.treasury).to.be.properAddress;
      expect(parsed!.args.roleRegistry).to.be.properAddress;
      expect(parsed!.args.paymaster).to.be.properAddress;
    });

    it("Should store deployment info", async function () {
      await factory
        .connect(deployer)
        .deployContractSuite(admin.address, entryPoint.address);

      const deployment = await factory.getDeployment(deployer.address);

      expect(deployment.escrow).to.be.properAddress;
      expect(deployment.treasury).to.be.properAddress;
      expect(deployment.roleRegistry).to.be.properAddress;
      expect(deployment.paymaster).to.be.properAddress;
      expect(deployment.deployedAt).to.be.gt(0);
    });

    it("Should wire contracts together correctly", async function () {
      await factory
        .connect(deployer)
        .deployContractSuite(admin.address, entryPoint.address);

      const deployment = await factory.getDeployment(deployer.address);

      // Get Treasury contract
      const Treasury = await ethers.getContractFactory("Treasury");
      const treasury = Treasury.attach(deployment.treasury);

      // Check that escrow is authorized caller
      expect(await treasury.isAuthorizedCaller(deployment.escrow)).to.be.true;
    });

    it("Should set correct admin in RoleRegistry", async function () {
      await factory
        .connect(deployer)
        .deployContractSuite(admin.address, entryPoint.address);

      const deployment = await factory.getDeployment(deployer.address);

      // Get RoleRegistry contract
      const RoleRegistry = await ethers.getContractFactory("RoleRegistry");
      const roleRegistry = RoleRegistry.attach(deployment.roleRegistry);

      // Check admin role
      const ADMIN_ROLE = await roleRegistry.ADMIN_ROLE();
      expect(await roleRegistry.hasRole(ADMIN_ROLE, admin.address)).to.be.true;
    });

    it("Should set correct admin in Treasury", async function () {
      await factory
        .connect(deployer)
        .deployContractSuite(admin.address, entryPoint.address);

      const deployment = await factory.getDeployment(deployer.address);

      // Get Treasury contract
      const Treasury = await ethers.getContractFactory("Treasury");
      const treasury = Treasury.attach(deployment.treasury);

      expect(await treasury.owner()).to.equal(admin.address);
    });

    it("Should set correct admin and entryPoint in Paymaster", async function () {
      await factory
        .connect(deployer)
        .deployContractSuite(admin.address, entryPoint.address);

      const deployment = await factory.getDeployment(deployer.address);

      // Get Paymaster contract
      const Paymaster = await ethers.getContractFactory("Paymaster");
      const paymaster = Paymaster.attach(deployment.paymaster);

      expect(await paymaster.owner()).to.equal(admin.address);
      expect(await paymaster.entryPoint()).to.equal(entryPoint.address);
    });

    it("Should set correct references in EscrowContract", async function () {
      await factory
        .connect(deployer)
        .deployContractSuite(admin.address, entryPoint.address);

      const deployment = await factory.getDeployment(deployer.address);

      // Get EscrowContract
      const EscrowContract = await ethers.getContractFactory("EscrowContract");
      const escrow = EscrowContract.attach(deployment.escrow);

      expect(await escrow.treasury()).to.equal(deployment.treasury);
      expect(await escrow.roleRegistry()).to.equal(deployment.roleRegistry);
      expect(await escrow.paymaster()).to.equal(deployment.paymaster);
    });

    it("Should revert if admin is zero address", async function () {
      await expect(
        factory
          .connect(deployer)
          .deployContractSuite(ethers.ZeroAddress, entryPoint.address),
      ).to.be.revertedWith("Factory: zero admin");
    });

    it("Should revert if entryPoint is zero address", async function () {
      await expect(
        factory
          .connect(deployer)
          .deployContractSuite(admin.address, ethers.ZeroAddress),
      ).to.be.revertedWith("Factory: zero entrypoint");
    });

    it("Should allow multiple deployers", async function () {
      const [, , deployer1, deployer2] = await ethers.getSigners();

      await factory
        .connect(deployer1)
        .deployContractSuite(admin.address, entryPoint.address);

      await factory
        .connect(deployer2)
        .deployContractSuite(admin.address, entryPoint.address);

      const deployment1 = await factory.getDeployment(deployer1.address);
      const deployment2 = await factory.getDeployment(deployer2.address);

      expect(deployment1.escrow).to.not.equal(deployment2.escrow);
      expect(deployment1.treasury).to.not.equal(deployment2.treasury);
    });
  });

  describe("Get Deployment", function () {
    it("Should return empty deployment for non-deployer", async function () {
      const deployment = await factory.getDeployment(deployer.address);

      expect(deployment.escrow).to.equal(ethers.ZeroAddress);
      expect(deployment.treasury).to.equal(ethers.ZeroAddress);
      expect(deployment.roleRegistry).to.equal(ethers.ZeroAddress);
      expect(deployment.paymaster).to.equal(ethers.ZeroAddress);
      expect(deployment.deployedAt).to.equal(0);
    });

    it("Should return correct deployment after deploy", async function () {
      await factory
        .connect(deployer)
        .deployContractSuite(admin.address, entryPoint.address);

      const deployment = await factory.getDeployment(deployer.address);

      expect(deployment.escrow).to.not.equal(ethers.ZeroAddress);
      expect(deployment.treasury).to.not.equal(ethers.ZeroAddress);
      expect(deployment.roleRegistry).to.not.equal(ethers.ZeroAddress);
      expect(deployment.paymaster).to.not.equal(ethers.ZeroAddress);
      expect(deployment.deployedAt).to.be.gt(0);
    });
  });

  describe("Has Deployment", function () {
    it("Should return false for non-deployer", async function () {
      expect(await factory.hasDeployment(deployer.address)).to.be.false;
    });

    it("Should return true after deployment", async function () {
      await factory
        .connect(deployer)
        .deployContractSuite(admin.address, entryPoint.address);

      expect(await factory.hasDeployment(deployer.address)).to.be.true;
    });
  });
});
