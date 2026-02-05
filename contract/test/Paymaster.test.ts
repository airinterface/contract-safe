import { expect } from "chai";
import { ethers } from "hardhat";
import { Paymaster } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("Paymaster", function () {
  let paymaster: Paymaster;
  let owner: SignerWithAddress;
  let entryPoint: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let unauthorized: SignerWithAddress;

  const SELECTOR_CREATE_TASK = "0x12345678";
  const SELECTOR_SUBMIT_WORK = "0x87654321";
  const GAS_LIMIT_PER_DAY = 1_000_000n;

  // Helper function to create a mock UserOperation
  function createMockUserOp(sender: string, callData: string) {
    return {
      sender: sender,
      nonce: 0,
      initCode: "0x",
      callData: callData,
      callGasLimit: 100000,
      verificationGasLimit: 100000,
      preVerificationGas: 21000,
      maxFeePerGas: ethers.parseUnits("10", "gwei"),
      maxPriorityFeePerGas: ethers.parseUnits("1", "gwei"),
      paymasterAndData: "0x",
      signature: "0x",
    };
  }

  beforeEach(async function () {
    [owner, entryPoint, user1, user2, unauthorized] = await ethers.getSigners();

    const PaymasterFactory = await ethers.getContractFactory("Paymaster");
    paymaster = await PaymasterFactory.deploy(
      entryPoint.address,
      owner.address,
    );
    await paymaster.waitForDeployment();

    // Deposit funds for gas sponsorship
    await paymaster.connect(owner).deposit({ value: ethers.parseEther("10") });
  });

  describe("Deployment", function () {
    it("Should set the correct entryPoint", async function () {
      expect(await paymaster.entryPoint()).to.equal(entryPoint.address);
    });

    it("Should set the correct owner", async function () {
      expect(await paymaster.owner()).to.equal(owner.address);
    });

    it("Should revert if entryPoint is zero address", async function () {
      const PaymasterFactory = await ethers.getContractFactory("Paymaster");
      await expect(
        PaymasterFactory.deploy(ethers.ZeroAddress, owner.address),
      ).to.be.revertedWith("Paymaster: zero entrypoint");
    });

    it("Should revert if owner is zero address", async function () {
      const PaymasterFactory = await ethers.getContractFactory("Paymaster");
      await expect(
        PaymasterFactory.deploy(entryPoint.address, ethers.ZeroAddress),
      ).to.be.revertedWith("Paymaster: zero owner");
    });

    it("Should have correct gas limit constant", async function () {
      expect(await paymaster.GAS_LIMIT_PER_USER_PER_DAY()).to.equal(
        GAS_LIMIT_PER_DAY,
      );
    });
  });

  describe("Allowlist Management", function () {
    it("Should allow owner to add allowlisted operation", async function () {
      await expect(
        paymaster.connect(owner).addAllowlistedOperation(SELECTOR_CREATE_TASK),
      )
        .to.emit(paymaster, "OperationAllowlisted")
        .withArgs(SELECTOR_CREATE_TASK);

      expect(await paymaster.isOperationAllowlisted(SELECTOR_CREATE_TASK)).to.be
        .true;
    });

    it("Should revert when adding already allowlisted operation", async function () {
      await paymaster
        .connect(owner)
        .addAllowlistedOperation(SELECTOR_CREATE_TASK);

      await expect(
        paymaster.connect(owner).addAllowlistedOperation(SELECTOR_CREATE_TASK),
      ).to.be.revertedWith("Paymaster: already allowlisted");
    });

    it("Should revert when non-owner tries to add operation", async function () {
      await expect(
        paymaster
          .connect(unauthorized)
          .addAllowlistedOperation(SELECTOR_CREATE_TASK),
      ).to.be.revertedWith("Paymaster: not owner");
    });

    it("Should allow owner to remove allowlisted operation", async function () {
      await paymaster
        .connect(owner)
        .addAllowlistedOperation(SELECTOR_CREATE_TASK);

      await expect(
        paymaster
          .connect(owner)
          .removeAllowlistedOperation(SELECTOR_CREATE_TASK),
      )
        .to.emit(paymaster, "OperationRemoved")
        .withArgs(SELECTOR_CREATE_TASK);

      expect(await paymaster.isOperationAllowlisted(SELECTOR_CREATE_TASK)).to.be
        .false;
    });

    it("Should revert when removing non-allowlisted operation", async function () {
      await expect(
        paymaster
          .connect(owner)
          .removeAllowlistedOperation(SELECTOR_CREATE_TASK),
      ).to.be.revertedWith("Paymaster: not allowlisted");
    });

    it("Should revert when non-owner tries to remove operation", async function () {
      await paymaster
        .connect(owner)
        .addAllowlistedOperation(SELECTOR_CREATE_TASK);

      await expect(
        paymaster
          .connect(unauthorized)
          .removeAllowlistedOperation(SELECTOR_CREATE_TASK),
      ).to.be.revertedWith("Paymaster: not owner");
    });
  });

  describe("Deposit Management", function () {
    it("Should allow owner to deposit funds", async function () {
      const depositAmount = ethers.parseEther("5");
      const initialBalance = await paymaster.getDepositBalance();

      await expect(paymaster.connect(owner).deposit({ value: depositAmount }))
        .to.emit(paymaster, "DepositReceived")
        .withArgs(owner.address, depositAmount);

      expect(await paymaster.getDepositBalance()).to.equal(
        initialBalance + depositAmount,
      );
    });

    it("Should revert when depositing zero amount", async function () {
      await expect(
        paymaster.connect(owner).deposit({ value: 0 }),
      ).to.be.revertedWith("Paymaster: zero deposit");
    });

    it("Should revert when non-owner tries to deposit", async function () {
      await expect(
        paymaster
          .connect(unauthorized)
          .deposit({ value: ethers.parseEther("1") }),
      ).to.be.revertedWith("Paymaster: not owner");
    });

    it("Should allow owner to withdraw funds", async function () {
      const withdrawAmount = ethers.parseEther("2");
      const initialBalance = await paymaster.getDepositBalance();

      await expect(paymaster.connect(owner).withdraw(withdrawAmount))
        .to.emit(paymaster, "WithdrawalProcessed")
        .withArgs(owner.address, withdrawAmount);

      expect(await paymaster.getDepositBalance()).to.equal(
        initialBalance - withdrawAmount,
      );
    });

    it("Should revert when withdrawing more than balance", async function () {
      const balance = await paymaster.getDepositBalance();
      const tooMuch = balance + ethers.parseEther("1");

      await expect(
        paymaster.connect(owner).withdraw(tooMuch),
      ).to.be.revertedWith("Paymaster: insufficient balance");
    });

    it("Should revert when non-owner tries to withdraw", async function () {
      await expect(
        paymaster.connect(unauthorized).withdraw(ethers.parseEther("1")),
      ).to.be.revertedWith("Paymaster: not owner");
    });

    it("Should accept deposits via receive function", async function () {
      const depositAmount = ethers.parseEther("1");
      const initialBalance = await paymaster.getDepositBalance();

      await expect(
        owner.sendTransaction({
          to: await paymaster.getAddress(),
          value: depositAmount,
        }),
      ).to.emit(paymaster, "DepositReceived");

      expect(await paymaster.getDepositBalance()).to.equal(
        initialBalance + depositAmount,
      );
    });
  });

  describe("User Operation Validation", function () {
    beforeEach(async function () {
      // Add allowlisted operation
      await paymaster
        .connect(owner)
        .addAllowlistedOperation(SELECTOR_CREATE_TASK);
    });

    it("Should sponsor gas for valid operation", async function () {
      const userOp = createMockUserOp(
        user1.address,
        SELECTOR_CREATE_TASK + "00000000",
      );
      const userOpHash = ethers.keccak256(ethers.toUtf8Bytes("test"));
      const maxCost = 50000;

      await expect(
        paymaster
          .connect(entryPoint)
          .validatePaymasterUserOp(userOp, userOpHash, maxCost),
      )
        .to.emit(paymaster, "GasSponsored")
        .withArgs(user1.address, maxCost);
    });

    it("Should reject non-allowlisted operation", async function () {
      const userOp = createMockUserOp(
        user1.address,
        SELECTOR_SUBMIT_WORK + "00000000",
      );
      const userOpHash = ethers.keccak256(ethers.toUtf8Bytes("test"));
      const maxCost = 50000;

      const result = await paymaster
        .connect(entryPoint)
        .validatePaymasterUserOp.staticCall(userOp, userOpHash, maxCost);

      expect(result.validationData).to.equal(1); // Rejected
    });

    it("Should reject when insufficient deposit", async function () {
      // Withdraw most funds
      const balance = await paymaster.getDepositBalance();
      await paymaster.connect(owner).withdraw(balance - 1000n);

      const userOp = createMockUserOp(
        user1.address,
        SELECTOR_CREATE_TASK + "00000000",
      );
      const userOpHash = ethers.keccak256(ethers.toUtf8Bytes("test"));
      const maxCost = 100000; // More than remaining deposit

      const result = await paymaster
        .connect(entryPoint)
        .validatePaymasterUserOp.staticCall(userOp, userOpHash, maxCost);

      expect(result.validationData).to.equal(1); // Rejected
    });

    it("Should reject when rate limit exceeded", async function () {
      const userOp = createMockUserOp(
        user1.address,
        SELECTOR_CREATE_TASK + "00000000",
      );
      const userOpHash = ethers.keccak256(ethers.toUtf8Bytes("test"));
      const maxCost = Number(GAS_LIMIT_PER_DAY) + 1;

      await expect(
        paymaster
          .connect(entryPoint)
          .validatePaymasterUserOp(userOp, userOpHash, maxCost),
      )
        .to.emit(paymaster, "RateLimitExceeded")
        .withArgs(user1.address, 0, maxCost);
    });

    it("Should revert when non-entryPoint calls validatePaymasterUserOp", async function () {
      const userOp = createMockUserOp(
        user1.address,
        SELECTOR_CREATE_TASK + "00000000",
      );
      const userOpHash = ethers.keccak256(ethers.toUtf8Bytes("test"));
      const maxCost = 50000;

      await expect(
        paymaster
          .connect(unauthorized)
          .validatePaymasterUserOp(userOp, userOpHash, maxCost),
      ).to.be.revertedWith("Paymaster: not entrypoint");
    });
  });

  describe("Post Operation", function () {
    beforeEach(async function () {
      await paymaster
        .connect(owner)
        .addAllowlistedOperation(SELECTOR_CREATE_TASK);
    });

    it("Should record gas usage after operation", async function () {
      const userOp = createMockUserOp(
        user1.address,
        SELECTOR_CREATE_TASK + "00000000",
      );
      const userOpHash = ethers.keccak256(ethers.toUtf8Bytes("test"));
      const maxCost = 50000;

      // Validate operation and get context
      await paymaster
        .connect(entryPoint)
        .validatePaymasterUserOp(userOp, userOpHash, maxCost);

      // Manually create context
      const context = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint256"],
        [user1.address, maxCost],
      );

      // Post operation
      const actualGasCost = 40000;
      await expect(
        paymaster.connect(entryPoint).postOp(0, context, actualGasCost),
      )
        .to.emit(paymaster, "GasRecorded")
        .withArgs(user1.address, actualGasCost, 0);

      expect(await paymaster.userGasUsed(user1.address)).to.equal(
        actualGasCost,
      );
    });

    it("Should deduct gas cost from deposit", async function () {
      const userOp = createMockUserOp(
        user1.address,
        SELECTOR_CREATE_TASK + "00000000",
      );
      const userOpHash = ethers.keccak256(ethers.toUtf8Bytes("test"));
      const maxCost = 50000;

      const initialDeposit = await paymaster.getDepositBalance();

      // Validate operation
      await paymaster
        .connect(entryPoint)
        .validatePaymasterUserOp(userOp, userOpHash, maxCost);

      // Manually create context
      const context = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint256"],
        [user1.address, maxCost],
      );

      // Post operation
      const actualGasCost = 40000;
      await paymaster.connect(entryPoint).postOp(0, context, actualGasCost);

      expect(await paymaster.getDepositBalance()).to.equal(
        initialDeposit - BigInt(actualGasCost),
      );
    });

    it("Should revert when non-entryPoint calls postOp", async function () {
      const context = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint256"],
        [user1.address, 50000],
      );

      await expect(
        paymaster.connect(unauthorized).postOp(0, context, 40000),
      ).to.be.revertedWith("Paymaster: not entrypoint");
    });
  });

  describe("Rate Limiting", function () {
    beforeEach(async function () {
      await paymaster
        .connect(owner)
        .addAllowlistedOperation(SELECTOR_CREATE_TASK);
    });

    it("Should track gas usage per user", async function () {
      const userOp = createMockUserOp(
        user1.address,
        SELECTOR_CREATE_TASK + "00000000",
      );
      const userOpHash = ethers.keccak256(ethers.toUtf8Bytes("test"));
      const maxCost = 50000;

      // Manually create context
      const context = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint256"],
        [user1.address, maxCost],
      );

      // First operation
      await paymaster
        .connect(entryPoint)
        .validatePaymasterUserOp(userOp, userOpHash, maxCost);
      await paymaster.connect(entryPoint).postOp(0, context, 40000);

      // Second operation
      await paymaster
        .connect(entryPoint)
        .validatePaymasterUserOp(userOp, userOpHash, maxCost);
      await paymaster.connect(entryPoint).postOp(0, context, 30000);

      expect(await paymaster.userGasUsed(user1.address)).to.equal(70000);
    });

    it("Should reset gas usage after period", async function () {
      const userOp = createMockUserOp(
        user1.address,
        SELECTOR_CREATE_TASK + "00000000",
      );
      const userOpHash = ethers.keccak256(ethers.toUtf8Bytes("test"));
      const maxCost = 50000;

      // Manually create context
      const context = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint256"],
        [user1.address, maxCost],
      );

      // First operation
      await paymaster
        .connect(entryPoint)
        .validatePaymasterUserOp(userOp, userOpHash, maxCost);
      await paymaster.connect(entryPoint).postOp(0, context, 40000);

      expect(await paymaster.userGasUsed(user1.address)).to.equal(40000);

      // Advance time by 1 day
      await time.increase(86400);

      // Second operation after reset
      await paymaster
        .connect(entryPoint)
        .validatePaymasterUserOp(userOp, userOpHash, maxCost);

      // Gas should be reset
      expect(await paymaster.getRemainingGasAllowance(user1.address)).to.equal(
        GAS_LIMIT_PER_DAY,
      );
    });

    it("Should return correct remaining gas allowance", async function () {
      expect(await paymaster.getRemainingGasAllowance(user1.address)).to.equal(
        GAS_LIMIT_PER_DAY,
      );

      const userOp = createMockUserOp(
        user1.address,
        SELECTOR_CREATE_TASK + "00000000",
      );
      const userOpHash = ethers.keccak256(ethers.toUtf8Bytes("test"));
      const maxCost = 50000;

      // Manually create context
      const context = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint256"],
        [user1.address, maxCost],
      );

      await paymaster
        .connect(entryPoint)
        .validatePaymasterUserOp(userOp, userOpHash, maxCost);
      await paymaster.connect(entryPoint).postOp(0, context, 40000);

      expect(await paymaster.getRemainingGasAllowance(user1.address)).to.equal(
        GAS_LIMIT_PER_DAY - 40000n,
      );
    });

    it("Should isolate gas tracking per user", async function () {
      const userOp1 = createMockUserOp(
        user1.address,
        SELECTOR_CREATE_TASK + "00000000",
      );
      const userOp2 = createMockUserOp(
        user2.address,
        SELECTOR_CREATE_TASK + "00000000",
      );
      const userOpHash = ethers.keccak256(ethers.toUtf8Bytes("test"));
      const maxCost = 50000;

      // Manually create contexts
      const context1 = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint256"],
        [user1.address, maxCost],
      );
      const context2 = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint256"],
        [user2.address, maxCost],
      );

      // User1 operation
      await paymaster
        .connect(entryPoint)
        .validatePaymasterUserOp(userOp1, userOpHash, maxCost);
      await paymaster.connect(entryPoint).postOp(0, context1, 40000);

      // User2 operation
      await paymaster
        .connect(entryPoint)
        .validatePaymasterUserOp(userOp2, userOpHash, maxCost);
      await paymaster.connect(entryPoint).postOp(0, context2, 30000);

      expect(await paymaster.userGasUsed(user1.address)).to.equal(40000);
      expect(await paymaster.userGasUsed(user2.address)).to.equal(30000);
    });
  });
});
