// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./EscrowContract.sol";
import "./Treasury.sol";
import "./RoleRegistry.sol";
import "./Paymaster.sol";
import "./interfaces/IContractFactory.sol";

/**
 * @title ContractFactory
 * @notice Factory contract for deploying complete ContractSafe suite
 * @dev Deploys all contracts in correct order and wires them together
 */
contract ContractFactory is IContractFactory {
    // Struct to store deployment info
    struct DeployedContracts {
        address escrow;
        address treasury;
        address roleRegistry;
        address paymaster;
        uint256 deployedAt;
    }

    // Mapping of deployer to their deployed contracts
    mapping(address => DeployedContracts) public deployments;

    /**
     * @notice Deploy a complete contract suite
     * @param admin Address that will be admin of all contracts
     * @param entryPoint Address of ERC-4337 EntryPoint for Paymaster
     * @return deployed Struct containing all deployed contract addresses
     */
    function deployContractSuite(
        address admin,
        address entryPoint
    ) external returns (DeployedContracts memory deployed) {
        require(admin != address(0), "Factory: zero admin");
        require(entryPoint != address(0), "Factory: zero entrypoint");

        // Deploy RoleRegistry first
        RoleRegistry roleRegistry = new RoleRegistry(admin);
        emit ContractInitialized(address(roleRegistry), "RoleRegistry", block.timestamp);

        // Deploy Treasury with factory as temporary owner
        Treasury treasury = new Treasury(address(this));
        emit ContractInitialized(address(treasury), "Treasury", block.timestamp);

        // Deploy Paymaster
        Paymaster paymaster = new Paymaster(entryPoint, admin);
        emit ContractInitialized(address(paymaster), "Paymaster", block.timestamp);

        // Deploy Escrow with references to other contracts
        EscrowContract escrow = new EscrowContract(
            address(treasury),
            address(roleRegistry),
            address(paymaster)
        );
        emit ContractInitialized(address(escrow), "EscrowContract", block.timestamp);

        // Wire contracts together
        // 1. Authorize escrow contract in treasury
        treasury.addAuthorizedCaller(address(escrow));
        
        // 2. Transfer treasury ownership to admin
        treasury.transferOwnership(admin);

        // Store deployment info
        deployed = DeployedContracts({
            escrow: address(escrow),
            treasury: address(treasury),
            roleRegistry: address(roleRegistry),
            paymaster: address(paymaster),
            deployedAt: block.timestamp
        });

        deployments[msg.sender] = deployed;

        emit ContractSuiteDeployed(
            msg.sender,
            address(escrow),
            address(treasury),
            address(roleRegistry),
            address(paymaster),
            block.timestamp
        );

        return deployed;
    }

    /**
     * @notice Get deployment info for a deployer
     * @param deployer Address of the deployer
     * @return deployed Struct containing deployed contract addresses
     */
    function getDeployment(address deployer) 
        external 
        view 
        returns (DeployedContracts memory deployed) 
    {
        return deployments[deployer];
    }

    /**
     * @notice Check if a deployer has deployed a suite
     * @param deployer Address to check
     * @return bool True if deployer has a deployment
     */
    function hasDeployment(address deployer) external view returns (bool) {
        return deployments[deployer].escrow != address(0);
    }
}
