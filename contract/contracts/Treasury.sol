// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/ITreasury.sol";

/**
 * @title Treasury
 * @notice Manages escrow funds and payment distribution for ContractSafe
 * @dev Holds funds in custody and releases them based on authorized contract calls
 * 
 * Key features:
 * - Escrow deposit and tracking per task
 * - Payment release to multiple recipients
 * - Refund processing
 * - Access control for authorized callers
 * - Support for native token (MATIC) and ERC20 tokens
 */
contract Treasury is ReentrancyGuard, ITreasury {
    using SafeERC20 for IERC20;

    // Authorized contracts that can call Treasury functions
    mapping(address => bool) public authorizedCallers;
    
    // Owner address for access control
    address public owner;
    
    // Escrow balance tracking per task
    // taskId => token address => amount
    mapping(uint256 => mapping(address => uint256)) public escrowBalances;
    
    // Native token address constant (0x0 represents native MATIC)
    address public constant NATIVE_TOKEN = address(0);

    /**
     * @notice Constructor sets the contract owner
     * @param _owner Address that will have owner privileges
     */
    constructor(address _owner) {
        require(_owner != address(0), "Treasury: zero address");
        owner = _owner;
    }

    /**
     * @notice Modifier to restrict access to owner only
     */
    modifier onlyOwner() {
        require(msg.sender == owner, "Treasury: not owner");
        _;
    }

    /**
     * @notice Modifier to restrict access to authorized callers only
     */
    modifier onlyAuthorized() {
        require(authorizedCallers[msg.sender], "Treasury: not authorized");
        _;
    }

    /**
     * @notice Grant authorization to a contract address
     * @param caller Address to authorize
     */
    function addAuthorizedCaller(address caller) external onlyOwner {
        require(caller != address(0), "Treasury: zero address");
        require(!authorizedCallers[caller], "Treasury: already authorized");
        
        authorizedCallers[caller] = true;
        emit AuthorizedCallerAdded(caller);
    }

    /**
     * @notice Revoke authorization from a contract address
     * @param caller Address to revoke
     */
    function removeAuthorizedCaller(address caller) external onlyOwner {
        require(authorizedCallers[caller], "Treasury: not authorized");
        
        authorizedCallers[caller] = false;
        emit AuthorizedCallerRemoved(caller);
    }

    /**
     * @notice Deposit escrow funds for a task
     * @dev Can handle both native token (MATIC) and ERC20 tokens
     * @param taskId The task identifier
     * @param token The token address (use NATIVE_TOKEN for MATIC)
     * @param amount The amount to deposit
     */
    function depositEscrow(
        uint256 taskId,
        address token,
        uint256 amount
    ) external payable override onlyAuthorized nonReentrant {
        require(amount > 0, "Treasury: zero amount");
        
        if (token == NATIVE_TOKEN) {
            require(msg.value == amount, "Treasury: incorrect native amount");
        } else {
            require(msg.value == 0, "Treasury: unexpected native token");
            IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        }
        
        escrowBalances[taskId][token] += amount;
        emit EscrowDeposited(taskId, token, amount);
    }

    /**
     * @notice Release payment to recipients
     * @dev Distributes funds from escrow to multiple recipients
     * @param taskId The task identifier
     * @param token The token address
     * @param recipients Array of recipient addresses
     * @param amounts Array of amounts corresponding to recipients
     */
    function releasePayment(
        uint256 taskId,
        address token,
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external override onlyAuthorized nonReentrant {
        require(recipients.length == amounts.length, "Treasury: length mismatch");
        require(recipients.length > 0, "Treasury: empty recipients");
        
        uint256 totalAmount = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            require(recipients[i] != address(0), "Treasury: zero recipient");
            require(amounts[i] > 0, "Treasury: zero amount");
            totalAmount += amounts[i];
        }
        
        require(
            escrowBalances[taskId][token] >= totalAmount,
            "Treasury: insufficient escrow"
        );
        
        escrowBalances[taskId][token] -= totalAmount;
        
        // Transfer to each recipient
        for (uint256 i = 0; i < recipients.length; i++) {
            if (token == NATIVE_TOKEN) {
                (bool success, ) = recipients[i].call{value: amounts[i]}("");
                require(success, "Treasury: native transfer failed");
            } else {
                IERC20(token).safeTransfer(recipients[i], amounts[i]);
            }
            
            emit PaymentReleased(taskId, token, recipients[i], amounts[i]);
        }
    }

    /**
     * @notice Refund escrow to creator
     * @param taskId The task identifier
     * @param token The token address
     * @param creator The creator address to refund
     * @param amount The amount to refund
     */
    function refundCreator(
        uint256 taskId,
        address token,
        address creator,
        uint256 amount
    ) external override onlyAuthorized nonReentrant {
        require(creator != address(0), "Treasury: zero creator");
        require(amount > 0, "Treasury: zero amount");
        require(
            escrowBalances[taskId][token] >= amount,
            "Treasury: insufficient escrow"
        );
        
        escrowBalances[taskId][token] -= amount;
        
        if (token == NATIVE_TOKEN) {
            (bool success, ) = creator.call{value: amount}("");
            require(success, "Treasury: native transfer failed");
        } else {
            IERC20(token).safeTransfer(creator, amount);
        }
        
        emit RefundProcessed(taskId, token, creator, amount);
    }

    /**
     * @notice Get escrow balance for a task and token
     * @param taskId The task identifier
     * @param token The token address
     * @return uint256 The escrow balance
     */
    function getEscrowBalance(
        uint256 taskId,
        address token
    ) external view override returns (uint256) {
        return escrowBalances[taskId][token];
    }

    /**
     * @notice Check if an address is an authorized caller
     * @param caller The address to check
     * @return bool True if authorized
     */
    function isAuthorizedCaller(address caller) external view returns (bool) {
        return authorizedCallers[caller];
    }

    /**
     * @notice Transfer ownership to a new owner
     * @param newOwner Address of the new owner
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Treasury: zero address");
        owner = newOwner;
    }

    /**
     * @notice Receive function to accept native token deposits
     */
    receive() external payable {
        // Accept native token deposits
    }
}
