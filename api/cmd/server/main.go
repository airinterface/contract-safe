package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/contractsafe/api/internal/blockchain"
	"github.com/contractsafe/api/internal/database"
	"github.com/contractsafe/api/internal/orchestrator"
	"github.com/contractsafe/api/internal/queue"
	"github.com/contractsafe/api/internal/webhook"
	"github.com/gorilla/mux"
	"github.com/joho/godotenv"
)

func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	// Initialize database
	db, err := database.NewPostgresDB(os.Getenv("DATABASE_URL"))
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	// Run migrations
	if err := database.RunMigrations(db); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}

	// Initialize Redis client
	redisClient := queue.NewRedisClient(
		os.Getenv("REDIS_URL"),
	)
	defer redisClient.Close()

	// Initialize blockchain client
	blockchainClient, err := blockchain.NewClient(
		os.Getenv("POLYGON_RPC_URL"),
		os.Getenv("ESCROW_CONTRACT_ADDRESS"),
	)
	if err != nil {
		log.Fatalf("Failed to initialize blockchain client: %v", err)
	}

	// Initialize job queue
	jobQueue := queue.NewJobQueue(redisClient)

	// Initialize orchestrator
	orch := orchestrator.NewOrchestrator(db, jobQueue, blockchainClient)

	// Initialize webhook handler
	webhookHandler := webhook.NewHandler(orch, os.Getenv("GOLDSKY_WEBHOOK_SECRET"))

	// Set up HTTP router
	router := mux.NewRouter()
	router.HandleFunc("/health", healthCheckHandler).Methods("GET")
	router.HandleFunc("/webhooks/goldsky", webhookHandler.HandleWebhook).Methods("POST")

	// Configure server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	server := &http.Server{
		Addr:         fmt.Sprintf(":%s", port),
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Start server in goroutine
	go func() {
		log.Printf("Starting server on port %s", port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server failed: %v", err)
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")

	// Graceful shutdown
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	log.Println("Server exited")
}

func healthCheckHandler(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	w.Write([]byte("OK"))
}
