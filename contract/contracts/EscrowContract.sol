// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IEscrow.sol";
import "./interfaces/ITreasury.sol";
import "./interfaces/IRoleRegistry.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title EscrowContract
 * @notice Manages task-based escrow with state machine transitions
 * @dev Core contract for ContractSafe escrow system
 * 
 * State Machine:
 * Draft → Created → Working → ApprovalRequested → Validating → (ProcessingPayment | Refunded)
 */
contract EscrowContract is ReentrancyGuard, IEscrow {
    // State enum
    enum TaskState {
        Draft,
        Created,
        Working,
        ApprovalRequested,
        Validating,
        ProcessingPayment,
        Refunded
    }

    // Task struct
    struct Task {
        uint256 taskId;
        address creator;
        address contributor;
        address validator;
        uint256 escrowAmount;
        uint8 contributorPercentage;
        uint8 validatorPercentage;
        TaskState state;
        string descriptionHash; // IPFS hash
        string artifactsHash;   // IPFS hash
        uint256 createdAt;
        uint256 updatedAt;
    }

    // Contract references
    ITreasury public immutable treasury;
    IRoleRegistry public immutable roleRegistry;
    address public immutable paymaster;

    // Storage
    mapping(uint256 => Task) public tasks;
    uint256 public nextTaskId;

    // Native token constant
    address public constant NATIVE_TOKEN = address(0);

    /**
     * @notice Constructor sets contract references
     * @param _treasury Treasury contract address
     * @param _roleRegistry RoleRegistry contract address
     * @param _paymaster Paymaster contract address
     */
    constructor(
        address _treasury,
        address _roleRegistry,
        address _paymaster
    ) {
        require(_treasury != address(0), "Escrow: zero treasury");
        require(_roleRegistry != address(0), "Escrow: zero registry");
        require(_paymaster != address(0), "Escrow: zero paymaster");

        treasury = ITreasury(_treasury);
        roleRegistry = IRoleRegistry(_roleRegistry);
        paymaster = _paymaster;
        
        nextTaskId = 1; // Start from 1
    }

    /**
     * @notice Modifier to check if caller has required role
     */
    modifier onlyRole(bytes32 role) {
        require(roleRegistry.hasRole(role, msg.sender), "Escrow: unauthorized");
        _;
    }

    /**
     * @notice Modifier to validate state transition
     */
    modifier validTransition(uint256 taskId, TaskState expectedState) {
        require(tasks[taskId].state == expectedState, "Escrow: invalid state");
        _;
    }

    /**
     * @notice Create a new task with escrow
     * @param contributor Address of the contributor
     * @param validator Address of the validator
     * @param contributorPercentage Percentage for contributor (0-100)
     * @param validatorPercentage Percentage for validator (0-100)
     * @param descriptionHash IPFS hash of task description
     * @return taskId The created task ID
     */
    function createTask(
        address contributor,
        address validator,
        uint8 contributorPercentage,
        uint8 validatorPercentage,
        string calldata descriptionHash
    ) external payable override nonReentrant returns (uint256 taskId) {
        // Validate addresses
        require(contributor != address(0), "Escrow: zero contributor");
        require(validator != address(0), "Escrow: zero validator");
        require(contributor != validator, "Escrow: same contributor/validator");
        require(msg.sender != contributor, "Escrow: creator is contributor");
        require(msg.sender != validator, "Escrow: creator is validator");

        // Validate percentages
        require(
            contributorPercentage + validatorPercentage == 100,
            "Escrow: percentages must sum to 100"
        );
        require(contributorPercentage > 0, "Escrow: zero contributor percentage");
        require(validatorPercentage > 0, "Escrow: zero validator percentage");

        // Validate escrow amount
        require(msg.value > 0, "Escrow: zero escrow amount");

        // Create task
        taskId = nextTaskId++;
        
        tasks[taskId] = Task({
            taskId: taskId,
            creator: msg.sender,
            contributor: contributor,
            validator: validator,
            escrowAmount: msg.value,
            contributorPercentage: contributorPercentage,
            validatorPercentage: validatorPercentage,
            state: TaskState.Created,
            descriptionHash: descriptionHash,
            artifactsHash: "",
            createdAt: block.timestamp,
            updatedAt: block.timestamp
        });

        // Deposit escrow to treasury
        treasury.depositEscrow{value: msg.value}(taskId, NATIVE_TOKEN, msg.value);

        emit TaskCreated(
            taskId,
            msg.sender,
            contributor,
            validator,
            msg.value
        );
    }

    /**
     * @notice Contributor starts working on the task
     * @param taskId The task ID
     */
    function startWork(uint256 taskId)
        external
        override
        nonReentrant
        validTransition(taskId, TaskState.Created)
    {
        Task storage task = tasks[taskId];
        require(msg.sender == task.contributor, "Escrow: not contributor");

        task.state = TaskState.Working;
        task.updatedAt = block.timestamp;

        emit TaskWorkingStarted(taskId, msg.sender);
    }

    /**
     * @notice Contributor submits work for validation
     * @param taskId The task ID
     * @param artifactsHash IPFS hash of work artifacts
     */
    function submitWork(uint256 taskId, string calldata artifactsHash)
        external
        override
        nonReentrant
        validTransition(taskId, TaskState.Working)
    {
        Task storage task = tasks[taskId];
        require(msg.sender == task.contributor, "Escrow: not contributor");
        require(bytes(artifactsHash).length > 0, "Escrow: empty artifacts");

        task.state = TaskState.ApprovalRequested;
        task.artifactsHash = artifactsHash;
        task.updatedAt = block.timestamp;

        emit ApprovalRequested(taskId, artifactsHash);
    }

    /**
     * @notice Validator approves the work
     * @param taskId The task ID
     */
    function approveWork(uint256 taskId)
        external
        override
        nonReentrant
        validTransition(taskId, TaskState.ApprovalRequested)
    {
        Task storage task = tasks[taskId];
        require(msg.sender == task.validator, "Escrow: not validator");

        task.state = TaskState.Validating;
        task.updatedAt = block.timestamp;

        emit ValidationStarted(taskId, msg.sender);

        // Transition to processing payment
        task.state = TaskState.ProcessingPayment;
        task.updatedAt = block.timestamp;

        emit TaskApproved(taskId, msg.sender);

        // Process payment
        _processPayment(taskId);
    }

    /**
     * @notice Validator rejects the work
     * @param taskId The task ID
     */
    function rejectWork(uint256 taskId)
        external
        override
        nonReentrant
        validTransition(taskId, TaskState.ApprovalRequested)
    {
        Task storage task = tasks[taskId];
        require(msg.sender == task.validator, "Escrow: not validator");

        task.state = TaskState.Refunded;
        task.updatedAt = block.timestamp;

        emit TaskRejected(taskId, msg.sender);

        // Process refund
        _refund(taskId);
    }

    /**
     * @notice Internal function to process payment
     * @param taskId The task ID
     */
    function _processPayment(uint256 taskId) internal {
        Task storage task = tasks[taskId];

        // Calculate amounts
        uint256 contributorAmount = (task.escrowAmount * task.contributorPercentage) / 100;
        uint256 validatorAmount = task.escrowAmount - contributorAmount;

        // Prepare recipients and amounts
        address[] memory recipients = new address[](2);
        uint256[] memory amounts = new uint256[](2);

        recipients[0] = task.contributor;
        amounts[0] = contributorAmount;

        recipients[1] = task.validator;
        amounts[1] = validatorAmount;

        // Release payment from treasury
        treasury.releasePayment(taskId, NATIVE_TOKEN, recipients, amounts);

        emit PaymentProcessed(taskId, contributorAmount, validatorAmount);
    }

    /**
     * @notice Internal function to process refund
     * @param taskId The task ID
     */
    function _refund(uint256 taskId) internal {
        Task storage task = tasks[taskId];

        // Refund full amount to creator
        treasury.refundCreator(taskId, NATIVE_TOKEN, task.creator, task.escrowAmount);

        emit TaskRefunded(taskId, task.creator, task.escrowAmount);
    }

    /**
     * @notice Get task details
     * @param taskId The task ID
     * @return task The task struct
     */
    function getTask(uint256 taskId) external view returns (Task memory task) {
        return tasks[taskId];
    }

    /**
     * @notice Get task state
     * @param taskId The task ID
     * @return state The current task state
     */
    function getTaskState(uint256 taskId) external view returns (TaskState state) {
        return tasks[taskId].state;
    }

    /**
     * @notice Check if a state transition is valid
     * @param from Current state
     * @param to Target state
     * @return bool True if transition is valid
     */
    function isValidTransition(TaskState from, TaskState to) public pure returns (bool) {
        if (from == TaskState.Draft && to == TaskState.Created) return true;
        if (from == TaskState.Created && to == TaskState.Working) return true;
        if (from == TaskState.Working && to == TaskState.ApprovalRequested) return true;
        if (from == TaskState.ApprovalRequested && to == TaskState.Validating) return true;
        if (from == TaskState.Validating && to == TaskState.ProcessingPayment) return true;
        if (from == TaskState.ApprovalRequested && to == TaskState.Refunded) return true;
        return false;
    }
}
