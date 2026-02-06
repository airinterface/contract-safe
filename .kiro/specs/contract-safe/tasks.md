# Implementation Plan: ContractSafe MVP

## Overview

This implementation plan breaks down the ContractSafe system into discrete, incremental tasks. The plan follows a bottom-up approach: smart contracts first, then indexing/orchestration, then frontend, and finally the AI agent validator. Each task builds on previous work and includes testing as sub-tasks.

## Tasks

- [x] 1. Project Setup and Infrastructure
  - Initialize monorepo structure with contract, web, api, script, example_agent, and subgraph folders
  - Set up Hardhat v3 configuration with Solidity compiler and test settings for multi-chain deployment
  - Configure network settings for Polygon, Ethereum, Arbitrum, Optimism, Base
  - Add LayerZero endpoint addresses for all chains
  - Add Uniswap v4 PoolManager addresses for all chains
  - Configure Vite + React + TypeScript for frontend
  - Set up Go module for orchestrator service
  - Create docker-compose.yml for local development
  - Add .env.example with required environment variables (RPC URLs for all chains, LayerZero config)
  - _Requirements: Infrastructure setup, Multi-chain support_

- [ ] 2. Smart Contract Foundation
  - [x] 2.1 Implement RoleRegistry contract
    - Create RoleRegistry.sol with role management functions (grantRole, revokeRole, hasRole)
    - Implement role constants (CREATOR_ROLE, CONTRIBUTOR_ROLE, VALIDATOR_ROLE, ADMIN_ROLE)
    - Add access control modifiers
    - _Requirements: 1.3, 6.2_

  - [ ]\* 2.2 Write property test for RoleRegistry
    - **Property: Role Assignment Consistency**
    - **Validates: Requirements 1.3**

  - [x] 2.3 Implement Treasury contract
    - Create Treasury.sol with fund custody functions (depositEscrow, releasePayment, refundCreator)
    - Add authorized caller access control
    - Implement balance tracking per task
    - _Requirements: 5.1, 5.2, 5.3, 5.5_

  - [ ]\* 2.4 Write property test for Treasury payment calculations
    - **Property 15: Payout Calculation Correctness**
    - **Validates: Requirements 5.1, 5.2**

  - [x] 2.5 Implement Paymaster contract
    - Create Paymaster.sol implementing ERC-4337 IPaymaster interface
    - Add validatePaymasterUserOp and postOp functions
    - Implement rate limiting logic with per-user gas tracking
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]\* 2.6 Write property test for Paymaster rate limiting
    - **Property 20: Rate Limit Enforcement**
    - **Validates: Requirements 6.5**

- [ ] 3. Core Escrow Contract
  - [x] 3.1 Implement EscrowContract with state machine
    - Create EscrowContract.sol with Task struct and TaskState enum
    - Implement createTask function with validation (addresses, percentages, escrow amount)
    - Add state transition functions (startWork, submitWork, approveWork, rejectWork)
    - Implement state machine validation to enforce valid transitions
    - Emit events for all state changes
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 2.1, 2.3, 4.3, 4.4, 8.5_

  - [ ]\* 3.2 Write property test for address validation
    - **Property 2: Address Validation**
    - **Validates: Requirements 1.3**

  - [ ]\* 3.3 Write property test for percentage validation
    - **Property 3: Percentage and Escrow Validation**
    - **Validates: Requirements 1.4**

  - [ ]\* 3.4 Write property test for state machine transitions
    - **Property 6: State Transition Validity**
    - **Validates: Requirements 8.5**

  - [ ]\* 3.5 Write property test for escrow locking
    - **Property 4: Escrow Locking**
    - **Validates: Requirements 1.5**

  - [x] 3.6 Implement payment processing logic
    - Add processPayment internal function with payout calculations
    - Integrate with Treasury for fund transfers
    - Ensure atomic transfers (both succeed or both fail)
    - Emit PaymentProcessed event
    - _Requirements: 4.5, 5.3, 5.4_

  - [ ]\* 3.7 Write property test for payment atomicity
    - **Property 16: Payment Atomicity**
    - **Validates: Requirements 5.3, 5.4**

  - [x] 3.8 Implement refund logic
    - Add refund internal function
    - Integrate with Treasury for refund transfers
    - Emit TaskRefunded event
    - _Requirements: 5.5_

  - [ ]\* 3.9 Write property test for refund completeness
    - **Property 17: Refund Completeness**
    - **Validates: Requirements 5.5**

