package gemini

import (
	"context"

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

	// Initialize flows with tools
	flows := InitFlows(g, tools)

	return &GeminiService{
		Genkit:                           g,
		TaskFlow:                         flows.TaskFlow,
		TaskFromImageFlow:                flows.TaskFromImageFlow,
		MultiTaskFromTextFlow:            flows.MultiTaskFromTextFlow,
		MultiTaskFromTextFlowWithContext: flows.MultiTaskFromTextFlowWithContext,
		AnalyticsReportFlow:              flows.AnalyticsReportFlow,
		GenerateBlueprintFlow:            flows.GenerateBlueprintFlow,
		Tools:                            tools,
	}
}
