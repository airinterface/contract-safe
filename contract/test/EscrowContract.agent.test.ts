import { expect } from "chai";
import { ethers } from "hardhat";
import {
  EscrowContract,
  Treasury,
  RoleRegistry,
  Paymaster,
} from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("EscrowContract - Agent Validator", function () {
  let escrow: EscrowContract;
  let treasury: Treasury;
  let roleRegistry: RoleRegistry;
  let paymaster: Paymaster;
  let owner: SignerWithAddress;
  let creator: SignerWithAddress;
  let contributor: SignerWithAddress;
  let agentValidator: SignerWithAddress;
  let entryPoint: SignerWithAddress;

  const ESCROW_AMOUNT = ethers.parseEther("1.0");
  const CONTRIBUTOR_PERCENTAGE = 70;
  const VALIDATOR_PERCENTAGE = 30;
  const DESCRIPTION_HASH = "QmTest123";
  const MCP_URL = "https://agent.example.com/mcp";
  const EVALUATION_CRITERIA = "Code must pass all tests and follow style guide";
  const CONFIDENCE_THRESHOLD = 80;

  beforeEach(async function () {
    [owner, creator, contributor, agentValidator, entryPoint] =
      await ethers.getSigners();

    // Deploy RoleRegistry
    const RoleRegistryFactory = await ethers.getContractFactory("RoleRegistry");
    roleRegistry = await RoleRegistryFactory.deploy(owner.address);

    // Deploy Treasury
    const TreasuryFactory = await ethers.getContractFactory("Treasury");
    treasury = await TreasuryFactory.deploy(owner.address);

    // Deploy Paymaster
    const PaymasterFactory = await ethers.getContractFactory("Paymaster");
    paymaster = await PaymasterFactory.deploy(
      entryPoint.address,
      owner.address,
    );

    // Deploy EscrowContract
    const EscrowFactory = await ethers.getContractFactory("EscrowContract");
    escrow = await EscrowFactory.deploy(
      await treasury.getAddress(),
      await roleRegistry.getAddress(),
      await paymaster.getAddress(),
    );

    // Authorize escrow in treasury
    await treasury
      .connect(owner)
      .addAuthorizedCaller(await escrow.getAddress());
  });

  describe("Agent Task Creation", function () {
    it("Should create task with agent validator configuration", async function () {
      const tx = await escrow
        .connect(creator)
        .createTaskWithAgent(
          contributor.address,
          agentValidator.address,
          CONTRIBUTOR_PERCENTAGE,
          VALIDATOR_PERCENTAGE,
          DESCRIPTION_HASH,
          MCP_URL,
          EVALUATION_CRITERIA,
          CONFIDENCE_THRESHOLD,
          { value: ESCROW_AMOUNT },
        );

      await expect(tx)
        .to.emit(escrow, "TaskCreatedWithAgent")
        .withArgs(
          1,
          creator.address,
          contributor.address,
          agentValidator.address,
          ESCROW_AMOUNT,
          MCP_URL,
        );

      const task = await escrow.getTask(1);
      expect(task.taskId).to.equal(1);
      expect(task.creator).to.equal(creator.address);
      expect(task.contributor).to.equal(contributor.address);
      expect(task.validator).to.equal(agentValidator.address);
      expect(task.escrowAmount).to.equal(ESCROW_AMOUNT);
      expect(task.state).to.equal(1); // Created
    });

    it("Should store agent configuration correctly", async function () {
      await escrow
        .connect(creator)
        .createTaskWithAgent(
          contributor.address,
          agentValidator.address,
          CONTRIBUTOR_PERCENTAGE,
          VALIDATOR_PERCENTAGE,
          DESCRIPTION_HASH,
          MCP_URL,
          EVALUATION_CRITERIA,
          CONFIDENCE_THRESHOLD,
          { value: ESCROW_AMOUNT },
        );

      const agentConfig = await escrow.getAgentConfig(1);
      expect(agentConfig.mcpUrl).to.equal(MCP_URL);
      expect(agentConfig.evaluationCriteria).to.equal(EVALUATION_CRITERIA);
      expect(agentConfig.confidenceThreshold).to.equal(CONFIDENCE_THRESHOLD);
      expect(agentConfig.isAgentValidator).to.be.true;
    });

    it("Should revert when MCP URL is empty", async function () {
      await expect(
        escrow.connect(creator).createTaskWithAgent(
          contributor.address,
          agentValidator.address,
          CONTRIBUTOR_PERCENTAGE,
          VALIDATOR_PERCENTAGE,
          DESCRIPTION_HASH,
          "", // Empty MCP URL
          EVALUATION_CRITERIA,
          CONFIDENCE_THRESHOLD,
          { value: ESCROW_AMOUNT },
        ),
      ).to.be.revertedWith("Escrow: empty MCP URL");
    });

    it("Should revert when evaluation criteria is empty", async function () {
      await expect(
        escrow.connect(creator).createTaskWithAgent(
          contributor.address,
          agentValidator.address,
          CONTRIBUTOR_PERCENTAGE,
          VALIDATOR_PERCENTAGE,
          DESCRIPTION_HASH,
          MCP_URL,
          "", // Empty criteria
          CONFIDENCE_THRESHOLD,
          { value: ESCROW_AMOUNT },
        ),
      ).to.be.revertedWith("Escrow: empty criteria");
    });

    it("Should revert when confidence threshold is zero", async function () {
      await expect(
        escrow.connect(creator).createTaskWithAgent(
          contributor.address,
          agentValidator.address,
          CONTRIBUTOR_PERCENTAGE,
          VALIDATOR_PERCENTAGE,
          DESCRIPTION_HASH,
          MCP_URL,
          EVALUATION_CRITERIA,
          0, // Zero threshold
          { value: ESCROW_AMOUNT },
        ),
      ).to.be.revertedWith("Escrow: invalid threshold");
    });

    it("Should revert when confidence threshold exceeds 100", async function () {
      await expect(
        escrow.connect(creator).createTaskWithAgent(
          contributor.address,
          agentValidator.address,
          CONTRIBUTOR_PERCENTAGE,
          VALIDATOR_PERCENTAGE,
          DESCRIPTION_HASH,
          MCP_URL,
          EVALUATION_CRITERIA,
          101, // Exceeds 100
          { value: ESCROW_AMOUNT },
        ),
      ).to.be.revertedWith("Escrow: invalid threshold");
    });

    it("Should revert when contributor address is zero", async function () {
      await expect(
        escrow
          .connect(creator)
          .createTaskWithAgent(
            ethers.ZeroAddress,
            agentValidator.address,
            CONTRIBUTOR_PERCENTAGE,
            VALIDATOR_PERCENTAGE,
            DESCRIPTION_HASH,
            MCP_URL,
            EVALUATION_CRITERIA,
            CONFIDENCE_THRESHOLD,
            { value: ESCROW_AMOUNT },
          ),
      ).to.be.revertedWith("Escrow: zero contributor");
    });

    it("Should revert when validator address is zero", async function () {
      await expect(
        escrow
          .connect(creator)
          .createTaskWithAgent(
            contributor.address,
            ethers.ZeroAddress,
            CONTRIBUTOR_PERCENTAGE,
            VALIDATOR_PERCENTAGE,
            DESCRIPTION_HASH,
            MCP_URL,
            EVALUATION_CRITERIA,
            CONFIDENCE_THRESHOLD,
            { value: ESCROW_AMOUNT },
          ),
      ).to.be.revertedWith("Escrow: zero validator");
    });

    it("Should revert when contributor and validator are the same", async function () {
      await expect(
        escrow.connect(creator).createTaskWithAgent(
          contributor.address,
          contributor.address, // Same as contributor
          CONTRIBUTOR_PERCENTAGE,
          VALIDATOR_PERCENTAGE,
          DESCRIPTION_HASH,
          MCP_URL,
          EVALUATION_CRITERIA,
          CONFIDENCE_THRESHOLD,
          { value: ESCROW_AMOUNT },
        ),
      ).to.be.revertedWith("Escrow: same contributor/validator");
    });

    it("Should revert when creator is contributor", async function () {
      await expect(
        escrow.connect(creator).createTaskWithAgent(
          creator.address, // Creator as contributor
          agentValidator.address,
          CONTRIBUTOR_PERCENTAGE,
          VALIDATOR_PERCENTAGE,
          DESCRIPTION_HASH,
          MCP_URL,
          EVALUATION_CRITERIA,
          CONFIDENCE_THRESHOLD,
          { value: ESCROW_AMOUNT },
        ),
      ).to.be.revertedWith("Escrow: creator is contributor");
    });

    it("Should revert when creator is validator", async function () {
      await expect(
        escrow.connect(creator).createTaskWithAgent(
          contributor.address,
          creator.address, // Creator as validator
          CONTRIBUTOR_PERCENTAGE,
          VALIDATOR_PERCENTAGE,
          DESCRIPTION_HASH,
          MCP_URL,
          EVALUATION_CRITERIA,
          CONFIDENCE_THRESHOLD,
          { value: ESCROW_AMOUNT },
        ),
      ).to.be.revertedWith("Escrow: creator is validator");
    });

    it("Should revert when percentages don't sum to 100", async function () {
      await expect(
        escrow.connect(creator).createTaskWithAgent(
          contributor.address,
          agentValidator.address,
          60, // 60 + 30 = 90
          VALIDATOR_PERCENTAGE,
          DESCRIPTION_HASH,
          MCP_URL,
          EVALUATION_CRITERIA,
          CONFIDENCE_THRESHOLD,
          { value: ESCROW_AMOUNT },
        ),
      ).to.be.revertedWith("Escrow: percentages must sum to 100");
    });

    it("Should revert when contributor percentage is zero", async function () {
      await expect(
        escrow
          .connect(creator)
          .createTaskWithAgent(
            contributor.address,
            agentValidator.address,
            0,
            100,
            DESCRIPTION_HASH,
            MCP_URL,
            EVALUATION_CRITERIA,
            CONFIDENCE_THRESHOLD,
            { value: ESCROW_AMOUNT },
          ),
      ).to.be.revertedWith("Escrow: zero contributor percentage");
    });

    it("Should revert when validator percentage is zero", async function () {
      await expect(
        escrow
          .connect(creator)
          .createTaskWithAgent(
            contributor.address,
            agentValidator.address,
            100,
            0,
            DESCRIPTION_HASH,
            MCP_URL,
            EVALUATION_CRITERIA,
            CONFIDENCE_THRESHOLD,
            { value: ESCROW_AMOUNT },
          ),
      ).to.be.revertedWith("Escrow: zero validator percentage");
    });

    it("Should revert when escrow amount is zero", async function () {
      await expect(
        escrow
          .connect(creator)
          .createTaskWithAgent(
            contributor.address,
            agentValidator.address,
            CONTRIBUTOR_PERCENTAGE,
            VALIDATOR_PERCENTAGE,
            DESCRIPTION_HASH,
            MCP_URL,
            EVALUATION_CRITERIA,
            CONFIDENCE_THRESHOLD,
            { value: 0 },
          ),
      ).to.be.revertedWith("Escrow: zero escrow amount");
    });
  });

  describe("Agent Task Workflow", function () {
    beforeEach(async function () {
      // Create task with agent validator
      await escrow
        .connect(creator)
        .createTaskWithAgent(
          contributor.address,
          agentValidator.address,
          CONTRIBUTOR_PERCENTAGE,
          VALIDATOR_PERCENTAGE,
          DESCRIPTION_HASH,
          MCP_URL,
          EVALUATION_CRITERIA,
          CONFIDENCE_THRESHOLD,
          { value: ESCROW_AMOUNT },
        );
    });

    it("Should allow contributor to start work on agent task", async function () {
      await expect(escrow.connect(contributor).startWork(1))
        .to.emit(escrow, "TaskWorkingStarted")
        .withArgs(1, contributor.address);

      const task = await escrow.getTask(1);
      expect(task.state).to.equal(2); // Working
    });

    it("Should allow contributor to submit work on agent task", async function () {
      await escrow.connect(contributor).startWork(1);

      const artifactsHash = "QmArtifacts123";
      await expect(escrow.connect(contributor).submitWork(1, artifactsHash))
        .to.emit(escrow, "ApprovalRequested")
        .withArgs(1, artifactsHash);

      const task = await escrow.getTask(1);
      expect(task.state).to.equal(3); // ApprovalRequested
      expect(task.artifactsHash).to.equal(artifactsHash);
    });

    it("Should allow agent validator to approve work", async function () {
      await escrow.connect(contributor).startWork(1);
      await escrow.connect(contributor).submitWork(1, "QmArtifacts123");

      const contributorBalanceBefore = await ethers.provider.getBalance(
        contributor.address,
      );
      const validatorBalanceBefore = await ethers.provider.getBalance(
        agentValidator.address,
      );

      const tx = await escrow.connect(agentValidator).approveWork(1);
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;

      await expect(tx)
        .to.emit(escrow, "TaskApproved")
        .withArgs(1, agentValidator.address);

      const task = await escrow.getTask(1);
      expect(task.state).to.equal(5); // ProcessingPayment

      // Verify payments
      const contributorBalanceAfter = await ethers.provider.getBalance(
        contributor.address,
      );
      const validatorBalanceAfter = await ethers.provider.getBalance(
        agentValidator.address,
      );

      const expectedContributorAmount =
        (ESCROW_AMOUNT * BigInt(CONTRIBUTOR_PERCENTAGE)) / 100n;
      const expectedValidatorAmount = ESCROW_AMOUNT - expectedContributorAmount;

      expect(contributorBalanceAfter - contributorBalanceBefore).to.equal(
        expectedContributorAmount,
      );
      // Validator balance should increase by payment minus gas costs
      expect(validatorBalanceAfter - validatorBalanceBefore).to.equal(
        expectedValidatorAmount - gasUsed,
      );
    });

    it("Should allow agent validator to reject work", async function () {
      await escrow.connect(contributor).startWork(1);
      await escrow.connect(contributor).submitWork(1, "QmArtifacts123");

      const creatorBalanceBefore = await ethers.provider.getBalance(
        creator.address,
      );

      await expect(escrow.connect(agentValidator).rejectWork(1))
        .to.emit(escrow, "TaskRejected")
        .withArgs(1, agentValidator.address);

      const task = await escrow.getTask(1);
      expect(task.state).to.equal(6); // Refunded

      // Verify refund
      const creatorBalanceAfter = await ethers.provider.getBalance(
        creator.address,
      );
      expect(creatorBalanceAfter - creatorBalanceBefore).to.equal(
        ESCROW_AMOUNT,
      );
    });
  });

  describe("Agent Config Retrieval", function () {
    it("Should return empty config for non-agent tasks", async function () {
      // Create regular task (not agent)
      await escrow
        .connect(creator)
        .createTask(
          contributor.address,
          agentValidator.address,
          CONTRIBUTOR_PERCENTAGE,
          VALIDATOR_PERCENTAGE,
          DESCRIPTION_HASH,
          { value: ESCROW_AMOUNT },
        );

      const agentConfig = await escrow.getAgentConfig(1);
      expect(agentConfig.mcpUrl).to.equal("");
      expect(agentConfig.evaluationCriteria).to.equal("");
      expect(agentConfig.confidenceThreshold).to.equal(0);
      expect(agentConfig.isAgentValidator).to.be.false;
    });

    it("Should return correct config for agent tasks", async function () {
      await escrow
        .connect(creator)
        .createTaskWithAgent(
          contributor.address,
          agentValidator.address,
          CONTRIBUTOR_PERCENTAGE,
          VALIDATOR_PERCENTAGE,
          DESCRIPTION_HASH,
          MCP_URL,
          EVALUATION_CRITERIA,
          CONFIDENCE_THRESHOLD,
          { value: ESCROW_AMOUNT },
        );

      const agentConfig = await escrow.getAgentConfig(1);
      expect(agentConfig.mcpUrl).to.equal(MCP_URL);
      expect(agentConfig.evaluationCriteria).to.equal(EVALUATION_CRITERIA);
      expect(agentConfig.confidenceThreshold).to.equal(CONFIDENCE_THRESHOLD);
      expect(agentConfig.isAgentValidator).to.be.true;
    });

    it("Should support multiple agent tasks with different configs", async function () {
      const mcpUrl2 = "https://agent2.example.com/mcp";
      const criteria2 = "Different criteria";
      const threshold2 = 90;

      // Create first agent task
      await escrow
        .connect(creator)
        .createTaskWithAgent(
          contributor.address,
          agentValidator.address,
          CONTRIBUTOR_PERCENTAGE,
          VALIDATOR_PERCENTAGE,
          DESCRIPTION_HASH,
          MCP_URL,
          EVALUATION_CRITERIA,
          CONFIDENCE_THRESHOLD,
          { value: ESCROW_AMOUNT },
        );

      // Create second agent task
      await escrow
        .connect(creator)
        .createTaskWithAgent(
          contributor.address,
          agentValidator.address,
          CONTRIBUTOR_PERCENTAGE,
          VALIDATOR_PERCENTAGE,
          DESCRIPTION_HASH,
          mcpUrl2,
          criteria2,
          threshold2,
          { value: ESCROW_AMOUNT },
        );

      // Verify first task config
      const config1 = await escrow.getAgentConfig(1);
      expect(config1.mcpUrl).to.equal(MCP_URL);
      expect(config1.evaluationCriteria).to.equal(EVALUATION_CRITERIA);
      expect(config1.confidenceThreshold).to.equal(CONFIDENCE_THRESHOLD);

      // Verify second task config
      const config2 = await escrow.getAgentConfig(2);
      expect(config2.mcpUrl).to.equal(mcpUrl2);
      expect(config2.evaluationCriteria).to.equal(criteria2);
      expect(config2.confidenceThreshold).to.equal(threshold2);
    });
  });

  describe("Edge Cases", function () {
    it("Should handle minimum confidence threshold (1)", async function () {
      await expect(
        escrow.connect(creator).createTaskWithAgent(
          contributor.address,
          agentValidator.address,
          CONTRIBUTOR_PERCENTAGE,
          VALIDATOR_PERCENTAGE,
          DESCRIPTION_HASH,
          MCP_URL,
          EVALUATION_CRITERIA,
          1, // Minimum threshold
          { value: ESCROW_AMOUNT },
        ),
      ).to.not.be.reverted;

      const agentConfig = await escrow.getAgentConfig(1);
      expect(agentConfig.confidenceThreshold).to.equal(1);
    });

    it("Should handle maximum confidence threshold (100)", async function () {
      await expect(
        escrow.connect(creator).createTaskWithAgent(
          contributor.address,
          agentValidator.address,
          CONTRIBUTOR_PERCENTAGE,
          VALIDATOR_PERCENTAGE,
          DESCRIPTION_HASH,
          MCP_URL,
          EVALUATION_CRITERIA,
          100, // Maximum threshold
          { value: ESCROW_AMOUNT },
        ),
      ).to.not.be.reverted;

      const agentConfig = await escrow.getAgentConfig(1);
      expect(agentConfig.confidenceThreshold).to.equal(100);
    });

    it("Should handle very long MCP URLs", async function () {
      const longUrl = "https://agent.example.com/mcp/" + "a".repeat(500);

      await expect(
        escrow
          .connect(creator)
          .createTaskWithAgent(
            contributor.address,
            agentValidator.address,
            CONTRIBUTOR_PERCENTAGE,
            VALIDATOR_PERCENTAGE,
            DESCRIPTION_HASH,
            longUrl,
            EVALUATION_CRITERIA,
            CONFIDENCE_THRESHOLD,
            { value: ESCROW_AMOUNT },
          ),
      ).to.not.be.reverted;

      const agentConfig = await escrow.getAgentConfig(1);
      expect(agentConfig.mcpUrl).to.equal(longUrl);
    });

    it("Should handle very long evaluation criteria", async function () {
      const longCriteria = "Criteria: " + "x".repeat(1000);

      await expect(
        escrow
          .connect(creator)
          .createTaskWithAgent(
            contributor.address,
            agentValidator.address,
            CONTRIBUTOR_PERCENTAGE,
            VALIDATOR_PERCENTAGE,
            DESCRIPTION_HASH,
            MCP_URL,
            longCriteria,
            CONFIDENCE_THRESHOLD,
            { value: ESCROW_AMOUNT },
          ),
      ).to.not.be.reverted;

      const agentConfig = await escrow.getAgentConfig(1);
      expect(agentConfig.evaluationCriteria).to.equal(longCriteria);
    });
  });
});
