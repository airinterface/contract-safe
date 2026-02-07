package webhook

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"github.com/contractsafe/api/internal/orchestrator"
)

// Handler handles webhook requests from Goldsky
type Handler struct {
	orchestrator *orchestrator.Orchestrator
	secret       string
}

// NewHandler creates a new webhook handler
func NewHandler(orch *orchestrator.Orchestrator, secret string) *Handler {
	return &Handler{
		orchestrator: orch,
		secret:       secret,
	}
}

// HandleWebhook handles incoming webhook requests
func (h *Handler) HandleWebhook(w http.ResponseWriter, r *http.Request) {
	// Read body
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Failed to read request body", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	// Validate signature if secret is configured
	if h.secret != "" {
		signature := r.Header.Get("X-Goldsky-Signature")
		if !h.validateSignature(body, signature) {
			http.Error(w, "Invalid signature", http.StatusUnauthorized)
			return
		}
	}

	// Parse webhook payload
	var payload WebhookPayload
	if err := json.Unmarshal(body, &payload); err != nil {
		http.Error(w, "Invalid JSON payload", http.StatusBadRequest)
		return
	}

	// Convert to internal event format
	event := &orchestrator.Event{
		Hash:            orchestrator.ComputeEventHash(payload.EventType, payload.TaskID, payload.BlockNumber, payload.TransactionHash),
		Type:            payload.EventType,
		TaskID:          payload.TaskID,
		BlockNumber:     payload.BlockNumber,
		TransactionHash: payload.TransactionHash,
		Payload:         payload.Data,
	}

	// Process event
	if err := h.orchestrator.ProcessEvent(r.Context(), event); err != nil {
		fmt.Printf("Error processing event: %v\n", err)
		http.Error(w, "Failed to process event", http.StatusInternalServerError)
		return
	}

	// Return success
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"status":"ok"}`))
}

// validateSignature validates the webhook signature
func (h *Handler) validateSignature(body []byte, signature string) bool {
	mac := hmac.New(sha256.New, []byte(h.secret))
	mac.Write(body)
	expectedSignature := "sha256=" + hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(signature), []byte(expectedSignature))
}

// WebhookPayload represents the incoming webhook payload from Goldsky
type WebhookPayload struct {
	EventType       string                 `json:"eventType"`
	TaskID          int64                  `json:"taskId"`
	BlockNumber     int64                  `json:"blockNumber"`
	TransactionHash string                 `json:"transactionHash"`
	Data            map[string]interface{} `json:"data"`
}
