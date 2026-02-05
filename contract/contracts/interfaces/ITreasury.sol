// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ITreasury
 * @notice Interface for Treasury contract managing escrow and payments
 */
interface ITreasury {
    // Events
    event EscrowDeposited(uint256 indexed taskId, address indexed token, uint256 amount);
    event PaymentReleased(uint256 indexed taskId, address indexed token, address indexed recipient, uint256 amount);
    event RefundProcessed(uint256 indexed taskId, address indexed token, address indexed creator, uint256 amount);
    event AuthorizedCallerAdded(address indexed caller);
    event AuthorizedCallerRemoved(address indexed caller);

    // Core functions
    function depositEscrow(uint256 taskId, address token, uint256 amount) external payable;
    function releasePayment(
        uint256 taskId,
        address token,
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external;
    function refundCreator(uint256 taskId, address token, address creator, uint256 amount) external;
    function getEscrowBalance(uint256 taskId, address token) external view returns (uint256);
}