- [ ] 4. ContractFactory and Agent Support
  - [x] 4.1 Implement ContractFactory
    - Create ContractFactory.sol with deployContractSuite function
    - Deploy all contracts (RoleRegistry, Treasury, Paymaster, EscrowContract) in correct order
    - Wire contracts together (grant roles, set authorized callers)
    - Emit ContractSuiteDeployed and ContractInitialized events
    - Store deployment info in mapping
    - _Requirements: Infrastructure_

  - [x] 4.2 Extend EscrowContract for agent validators
    - Add AgentConfig struct to store MCP configuration
    - Implement createTaskWithAgent function
    - Add taskAgentConfigs mapping
    - Emit TaskCreatedWithAgent event
    - _Requirements: Agent validation support_

  - [ ]\* 4.3 Write integration test for ContractFactory deployment
    - Test full contract suite deployment
    - Verify all contracts are wired correctly
    - Verify events are emitted with correct addresses

- [ ] 5. Cross-Chain Funding and Uniswap V4 Integration
  - [ ] 5.1 Implement CrossChainFunding contract (multi-chain deployment)
    - Create CrossChainFunding.sol with fundTaskCrossChain function
    - Integrate Uniswap v4 PoolManager for token swaps on source chain
    - Implement \_swapToBridgeable function to convert any token to USDC
    - Add LayerZero endpoint integration for cross-chain messaging
    - Encode task creation parameters in bridge payload
    - Emit FundingInitiated event
    - Deploy to Ethereum, Arbitrum, Optimism, Base
    - _Requirements: Cross-chain funding, token flexibility_

  - [ ] 5.2 Extend EscrowContract for cross-chain task creation
    - Implement lzReceive function to handle LayerZero messages
    - Add \_swapToMatic function to convert bridged USDC to MATIC on Polygon
    - Create \_createTaskInternal function for cross-chain task creation
    - Emit CrossChainTaskCreated event
    - _Requirements: Cross-chain task creation_

  - [ ] 5.3 Implement EscrowPaymentHook for Uniswap v4
    - Create EscrowPaymentHook.sol extending BaseHook
    - Implement afterSwap hook to track payment swaps
    - Emit SwapCompletedForTask event with taskId and delta
    - _Requirements: Token distribution tracking_

  - [ ] 5.4 Update Treasury for cross-chain payouts
    - Replace swapAndDistribute with swapAndBridge function
    - Add \_swapOnUniswap internal function for MATIC to token conversion
    - Add \_bridgeToChain internal function for LayerZero bridging
    - Handle same-chain transfers (no bridge needed)
    - Emit CrossChainPaymentInitiated and TokensBridged events
    - _Requirements: Cross-chain payment distribution_

  - [ ] 5.5 Write unit test for Uniswap v4 token conversion
    - Test swap from ETH to USDC on Ethereum
    - Test swap from USDC to MATIC on Polygon
    - Test swap from MATIC to various tokens (USDC, DAI, WETH)
    - Test swap with mock pools
    - Test slippage protection
    - Test hook callback execution

  - [ ] 5.6 Write integration test for cross-chain funding
    - Test complete flow: ETH on Ethereum → USDC → bridge → MATIC on Polygon
    - Test with different source tokens (DAI, WBTC, USDT)
    - Test with different source chains (Arbitrum, Optimism, Base)
    - Verify task creation on Polygon after bridging
    - Verify correct escrow amounts after conversions
    - Test LayerZero message handling

  - [ ] 5.7 Write integration test for cross-chain payouts
    - Test payment distribution to multiple chains
    - Test token conversion before bridging
    - Test same-chain payouts (no bridge)
    - Verify recipients receive correct amounts on destination chains
    - Test with different token combinations

