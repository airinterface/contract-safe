# Docker Setup Guide

This guide explains how to run ContractSafe services using Docker Compose for local development.

## Prerequisites

- Docker 20.10+
- Docker Compose 2.0+

## Services Overview

The docker-compose.yml defines the following services:

### Core Services (Always Available)

1. **postgres** - PostgreSQL 15 database for event storage
   - Port: 5432
   - User: contractsafe
   - Password: contractsafe
   - Database: contractsafe

2. **redis** - Redis 7 for job queue
   - Port: 6379
   - Persistence: Enabled (AOF)

3. **api** - Go orchestrator service
   - Port: 8080
   - Endpoints:
     - GET /health - Health check
     - POST /webhooks/goldsky - Webhook receiver

### Optional Services (Profiles)

4. **hardhat** - Local blockchain node (profile: `local-blockchain`)
   - Port: 8545
   - Use for local contract testing

5. **web** - React frontend (profile: `frontend`)
   - Port: 5173
   - Vite dev server with hot reload

6. **mcp-agent** - AI agent validator (profile: `agent`)
   - Port: 3000
   - MCP server for task validation

## Quick Start

### 1. Start Core Services (Database + Redis + API)

```bash
# Start PostgreSQL, Redis, and API
docker-compose up -d

# View logs
docker-compose logs -f

# Check service health
docker-compose ps
```

### 2. Start with Frontend

```bash
# Start core services + frontend
docker-compose --profile frontend up -d

# Frontend will be available at http://localhost:5173
```

### 3. Start All Services

```bash
# Start everything including local blockchain and agent
docker-compose --profile local-blockchain --profile frontend --profile agent up -d
```

## Service Management

### Start Services

```bash
# Start specific service
docker-compose up -d postgres redis

# Start with logs
docker-compose up postgres redis

# Start all core services
docker-compose up -d
```

### Stop Services

```bash
# Stop all services
docker-compose down

# Stop and remove volumes (WARNING: deletes data)
docker-compose down -v

# Stop specific service
docker-compose stop api
```

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f api

# Last 100 lines
docker-compose logs --tail=100 api
```

### Restart Services

```bash
# Restart all
docker-compose restart

# Restart specific service
docker-compose restart api
```

## Environment Configuration

### Using .env File

Create a `.env` file in the project root:

```bash
# Blockchain Configuration
POLYGON_RPC_URL=https://rpc-amoy.polygon.technology
ESCROW_CONTRACT_ADDRESS=0x...

# Goldsky Webhook
GOLDSKY_WEBHOOK_SECRET=your_secret_here

# Frontend (Dynamic.xyz)
REACT_APP_DYNAMIC_ENV_ID=your_dynamic_env_id

# AI Agent
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
```

Docker Compose will automatically load these variables.

### Override Environment Variables

```bash
# Override specific variable
POLYGON_RPC_URL=https://polygon-rpc.com docker-compose up -d

# Use different env file
docker-compose --env-file .env.production up -d
```

## Database Management

### Access PostgreSQL

```bash
# Connect to database
docker-compose exec postgres psql -U contractsafe -d contractsafe

# Run SQL file
docker-compose exec -T postgres psql -U contractsafe -d contractsafe < schema.sql

# Backup database
docker-compose exec postgres pg_dump -U contractsafe contractsafe > backup.sql

# Restore database
docker-compose exec -T postgres psql -U contractsafe -d contractsafe < backup.sql
```

### Database Migrations

Migrations run automatically when the API starts. To run manually:

```bash
# View API logs to see migration status
docker-compose logs api | grep migration
```

### Reset Database

```bash
# Stop services
docker-compose down

# Remove database volume
docker volume rm contractsafe_postgres_data

# Start services (migrations will run)
docker-compose up -d
```

## Redis Management

### Access Redis CLI

```bash
# Connect to Redis
docker-compose exec redis redis-cli

# Check keys
docker-compose exec redis redis-cli KEYS '*'

# Monitor commands
docker-compose exec redis redis-cli MONITOR

# Get info
docker-compose exec redis redis-cli INFO
```

### Clear Redis Data

```bash
# Flush all data
docker-compose exec redis redis-cli FLUSHALL

# Or restart with volume removal
docker-compose down
docker volume rm contractsafe_redis_data
docker-compose up -d
```

## Development Workflows

### Backend Development

```bash
# Start dependencies only
docker-compose up -d postgres redis

