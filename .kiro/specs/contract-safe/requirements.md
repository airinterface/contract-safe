# Requirements Document: ContractSafe MVP

## Introduction

ContractSafe is an event-driven, task-based escrow system built on Ethereum that enables trustless collaboration between task creators, contributors, and validators. The system combines deterministic on-chain state management with asynchronous off-chain validation workflows, supporting human validators, AI agents, and oracle-based verification while maintaining transparency and auditability.

## Glossary

- **Task_Creator**: A user who creates and funds a task with escrowed funds
- **Contributor**: A user who performs work on an assigned task
- **Validator**: A user or agent who reviews and approves or rejects submitted work
- **Smart_Contract**: The on-chain Ethereum contract managing task state and escrow funds
- **Orchestrator**: The off-chain service that receives blockchain events and routes work to async systems
- **Subgraph**: The Goldsky-indexed queryable representation of on-chain task state
- **BullMQ**: The async job queue system handling time-dependent and retry-based workflows
- **Task_State**: The current lifecycle stage of a task (Draft, Created, Working, ApprovalRequested, Validating, ProcessingPayment, Refunded)
- **Escrow_Amount**: The funds locked in the contract for a specific task
- **Validation_Artifacts**: Evidence submitted by contributors to prove work completion
- **Paymaster**: The ERC-4337 component that sponsors gas fees for gasless UX

## Requirements

### Requirement 1: Task Creation and Escrow

**User Story:** As a Task_Creator, I want to create tasks with escrowed funds, so that I can ensure contributors are paid upon successful completion.

#### Acceptance Criteria

1. WHEN a Task_Creator authenticates via dynamic.xyz THEN THE Smart_Contract SHALL verify the wallet identity
2. WHEN a Task_Creator creates a task draft THEN THE System SHALL store the task title, description, and validation instructions
3. WHEN a Task_Creator specifies contributor and validator addresses THEN THE Smart_Contract SHALL validate the addresses are non-zero and distinct
4. WHEN a Task_Creator defines escrow amount and payout percentages THEN THE Smart_Contract SHALL validate percentages sum to 100 and escrow amount is greater than zero
5. WHEN a Task_Creator submits a task with valid parameters THEN THE Smart_Contract SHALL lock the escrow amount and emit a TaskCreated event
6. WHEN a TaskCreated event is emitted THEN THE Subgraph SHALL index the task with all metadata and transition state to TaskCreated

### Requirement 2: Work Submission Flow

**User Story:** As a Contributor, I want to submit my completed work with validation artifacts, so that validators can review and approve payment.

#### Acceptance Criteria

1. WHEN a Contributor accepts a task THEN THE Smart_Contract SHALL transition the task state to TaskWorking
2. WHEN a task transitions to TaskWorking THEN THE Smart_Contract SHALL emit a TaskWorkingStarted event
3. WHEN a Contributor submits work with validation artifacts THEN THE Smart_Contract SHALL store artifact references and transition state to ApprovalRequested
4. WHEN state transitions to ApprovalRequested THEN THE Smart_Contract SHALL emit an ApprovalRequested event with taskId and artifact references
5. WHEN an ApprovalRequested event is emitted THEN THE Subgraph SHALL update the task state and index the validation artifacts

### Requirement 3: Event Streaming and Orchestration

**User Story:** As the System, I want to stream blockchain events in real-time to off-chain services, so that asynchronous validation workflows can be triggered without polling.

#### Acceptance Criteria

1. WHEN any state transition occurs on-chain THEN THE Smart_Contract SHALL emit an event with taskId, previous state, new state, and timestamp
2. WHEN an event is emitted THEN THE Subgraph SHALL index the event within 5 seconds
3. WHEN the Subgraph indexes an event THEN THE Goldsky_Webhook SHALL push the event to the Orchestrator endpoint
4. WHEN the Orchestrator receives a webhook event THEN THE Orchestrator SHALL validate the event signature and deduplicate based on event hash
5. WHEN the Orchestrator processes an ApprovalRequested event THEN THE Orchestrator SHALL enqueue a REQUEST_VALIDATION job to BullMQ with taskId and artifact references

### Requirement 4: Asynchronous Validation Workflow

**User Story:** As a Validator, I want to review submitted work asynchronously and submit my decision, so that contributors receive payment or tasks are refunded based on work quality.

#### Acceptance Criteria

1. WHEN a REQUEST_VALIDATION job is dequeued THEN THE BullMQ_Worker SHALL transition the task state to Validating on-chain
2. WHEN state transitions to Validating THEN THE Smart_Contract SHALL emit a ValidationStarted event
3. WHEN a Validator submits an approval decision THEN THE Smart_Contract SHALL transition state to ProcessingPayment and emit a TaskApproved event
4. WHEN a Validator submits a rejection decision THEN THE Smart_Contract SHALL transition state to Refunded and emit a TaskRejected event
5. WHEN state transitions to ProcessingPayment THEN THE Smart_Contract SHALL transfer escrow funds according to payout percentages to contributor and validator addresses

