package orchestrator

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
)

// Event represents a blockchain event from Goldsky
type Event struct {
	Hash            string                 `json:"hash"`
	Type            string                 `json:"type"`
	TaskID          int64                  `json:"taskId"`
	BlockNumber     int64                  `json:"blockNumber"`
	TransactionHash string                 `json:"transactionHash"`
	Payload         map[string]interface{} `json:"payload"`
}

// ComputeEventHash computes a unique hash for an event
func ComputeEventHash(eventType string, taskID int64, blockNumber int64, txHash string) string {
	data := fmt.Sprintf("%s:%d:%d:%s", eventType, taskID, blockNumber, txHash)
	hash := sha256.Sum256([]byte(data))
	return "0x" + hex.EncodeToString(hash[:])
}

// isDuplicateEvent checks if an event has already been processed
func (o *Orchestrator) isDuplicateEvent(ctx context.Context, eventHash string) (bool, error) {
	var exists bool
	query := `SELECT EXISTS(SELECT 1 FROM events WHERE event_hash = $1)`
	
	err := o.db.QueryRowContext(ctx, query, eventHash).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("failed to check duplicate: %w", err)
	}

	return exists, nil
}

// storeEvent stores an event in the database
func (o *Orchestrator) storeEvent(ctx context.Context, event *Event) error {
	payloadJSON, err := json.Marshal(event.Payload)
	if err != nil {
		return fmt.Errorf("failed to marshal payload: %w", err)
	}

	query := `
		INSERT INTO events (event_hash, event_type, task_id, block_number, transaction_hash, payload)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (event_hash) DO NOTHING
	`

	_, err = o.db.ExecContext(
		ctx,
		query,
		event.Hash,
		event.Type,
		event.TaskID,
		event.BlockNumber,
		event.TransactionHash,
		payloadJSON,
	)

	if err != nil {
		return fmt.Errorf("failed to store event: %w", err)
	}

	return nil
}

// GetProcessedEvents retrieves processed events for a task
func (o *Orchestrator) GetProcessedEvents(ctx context.Context, taskID int64) ([]Event, error) {
	query := `
		SELECT event_hash, event_type, task_id, block_number, transaction_hash, payload
		FROM events
		WHERE task_id = $1
		ORDER BY block_number ASC, id ASC
	`

	rows, err := o.db.QueryContext(ctx, query, taskID)
	if err != nil {
		return nil, fmt.Errorf("failed to query events: %w", err)
	}
	defer rows.Close()

	var events []Event
	for rows.Next() {
		var event Event
		var payloadJSON []byte

		err := rows.Scan(
			&event.Hash,
			&event.Type,
			&event.TaskID,
			&event.BlockNumber,
			&event.TransactionHash,
			&payloadJSON,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan event: %w", err)
		}

		if err := json.Unmarshal(payloadJSON, &event.Payload); err != nil {
			return nil, fmt.Errorf("failed to unmarshal payload: %w", err)
		}

		events = append(events, event)
	}

	return events, nil
}