- [ ] 6. Deployment Scripts
  - [x] 6.1 Create multi-chain deployment script
    - Write scripts/deploy-multichain.js using Hardhat v3
    - Deploy ContractFactory on Polygon
    - Deploy CrossChainFunding on Ethereum, Arbitrum, Optimism, Base
    - Configure LayerZero endpoints for all chains
    - Link CrossChainFunding contracts to Polygon Escrow
    - Save all addresses to web/src/contracts/addresses.json (per chain)
    - _Requirements: Multi-chain deployment automation_

  - [x] 6.2 Create verification script
    - Write scripts/verify.js for Etherscan/Polygonscan verification
    - Verify all deployed contracts on all chains
    - _Requirements: Transparency_

- [ ] 7. Checkpoint - Smart Contracts Complete
  - Ensure all contract tests pass
  - Verify contracts compile without warnings
  - Review gas costs for optimization opportunities
  - Ask the user if questions arise

- [ ] 8. Goldsky Subgraph Setup
  - [ ] 8.1 Define GraphQL schema
    - Create subgraph/schema.graphql with Task and StateTransition entities
    - Define all fields matching contract events
    - Add derived fields for relationships
    - _Requirements: 1.6, 2.5, 8.3_

  - [ ] 8.2 Implement event handlers
    - Create subgraph/src/mapping.ts with handlers for all events
    - Implement handleTaskCreated, handleTaskWorkingStarted, handleApprovalRequested, etc.
    - Create StateTransition entities for each state change
    - Maintain ordered history per task
    - _Requirements: 1.6, 2.5, 3.1, 8.3, 8.4_

  - [ ]\* 8.3 Write property test for event indexing completeness
    - **Property 5: Event Indexing Completeness**
    - **Validates: Requirements 1.6**

  - [ ]\* 8.4 Write property test for event ordering
    - **Property 25: Event Ordering Consistency**
    - **Validates: Requirements 8.3, 8.4**

  - [ ] 8.3 Configure Goldsky webhooks
    - Create webhook configuration for all events
    - Set retry policy (max 5 retries, exponential backoff)
    - Configure webhook URL pointing to orchestrator
    - _Requirements: 3.3_

- [ ] 9. Orchestrator Service (Go)
  - [ ] 9.1 Set up Go project structure
    - Create api/cmd/server/main.go entry point
    - Set up internal packages (orchestrator, webhook, queue, blockchain, database)
    - Initialize dependencies (database, Redis, blockchain client)
    - _Requirements: Infrastructure_

  - [ ] 9.2 Implement webhook handler
    - Create webhook/handler.go with HTTP endpoint
    - Implement event signature validation
    - Parse webhook payload into Event struct
    - Return appropriate HTTP status codes
    - _Requirements: 3.4, 10.3_

  - [ ]\* 9.3 Write property test for webhook validation
    - Test signature validation with valid/invalid signatures
    - Test malformed payload handling
    - Test HTTP status code responses

  - [ ] 9.4 Implement event deduplication
    - Create orchestrator/deduplication.go with hash computation
    - Implement PostgreSQL storage for processed events
    - Check for duplicate events before processing
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [ ]\* 9.5 Write property test for event idempotency
    - **Property 11: Event Idempotency**
    - **Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5**

  - [ ] 9.6 Implement event routing
    - Create orchestrator/orchestrator.go with RouteEvent function
    - Route ApprovalRequested to validation queue
    - Route TaskRejected to refund handler
    - Handle unknown event types gracefully
    - _Requirements: 3.5_

  - [ ]\* 9.7 Write property test for validation job routing
    - **Property 12: Validation Job Routing**
    - **Validates: Requirements 3.5**

  - [ ] 9.8 Integrate BullMQ job queue
    - Create queue/bullmq.go with job enqueue functions
    - Implement job types (REQUEST_VALIDATION, RUN_AI_CHECK, etc.)
    - Configure retry policies and timeouts
    - _Requirements: 4.1, 10.1, 10.2_

  - [ ]\* 9.9 Write property test for retry policy execution
    - **Property 26: Retry Policy Execution**
    - **Validates: Requirements 10.1, 10.2**

  - [ ] 9.10 Implement blockchain client
    - Create blockchain/client.go with contract interaction functions
    - Implement transitionToValidating function
    - Add transaction error logging
    - _Requirements: 4.1, 10.4_

