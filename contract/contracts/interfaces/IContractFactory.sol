// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IContractFactory
 * @notice Interface for ContractFactory
 */
interface IContractFactory {
    // Events
    event ContractSuiteDeployed(
        address indexed deployer,
        address escrow,
        address treasury,
        address roleRegistry,
        address paymaster,
        uint256 timestamp
    );

    event ContractInitialized(
        address indexed contractAddress,
        string contractType,
        uint256 timestamp
    );
}
