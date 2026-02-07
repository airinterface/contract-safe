# ContractSafe Orchestrator API

Go-based orchestrator service that processes blockchain events from Goldsky and coordinates task validation workflows.

## Features

- **Event Processing**: Receives webhook events from Goldsky subgraph
- **Deduplication**: Prevents duplicate event processing using PostgreSQL
- **Job Queue**: Uses Asynq (Redis-based) for reliable job processing
- **Event Routing**: Routes events to appropriate handlers (validation, refund, etc.)
- **Blockchain Integration**: Interacts with smart contracts on Polygon

## Architecture

```
Goldsky Webhook → Webhook Handler → Orchestrator → Job Queue → Workers
                                   ↓
                              PostgreSQL (deduplication)
                                   ↓
                              Blockchain Client
```

## Setup

### Prerequisites

- Go 1.21+
- PostgreSQL 14+
- Redis 6+

### Installation

1. Install dependencies:

```bash
go mod download
```

2. Set up environment variables:

```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Run database migrations (automatic on startup)

### Running Locally

```bash
go run cmd/server/main.go
```

The server will start on port 8080 (or PORT from .env).

### Running with Docker

```bash
docker build -t contractsafe-api .
docker run -p 8080:8080 --env-file .env contractsafe-api
```

## API Endpoints

### Health Check

```
GET /health
```

Returns `OK` if the service is running.

### Goldsky Webhook

```
POST /webhooks/goldsky
```

Receives blockchain events from Goldsky. Requires valid signature in `X-Goldsky-Signature` header.

**Payload Example:**

```json
{
  "eventType": "ApprovalRequested",
  "taskId": 1,
  "blockNumber": 12345678,
  "transactionHash": "0x...",
  "data": {
    "isAgentValidator": true,
    "contributor": "0x...",
    "validator": "0x..."
  }
}
```

## Event Types

- **TaskCreated**: New task created (informational)
- **TaskWorkingStarted**: Contributor started work (informational)
- **TaskWorkSubmitted**: Work submitted for review (informational)
- **ApprovalRequested**: Validation needed → Routes to validation queue
- **TaskRejected**: Task rejected → Routes to refund handler
- **TaskApproved**: Task approved (informational)
- **TaskCompleted**: Task completed (informational)

## Job Types

- **REQUEST_VALIDATION**: Human validator notification
- **RUN_AI_CHECK**: AI agent validation
- **PROCESS_REFUND**: Refund processing

## Database Schema

### events table

Stores processed events for deduplication:

- `id`: Serial primary key
- `event_hash`: Unique hash of event (type + taskId + blockNumber + txHash)
- `event_type`: Type of event
- `task_id`: Task ID
- `block_number`: Block number
- `transaction_hash`: Transaction hash
- `payload`: JSONB event data
- `processed_at`: Processing timestamp
- `created_at`: Creation timestamp

## Development

### Project Structure

```
api/
├── cmd/
│   └── server/          # Main entry point
├── internal/
│   ├── blockchain/      # Blockchain client
│   ├── database/        # Database connection and migrations
│   ├── orchestrator/    # Event processing and routing
│   ├── queue/           # Job queue (Asynq)
│   └── webhook/         # Webhook handler
└── pkg/                 # Public packages (if any)
```

### Adding New Event Types

1. Add event type constant in `orchestrator/orchestrator.go`
2. Add handler function (e.g., `handleNewEvent`)
3. Add case in `routeEvent` switch statement

### Testing

```bash
# Run all tests
go test ./...

# Run with coverage
go test -cover ./...

# Run specific package
go test ./internal/orchestrator
```

## Deployment

### Environment Variables

See `.env.example` for required variables.

### Production Considerations

- Use connection pooling for PostgreSQL
- Configure Redis persistence
- Set up monitoring and alerting
- Use secrets management for sensitive values
- Enable HTTPS for webhook endpoint
- Configure rate limiting
- Set up log aggregation

## Troubleshooting

### Database Connection Issues

- Verify DATABASE_URL is correct
- Check PostgreSQL is running
- Verify network connectivity

### Redis Connection Issues

- Verify REDIS_URL is correct
- Check Redis is running
- Verify network connectivity

### Webhook Signature Validation Fails

- Verify GOLDSKY_WEBHOOK_SECRET matches Goldsky configuration
- Check X-Goldsky-Signature header is present
- Verify payload hasn't been modified

## License

MIT