- [ ] 10. Checkpoint - Orchestrator Complete
  - Ensure all orchestrator tests pass
  - Test webhook endpoint with mock Goldsky events
  - Verify database migrations work correctly
  - Ask the user if questions arise

- [ ] 11. Frontend Foundation
  - [ ] 11.1 Set up React project with Vite
    - Initialize Vite project with React and TypeScript
    - Configure Tailwind CSS with custom theme
    - Set up folder structure (components, views, router, hooks, lib, utils)
    - Add Dynamic.xyz SDK for wallet authentication
    - _Requirements: 7.1_

  - [ ] 11.2 Implement router configuration
    - Create router/index.tsx with route definitions
    - Implement ProtectedRoute component with authentication check
    - Define routes for login, task list, task detail, create task
    - _Requirements: Navigation_

  - [ ] 11.3 Create authentication hook
    - Implement hooks/useAuth.ts with Dynamic.xyz integration
    - Add login, logout, and role resolution functions
    - Manage authentication state
    - _Requirements: 7.1, 7.2_

  - [ ]\* 11.4 Write unit test for role resolution
    - Test role resolution for different user addresses
    - Test authentication state management

  - [ ] 11.5 Create contract interaction hook with multi-chain support
    - Implement hooks/useContract.ts with ethers.js integration
    - Load contract addresses from addresses.json (per chain)
    - Detect user's current chain
    - Create functions for cross-chain task creation (fundTaskCrossChain on source chain)
    - Create functions for on-chain interactions (startWork, submitWork, approveWork, rejectWork on Polygon)
    - Handle chain switching when needed
    - Handle transaction errors gracefully
    - Show transaction status and bridging progress
    - _Requirements: Contract interaction, Cross-chain support_

  - [ ] 11.6 Set up GraphQL client
    - Create lib/graphql.ts with Apollo Client configuration
    - Define GraphQL queries (GET_USER_TASKS, GET_TASK)
    - Configure polling interval for real-time updates
    - _Requirements: 7.3, 7.6_

