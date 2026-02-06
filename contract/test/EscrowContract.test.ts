import { expect } from "chai";
import { ethers } from "hardhat";
import {
  EscrowContract,
  Treasury,
  RoleRegistry,
  Paymaster,
} from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("EscrowContract", function () {
  let escrow: EscrowContract;
  let treasury: Treasury;
  let roleRegistry: RoleRegistry;
  let paymaster: Paymaster;

  let owner: SignerWithAddress;
  let creator: SignerWithAddress;
  let contributor: SignerWithAddress;
  let validator: SignerWithAddress;
  let unauthorized: SignerWithAddress;

  const ESCROW_AMOUNT = ethers.parseEther("1.0");
  const CONTRIBUTOR_PERCENTAGE = 70;
  const VALIDATOR_PERCENTAGE = 30;
  const DESCRIPTION_HASH = "QmTest123";
  const ARTIFACTS_HASH = "QmArtifacts456";

  // Task states
  const TaskState = {
    Draft: 0,
    Created: 1,
    Working: 2,
    ApprovalRequested: 3,
    Validating: 4,
    ProcessingPayment: 5,
    Refunded: 6,
  };

  beforeEach(async function () {
    [owner, creator, contributor, validator, unauthorized] =
      await ethers.getSigners();

    // Deploy RoleRegistry
    const RoleRegistryFactory = await ethers.getContractFactory("RoleRegistry");
    roleRegistry = await RoleRegistryFactory.deploy(owner.address);
    await roleRegistry.waitForDeployment();

    // Deploy Treasury
    const TreasuryFactory = await ethers.getContractFactory("Treasury");
    treasury = await TreasuryFactory.deploy(owner.address);
    await treasury.waitForDeployment();

    // Deploy Paymaster
    const PaymasterFactory = await ethers.getContractFactory("Paymaster");
    paymaster = await PaymasterFactory.deploy(owner.address, owner.address);
    await paymaster.waitForDeployment();

    // Deploy EscrowContract
    const EscrowFactory = await ethers.getContractFactory("EscrowContract");
    escrow = await EscrowFactory.deploy(
      await treasury.getAddress(),
      await roleRegistry.getAddress(),
      await paymaster.getAddress(),
    );
    await escrow.waitForDeployment();

    // Authorize escrow contract in treasury
    await treasury
      .connect(owner)
      .addAuthorizedCaller(await escrow.getAddress());
  });

  describe("Deployment", function () {
    it("Should set correct contract references", async function () {
      expect(await escrow.treasury()).to.equal(await treasury.getAddress());
      expect(await escrow.roleRegistry()).to.equal(
        await roleRegistry.getAddress(),
      );
      expect(await escrow.paymaster()).to.equal(await paymaster.getAddress());
    });

    it("Should initialize nextTaskId to 1", async function () {
      expect(await escrow.nextTaskId()).to.equal(1);
    });

    it("Should revert if treasury is zero address", async function () {
      const EscrowFactory = await ethers.getContractFactory("EscrowContract");
      await expect(
        EscrowFactory.deploy(
          ethers.ZeroAddress,
          await roleRegistry.getAddress(),
          await paymaster.getAddress(),
        ),
      ).to.be.revertedWith("Escrow: zero treasury");
    });

    it("Should revert if roleRegistry is zero address", async function () {
      const EscrowFactory = await ethers.getContractFactory("EscrowContract");
      await expect(
        EscrowFactory.deploy(
          await treasury.getAddress(),
          ethers.ZeroAddress,
          await paymaster.getAddress(),
        ),
      ).to.be.revertedWith("Escrow: zero registry");
    });

    it("Should revert if paymaster is zero address", async function () {
      const EscrowFactory = await ethers.getContractFactory("EscrowContract");
      await expect(
        EscrowFactory.deploy(
          await treasury.getAddress(),
          await roleRegistry.getAddress(),
          ethers.ZeroAddress,
        ),
      ).to.be.revertedWith("Escrow: zero paymaster");
    });
  });

  describe("Task Creation", function () {
    it("Should create a task with valid parameters", async function () {
      await expect(
        escrow
          .connect(creator)
          .createTask(
            contributor.address,
            validator.address,
            CONTRIBUTOR_PERCENTAGE,
            VALIDATOR_PERCENTAGE,
            DESCRIPTION_HASH,
            { value: ESCROW_AMOUNT },
          ),
      )
        .to.emit(escrow, "TaskCreated")
        .withArgs(
          1,
          creator.address,
          contributor.address,
          validator.address,
          ESCROW_AMOUNT,
        );

      const task = await escrow.getTask(1);
      expect(task.taskId).to.equal(1);
      expect(task.creator).to.equal(creator.address);
      expect(task.contributor).to.equal(contributor.address);
      expect(task.validator).to.equal(validator.address);
      expect(task.escrowAmount).to.equal(ESCROW_AMOUNT);
      expect(task.contributorPercentage).to.equal(CONTRIBUTOR_PERCENTAGE);
      expect(task.validatorPercentage).to.equal(VALIDATOR_PERCENTAGE);
      expect(task.state).to.equal(TaskState.Created);
      expect(task.descriptionHash).to.equal(DESCRIPTION_HASH);
    });

    it("Should increment task ID for each new task", async function () {
      await escrow
        .connect(creator)
        .createTask(
          contributor.address,
          validator.address,
          CONTRIBUTOR_PERCENTAGE,
          VALIDATOR_PERCENTAGE,
          DESCRIPTION_HASH,
          { value: ESCROW_AMOUNT },
        );

      await escrow
        .connect(creator)
        .createTask(
          contributor.address,
          validator.address,
          CONTRIBUTOR_PERCENTAGE,
          VALIDATOR_PERCENTAGE,
          DESCRIPTION_HASH,
          { value: ESCROW_AMOUNT },
        );

      expect(await escrow.nextTaskId()).to.equal(3);
    });

    it("Should deposit escrow to treasury", async function () {
      await escrow
        .connect(creator)
        .createTask(
          contributor.address,
          validator.address,
          CONTRIBUTOR_PERCENTAGE,
          VALIDATOR_PERCENTAGE,
          DESCRIPTION_HASH,
          { value: ESCROW_AMOUNT },
        );

      const escrowBalance = await treasury.getEscrowBalance(
        1,
        ethers.ZeroAddress,
      );
      expect(escrowBalance).to.equal(ESCROW_AMOUNT);
    });

    it("Should revert if contributor is zero address", async function () {
      await expect(
        escrow
          .connect(creator)
          .createTask(
            ethers.ZeroAddress,
            validator.address,
            CONTRIBUTOR_PERCENTAGE,
            VALIDATOR_PERCENTAGE,
            DESCRIPTION_HASH,
            { value: ESCROW_AMOUNT },
          ),
      ).to.be.revertedWith("Escrow: zero contributor");
    });

    it("Should revert if validator is zero address", async function () {
      await expect(
        escrow
          .connect(creator)
          .createTask(
            contributor.address,
            ethers.ZeroAddress,
            CONTRIBUTOR_PERCENTAGE,
            VALIDATOR_PERCENTAGE,
            DESCRIPTION_HASH,
            { value: ESCROW_AMOUNT },
          ),
      ).to.be.revertedWith("Escrow: zero validator");
    });

    it("Should revert if contributor and validator are same", async function () {
      await expect(
        escrow
          .connect(creator)
          .createTask(
            contributor.address,
            contributor.address,
            CONTRIBUTOR_PERCENTAGE,
            VALIDATOR_PERCENTAGE,
            DESCRIPTION_HASH,
            { value: ESCROW_AMOUNT },
          ),
      ).to.be.revertedWith("Escrow: same contributor/validator");
    });

    it("Should revert if creator is contributor", async function () {
      await expect(
        escrow
          .connect(creator)
          .createTask(
            creator.address,
            validator.address,
            CONTRIBUTOR_PERCENTAGE,
            VALIDATOR_PERCENTAGE,
            DESCRIPTION_HASH,
            { value: ESCROW_AMOUNT },
          ),
      ).to.be.revertedWith("Escrow: creator is contributor");
    });

    it("Should revert if creator is validator", async function () {
      await expect(
        escrow
          .connect(creator)
          .createTask(
            contributor.address,
            creator.address,
            CONTRIBUTOR_PERCENTAGE,
            VALIDATOR_PERCENTAGE,
            DESCRIPTION_HASH,
            { value: ESCROW_AMOUNT },
          ),
      ).to.be.revertedWith("Escrow: creator is validator");
    });

    it("Should revert if percentages don't sum to 100", async function () {
      await expect(
        escrow
          .connect(creator)
          .createTask(
            contributor.address,
            validator.address,
            60,
            30,
            DESCRIPTION_HASH,
            { value: ESCROW_AMOUNT },
          ),
      ).to.be.revertedWith("Escrow: percentages must sum to 100");
    });

    it("Should revert if contributor percentage is zero", async function () {
      await expect(
        escrow
          .connect(creator)
          .createTask(
            contributor.address,
            validator.address,
            0,
            100,
            DESCRIPTION_HASH,
            { value: ESCROW_AMOUNT },
          ),
      ).to.be.revertedWith("Escrow: zero contributor percentage");
    });

    it("Should revert if validator percentage is zero", async function () {
      await expect(
        escrow
          .connect(creator)
          .createTask(
            contributor.address,
            validator.address,
            100,
            0,
            DESCRIPTION_HASH,
            { value: ESCROW_AMOUNT },
          ),
      ).to.be.revertedWith("Escrow: zero validator percentage");
    });

    it("Should revert if escrow amount is zero", async function () {
      await expect(
        escrow
          .connect(creator)
          .createTask(
            contributor.address,
            validator.address,
            CONTRIBUTOR_PERCENTAGE,
            VALIDATOR_PERCENTAGE,
            DESCRIPTION_HASH,
            { value: 0 },
          ),
      ).to.be.revertedWith("Escrow: zero escrow amount");
    });
  });

  describe("Start Work", function () {
    let taskId: number;

    beforeEach(async function () {
      const tx = await escrow
        .connect(creator)
        .createTask(
          contributor.address,
          validator.address,
          CONTRIBUTOR_PERCENTAGE,
          VALIDATOR_PERCENTAGE,
          DESCRIPTION_HASH,
          { value: ESCROW_AMOUNT },
        );
      taskId = 1;
    });

    it("Should allow contributor to start work", async function () {
      await expect(escrow.connect(contributor).startWork(taskId))
        .to.emit(escrow, "TaskWorkingStarted")
        .withArgs(taskId, contributor.address);

      const task = await escrow.getTask(taskId);
      expect(task.state).to.equal(TaskState.Working);
    });

    it("Should revert if not contributor", async function () {
      await expect(
        escrow.connect(unauthorized).startWork(taskId),
      ).to.be.revertedWith("Escrow: not contributor");
    });

    it("Should revert if task is not in Created state", async function () {
      await escrow.connect(contributor).startWork(taskId);

      await expect(
        escrow.connect(contributor).startWork(taskId),
      ).to.be.revertedWith("Escrow: invalid state");
    });
  });

  describe("Submit Work", function () {
    let taskId: number;

    beforeEach(async function () {
      await escrow
        .connect(creator)
        .createTask(
          contributor.address,
          validator.address,
          CONTRIBUTOR_PERCENTAGE,
          VALIDATOR_PERCENTAGE,
          DESCRIPTION_HASH,
          { value: ESCROW_AMOUNT },
        );
      taskId = 1;
      await escrow.connect(contributor).startWork(taskId);
    });

    it("Should allow contributor to submit work", async function () {
      await expect(
        escrow.connect(contributor).submitWork(taskId, ARTIFACTS_HASH),
      )
        .to.emit(escrow, "ApprovalRequested")
        .withArgs(taskId, ARTIFACTS_HASH);

      const task = await escrow.getTask(taskId);
      expect(task.state).to.equal(TaskState.ApprovalRequested);
      expect(task.artifactsHash).to.equal(ARTIFACTS_HASH);
    });

    it("Should revert if not contributor", async function () {
      await expect(
        escrow.connect(unauthorized).submitWork(taskId, ARTIFACTS_HASH),
      ).to.be.revertedWith("Escrow: not contributor");
    });

    it("Should revert if artifacts hash is empty", async function () {
      await expect(
        escrow.connect(contributor).submitWork(taskId, ""),
      ).to.be.revertedWith("Escrow: empty artifacts");
    });

    it("Should revert if task is not in Working state", async function () {
      await escrow.connect(contributor).submitWork(taskId, ARTIFACTS_HASH);

      await expect(
        escrow.connect(contributor).submitWork(taskId, ARTIFACTS_HASH),
      ).to.be.revertedWith("Escrow: invalid state");
    });
  });

  describe("Approve Work", function () {
    let taskId: number;

    beforeEach(async function () {
      await escrow
        .connect(creator)
        .createTask(
          contributor.address,
          validator.address,
          CONTRIBUTOR_PERCENTAGE,
          VALIDATOR_PERCENTAGE,
          DESCRIPTION_HASH,
          { value: ESCROW_AMOUNT },
        );
      taskId = 1;
      await escrow.connect(contributor).startWork(taskId);
      await escrow.connect(contributor).submitWork(taskId, ARTIFACTS_HASH);
    });

    it("Should allow validator to approve work", async function () {
      await expect(escrow.connect(validator).approveWork(taskId))
        .to.emit(escrow, "ValidationStarted")
        .withArgs(taskId, validator.address)
        .to.emit(escrow, "TaskApproved")
        .withArgs(taskId, validator.address)
        .to.emit(escrow, "PaymentProcessed");

      const task = await escrow.getTask(taskId);
      expect(task.state).to.equal(TaskState.ProcessingPayment);
    });

    it("Should process payment correctly", async function () {
      const contributorBalanceBefore = await ethers.provider.getBalance(
        contributor.address,
      );
      const validatorBalanceBefore = await ethers.provider.getBalance(
        validator.address,
      );

      const tx = await escrow.connect(validator).approveWork(taskId);
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;

      const contributorBalanceAfter = await ethers.provider.getBalance(
        contributor.address,
      );
      const validatorBalanceAfter = await ethers.provider.getBalance(
        validator.address,
      );

      const contributorAmount =
        (ESCROW_AMOUNT * BigInt(CONTRIBUTOR_PERCENTAGE)) / 100n;
      const validatorAmount = ESCROW_AMOUNT - contributorAmount;

      expect(contributorBalanceAfter).to.equal(
        contributorBalanceBefore + contributorAmount,
      );
      expect(validatorBalanceAfter).to.equal(
        validatorBalanceBefore + validatorAmount - gasUsed,
      );
    });

    it("Should revert if not validator", async function () {
      await expect(
        escrow.connect(unauthorized).approveWork(taskId),
      ).to.be.revertedWith("Escrow: not validator");
    });

    it("Should revert if task is not in ApprovalRequested state", async function () {
      await escrow.connect(validator).approveWork(taskId);

      await expect(
        escrow.connect(validator).approveWork(taskId),
      ).to.be.revertedWith("Escrow: invalid state");
    });
  });

  describe("Reject Work", function () {
    let taskId: number;

    beforeEach(async function () {
      await escrow
        .connect(creator)
        .createTask(
          contributor.address,
          validator.address,
          CONTRIBUTOR_PERCENTAGE,
          VALIDATOR_PERCENTAGE,
          DESCRIPTION_HASH,
          { value: ESCROW_AMOUNT },
        );
      taskId = 1;
      await escrow.connect(contributor).startWork(taskId);
      await escrow.connect(contributor).submitWork(taskId, ARTIFACTS_HASH);
    });

    it("Should allow validator to reject work", async function () {
      await expect(escrow.connect(validator).rejectWork(taskId))
        .to.emit(escrow, "TaskRejected")
        .withArgs(taskId, validator.address)
        .to.emit(escrow, "TaskRefunded");

      const task = await escrow.getTask(taskId);
      expect(task.state).to.equal(TaskState.Refunded);
    });

    it("Should refund creator correctly", async function () {
      const creatorBalanceBefore = await ethers.provider.getBalance(
        creator.address,
      );

      await escrow.connect(validator).rejectWork(taskId);

      const creatorBalanceAfter = await ethers.provider.getBalance(
        creator.address,
      );

      expect(creatorBalanceAfter).to.equal(
        creatorBalanceBefore + ESCROW_AMOUNT,
      );
    });

    it("Should revert if not validator", async function () {
      await expect(
        escrow.connect(unauthorized).rejectWork(taskId),
      ).to.be.revertedWith("Escrow: not validator");
    });

    it("Should revert if task is not in ApprovalRequested state", async function () {
      await escrow.connect(validator).rejectWork(taskId);

      await expect(
        escrow.connect(validator).rejectWork(taskId),
      ).to.be.revertedWith("Escrow: invalid state");
    });
  });

  describe("State Machine Validation", function () {
    it("Should validate Draft to Created transition", async function () {
      expect(await escrow.isValidTransition(TaskState.Draft, TaskState.Created))
        .to.be.true;
    });

    it("Should validate Created to Working transition", async function () {
      expect(
        await escrow.isValidTransition(TaskState.Created, TaskState.Working),
      ).to.be.true;
    });

    it("Should validate Working to ApprovalRequested transition", async function () {
      expect(
        await escrow.isValidTransition(
          TaskState.Working,
          TaskState.ApprovalRequested,
        ),
      ).to.be.true;
    });

    it("Should validate ApprovalRequested to Validating transition", async function () {
      expect(
        await escrow.isValidTransition(
          TaskState.ApprovalRequested,
          TaskState.Validating,
        ),
      ).to.be.true;
    });

    it("Should validate Validating to ProcessingPayment transition", async function () {
      expect(
        await escrow.isValidTransition(
          TaskState.Validating,
          TaskState.ProcessingPayment,
        ),
      ).to.be.true;
    });

    it("Should validate ApprovalRequested to Refunded transition", async function () {
      expect(
        await escrow.isValidTransition(
          TaskState.ApprovalRequested,
          TaskState.Refunded,
        ),
      ).to.be.true;
    });

    it("Should reject invalid transitions", async function () {
      expect(
        await escrow.isValidTransition(TaskState.Created, TaskState.Refunded),
      ).to.be.false;
      expect(
        await escrow.isValidTransition(
          TaskState.Working,
          TaskState.ProcessingPayment,
        ),
      ).to.be.false;
      expect(
        await escrow.isValidTransition(
          TaskState.ProcessingPayment,
          TaskState.Working,
        ),
      ).to.be.false;
    });
  });
});
