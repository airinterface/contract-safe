package database

import (
	"database/sql"
	"fmt"

	_ "github.com/lib/pq"
)

// NewPostgresDB creates a new PostgreSQL database connection
func NewPostgresDB(connectionString string) (*sql.DB, error) {
	db, err := sql.Open("postgres", connectionString)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	// Test connection
	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	// Configure connection pool
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)

	return db, nil
}

// RunMigrations runs database migrations
func RunMigrations(db *sql.DB) error {
	migrations := []string{
		// Events table for deduplication
		`CREATE TABLE IF NOT EXISTS events (
			id SERIAL PRIMARY KEY,
			event_hash VARCHAR(66) UNIQUE NOT NULL,
			event_type VARCHAR(50) NOT NULL,
			task_id BIGINT NOT NULL,
			block_number BIGINT NOT NULL,
			transaction_hash VARCHAR(66) NOT NULL,
			processed_at TIMESTAMP NOT NULL DEFAULT NOW(),
			payload JSONB NOT NULL,
			created_at TIMESTAMP NOT NULL DEFAULT NOW()
		)`,
		// Index for fast lookups
		`CREATE INDEX IF NOT EXISTS idx_events_hash ON events(event_hash)`,
		`CREATE INDEX IF NOT EXISTS idx_events_task_id ON events(task_id)`,
		`CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type)`,
	}

	for _, migration := range migrations {
		if _, err := db.Exec(migration); err != nil {
			return fmt.Errorf("migration failed: %w", err)
		}
	}

	return nil
}
