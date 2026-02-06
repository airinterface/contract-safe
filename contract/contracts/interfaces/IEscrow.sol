// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IEscrow
 * @notice Interface for EscrowContract
 */
interface IEscrow {
    // Events
    event TaskCreated(
        uint256 indexed taskId,
        address indexed creator,
        address contributor,
        address validator,
        uint256 escrowAmount
    );
    event TaskWorkingStarted(uint256 indexed taskId, address indexed contributor);
    event ApprovalRequested(uint256 indexed taskId, string artifactsHash);
    event ValidationStarted(uint256 indexed taskId, address indexed validator);
    event TaskApproved(uint256 indexed taskId, address indexed validator);
    event TaskRejected(uint256 indexed taskId, address indexed validator);
    event PaymentProcessed(uint256 indexed taskId, uint256 contributorAmount, uint256 validatorAmount);
    event TaskRefunded(uint256 indexed taskId, address indexed creator, uint256 amount);

    // Core functions
    function createTask(
        address contributor,
        address validator,
        uint8 contributorPercentage,
        uint8 validatorPercentage,
        string calldata descriptionHash
    ) external payable returns (uint256 taskId);

    function startWork(uint256 taskId) external;
    function submitWork(uint256 taskId, string calldata artifactsHash) external;
    function approveWork(uint256 taskId) external;
    function rejectWork(uint256 taskId) external;
}
