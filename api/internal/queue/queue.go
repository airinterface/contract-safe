package queue

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/hibiken/asynq"
)

// JobType represents different types of jobs
type JobType string

const (
	JobTypeRequestValidation JobType = "REQUEST_VALIDATION"
	JobTypeRunAICheck        JobType = "RUN_AI_CHECK"
	JobTypeProcessRefund     JobType = "PROCESS_REFUND"
)

// JobPayload represents the data for a job
type JobPayload struct {
	TaskID          int64             `json:"taskId"`
	EventType       string            `json:"eventType"`
	TransactionHash string            `json:"transactionHash"`
	BlockNumber     int64             `json:"blockNumber"`
	Data            map[string]interface{} `json:"data"`
}

// JobQueue handles job queue operations
type JobQueue struct {
	client *asynq.Client
}

// NewJobQueue creates a new job queue
func NewJobQueue(redisClient *redis.Client) *JobQueue {
	// Get Redis options from client
	opt := redisClient.Options()
	
	asynqClient := asynq.NewClient(asynq.RedisClientOpt{
		Addr: opt.Addr,
	})

	return &JobQueue{
		client: asynqClient,
	}
}

// EnqueueJob adds a job to the queue
func (q *JobQueue) EnqueueJob(ctx context.Context, jobType JobType, payload JobPayload, opts ...asynq.Option) error {
	data, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal payload: %w", err)
	}

	task := asynq.NewTask(string(jobType), data, opts...)
	
	info, err := q.client.Enqueue(task)
	if err != nil {
		return fmt.Errorf("failed to enqueue task: %w", err)
	}

	fmt.Printf("Enqueued job: type=%s, id=%s, queue=%s\n", jobType, info.ID, info.Queue)
	return nil
}

// EnqueueWithRetry adds a job with retry policy
func (q *JobQueue) EnqueueWithRetry(ctx context.Context, jobType JobType, payload JobPayload, maxRetries int) error {
	opts := []asynq.Option{
		asynq.MaxRetry(maxRetries),
		asynq.Timeout(5 * time.Minute),
	}
	return q.EnqueueJob(ctx, jobType, payload, opts...)
}

// Close closes the queue client
func (q *JobQueue) Close() error {
	return q.client.Close()
}
