package mcpserver

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	category "github.com/abhikaboy/Kindred/internal/handlers/category"
	"github.com/abhikaboy/Kindred/internal/handlers/rings"
	"github.com/abhikaboy/Kindred/internal/handlers/task"
	testpkg "github.com/abhikaboy/Kindred/internal/testing"
	"github.com/gofiber/fiber/v2"
	"github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/stretchr/testify/suite"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// ToolsTestSuite drives the tools end to end over HTTP with a real token and database.
type ToolsTestSuite struct {
	testpkg.BaseSuite
	service *TokenService
	srv     *httptest.Server
	session *mcp.ClientSession
	userID  primitive.ObjectID
	token   string
}

func TestTools(t *testing.T) {
	suite.Run(t, new(ToolsTestSuite))
}

func (s *ToolsTestSuite) SetupTest() {
	s.BaseSuite.SetupTest()
	s.service = NewTokenService(s.Collections)
	s.userID = s.GetUser(0).ID
	raw, _, err := s.service.Create(s.Ctx, s.userID, "Claude")
	s.Require().NoError(err)
	s.token = raw

	h := NewHandler(s.Collections, rings.NewRingServiceFromCollections(s.Collections), s.service)
	s.srv = httptest.NewServer(h)
	s.session = connectClient(s.T(), s.srv.URL, s.token)
}

func (s *ToolsTestSuite) TearDownTest() {
	if s.srv != nil {
		s.srv.Close()
	}
	s.BaseSuite.TearDownTest()
}

// call invokes a tool and decodes its structured output. It fails the test on tool errors unless wantErr is set.
func (s *ToolsTestSuite) call(name string, args map[string]any, out any) *mcp.CallToolResult {
	res, err := s.session.CallTool(context.Background(), &mcp.CallToolParams{Name: name, Arguments: args})
	s.Require().NoError(err)
	if out != nil {
		s.Require().False(res.IsError, "tool %s failed: %s", name, toolText(res))
		raw, err := json.Marshal(res.StructuredContent)
		s.Require().NoError(err)
		s.Require().NoError(json.Unmarshal(raw, out))
	}
	return res
}

func toolText(res *mcp.CallToolResult) string {
	var parts []string
	for _, c := range res.Content {
		if tc, ok := c.(*mcp.TextContent); ok {
			parts = append(parts, tc.Text)
		}
	}
	return strings.Join(parts, " ")
}

func (s *ToolsTestSuite) TestWorkspaceCategoryTaskLifecycle() {
	var ws createWorkspaceOutput
	s.call("create_workspace", map[string]any{"name": "Robotics Club", "color": "#6C5CE7"}, &ws)
	s.Equal("Robotics Club", ws.Name)

	dup := s.call("create_workspace", map[string]any{"name": "robotics club"}, nil)
	s.True(dup.IsError, "duplicate workspace names are rejected")

	var cat categorySummary
	s.call("create_category", map[string]any{"name": "Build", "workspace": "Robotics Club"}, &cat)
	s.Equal("Build", cat.Name)
	s.Equal("Robotics Club", cat.Workspace)

	var listed listWorkspacesOutput
	s.call("list_workspaces", map[string]any{}, &listed)
	var found *workspaceSummary
	for i := range listed.Workspaces {
		if listed.Workspaces[i].Name == "Robotics Club" {
			found = &listed.Workspaces[i]
		}
	}
	s.Require().NotNil(found)
	s.Equal("#6C5CE7", found.Color)
	s.Require().Len(found.Categories, 1, "placeholder category is hidden")
	s.Equal(cat.ID, found.Categories[0].ID)

	var cats listCategoriesOutput
	s.call("list_categories", map[string]any{"workspace": "Robotics Club"}, &cats)
	s.Require().Len(cats.Categories, 1)

	var created createTaskOutput
	s.call("create_task", map[string]any{
		"category_id": cat.ID,
		"content":     "Order servo motors",
		"priority":    2,
		"deadline":    "2030-01-15",
		"notes":       "Check the budget sheet",
	}, &created)
	s.Equal("Order servo motors", created.Task.Content)
	s.Equal(2, created.Task.Priority)
	s.Equal(1.0, created.Task.Difficulty)
	s.Equal(cat.ID, created.Task.CategoryID)
	s.Contains(created.Task.Deadline, "2030-01-15T23:59:00")
	s.NotEmpty(created.Task.StartDate, "start date defaults to today like the app")

	var tasks listTasksOutput
	s.call("list_tasks", map[string]any{"category_id": cat.ID}, &tasks)
	s.Require().Len(tasks.Tasks, 1)
	s.Equal(created.Task.ID, tasks.Tasks[0].ID)
	s.Equal("Build", tasks.Tasks[0].Category)
	s.Equal("Robotics Club", tasks.Tasks[0].Workspace)

	s.call("list_tasks", map[string]any{"workspace": "Robotics Club", "due_before": "2029-12-31"}, &tasks)
	s.Empty(tasks.Tasks, "deadline window excludes the task")

	var done completeTaskOutput
	s.call("complete_task", map[string]any{"task_id": created.Task.ID}, &done)
	s.True(done.Task.Completed)
	s.GreaterOrEqual(done.TasksComplete, 1.0)

	taskID, err := primitive.ObjectIDFromHex(created.Task.ID)
	s.Require().NoError(err)
	s.Equal(int64(1), s.CountDocuments("completed-tasks", bson.M{"_id": taskID}))

	s.call("list_tasks", map[string]any{"workspace": "Robotics Club", "include_completed": true}, &tasks)
	s.Empty(tasks.Tasks)
	s.Require().Len(tasks.Completed, 1)
	s.Equal(created.Task.ID, tasks.Completed[0].ID)
	s.True(tasks.Completed[0].Completed)

	again := s.call("complete_task", map[string]any{"task_id": created.Task.ID}, nil)
	s.True(again.IsError, "a completed task cannot be completed twice")
}