- [ ] 12. Frontend Views
  - [ ] 12.1 Implement LoginPage
    - Create views/LoginPage.tsx with "Contract Safe" branding
    - Add wallet connection button using Dynamic.xyz
    - Implement responsive layout
    - Redirect to /tasks after successful login
    - _Requirements: 7.1_

  - [ ] 12.2 Implement TaskListPage
    - Create views/TaskListPage.tsx with task grid
    - Add filter tabs (all, creator, contributor, validator)
    - Implement responsive grid (1 column mobile, 2-3 columns desktop)
    - Add "Create Task" button
    - Query tasks from subgraph with polling
    - _Requirements: 7.3_

  - [ ]\* 12.3 Write property test for task filtering
    - **Property 21: Task Visibility**
    - **Validates: Requirements 7.3**

  - [ ] 12.4 Implement TaskDetailPage
    - Create views/TaskDetailPage.tsx with full task information
    - Display task metadata (creator, contributor, validator, escrow, state)
    - Show state visualization component
    - Display state history with transaction links
    - Render contextual actions based on user role
    - _Requirements: 7.5, 8.1, 8.2_

  - [ ]\* 12.5 Write property test for contextual actions
    - **Property 23: Role-Based Action Authorization**
    - **Validates: Requirements 7.5**

  - [ ] 12.6 Implement CreateTaskPage with cross-chain funding
    - Create views/CreateTaskPage.tsx with task creation form
    - Add creator funding section (chain selector, token selector, amount input)
    - Add contributor payment preferences section (destination chain, token, recipient address)
    - Add validator payment preferences section (destination chain, token, recipient address)
    - Add validator type selector (Human vs Agent)
    - Implement agent configuration form (MCP URL, criteria, threshold)
    - Add form validation for all fields
    - Implement cross-chain transaction flow (detect user's chain, call appropriate contract)
    - Show helpful text: "Funds will be automatically bridged to Polygon for escrow"
    - Submit task creation transaction (CrossChainFunding or direct Escrow)
    - _Requirements: 7.4, Agent support, Cross-chain funding_

  - [ ] 12.7 Write property test for form validation
    - **Property 22: Form Validation Completeness**
    - **Validates: Requirements 7.4**

- [ ] 13. Frontend Components
  - [ ] 13.1 Create Header component
    - Implement components/layout/Header.tsx with responsive navigation
    - Add "Contract Safe" logo
    - Show user address and logout button
    - Implement mobile menu
    - _Requirements: Responsive design_

  - [ ] 13.2 Create TaskCard component
    - Implement components/tasks/TaskCard.tsx for task list items
    - Display task summary (ID, state, escrow amount)
    - Show user's role on the task
    - Make card clickable to navigate to detail page
    - _Requirements: 7.3_

  - [ ] 13.3 Create TaskActions component
    - Implement components/tasks/TaskActions.tsx with role-based actions
    - Show "Start Work" button for contributor on Created tasks
    - Show "Submit Work" form for contributor on Working tasks
    - Show "Approve/Reject" buttons for validator on ApprovalRequested tasks
    - Handle transaction submission and errors
    - _Requirements: 7.5_

  - [ ] 13.4 Create StateVisualization component
    - Implement components/tasks/StateVisualization.tsx with state machine diagram
    - Highlight current state
    - Show valid next states
    - Use responsive design
    - _Requirements: 8.1_

  - [ ] 13.5 Create CreateTaskForm component
    - Implement components/tasks/CreateTaskForm.tsx with all form fields
    - Add real-time validation
    - Show validation errors
    - Disable submit button when form is invalid
    - Support both human and agent validator configuration
    - _Requirements: 7.4, Agent support_

  - [ ] 13.6 Create common UI components
    - Implement Button, Card, Modal, Toast components in components/common/
    - Use Tailwind CSS with consistent styling
    - Ensure all components are responsive
    - _Requirements: Design system_

- [ ] 14. Checkpoint - Frontend Complete
  - Ensure all frontend tests pass
  - Test responsive design on mobile and desktop
  - Verify all user flows work end-to-end
  - Ask the user if questions arise

- [ ] 15. AI Agent Validator (MCP)
  - [ ] 15.1 Set up MCP server project
    - Initialize example_agent/ with TypeScript and MCP SDK
    - Configure package.json with dependencies
    - Set up tsconfig.json
    - _Requirements: Agent validation_

  - [ ] 15.2 Implement MCP server with evaluation tools
    - Create example_agent/src/index.ts with Server setup
    - Register evaluate_submission tool
    - Register check_requirements tool
    - Implement tool handlers
    - _Requirements: Agent validation_

  - [ ] 15.3 Implement evaluation logic
    - Create evaluateWithLLM function with prompt engineering
    - Implement LLM API integration (OpenAI, Anthropic, or local model)
    - Parse LLM response into structured evaluation result
    - Calculate confidence score
    - _Requirements: Agent validation_

  - [ ] 15.4 Implement artifact fetching
    - Create fetchArtifacts function to retrieve submission from IPFS
    - Handle different artifact types (code, documents, images)
    - Add error handling for missing artifacts
    - _Requirements: Agent validation_

  - [ ] 15.5 Integrate agent with orchestrator
    - Add triggerMCPValidation function to orchestrator
    - Call MCP agent when agent validator is detected
    - Parse agent evaluation result
    - Submit approval/rejection on-chain based on confidence threshold
    - Handle requireHumanReview flag
    - _Requirements: Agent validation_

  - [ ]\* 15.6 Write integration test for agent validation
    - Test end-to-end agent validation flow
    - Test auto-approval at high confidence
    - Test human review fallback at low confidence
    - Test rejection with reasoning

- [ ] 16. Integration and End-to-End Testing
  - [ ] 16.1 Write integration test for complete cross-chain task lifecycle
    - Test cross-chain task creation: ETH on Ethereum → USDC → bridge → MATIC on Polygon
    - Test work submission and validation on Polygon
    - Test cross-chain payment: MATIC → USDC/DAI → bridge → recipient chains
    - Test with both human and agent validators
    - Verify all events are emitted and indexed on all chains
    - Verify state transitions are correct
    - Verify correct amounts after all conversions and bridges

  - [ ] 16.2 Write integration test for multi-chain scenarios
    - Test creator on Ethereum, contributor payout to Arbitrum, validator payout to Optimism
    - Test creator on Base, both payouts to Polygon (same chain, no bridge)
    - Test with different token combinations (ETH, DAI, USDC, WBTC)
    - Verify LayerZero message delivery
    - Verify Uniswap v4 swaps at all stages

  - [ ] 16.3 Write integration test for gasless transactions
    - Test Paymaster sponsorship for all operations on Polygon
    - Test rate limiting enforcement
    - Test gas cost recording
    - Test cross-chain funding with sponsored gas

  - [ ] 16.4 Write integration test for edge cases
    - Test swap failure handling (insufficient liquidity)
    - Test bridge failure handling (LayerZero timeout)
    - Test same-token scenarios (no swap needed)
    - Test minimum amounts and slippage protection
    - Test refund flow with cross-chain bridging back to creator

- [ ] 17. Documentation and Deployment
  - [ ] 17.1 Update README with setup instructions
    - Document prerequisites (Node.js, Go, Docker, etc.)
    - Add detailed setup steps for each component
    - Include example .env configuration with all chain RPC URLs
    - Add multi-chain setup instructions
    - Add troubleshooting section for cross-chain issues
    - _Requirements: Documentation_

  - [ ] 17.2 Create multi-chain deployment guide
    - Document testnet deployment process for all chains
    - Document LayerZero endpoint configuration
    - Document Uniswap v4 pool setup on each chain
    - Document mainnet deployment checklist
    - Add security considerations for cross-chain contracts
    - Include monitoring and alerting setup for all chains
    - Add bridge monitoring and failure recovery procedures
    - _Requirements: Documentation_

  - [ ] 17.3 Deploy to testnets (Mumbai, Sepolia, Arbitrum Goerli, Optimism Goerli, Base Goerli)
    - Deploy ContractFactory and suite on Mumbai (Polygon testnet)
    - Deploy CrossChainFunding on Sepolia, Arbitrum Goerli, Optimism Goerli, Base Goerli
    - Configure LayerZero endpoints for all testnets
    - Deploy and configure Goldsky subgraph on Mumbai
    - Deploy orchestrator to cloud (Docker container)
    - Deploy frontend to Vercel/Netlify with multi-chain support
    - Test end-to-end cross-chain flow on testnets
    - Verify bridging works between all chains
    - _Requirements: Multi-chain testnet deployment_

- [ ] 18. Final Checkpoint
  - Run full test suite (contracts on all chains, orchestrator, frontend, agent)
  - Verify all property-based tests pass with 100+ iterations
  - Check code coverage meets requirements (90% contracts, 80% orchestrator, 70% frontend)
  - Review gas costs on all chains and optimize if needed
  - Test cross-chain flows with real testnet bridges
  - Verify Uniswap v4 liquidity on all chains
  - Conduct security review of smart contracts
  - Ask the user for final approval before mainnet deployment

## Notes

- Each task references specific requirements for traceability
- Property tests validate universal correctness properties with minimum 100 iterations
- Unit tests validate specific examples and edge cases
- Integration tests validate end-to-end workflows
- Checkpoints ensure incremental validation and provide opportunities for user feedback
- All tests are required for comprehensive quality assurance
