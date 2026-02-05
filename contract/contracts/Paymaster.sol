// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IPaymaster.sol";

/**
 * @title Paymaster
 * @notice Sponsors gas fees for allowlisted operations using ERC-4337
 * @dev Implements rate limiting to prevent abuse
 * 
 * Key features:
 * - Gas sponsorship for valid smart account operations
 * - Per-user daily gas limits
 * - Allowlist for sponsored operations
 * - Gas cost tracking and recording
 */
contract Paymaster is IPaymaster {
    // EntryPoint contract address (ERC-4337)
    address public immutable entryPoint;
    
    // Owner address for access control
    address public owner;
    
    // Gas tracking per user
    mapping(address => uint256) public userGasUsed;
    mapping(address => uint256) public lastResetTime;
    
    // Allowlisted operations (function selectors)
    mapping(bytes4 => bool) public allowlistedOperations;
    
    // Rate limiting constants
    uint256 public constant GAS_LIMIT_PER_USER_PER_DAY = 1_000_000;
    uint256 public constant RESET_PERIOD = 1 days;
    
    // Deposit for gas sponsorship
    uint256 public depositBalance;

    /**
     * @notice Constructor sets the EntryPoint and owner
     * @param _entryPoint Address of the ERC-4337 EntryPoint contract
     * @param _owner Address that will have owner privileges
     */
    constructor(address _entryPoint, address _owner) {
        require(_entryPoint != address(0), "Paymaster: zero entrypoint");
        require(_owner != address(0), "Paymaster: zero owner");
        
        entryPoint = _entryPoint;
        owner = _owner;
    }

    /**
     * @notice Modifier to restrict access to owner only
     */
    modifier onlyOwner() {
        require(msg.sender == owner, "Paymaster: not owner");
        _;
    }

    /**
     * @notice Modifier to restrict access to EntryPoint only
     */
    modifier onlyEntryPoint() {
        require(msg.sender == entryPoint, "Paymaster: not entrypoint");
        _;
    }

    /**
     * @notice Add an operation to the allowlist
     * @param selector The function selector to allowlist
     */
    function addAllowlistedOperation(bytes4 selector) external onlyOwner {
        require(!allowlistedOperations[selector], "Paymaster: already allowlisted");
        allowlistedOperations[selector] = true;
        emit OperationAllowlisted(selector);
    }

    /**
     * @notice Remove an operation from the allowlist
     * @param selector The function selector to remove
     */
    function removeAllowlistedOperation(bytes4 selector) external onlyOwner {
        require(allowlistedOperations[selector], "Paymaster: not allowlisted");
        allowlistedOperations[selector] = false;
        emit OperationRemoved(selector);
    }

    /**
     * @notice Deposit funds for gas sponsorship
     */
    function deposit() external payable onlyOwner {
        require(msg.value > 0, "Paymaster: zero deposit");
        depositBalance += msg.value;
        emit DepositReceived(msg.sender, msg.value);
    }

    /**
     * @notice Withdraw funds from deposit
     * @param amount Amount to withdraw
     */
    function withdraw(uint256 amount) external onlyOwner {
        require(amount <= depositBalance, "Paymaster: insufficient balance");
        depositBalance -= amount;
        
        (bool success, ) = owner.call{value: amount}("");
        require(success, "Paymaster: withdrawal failed");
        
        emit WithdrawalProcessed(owner, amount);
    }

    /**
     * @notice Validate a user operation for gas sponsorship
     * @dev Called by EntryPoint to check if operation should be sponsored
     * @param userOp The user operation to validate
     * @param maxCost Maximum gas cost for the operation
     * @return context Context data to pass to postOp
     * @return validationData Validation result (0 = valid, 1 = invalid)
     */
    function validatePaymasterUserOp(
        UserOperation calldata userOp,
        bytes32 /* userOpHash */,
        uint256 maxCost
    ) external override onlyEntryPoint returns (bytes memory context, uint256 validationData) {
        // Extract function selector from callData
        bytes4 selector = bytes4(userOp.callData);
        
        // Check if operation is allowlisted
        if (!allowlistedOperations[selector]) {
            return ("", 1); // Reject: operation not allowlisted
        }
        
        // Check if we have enough deposit to cover gas
        if (maxCost > depositBalance) {
            return ("", 1); // Reject: insufficient deposit
        }
        
        // Get user address (sender)
        address user = userOp.sender;
        
        // Reset gas tracking if period has elapsed
        if (block.timestamp >= lastResetTime[user] + RESET_PERIOD) {
            userGasUsed[user] = 0;
            lastResetTime[user] = block.timestamp;
        }
        
        // Check rate limit
        if (userGasUsed[user] + maxCost > GAS_LIMIT_PER_USER_PER_DAY) {
            emit RateLimitExceeded(user, userGasUsed[user], maxCost);
            return ("", 1); // Reject: rate limit exceeded
        }
        
        // Encode context for postOp
        context = abi.encode(user, maxCost);
        
        emit GasSponsored(user, maxCost);
        
        return (context, 0); // Accept
    }

    /**
     * @notice Post-operation handler called after user operation execution
     * @dev Records actual gas used and updates tracking
     * @param mode Post-operation mode (opSucceeded, opReverted, postOpReverted)
     * @param context Context data from validatePaymasterUserOp
     * @param actualGasCost Actual gas cost incurred
     */
    function postOp(
        PostOpMode mode,
        bytes calldata context,
        uint256 actualGasCost
    ) external override onlyEntryPoint {
        // Decode context
        (address user, ) = abi.decode(context, (address, uint256));
        
        // Update gas tracking
        userGasUsed[user] += actualGasCost;
        
        // Deduct from deposit
        if (actualGasCost <= depositBalance) {
            depositBalance -= actualGasCost;
        }
        
        emit GasRecorded(user, actualGasCost, mode);
    }

    /**
     * @notice Get remaining gas allowance for a user
     * @param user The user address to check
     * @return uint256 Remaining gas allowance
     */
    function getRemainingGasAllowance(address user) external view returns (uint256) {
        // Reset if period has elapsed
        if (block.timestamp >= lastResetTime[user] + RESET_PERIOD) {
            return GAS_LIMIT_PER_USER_PER_DAY;
        }
        
        uint256 used = userGasUsed[user];
        if (used >= GAS_LIMIT_PER_USER_PER_DAY) {
            return 0;
        }
        
        return GAS_LIMIT_PER_USER_PER_DAY - used;
    }

    /**
     * @notice Check if an operation is allowlisted
     * @param selector The function selector to check
     * @return bool True if allowlisted
     */
    function isOperationAllowlisted(bytes4 selector) external view returns (bool) {
        return allowlistedOperations[selector];
    }

    /**
     * @notice Get deposit balance
     * @return uint256 Current deposit balance
     */
    function getDepositBalance() external view returns (uint256) {
        return depositBalance;
    }

    /**
     * @notice Receive function to accept deposits
     */
    receive() external payable {
        depositBalance += msg.value;
        emit DepositReceived(msg.sender, msg.value);
    }
}