### Requirement 5: Payment Processing and Refunds

**User Story:** As a Contributor, I want to receive payment automatically when my work is approved, so that I am compensated without manual intervention.

#### Acceptance Criteria

1. WHEN a task is approved THEN THE Smart_Contract SHALL calculate contributor payout as escrow amount multiplied by contributor percentage
2. WHEN a task is approved THEN THE Smart_Contract SHALL calculate validator payout as escrow amount multiplied by validator percentage
3. WHEN payout amounts are calculated THEN THE Smart_Contract SHALL transfer funds to contributor and validator addresses atomically
4. WHEN transfers complete successfully THEN THE Smart_Contract SHALL emit a PaymentProcessed event with recipient addresses and amounts
5. WHEN a task is rejected THEN THE Smart_Contract SHALL refund the full escrow amount to the Task_Creator address

### Requirement 6: Gasless User Experience

**User Story:** As a user, I want to interact with the system without paying gas fees, so that I can focus on task completion rather than transaction costs.

#### Acceptance Criteria

1. WHEN a user submits a transaction THEN THE Paymaster SHALL sponsor the gas fee if the user has a valid smart account
2. WHEN the Paymaster sponsors gas THEN THE Smart_Contract SHALL validate the operation is allowlisted for sponsored gas
3. WHEN a user exceeds rate limits THEN THE Paymaster SHALL reject the sponsorship and require the user to pay gas directly
4. WHEN gas is sponsored THEN THE System SHALL record the gas cost for potential reimbursement or fee calculation
5. WHERE gas sponsorship is enabled THEN THE System SHALL enforce per-task and per-validator rate limits to prevent abuse

### Requirement 7: Frontend Task Management UI

**User Story:** As a user, I want to view and manage tasks through a web interface, so that I can interact with the system without using command-line tools.

#### Acceptance Criteria

1. WHEN a user visits the login page THEN THE Frontend SHALL display wallet authentication via dynamic.xyz
2. WHEN a user authenticates THEN THE Frontend SHALL resolve the user role as Task_Creator, Contributor, or Validator
3. WHEN a user views the task list THEN THE Frontend SHALL query the Subgraph and display all accessible tasks filtered by role and state
4. WHEN a Task_Creator fills the create task form THEN THE Frontend SHALL validate all required fields before enabling submission
5. WHEN a user views a task detail page THEN THE Frontend SHALL display contextual actions based on user role and current task state
6. WHEN a task state changes on-chain THEN THE Frontend SHALL reflect the updated state within 10 seconds via subgraph polling or webhook-triggered revalidation

### Requirement 8: State Machine Transparency and Auditability

**User Story:** As a user, I want to view the complete history of task state transitions, so that I can verify the system behaves correctly and audit all decisions.

#### Acceptance Criteria

1. WHEN a user views a task detail page THEN THE Frontend SHALL display all historical state transitions with timestamps
2. WHEN a state transition is displayed THEN THE Frontend SHALL include a link to the on-chain transaction for verification
3. WHEN the Subgraph indexes events THEN THE Subgraph SHALL maintain a complete ordered history of all state transitions per task
4. WHEN a user queries task history THEN THE Subgraph SHALL return events ordered by block number and transaction index
5. THE Smart_Contract SHALL enforce that state transitions follow the valid state machine: Draft → Created → Working → ApprovalRequested → Validating → (ProcessingPayment | Refunded)

### Requirement 9: Idempotent Event Processing

**User Story:** As the System, I want to process blockchain events idempotently, so that duplicate webhook deliveries do not cause incorrect behavior.

#### Acceptance Criteria

1. WHEN the Orchestrator receives an event THEN THE Orchestrator SHALL compute a deterministic hash from event data
2. WHEN the Orchestrator processes an event THEN THE Orchestrator SHALL check if the event hash has been processed previously
3. WHEN an event hash is already processed THEN THE Orchestrator SHALL acknowledge the webhook and skip processing
4. WHEN an event hash is new THEN THE Orchestrator SHALL process the event and store the hash for future deduplication
5. WHEN BullMQ jobs are enqueued THEN THE BullMQ SHALL use taskId and event hash as job identifiers to prevent duplicate jobs

### Requirement 10: Error Handling and Retry Logic

**User Story:** As the System, I want to handle transient failures gracefully with retries, so that temporary issues do not cause permanent task failures.

#### Acceptance Criteria

1. WHEN a BullMQ job fails due to a transient error THEN THE BullMQ SHALL retry the job with exponential backoff up to 5 attempts
2. WHEN a job exceeds maximum retry attempts THEN THE BullMQ SHALL move the job to a dead letter queue and emit an alert
3. WHEN the Orchestrator fails to process a webhook THEN THE Orchestrator SHALL return an HTTP error code to trigger Goldsky retry
4. WHEN a blockchain transaction fails THEN THE System SHALL log the error with transaction hash and revert reason
5. IF a validation job times out THEN THE System SHALL transition the task to a timeout state and notify the Task_Creator
