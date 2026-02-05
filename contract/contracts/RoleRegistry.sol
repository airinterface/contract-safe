// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./interfaces/IRoleRegistry.sol";

/**
 * @title RoleRegistry
 * @notice Manages role-based access control for ContractSafe platform
 * @dev Extends OpenZeppelin AccessControl with platform-specific roles
 * 
 * Roles:
 * - ADMIN_ROLE: Can grant/revoke all roles
 * - CREATOR_ROLE: Can create tasks and fund escrow
 * - CONTRIBUTOR_ROLE: Can accept tasks and submit work
 * - VALIDATOR_ROLE: Can validate submissions and approve/reject work
 */
contract RoleRegistry is AccessControl, IRoleRegistry {
    // Role identifiers
    bytes32 public constant CREATOR_ROLE = keccak256("CREATOR_ROLE");
    bytes32 public constant CONTRIBUTOR_ROLE = keccak256("CONTRIBUTOR_ROLE");
    bytes32 public constant VALIDATOR_ROLE = keccak256("VALIDATOR_ROLE");
    bytes32 public constant ADMIN_ROLE = DEFAULT_ADMIN_ROLE;

    /**
     * @notice Constructor sets up initial admin
     * @param initialAdmin Address that will receive admin role
     */
    constructor(address initialAdmin) {
        require(initialAdmin != address(0), "RoleRegistry: zero address");
        _grantRole(ADMIN_ROLE, initialAdmin);
    }

    /**
     * @notice Grant a role to an account
     * @dev Only callable by role admin (ADMIN_ROLE for all roles)
     * @param role The role identifier to grant
     * @param account The address receiving the role
     */
    function grantRole(bytes32 role, address account) 
        public 
        override(AccessControl, IRoleRegistry) 
        onlyRole(getRoleAdmin(role)) 
    {
        _grantRole(role, account);
    }

    /**
     * @notice Revoke a role from an account
     * @dev Only callable by role admin (ADMIN_ROLE for all roles)
     * @param role The role identifier to revoke
     * @param account The address losing the role
     */
    function revokeRole(bytes32 role, address account) 
        public 
        override(AccessControl, IRoleRegistry) 
        onlyRole(getRoleAdmin(role)) 
    {
        _revokeRole(role, account);
    }

    /**
     * @notice Check if an account has a specific role
     * @param role The role identifier to check
     * @param account The address to check
     * @return bool True if account has the role
     */
    function hasRole(bytes32 role, address account) 
        public 
        view 
        override(AccessControl, IRoleRegistry) 
        returns (bool) 
    {
        return super.hasRole(role, account);
    }

    /**
     * @notice Get the admin role for a given role
     * @param role The role to query
     * @return bytes32 The admin role identifier
     */
    function getRoleAdmin(bytes32 role) 
        public 
        view 
        override(AccessControl, IRoleRegistry) 
        returns (bytes32) 
    {
        return super.getRoleAdmin(role);
    }

    /**
     * @notice Check if an address is a creator
     * @param account Address to check
     * @return bool True if account has CREATOR_ROLE
     */
    function isCreator(address account) external view returns (bool) {
        return hasRole(CREATOR_ROLE, account);
    }

    /**
     * @notice Check if an address is a contributor
     * @param account Address to check
     * @return bool True if account has CONTRIBUTOR_ROLE
     */
    function isContributor(address account) external view returns (bool) {
        return hasRole(CONTRIBUTOR_ROLE, account);
    }

    /**
     * @notice Check if an address is a validator
     * @param account Address to check
     * @return bool True if account has VALIDATOR_ROLE
     */
    function isValidator(address account) external view returns (bool) {
        return hasRole(VALIDATOR_ROLE, account);
    }

    /**
     * @notice Check if an address is an admin
     * @param account Address to check
     * @return bool True if account has ADMIN_ROLE
     */
    function isAdmin(address account) external view returns (bool) {
        return hasRole(ADMIN_ROLE, account);
    }
}
