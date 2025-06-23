package health

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
)

/*
Handler to execute business logic for Health Endpoint
*/
type Handler struct {
	service *Service
}

// HealthInput represents the input for the health check endpoint
type HealthInput struct{}

// HealthOutput represents the output for the health check endpoint  
type HealthOutput struct {
	Body struct {
		Status string `json:"status" example:"ok"`
	}
}

func (h *Handler) GetHealth(ctx context.Context, input *HealthInput) (*HealthOutput, error) {
	resp := &HealthOutput{}
	resp.Body.Status = "ok"
	return resp, nil
}

// RegisterHealthOperation registers the health check operation with Huma
func RegisterHealthOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "get-health",
		Method:      http.MethodGet,
		Path:        "/v1/health/",
		Summary:     "Health check endpoint",
		Description: "Returns the health status of the API",
		Tags:        []string{"health"},
	}, handler.GetHealth)
}
