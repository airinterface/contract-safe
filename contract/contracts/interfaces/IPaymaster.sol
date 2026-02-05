// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IPaymaster
 * @notice Interface for ERC-4337 Paymaster contract
 * @dev Simplified interface for gas sponsorship
 */
interface IPaymaster {
    // ERC-4337 UserOperation struct
    struct UserOperation {
        address sender;
        uint256 nonce;
        bytes initCode;
        bytes callData;
        uint256 callGasLimit;
        uint256 verificationGasLimit;
        uint256 preVerificationGas;
        uint256 maxFeePerGas;
        uint256 maxPriorityFeePerGas;
        bytes paymasterAndData;
        bytes signature;
    }

    // Post-operation modes
    enum PostOpMode {
        opSucceeded,
        opReverted,
        postOpReverted
    }

    // Events
    event GasSponsored(address indexed user, uint256 maxCost);
    event GasRecorded(address indexed user, uint256 actualCost, PostOpMode mode);
    event RateLimitExceeded(address indexed user, uint256 currentUsage, uint256 requestedAmount);
    event OperationAllowlisted(bytes4 indexed selector);
    event OperationRemoved(bytes4 indexed selector);
    event DepositReceived(address indexed from, uint256 amount);
    event WithdrawalProcessed(address indexed to, uint256 amount);

    // Core ERC-4337 functions
    function validatePaymasterUserOp(
        UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    ) external returns (bytes memory context, uint256 validationData);

    function postOp(
        PostOpMode mode,
        bytes calldata context,
        uint256 actualGasCost
    ) external;
}
