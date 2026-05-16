package gemini

import (
	"context"

	Category "github.com/abhikaboy/Kindred/internal/handlers/category"
	"github.com/abhikaboy/Kindred/internal/unsplash"
	"github.com/firebase/genkit/go/genkit"
	"github.com/firebase/genkit/go/plugins/googlegenai"
	"go.mongodb.org/mongo-driver/mongo"
)

// InitGenkit initializes the Genkit service with all tools and flows
func InitGenkit(collections map[string]*mongo.Collection, unsplashClient *unsplash.Client) *GeminiService {
	// Initialize Genkit with the Google AI plugin
	g := genkit.Init(context.Background(),
		genkit.WithPlugins(&googlegenai.GoogleAI{}),
		genkit.WithDefaultModel("googleai/gemini-2.5-flash"),
	)

	// Initialize tools
	tools := InitTools(g, collections, unsplashClient)

	// Initialize category service for prompt injection
	categoryService := Category.NewService(collections)

	// Initialize flows with tools and category service
	flows := InitFlows(g, tools, categoryService)

	return &GeminiService{
		Genkit:                           g,
		TaskFlow:                         flows.TaskFlow,
		TaskFromImageFlow:                flows.TaskFromImageFlow,
		MultiTaskFromTextFlow:            flows.MultiTaskFromTextFlow,
		MultiTaskFromTextFlowWithContext: flows.MultiTaskFromTextFlowWithContext,
		AnalyticsReportFlow:              flows.AnalyticsReportFlow,
		GenerateBlueprintFlow:            flows.GenerateBlueprintFlow,
		QueryTasksFlow:                   flows.QueryTasksFlow,
		EditTasksFlow:                    flows.EditTasksFlow,
		IntentRouterFlow:                 flows.IntentRouterFlow,
		Tools:                            tools,
	}
}
