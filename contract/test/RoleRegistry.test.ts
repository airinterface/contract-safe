import { expect } from "chai";
import { ethers } from "hardhat";
import { RoleRegistry } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("RoleRegistry", function () {
  let roleRegistry: RoleRegistry;
  let admin: SignerWithAddress;
  let creator: SignerWithAddress;
  let contributor: SignerWithAddress;
  let validator: SignerWithAddress;
  let unauthorized: SignerWithAddress;

  let CREATOR_ROLE: string;
  let CONTRIBUTOR_ROLE: string;
  let VALIDATOR_ROLE: string;
  let ADMIN_ROLE: string;

  beforeEach(async function () {
    [admin, creator, contributor, validator, unauthorized] =
      await ethers.getSigners();

    const RoleRegistryFactory = await ethers.getContractFactory("RoleRegistry");
    roleRegistry = await RoleRegistryFactory.deploy(admin.address);
    await roleRegistry.waitForDeployment();

    // Get role identifiers
    CREATOR_ROLE = await roleRegistry.CREATOR_ROLE();
    CONTRIBUTOR_ROLE = await roleRegistry.CONTRIBUTOR_ROLE();
    VALIDATOR_ROLE = await roleRegistry.VALIDATOR_ROLE();
    ADMIN_ROLE = await roleRegistry.ADMIN_ROLE();
  });

  describe("Deployment", function () {
    it("Should set the deployer as admin", async function () {
      expect(await roleRegistry.hasRole(ADMIN_ROLE, admin.address)).to.be.true;
    });

    it("Should revert if initial admin is zero address", async function () {
      const RoleRegistryFactory =
        await ethers.getContractFactory("RoleRegistry");
      await expect(
        RoleRegistryFactory.deploy(ethers.ZeroAddress),
      ).to.be.revertedWith("RoleRegistry: zero address");
    });

    it("Should have correct role identifiers", async function () {
      expect(CREATOR_ROLE).to.equal(
        ethers.keccak256(ethers.toUtf8Bytes("CREATOR_ROLE")),
      );
      expect(CONTRIBUTOR_ROLE).to.equal(
        ethers.keccak256(ethers.toUtf8Bytes("CONTRIBUTOR_ROLE")),
      );
      expect(VALIDATOR_ROLE).to.equal(
        ethers.keccak256(ethers.toUtf8Bytes("VALIDATOR_ROLE")),
      );
    });
  });

  describe("Role Granting", function () {
    it("Should allow admin to grant CREATOR_ROLE", async function () {
      await expect(
        roleRegistry.connect(admin).grantRole(CREATOR_ROLE, creator.address),
      )
        .to.emit(roleRegistry, "RoleGranted")
        .withArgs(CREATOR_ROLE, creator.address, admin.address);

      expect(await roleRegistry.hasRole(CREATOR_ROLE, creator.address)).to.be
        .true;
      expect(await roleRegistry.isCreator(creator.address)).to.be.true;
    });

    it("Should allow admin to grant CONTRIBUTOR_ROLE", async function () {
      await expect(
        roleRegistry
          .connect(admin)
          .grantRole(CONTRIBUTOR_ROLE, contributor.address),
      )
        .to.emit(roleRegistry, "RoleGranted")
        .withArgs(CONTRIBUTOR_ROLE, contributor.address, admin.address);

      expect(await roleRegistry.hasRole(CONTRIBUTOR_ROLE, contributor.address))
        .to.be.true;
      expect(await roleRegistry.isContributor(contributor.address)).to.be.true;
    });

    it("Should allow admin to grant VALIDATOR_ROLE", async function () {
      await expect(
        roleRegistry
          .connect(admin)
          .grantRole(VALIDATOR_ROLE, validator.address),
      )
        .to.emit(roleRegistry, "RoleGranted")
        .withArgs(VALIDATOR_ROLE, validator.address, admin.address);

      expect(await roleRegistry.hasRole(VALIDATOR_ROLE, validator.address)).to
        .be.true;
      expect(await roleRegistry.isValidator(validator.address)).to.be.true;
    });

    it("Should allow admin to grant multiple roles to same address", async function () {
      await roleRegistry
        .connect(admin)
        .grantRole(CREATOR_ROLE, creator.address);
      await roleRegistry
        .connect(admin)
        .grantRole(CONTRIBUTOR_ROLE, creator.address);
      await roleRegistry
        .connect(admin)
        .grantRole(VALIDATOR_ROLE, creator.address);

      expect(await roleRegistry.isCreator(creator.address)).to.be.true;
      expect(await roleRegistry.isContributor(creator.address)).to.be.true;
      expect(await roleRegistry.isValidator(creator.address)).to.be.true;
    });

    it("Should revert when non-admin tries to grant role", async function () {
      await expect(
        roleRegistry
          .connect(unauthorized)
          .grantRole(CREATOR_ROLE, creator.address),
      ).to.be.reverted;
    });
  });

  describe("Role Revoking", function () {
    beforeEach(async function () {
      await roleRegistry
        .connect(admin)
        .grantRole(CREATOR_ROLE, creator.address);
      await roleRegistry
        .connect(admin)
        .grantRole(CONTRIBUTOR_ROLE, contributor.address);
      await roleRegistry
        .connect(admin)
        .grantRole(VALIDATOR_ROLE, validator.address);
    });

    it("Should allow admin to revoke CREATOR_ROLE", async function () {
      await expect(
        roleRegistry.connect(admin).revokeRole(CREATOR_ROLE, creator.address),
      )
        .to.emit(roleRegistry, "RoleRevoked")
        .withArgs(CREATOR_ROLE, creator.address, admin.address);

      expect(await roleRegistry.hasRole(CREATOR_ROLE, creator.address)).to.be
        .false;
      expect(await roleRegistry.isCreator(creator.address)).to.be.false;
    });

    it("Should allow admin to revoke CONTRIBUTOR_ROLE", async function () {
      await expect(
        roleRegistry
          .connect(admin)
          .revokeRole(CONTRIBUTOR_ROLE, contributor.address),
      )
        .to.emit(roleRegistry, "RoleRevoked")
        .withArgs(CONTRIBUTOR_ROLE, contributor.address, admin.address);

      expect(await roleRegistry.hasRole(CONTRIBUTOR_ROLE, contributor.address))
        .to.be.false;
      expect(await roleRegistry.isContributor(contributor.address)).to.be.false;
    });

    it("Should allow admin to revoke VALIDATOR_ROLE", async function () {
      await expect(
        roleRegistry
          .connect(admin)
          .revokeRole(VALIDATOR_ROLE, validator.address),
      )
        .to.emit(roleRegistry, "RoleRevoked")
        .withArgs(VALIDATOR_ROLE, validator.address, admin.address);

      expect(await roleRegistry.hasRole(VALIDATOR_ROLE, validator.address)).to
        .be.false;
      expect(await roleRegistry.isValidator(validator.address)).to.be.false;
    });

    it("Should revert when non-admin tries to revoke role", async function () {
      await expect(
        roleRegistry
          .connect(unauthorized)
          .revokeRole(CREATOR_ROLE, creator.address),
      ).to.be.reverted;
    });
  });

  describe("Role Checking", function () {
    beforeEach(async function () {
      await roleRegistry
        .connect(admin)
        .grantRole(CREATOR_ROLE, creator.address);
      await roleRegistry
        .connect(admin)
        .grantRole(CONTRIBUTOR_ROLE, contributor.address);
      await roleRegistry
        .connect(admin)
        .grantRole(VALIDATOR_ROLE, validator.address);
    });

    it("Should correctly identify creators", async function () {
      expect(await roleRegistry.isCreator(creator.address)).to.be.true;
      expect(await roleRegistry.isCreator(contributor.address)).to.be.false;
    });

    it("Should correctly identify contributors", async function () {
      expect(await roleRegistry.isContributor(contributor.address)).to.be.true;
      expect(await roleRegistry.isContributor(creator.address)).to.be.false;
    });

    it("Should correctly identify validators", async function () {
      expect(await roleRegistry.isValidator(validator.address)).to.be.true;
      expect(await roleRegistry.isValidator(creator.address)).to.be.false;
    });

    it("Should correctly identify admins", async function () {
      expect(await roleRegistry.isAdmin(admin.address)).to.be.true;
      expect(await roleRegistry.isAdmin(creator.address)).to.be.false;
    });

    it("Should return false for addresses without roles", async function () {
      expect(await roleRegistry.isCreator(unauthorized.address)).to.be.false;
      expect(await roleRegistry.isContributor(unauthorized.address)).to.be
        .false;
      expect(await roleRegistry.isValidator(unauthorized.address)).to.be.false;
      expect(await roleRegistry.isAdmin(unauthorized.address)).to.be.false;
    });
  });

  describe("Admin Role Management", function () {
    it("Should allow admin to grant admin role to another address", async function () {
      await roleRegistry.connect(admin).grantRole(ADMIN_ROLE, creator.address);
      expect(await roleRegistry.isAdmin(creator.address)).to.be.true;
    });

    it("Should allow new admin to grant roles", async function () {
      await roleRegistry.connect(admin).grantRole(ADMIN_ROLE, creator.address);
      await roleRegistry
        .connect(creator)
        .grantRole(CONTRIBUTOR_ROLE, contributor.address);
      expect(await roleRegistry.isContributor(contributor.address)).to.be.true;
    });

    it("Should allow admin to revoke their own admin role if another admin exists", async function () {
      await roleRegistry.connect(admin).grantRole(ADMIN_ROLE, creator.address);
      await roleRegistry.connect(admin).revokeRole(ADMIN_ROLE, admin.address);
      expect(await roleRegistry.isAdmin(admin.address)).to.be.false;
      expect(await roleRegistry.isAdmin(creator.address)).to.be.true;
    });
  });
});