# Run API locally (outside Docker)
cd api
go run cmd/server/main.go

# Or rebuild and restart API container
docker-compose up -d --build api
```

### Frontend Development

```bash
# Start backend services
docker-compose up -d

# Run frontend locally (outside Docker)
cd web
npm run dev

# Or use Docker with hot reload
docker-compose --profile frontend up -d
```

### Contract Development

```bash
# Start local blockchain
docker-compose --profile local-blockchain up -d hardhat

# Deploy contracts to local network
cd contract
npx hardhat run scripts/deploy.js --network localhost

# Run tests
npx hardhat test
```

## Troubleshooting

### Service Won't Start

```bash
# Check logs
docker-compose logs service-name

# Check if port is already in use
lsof -i :8080  # API port
lsof -i :5432  # PostgreSQL port
lsof -i :6379  # Redis port

# Remove and recreate
docker-compose down
docker-compose up -d --force-recreate
```

### Database Connection Issues

```bash
# Check if PostgreSQL is healthy
docker-compose ps postgres

# Test connection
docker-compose exec postgres pg_isready -U contractsafe

# Check API can connect
docker-compose logs api | grep database
```

### Redis Connection Issues

```bash
# Check if Redis is healthy
docker-compose ps redis

# Test connection
docker-compose exec redis redis-cli PING

# Check API can connect
docker-compose logs api | grep redis
```

### API Not Receiving Webhooks

```bash
# Check API is running
curl http://localhost:8080/health

# Check webhook endpoint
curl -X POST http://localhost:8080/webhooks/goldsky \
  -H "Content-Type: application/json" \
  -d '{"eventType":"test"}'

# View API logs
docker-compose logs -f api
```

### Container Build Issues

```bash
# Rebuild without cache
docker-compose build --no-cache

# Remove all images and rebuild
docker-compose down --rmi all
docker-compose up -d --build
```

## Production Deployment

### Build Production Images

```bash
# Build all images
docker-compose build

# Tag for registry
docker tag contractsafe-api:latest your-registry/contractsafe-api:v1.0.0

# Push to registry
docker push your-registry/contractsafe-api:v1.0.0
```

### Production Considerations

1. **Use External Databases**: Don't run PostgreSQL/Redis in containers for production
2. **Environment Variables**: Use secrets management (AWS Secrets Manager, HashiCorp Vault)
3. **Logging**: Configure log aggregation (CloudWatch, Datadog, etc.)
4. **Monitoring**: Add health checks and metrics
5. **Scaling**: Use orchestration (Kubernetes, ECS, etc.)
6. **Backups**: Automated database backups
7. **Security**:
   - Don't expose database ports publicly
   - Use strong passwords
   - Enable SSL/TLS
   - Regular security updates

## Useful Commands

```bash
# View resource usage
docker stats

# Clean up unused resources
docker system prune -a

# View volumes
docker volume ls

# Inspect service
docker-compose exec api env

# Execute command in container
docker-compose exec api sh

# Copy files from container
docker cp contractsafe-api:/app/logs ./logs

# View container IP addresses
docker-compose exec api hostname -i
```

## Network Configuration

All services run on the `contractsafe` bridge network. Services can communicate using service names:

- API can reach PostgreSQL at: `postgres:5432`
- API can reach Redis at: `redis:6379`
- Frontend can reach API at: `api:8080` (internal) or `localhost:8080` (from host)

## Volume Management

### Persistent Data

- `postgres_data`: PostgreSQL database files
- `redis_data`: Redis persistence files

### Backup Volumes

```bash
# Backup PostgreSQL volume
docker run --rm -v contractsafe_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres-backup.tar.gz /data

# Restore PostgreSQL volume
docker run --rm -v contractsafe_postgres_data:/data -v $(pwd):/backup alpine tar xzf /backup/postgres-backup.tar.gz -C /
```

## Next Steps

1. Start core services: `docker-compose up -d`
2. Deploy smart contracts to testnet
3. Update `.env` with contract addresses
4. Test webhook endpoint
5. Start frontend: `docker-compose --profile frontend up -d`
6. Access application at http://localhost:5173

## Support

For issues or questions:

- Check logs: `docker-compose logs -f`
- Review API README: `api/README.md`
- Check contract deployment: `contract/DEPLOYMENT.md`
