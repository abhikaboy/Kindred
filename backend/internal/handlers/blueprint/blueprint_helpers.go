package Blueprint

import (
	"context"
	"encoding/json"
	"fmt"
	"reflect"

	"github.com/abhikaboy/Kindred/internal/handlers/types"
)

// GeneratedBlueprintData matches the structure returned by Genkit flow
type GeneratedBlueprintData struct {
	Name        string                   `json:"name"`
	Description string                   `json:"description"`
	Banner      string                   `json:"banner"`
	Tags        []string                 `json:"tags"`
	Duration    string                   `json:"duration"`
	Category    string                   `json:"category"`
	Categories  []types.CategoryDocument `json:"categories"`
}

// callGeminiGenerateBlueprintFlow uses reflection to call the Genkit flow without circular import
func (h *Handler) callGeminiGenerateBlueprintFlow(ctx context.Context, userID, description string) (*GeneratedBlueprintData, error) {
	if h.geminiService == nil {
		return nil, fmt.Errorf("gemini service not available")
	}

	// Use reflection to access the flow
	svcValue := reflect.ValueOf(h.geminiService)
	flowField := svcValue.Elem().FieldByName("GenerateBlueprintFlow")
	if !flowField.IsValid() {
		return nil, fmt.Errorf("gemini blueprint flow not configured")
	}

	// Get the Run method
	runMethod := flowField.MethodByName("Run")
	if !runMethod.IsValid() {
		return nil, fmt.Errorf("gemini blueprint flow Run method not available")
	}

	// Create input value with the correct type
	inputType := runMethod.Type().In(1)
	inputValue := reflect.New(inputType).Elem()
	inputValue.FieldByName("UserID").SetString(userID)
	inputValue.FieldByName("Description").SetString(description)

	// Call the Run method
	callResults := runMethod.Call([]reflect.Value{
		reflect.ValueOf(ctx),
		inputValue,
	})

	if len(callResults) != 2 {
		return nil, fmt.Errorf("unexpected gemini flow response structure")
	}

	// Check for error
	if !callResults[1].IsNil() {
		return nil, callResults[1].Interface().(error)
	}

	// Extract the blueprint from the response
	// The result is GenerateBlueprintOutput which has a Blueprint field
	resultValue := callResults[0]
	blueprintField := resultValue.FieldByName("Blueprint")
	if !blueprintField.IsValid() {
		return nil, fmt.Errorf("invalid blueprint response structure")
	}

	// Convert the blueprint to our response type
	var response GeneratedBlueprintData
	blueprintBytes, err := json.Marshal(blueprintField.Interface())
	if err != nil {
		return nil, fmt.Errorf("failed to parse AI blueprint response: %w", err)
	}

	if err := json.Unmarshal(blueprintBytes, &response); err != nil {
		return nil, fmt.Errorf("failed to parse AI blueprint response structure: %w", err)
	}

	return &response, nil
}
