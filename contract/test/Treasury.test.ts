import { expect } from "chai";
import { ethers } from "hardhat";
import { Treasury } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("Treasury", function () {
  let treasury: Treasury;
  let owner: SignerWithAddress;
  let escrowContract: SignerWithAddress;
  let creator: SignerWithAddress;
  let contributor: SignerWithAddress;
  let validator: SignerWithAddress;
  let unauthorized: SignerWithAddress;

  const NATIVE_TOKEN = ethers.ZeroAddress;
  const TASK_ID = 1;

  beforeEach(async function () {
    [owner, escrowContract, creator, contributor, validator, unauthorized] =
      await ethers.getSigners();

    const TreasuryFactory = await ethers.getContractFactory("Treasury");
    treasury = await TreasuryFactory.deploy(owner.address);
    await treasury.waitForDeployment();

    // Authorize escrow contract
    await treasury.connect(owner).addAuthorizedCaller(escrowContract.address);
  });

  describe("Deployment", function () {
    it("Should set the correct owner", async function () {
      expect(await treasury.owner()).to.equal(owner.address);
    });

    it("Should revert if owner is zero address", async function () {
      const TreasuryFactory = await ethers.getContractFactory("Treasury");
      await expect(
        TreasuryFactory.deploy(ethers.ZeroAddress),
      ).to.be.revertedWith("Treasury: zero address");
    });

    it("Should have NATIVE_TOKEN constant as zero address", async function () {
      expect(await treasury.NATIVE_TOKEN()).to.equal(ethers.ZeroAddress);
    });
  });

  describe("Authorization Management", function () {
    it("Should allow owner to add authorized caller", async function () {
      const newCaller = contributor.address;

      await expect(treasury.connect(owner).addAuthorizedCaller(newCaller))
        .to.emit(treasury, "AuthorizedCallerAdded")
        .withArgs(newCaller);

      expect(await treasury.isAuthorizedCaller(newCaller)).to.be.true;
    });

    it("Should revert when adding zero address as authorized caller", async function () {
      await expect(
        treasury.connect(owner).addAuthorizedCaller(ethers.ZeroAddress),
      ).to.be.revertedWith("Treasury: zero address");
    });

    it("Should revert when adding already authorized caller", async function () {
      await expect(
        treasury.connect(owner).addAuthorizedCaller(escrowContract.address),
      ).to.be.revertedWith("Treasury: already authorized");
    });

    it("Should revert when non-owner tries to add authorized caller", async function () {
      await expect(
        treasury.connect(unauthorized).addAuthorizedCaller(contributor.address),
      ).to.be.revertedWith("Treasury: not owner");
    });

    it("Should allow owner to remove authorized caller", async function () {
      await expect(
        treasury.connect(owner).removeAuthorizedCaller(escrowContract.address),
      )
        .to.emit(treasury, "AuthorizedCallerRemoved")
        .withArgs(escrowContract.address);

      expect(await treasury.isAuthorizedCaller(escrowContract.address)).to.be
        .false;
    });

    it("Should revert when removing non-authorized caller", async function () {
      await expect(
        treasury.connect(owner).removeAuthorizedCaller(contributor.address),
      ).to.be.revertedWith("Treasury: not authorized");
    });

    it("Should revert when non-owner tries to remove authorized caller", async function () {
      await expect(
        treasury
          .connect(unauthorized)
          .removeAuthorizedCaller(escrowContract.address),
      ).to.be.revertedWith("Treasury: not owner");
    });
  });

  describe("Escrow Deposit - Native Token", function () {
    const depositAmount = ethers.parseEther("1.0");

    it("Should allow authorized caller to deposit native token", async function () {
      await expect(
        treasury
          .connect(escrowContract)
          .depositEscrow(TASK_ID, NATIVE_TOKEN, depositAmount, {
            value: depositAmount,
          }),
      )
        .to.emit(treasury, "EscrowDeposited")
        .withArgs(TASK_ID, NATIVE_TOKEN, depositAmount);

      expect(await treasury.getEscrowBalance(TASK_ID, NATIVE_TOKEN)).to.equal(
        depositAmount,
      );
    });

    it("Should accumulate multiple deposits for same task", async function () {
      await treasury
        .connect(escrowContract)
        .depositEscrow(TASK_ID, NATIVE_TOKEN, depositAmount, {
          value: depositAmount,
        });

      await treasury
        .connect(escrowContract)
        .depositEscrow(TASK_ID, NATIVE_TOKEN, depositAmount, {
          value: depositAmount,
        });

      expect(await treasury.getEscrowBalance(TASK_ID, NATIVE_TOKEN)).to.equal(
        depositAmount * 2n,
      );
    });

    it("Should revert when unauthorized caller tries to deposit", async function () {
      await expect(
        treasury
          .connect(unauthorized)
          .depositEscrow(TASK_ID, NATIVE_TOKEN, depositAmount, {
            value: depositAmount,
          }),
      ).to.be.revertedWith("Treasury: not authorized");
    });

    it("Should revert when deposit amount is zero", async function () {
      await expect(
        treasury
          .connect(escrowContract)
          .depositEscrow(TASK_ID, NATIVE_TOKEN, 0, { value: 0 }),
      ).to.be.revertedWith("Treasury: zero amount");
    });

    it("Should revert when msg.value doesn't match amount", async function () {
      await expect(
        treasury
          .connect(escrowContract)
          .depositEscrow(TASK_ID, NATIVE_TOKEN, depositAmount, {
            value: depositAmount / 2n,
          }),
      ).to.be.revertedWith("Treasury: incorrect native amount");
    });
  });

  describe("Payment Release - Native Token", function () {
    const escrowAmount = ethers.parseEther("1.0");
    const contributorAmount = ethers.parseEther("0.7");
    const validatorAmount = ethers.parseEther("0.3");

    beforeEach(async function () {
      await treasury
        .connect(escrowContract)
        .depositEscrow(TASK_ID, NATIVE_TOKEN, escrowAmount, {
          value: escrowAmount,
        });
    });

    it("Should release payment to multiple recipients", async function () {
      const recipients = [contributor.address, validator.address];
      const amounts = [contributorAmount, validatorAmount];

      const contributorBalanceBefore = await ethers.provider.getBalance(
        contributor.address,
      );
      const validatorBalanceBefore = await ethers.provider.getBalance(
        validator.address,
      );

      await expect(
        treasury
          .connect(escrowContract)
          .releasePayment(TASK_ID, NATIVE_TOKEN, recipients, amounts),
      )
        .to.emit(treasury, "PaymentReleased")
        .withArgs(TASK_ID, NATIVE_TOKEN, contributor.address, contributorAmount)
        .to.emit(treasury, "PaymentReleased")
        .withArgs(TASK_ID, NATIVE_TOKEN, validator.address, validatorAmount);

      expect(await ethers.provider.getBalance(contributor.address)).to.equal(
        contributorBalanceBefore + contributorAmount,
      );
      expect(await ethers.provider.getBalance(validator.address)).to.equal(
        validatorBalanceBefore + validatorAmount,
      );
      expect(await treasury.getEscrowBalance(TASK_ID, NATIVE_TOKEN)).to.equal(
        0,
      );
    });

    it("Should revert when recipients and amounts length mismatch", async function () {
      await expect(
        treasury
          .connect(escrowContract)
          .releasePayment(
            TASK_ID,
            NATIVE_TOKEN,
            [contributor.address],
            [contributorAmount, validatorAmount],
          ),
      ).to.be.revertedWith("Treasury: length mismatch");
    });

    it("Should revert when recipients array is empty", async function () {
      await expect(
        treasury
          .connect(escrowContract)
          .releasePayment(TASK_ID, NATIVE_TOKEN, [], []),
      ).to.be.revertedWith("Treasury: empty recipients");
    });

    it("Should revert when recipient is zero address", async function () {
      await expect(
        treasury
          .connect(escrowContract)
          .releasePayment(
            TASK_ID,
            NATIVE_TOKEN,
            [ethers.ZeroAddress],
            [contributorAmount],
          ),
      ).to.be.revertedWith("Treasury: zero recipient");
    });

    it("Should revert when amount is zero", async function () {
      await expect(
        treasury
          .connect(escrowContract)
          .releasePayment(TASK_ID, NATIVE_TOKEN, [contributor.address], [0]),
      ).to.be.revertedWith("Treasury: zero amount");
    });

    it("Should revert when insufficient escrow balance", async function () {
      const tooMuch = escrowAmount + ethers.parseEther("1.0");

      await expect(
        treasury
          .connect(escrowContract)
          .releasePayment(
            TASK_ID,
            NATIVE_TOKEN,
            [contributor.address],
            [tooMuch],
          ),
      ).to.be.revertedWith("Treasury: insufficient escrow");
    });

    it("Should revert when unauthorized caller tries to release payment", async function () {
      await expect(
        treasury
          .connect(unauthorized)
          .releasePayment(
            TASK_ID,
            NATIVE_TOKEN,
            [contributor.address],
            [contributorAmount],
          ),
      ).to.be.revertedWith("Treasury: not authorized");
    });
  });

  describe("Refund - Native Token", function () {
    const escrowAmount = ethers.parseEther("1.0");

    beforeEach(async function () {
      await treasury
        .connect(escrowContract)
        .depositEscrow(TASK_ID, NATIVE_TOKEN, escrowAmount, {
          value: escrowAmount,
        });
    });

    it("Should refund creator", async function () {
      const creatorBalanceBefore = await ethers.provider.getBalance(
        creator.address,
      );

      await expect(
        treasury
          .connect(escrowContract)
          .refundCreator(TASK_ID, NATIVE_TOKEN, creator.address, escrowAmount),
      )
        .to.emit(treasury, "RefundProcessed")
        .withArgs(TASK_ID, NATIVE_TOKEN, creator.address, escrowAmount);

      expect(await ethers.provider.getBalance(creator.address)).to.equal(
        creatorBalanceBefore + escrowAmount,
      );
      expect(await treasury.getEscrowBalance(TASK_ID, NATIVE_TOKEN)).to.equal(
        0,
      );
    });

    it("Should revert when creator is zero address", async function () {
      await expect(
        treasury
          .connect(escrowContract)
          .refundCreator(
            TASK_ID,
            NATIVE_TOKEN,
            ethers.ZeroAddress,
            escrowAmount,
          ),
      ).to.be.revertedWith("Treasury: zero creator");
    });

    it("Should revert when refund amount is zero", async function () {
      await expect(
        treasury
          .connect(escrowContract)
          .refundCreator(TASK_ID, NATIVE_TOKEN, creator.address, 0),
      ).to.be.revertedWith("Treasury: zero amount");
    });

    it("Should revert when insufficient escrow balance", async function () {
      const tooMuch = escrowAmount + ethers.parseEther("1.0");

      await expect(
        treasury
          .connect(escrowContract)
          .refundCreator(TASK_ID, NATIVE_TOKEN, creator.address, tooMuch),
      ).to.be.revertedWith("Treasury: insufficient escrow");
    });

    it("Should revert when unauthorized caller tries to refund", async function () {
      await expect(
        treasury
          .connect(unauthorized)
          .refundCreator(TASK_ID, NATIVE_TOKEN, creator.address, escrowAmount),
      ).to.be.revertedWith("Treasury: not authorized");
    });
  });

  describe("Receive Function", function () {
    it("Should accept direct native token transfers", async function () {
      const amount = ethers.parseEther("1.0");

      await expect(
        owner.sendTransaction({
          to: await treasury.getAddress(),
          value: amount,
        }),
      ).to.not.be.reverted;

      expect(
        await ethers.provider.getBalance(await treasury.getAddress()),
      ).to.be.gte(amount);
    });
  });

  describe("Multiple Tasks", function () {
    const task1Amount = ethers.parseEther("1.0");
    const task2Amount = ethers.parseEther("2.0");

    it("Should track escrow balances separately per task", async function () {
      await treasury
        .connect(escrowContract)
        .depositEscrow(1, NATIVE_TOKEN, task1Amount, { value: task1Amount });

      await treasury
        .connect(escrowContract)
        .depositEscrow(2, NATIVE_TOKEN, task2Amount, { value: task2Amount });

      expect(await treasury.getEscrowBalance(1, NATIVE_TOKEN)).to.equal(
        task1Amount,
      );
      expect(await treasury.getEscrowBalance(2, NATIVE_TOKEN)).to.equal(
        task2Amount,
      );
    });

    it("Should release payment from correct task escrow", async function () {
      await treasury
        .connect(escrowContract)
        .depositEscrow(1, NATIVE_TOKEN, task1Amount, { value: task1Amount });

      await treasury
        .connect(escrowContract)
        .depositEscrow(2, NATIVE_TOKEN, task2Amount, { value: task2Amount });

      await treasury
        .connect(escrowContract)
        .releasePayment(1, NATIVE_TOKEN, [contributor.address], [task1Amount]);

      expect(await treasury.getEscrowBalance(1, NATIVE_TOKEN)).to.equal(0);
      expect(await treasury.getEscrowBalance(2, NATIVE_TOKEN)).to.equal(
        task2Amount,
      );
    });
  });
});
