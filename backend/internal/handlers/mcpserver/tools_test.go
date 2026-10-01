package mcpserver

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/abhikaboy/Kindred/internal/handlers/auth"
	category "github.com/abhikaboy/Kindred/internal/handlers/category"
	"github.com/abhikaboy/Kindred/internal/handlers/oauth"
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
	tokenID primitive.ObjectID
}

func TestTools(t *testing.T) {
	suite.Run(t, new(ToolsTestSuite))
}

func (s *ToolsTestSuite) SetupTest() {
	s.BaseSuite.SetupTest()
	s.service = NewTokenService(s.Collections)
	s.userID = s.GetUser(0).ID
	raw, doc, err := s.service.Create(s.Ctx, s.userID, "Claude", TokenOptions{})
	s.Require().NoError(err)
	s.token, s.tokenID = raw, doc.ID

	h := NewHandler(s.Collections, rings.NewRingServiceFromCollections(s.Collections), s.service, nil)
	s.srv = httptest.NewServer(h)
	s.session = connectClient(s.T(), s.srv.URL, s.token)
}

// connectWith opens a session for a fresh token with the given scopes and limits.
func (s *ToolsTestSuite) connectWith(scopes []string, l limits) (*mcp.ClientSession, primitive.ObjectID) {
	raw, doc, err := s.service.Create(s.Ctx, s.userID, "Scoped", TokenOptions{Scopes: scopes})
	s.Require().NoError(err)
	t := newTools(s.Collections, rings.NewRingServiceFromCollections(s.Collections), l)
	srv := httptest.NewServer(newHandler(t, s.service, nil, s.Collections["users"], l))
	s.T().Cleanup(srv.Close)
	return connectClient(s.T(), srv.URL, raw), doc.ID
}

func callOn(session *mcp.ClientSession, name string, args map[string]any) (*mcp.CallToolResult, error) {
	return session.CallTool(context.Background(), &mcp.CallToolParams{Name: name, Arguments: args})
}

func (s *ToolsTestSuite) newCategory(ws, name string) categorySummary {
	var cat categorySummary
	s.call("create_workspace", map[string]any{"name": ws}, &createWorkspaceOutput{})
	s.call("create_category", map[string]any{"name": name, "workspace": ws}, &cat)
	return cat
}

