package orchestrator

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/contractsafe/api/internal/blockchain"
	"github.com/contractsafe/api/internal/queue"
)

// Orchestrator coordinates event processing
type Orchestrator struct {
	db               *sql.DB
	queue            *queue.JobQueue
	blockchainClient *blockchain.Client
}

// NewOrchestrator creates a new orchestrator
func NewOrchestrator(db *sql.DB, jobQueue *queue.JobQueue, blockchainClient *blockchain.Client) *Orchestrator {
	return &Orchestrator{
		db:               db,
		queue:            jobQueue,
		blockchainClient: blockchainClient,
	}
}

// ProcessEvent processes an incoming event from Goldsky
func (o *Orchestrator) ProcessEvent(ctx context.Context, event *Event) error {
	// Check for duplicate
	isDuplicate, err := o.isDuplicateEvent(ctx, event.Hash)
	if err != nil {
		return fmt.Errorf("failed to check duplicate: %w", err)
	}

	if isDuplicate {
		fmt.Printf("Skipping duplicate event: %s\n", event.Hash)
		return nil
	}

	// Store event
	if err := o.storeEvent(ctx, event); err != nil {
		return fmt.Errorf("failed to store event: %w", err)
	}

	// Route event
	if err := o.routeEvent(ctx, event); err != nil {
		return fmt.Errorf("failed to route event: %w", err)
	}

	return nil
}

// routeEvent routes an event to the appropriate handler
func (o *Orchestrator) routeEvent(ctx context.Context, event *Event) error {
	switch event.Type {
	case "ApprovalRequested":
		return o.handleApprovalRequested(ctx, event)
	case "TaskRejected":
		return o.handleTaskRejected(ctx, event)
	case "TaskCreated", "TaskWorkingStarted", "TaskWorkSubmitted", "TaskApproved", "TaskCompleted":
		// These events are informational only, no action needed
		fmt.Printf("Processed informational event: %s for task %d\n", event.Type, event.TaskID)
		return nil
	default:
		fmt.Printf("Unknown event type: %s\n", event.Type)
		return nil
	}
}

// handleApprovalRequested handles ApprovalRequested events
func (o *Orchestrator) handleApprovalRequested(ctx context.Context, event *Event) error {
	fmt.Printf("Handling ApprovalRequested for task %d\n", event.TaskID)

	// Check if this is an agent validator task
	isAgentTask := event.Payload["isAgentValidator"] == true

	if isAgentTask {
		// Enqueue AI validation job
		payload := queue.JobPayload{
			TaskID:          event.TaskID,
			EventType:       event.Type,
			TransactionHash: event.TransactionHash,
			BlockNumber:     event.BlockNumber,
			Data:            event.Payload,
		}

		return o.queue.EnqueueWithRetry(ctx, queue.JobTypeRunAICheck, payload, 3)
	}

	// For human validators, just enqueue a validation request
	payload := queue.JobPayload{
		TaskID:          event.TaskID,
		EventType:       event.Type,
		TransactionHash: event.TransactionHash,
		BlockNumber:     event.BlockNumber,
		Data:            event.Payload,
	}

	return o.queue.EnqueueWithRetry(ctx, queue.JobTypeRequestValidation, payload, 3)
}

// handleTaskRejected handles TaskRejected events
func (o *Orchestrator) handleTaskRejected(ctx context.Context, event *Event) error {
	fmt.Printf("Handling TaskRejected for task %d\n", event.TaskID)

	// Enqueue refund processing job
	payload := queue.JobPayload{
		TaskID:          event.TaskID,
		EventType:       event.Type,
		TransactionHash: event.TransactionHash,
		BlockNumber:     event.BlockNumber,
		Data:            event.Payload,
	}

	return o.queue.EnqueueWithRetry(ctx, queue.JobTypeProcessRefund, payload, 3)
}
