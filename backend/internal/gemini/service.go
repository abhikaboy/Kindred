package gemini

import (
	"github.com/abhikaboy/Kindred/internal/handlers/task"
	"github.com/firebase/genkit/go/core"
	"github.com/firebase/genkit/go/genkit"
)

type GeminiService struct {
	Genkit                           *genkit.Genkit
	TaskFlow                         *core.Flow[GenerateTaskParams, *task.CreateTaskParams, struct{}]
	TaskFromImageFlow                *core.Flow[GenerateTaskFromImageParams, MultiTaskFromTextOutput, struct{}]
	MultiTaskFromTextFlow            *core.Flow[MultiTaskFromTextInput, MultiTaskFromTextOutput, struct{}]
	MultiTaskFromTextFlowWithContext *core.Flow[MultiTaskFromTextInputWithUser, MultiTaskFromTextOutput, struct{}]
	AnalyticsReportFlow              *core.Flow[AnalyticsReportInput, AnalyticsReportOutput, struct{}]
	GenerateBlueprintFlow            *core.Flow[GenerateBlueprintInput, GenerateBlueprintOutput, struct{}]
	QueryTasksFlow                   *core.Flow[QueryTasksFlowInput, TaskQueryFiltersOutput, struct{}]
	EditTasksFlow                    *core.Flow[EditTasksFlowInput, EditTasksFlowOutput, struct{}]
	IntentRouterFlow                 *core.Flow[IntentRouterInput, IntentRouterOutput, struct{}]
	SuggestTaskFieldsFlow            *core.Flow[SuggestTaskFieldsFlowInput, SuggestTaskFieldsFlowOutput, struct{}]
	PredictTasksFlow                 *core.Flow[PredictTasksFlowInput, PredictTasksFlowOutput, struct{}]
	EnrichTasksFlow                  *core.Flow[EnrichTasksFlowInput, EnrichTasksFlowOutput, struct{}]
	Tools                            *ToolSet
}