func (s *ToolsTestSuite) auditEntries(filter bson.M) []AuditEntry {
	cursor, err := NewAuditLog(s.Collections).coll.Find(s.Ctx, filter)
	s.Require().NoError(err)
	var out []AuditEntry
	s.Require().NoError(cursor.All(s.Ctx, &out))
	return out
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
	Mount(app, s.Collections, nil, s.service, nil)

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

func (s *ToolsTestSuite) TestOriginStampedAndSurvivesCompletion() {
	cat := s.newCategory("Errands", "Groceries")
	var created createTaskOutput
	s.call("create_task", map[string]any{"category_id": cat.ID, "content": "Buy milk"}, &created)
	taskID, err := primitive.ObjectIDFromHex(created.Task.ID)
	s.Require().NoError(err)
	catID, err := primitive.ObjectIDFromHex(cat.ID)
	s.Require().NoError(err)

	var stored category.CategoryDocument
	s.FindOne("categories", bson.M{"_id": catID}, &stored)
	s.Require().Len(stored.Tasks, 1)
	origin := stored.Tasks[0].Origin
	s.Require().NotNil(origin)
	s.Equal("mcp", origin.Kind)
	s.Equal(s.tokenID, origin.ConnectionID)
	s.Equal("Claude", origin.ClientName)
	s.False(origin.At.IsZero())

	s.call("complete_task", map[string]any{"task_id": created.Task.ID}, &completeTaskOutput{})
	var done task.TaskDocument
	s.FindOne("completed-tasks", bson.M{"_id": taskID}, &done)
	s.Require().NotNil(done.Origin, "origin is copied into the completed record")
	s.Equal(s.tokenID, done.Origin.ConnectionID)
}

func (s *ToolsTestSuite) TestTasksArePrivateByDefault() {
	cat := s.newCategory("Errands", "Groceries")
	catID, err := primitive.ObjectIDFromHex(cat.ID)
	s.Require().NoError(err)
	s.call("create_task", map[string]any{"category_id": cat.ID, "content": "Quiet"}, &createTaskOutput{})
	s.call("create_task", map[string]any{"category_id": cat.ID, "content": "Shared", "public": true}, &createTaskOutput{})

	var stored category.CategoryDocument
	s.FindOne("categories", bson.M{"_id": catID}, &stored)
	s.Require().Len(stored.Tasks, 2)
	public := map[string]bool{}
	for _, tk := range stored.Tasks {
		public[tk.Content] = tk.Public
	}
	s.False(public["Quiet"])
	s.True(public["Shared"])
}

func (s *ToolsTestSuite) TestAuditEntriesForWrites() {
	cat := s.newCategory("Errands", "Groceries")
	var created createTaskOutput
	s.call("create_task", map[string]any{"category_id": cat.ID, "content": "Buy milk"}, &created)
	s.call("create_task", map[string]any{"category_id": primitive.NewObjectID().Hex(), "content": "Ghost"}, nil)
	s.call("complete_task", map[string]any{"task_id": created.Task.ID}, &completeTaskOutput{})
	s.call("list_tasks", map[string]any{}, &listTasksOutput{})

	entries := s.auditEntries(bson.M{"connection_id": s.tokenID})
	s.Require().Len(entries, 5, "workspace, category, two task creates and one completion; reads are not audited")
	byTool := map[string][]AuditEntry{}
	for _, e := range entries {
		s.Equal(s.userID, e.UserID)
		s.Equal("pat", e.Kind)
		s.Equal("Claude", e.ClientName)
		s.False(e.CreatedAt.IsZero())
		byTool[e.Tool] = append(byTool[e.Tool], e)
	}
	s.Require().Len(byTool["create_task"], 2)
	var ok, failed AuditEntry
	for _, e := range byTool["create_task"] {
		if e.OK {
			ok = e
		} else {
			failed = e
		}
	}
	s.Equal(`Created task "Buy milk" in Groceries`, ok.Summary)
	s.Equal(created.Task.ID, ok.TargetIDs[0].Hex())
	s.Contains(failed.Summary, `Failed to create task "Ghost"`)
	s.Contains(failed.Error, "category not found")

	s.Require().Len(byTool["complete_task"], 1)
	s.True(byTool["complete_task"][0].OK)
	s.Equal(`Completed task "Buy milk" in Groceries`, byTool["complete_task"][0].Summary)
	s.Equal(`Created workspace "Errands"`, byTool["create_workspace"][0].Summary)
	s.Equal(`Created category "Groceries" in Errands`, byTool["create_category"][0].Summary)
}

func (s *ToolsTestSuite) TestScopedTokenSeesAndCallsOnlyGrantedTools() {
	cat := s.newCategory("Errands", "Groceries")
	var created createTaskOutput
	s.call("create_task", map[string]any{"category_id": cat.ID, "content": "Buy milk"}, &created)

	session, connID := s.connectWith([]string{oauth.ScopeRead}, defaultLimits)
	s.Equal([]string{"list_categories", "list_tasks", "list_workspaces"}, toolNames(s.T(), session))

	res, err := callOn(session, "list_tasks", map[string]any{})
	s.Require().NoError(err)
	s.False(res.IsError)

	res, err = callOn(session, "complete_task", map[string]any{"task_id": created.Task.ID})
	s.True(err != nil || res.IsError, "unlisted tools cannot be called")
	s.Equal(int64(1), s.CountDocuments("categories", bson.M{"tasks._id": mustID(s, created.Task.ID)}), "task is still open")
	s.Empty(s.auditEntries(bson.M{"connection_id": connID}))
}

func mustID(s *ToolsTestSuite, hex string) primitive.ObjectID {
	id, err := primitive.ObjectIDFromHex(hex)
	s.Require().NoError(err)
	return id
}

func (s *ToolsTestSuite) TestDailyCaps() {
	session, connID := s.connectWith(oauth.AllScopes(), limits{requestsPerMinute: 1000, dailyCreates: 3, dailyCompletes: 1})
	for _, call := range []struct {
		tool string
		args map[string]any
	}{
		{"create_workspace", map[string]any{"name": "Capped"}},
		{"create_category", map[string]any{"name": "One", "workspace": "Capped"}},
	} {
		res, err := callOn(session, call.tool, call.args)
		s.Require().NoError(err)
		s.Require().False(res.IsError, toolText(res))
	}
	var cats listCategoriesOutput
	s.call("list_categories", map[string]any{"workspace": "Capped"}, &cats)
	s.Require().Len(cats.Categories, 1)
	catID := cats.Categories[0].ID

	res, err := callOn(session, "create_task", map[string]any{"category_id": catID, "content": "First"})
	s.Require().NoError(err)
	s.Require().False(res.IsError, toolText(res))

	res, err = callOn(session, "create_task", map[string]any{"category_id": catID, "content": "Fourth"})
	s.Require().NoError(err)
	s.True(res.IsError)
	s.Contains(toolText(res), "daily limit reached")

	var tasks listTasksOutput
	s.call("list_tasks", map[string]any{"category_id": catID}, &tasks)
	s.Require().Len(tasks.Tasks, 1)

	res, err = callOn(session, "complete_task", map[string]any{"task_id": tasks.Tasks[0].ID})
	s.Require().NoError(err)
	s.Require().False(res.IsError, toolText(res))

	s.call("create_task", map[string]any{"category_id": catID, "content": "Via main token"}, &createTaskOutput{})
	s.call("list_tasks", map[string]any{"category_id": catID}, &tasks)
	res, err = callOn(session, "complete_task", map[string]any{"task_id": tasks.Tasks[0].ID})
	s.Require().NoError(err)
	s.True(res.IsError)
	s.Contains(toolText(res), "daily limit reached")

	s.call("complete_task", map[string]any{"task_id": tasks.Tasks[0].ID}, &completeTaskOutput{})
	failed := s.auditEntries(bson.M{"connection_id": connID, "ok": false})
	s.Len(failed, 2, "capped calls are audited as failures")
}

func (s *ToolsTestSuite) TestActivityEndpointScopedToCaller() {
	cat := s.newCategory("Errands", "Groceries")
	s.call("create_task", map[string]any{"category_id": cat.ID, "content": "Buy milk"}, &createTaskOutput{})

	audit := NewAuditLog(s.Collections)
	other := s.GetUser(1).ID
	s.Require().NoError(audit.Record(s.Ctx, &oauth.Principal{UserID: other, ConnectionID: s.tokenID, Kind: "pat"}, "create_task", nil, "Theirs", nil))

	h := &activityHandler{audit: audit}
	ctx := context.WithValue(s.Ctx, auth.UserIDContextKey, s.userID.Hex())
	out, err := h.List(ctx, &ListActivityInput{})
	s.Require().NoError(err)
	s.Require().Len(out.Body, 3)
	s.Equal("create_task", out.Body[0].Tool, "newest first")
	s.Equal(`Created task "Buy milk" in Groceries`, out.Body[0].Summary)
	s.True(out.Body[0].OK)
	s.NotEmpty(out.Body[0].TargetID)
	for _, item := range out.Body {
		s.NotEqual("Theirs", item.Summary, "other users' activity is never returned")
	}

	out, err = h.List(ctx, &ListActivityInput{ConnectionID: s.tokenID.Hex(), Limit: 1})
	s.Require().NoError(err)
	s.Len(out.Body, 1)

	out, err = h.List(ctx, &ListActivityInput{ConnectionID: primitive.NewObjectID().Hex()})
	s.Require().NoError(err)
	s.Empty(out.Body)

	_, err = h.List(ctx, &ListActivityInput{ConnectionID: "nope"})
	s.Error(err)
	_, err = h.List(s.Ctx, &ListActivityInput{})
	s.Error(err, "requires an authenticated caller")
}
