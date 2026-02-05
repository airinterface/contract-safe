// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IRoleRegistry
 * @notice Interface for role-based access control in ContractSafe
 * @dev Manages CREATOR, CONTRIBUTOR, VALIDATOR, and ADMIN roles
 * @dev Events are inherited from IAccessControl (RoleGranted, RoleRevoked)
 */
interface IRoleRegistry {
    // Role constants
    function CREATOR_ROLE() external view returns (bytes32);
    function CONTRIBUTOR_ROLE() external view returns (bytes32);
    function VALIDATOR_ROLE() external view returns (bytes32);
    function ADMIN_ROLE() external view returns (bytes32);

    // Core functions
    function grantRole(bytes32 role, address account) external;
    function revokeRole(bytes32 role, address account) external;
    function hasRole(bytes32 role, address account) external view returns (bool);
    function getRoleAdmin(bytes32 role) external view returns (bytes32);
}