func (s *ToolsTestSuite) TestRejectsOtherUsersCategory() {
	other := category.CategoryDocument{
		ID:            primitive.NewObjectID(),
		Name:          "Private",
		WorkspaceName: "Theirs",
		User:          s.GetUser(1).ID,
		Tasks:         []task.TaskDocument{},
	}
	_, err := category.NewService(s.Collections).CreateCategory(&other)
	s.Require().NoError(err)

	res := s.call("create_task", map[string]any{"category_id": other.ID.Hex(), "content": "Sneaky"}, nil)
	s.True(res.IsError)
	s.Contains(toolText(res), "category not found")

	res = s.call("list_tasks", map[string]any{"category_id": other.ID.Hex()}, nil)
	s.True(res.IsError)

	res = s.call("create_category", map[string]any{"name": "Mine", "workspace": "Theirs"}, nil)
	s.True(res.IsError, "workspace names are scoped to the caller")
}

func (s *ToolsTestSuite) TestCreateTaskValidation() {
	var cat categorySummary
	s.call("create_workspace", map[string]any{"name": "Errands"}, &createWorkspaceOutput{})
	s.call("create_category", map[string]any{"name": "Groceries", "workspace": "Errands"}, &cat)

	for _, args := range []map[string]any{
		{"category_id": cat.ID, "content": "   "},
		{"category_id": cat.ID, "content": "Milk", "priority": 4},
		{"category_id": cat.ID, "content": "Milk", "difficulty": 11},
		{"category_id": cat.ID, "content": "Milk", "deadline": "tomorrow-ish"},
		{"category_id": "not-an-id", "content": "Milk"},
	} {
		res := s.call("create_task", args, nil)
		s.True(res.IsError, "expected error for %v", args)
	}
}

func (s *ToolsTestSuite) TestMountOnFiber() {
	app := fiber.New()
	Mount(app, s.Collections, nil, s.service)

	req := httptest.NewRequest(http.MethodPost, Path, strings.NewReader(`{"jsonrpc":"2.0","id":1,"method":"tools/list"}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json, text/event-stream")
	resp, err := app.Test(req, -1)
	s.Require().NoError(err)
	s.Equal(http.StatusUnauthorized, resp.StatusCode)
	s.Contains(resp.Header.Get("WWW-Authenticate"), "Bearer")

	req = httptest.NewRequest(http.MethodPost, Path, strings.NewReader(`{"jsonrpc":"2.0","id":1,"method":"tools/list"}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json, text/event-stream")
	req.Header.Set("Authorization", "Bearer "+s.token)
	resp, err = app.Test(req, -1)
	s.Require().NoError(err)
	s.Equal(http.StatusOK, resp.StatusCode)

	var body struct {
		Result struct {
			Tools []struct {
				Name string `json:"name"`
			} `json:"tools"`
		} `json:"result"`
	}
	s.Require().NoError(json.NewDecoder(resp.Body).Decode(&body))
	s.Len(body.Result.Tools, 7)
}
