package mcpserver

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/auth"
	category "github.com/abhikaboy/Kindred/internal/handlers/category"
	"github.com/abhikaboy/Kindred/internal/handlers/rings"
	"github.com/abhikaboy/Kindred/internal/handlers/task"
	"github.com/abhikaboy/Kindred/xutils"
	"github.com/modelcontextprotocol/go-sdk/mcp"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// proxyCategoryName is the placeholder category the app uses to materialize an empty workspace.
const proxyCategoryName = "!-proxy-!"

const (
	defaultTaskLimit = 100
	maxTaskLimit     = 500
	maxCompleted     = 100
)

var hexColor = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)

// tools holds the services the MCP tools call. Writes go through the task handler so side effects match the app.
type tools struct {
	taskHandler *task.Handler
	taskService *task.Service
	categories  *category.Service
}

func newTools(collections map[string]*mongo.Collection, ringService *rings.RingService) *tools {
	if collections["workspaces"] == nil && collections["categories"] != nil {
		collections["workspaces"] = collections["categories"].Database().Collection("workspaces")
	}
	return &tools{
		taskHandler: task.NewStreamHandler(collections, nil, ringService),
		taskService: task.NewService(collections),
		categories:  category.NewService(collections),
	}
}

func (t *tools) register(s *mcp.Server) {
	readOnly := &mcp.ToolAnnotations{ReadOnlyHint: true}
	mcp.AddTool(s, &mcp.Tool{
		Name:        "list_workspaces",
		Title:       "List workspaces",
		Description: "List the user's workspaces with the categories inside each one, including category ids and open task counts.",
		Annotations: readOnly,
	}, t.listWorkspaces)
	mcp.AddTool(s, &mcp.Tool{
		Name:        "list_categories",
		Title:       "List categories",
		Description: "List the user's categories, optionally limited to one workspace. Use the returned id as category_id for other tools.",
		Annotations: readOnly,
	}, t.listCategories)
	mcp.AddTool(s, &mcp.Tool{
		Name:        "list_tasks",
		Title:       "List tasks",
		Description: "List the user's open tasks, optionally filtered by workspace, category or deadline window. Set include_completed to also get recently completed tasks.",
		Annotations: readOnly,
	}, t.listTasks)
	mcp.AddTool(s, &mcp.Tool{
		Name:        "create_workspace",
		Title:       "Create workspace",
		Description: "Create a new, empty workspace. Add categories to it with create_category before creating tasks.",
	}, t.createWorkspace)
	mcp.AddTool(s, &mcp.Tool{
		Name:        "create_category",
		Title:       "Create category",
		Description: "Create a category inside an existing workspace. Returns the new category id.",
	}, t.createCategory)
	mcp.AddTool(s, &mcp.Tool{
		Name:        "create_task",
		Title:       "Create task",
		Description: "Create a task in a category. Behaves like creating a task in the Kindred app, including ring progress.",
	}, t.createTask)
	mcp.AddTool(s, &mcp.Tool{
		Name:        "complete_task",
		Title:       "Complete task",
		Description: "Mark an open task as complete. This moves it to the user's completed history and updates their streak and rings, exactly as the app does. It cannot be undone through this server.",
	}, t.completeTask)
}

// Tool inputs and outputs.

type listWorkspacesInput struct{}

type workspaceSummary struct {
	Name       string            `json:"name"`
	Color      string            `json:"color,omitempty"`
	Categories []categorySummary `json:"categories"`
}

type categorySummary struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Workspace string `json:"workspace"`
	OpenTasks int    `json:"open_tasks"`
	Inbox     bool   `json:"inbox,omitempty"`
}

type listWorkspacesOutput struct {
	Workspaces []workspaceSummary `json:"workspaces"`
}

type listCategoriesInput struct {
	Workspace string `json:"workspace,omitempty" jsonschema:"Only list categories in the workspace with this exact name"`
}

type listCategoriesOutput struct {
	Categories []categorySummary `json:"categories"`
}

type listTasksInput struct {
	Workspace        string `json:"workspace,omitempty" jsonschema:"Only include tasks in the workspace with this exact name"`
	CategoryID       string `json:"category_id,omitempty" jsonschema:"Only include tasks in this category id"`
	IncludeCompleted bool   `json:"include_completed,omitempty" jsonschema:"Also return up to 100 of the most recently completed tasks"`
	DueAfter         string `json:"due_after,omitempty" jsonschema:"Only tasks with a deadline at or after this time. RFC 3339 or YYYY-MM-DD in the user's timezone"`
	DueBefore        string `json:"due_before,omitempty" jsonschema:"Only tasks with a deadline at or before this time. A bare date includes that whole day"`
	Limit            int    `json:"limit,omitempty" jsonschema:"Maximum open tasks to return, default 100, max 500"`
}

type taskSummary struct {
	ID          string  `json:"id"`
	Content     string  `json:"content"`
	CategoryID  string  `json:"category_id"`
	Category    string  `json:"category,omitempty"`
	Workspace   string  `json:"workspace,omitempty"`
	Priority    int     `json:"priority" jsonschema:"1 low, 2 medium, 3 high"`
	Difficulty  float64 `json:"difficulty" jsonschema:"1 to 10"`
	StartDate   string  `json:"start_date,omitempty"`
	Deadline    string  `json:"deadline,omitempty"`
	Notes       string  `json:"notes,omitempty"`
	Recurring   bool    `json:"recurring,omitempty"`
	Someday     bool    `json:"someday,omitempty"`
	InProgress  bool    `json:"in_progress,omitempty"`
	Completed   bool    `json:"completed"`
	CompletedAt string  `json:"completed_at,omitempty"`
}

type listTasksOutput struct {
	Tasks     []taskSummary `json:"tasks"`
	Completed []taskSummary `json:"completed,omitempty"`
	Truncated bool          `json:"truncated,omitempty" jsonschema:"True when more open tasks matched than limit allowed"`
	Timezone  string        `json:"timezone"`
}

type createWorkspaceInput struct {
	Name  string `json:"name" jsonschema:"Workspace name, for example Personal or School"`
	Color string `json:"color,omitempty" jsonschema:"Optional hex color such as #6C5CE7"`
}

type createWorkspaceOutput struct {
	Name string `json:"name"`
}

type createCategoryInput struct {
	Name      string `json:"name" jsonschema:"Category name"`
	Workspace string `json:"workspace" jsonschema:"Name of an existing workspace to add the category to"`
}

type createTaskInput struct {
	CategoryID string  `json:"category_id" jsonschema:"Id of the category to put the task in, from list_categories"`
	Content    string  `json:"content" jsonschema:"The task title"`
	Priority   int     `json:"priority,omitempty" jsonschema:"1 low, 2 medium, 3 high. Defaults to 1"`
	Difficulty float64 `json:"difficulty,omitempty" jsonschema:"How much effort the task takes, 1 to 10. Defaults to 1"`
	StartDate  string  `json:"start_date,omitempty" jsonschema:"When to start. YYYY-MM-DD for a day, or a date and time. Defaults to today"`
	Deadline   string  `json:"deadline,omitempty" jsonschema:"When it is due. YYYY-MM-DD means the end of that day, or give a date and time"`
	Notes      string  `json:"notes,omitempty" jsonschema:"Optional free text notes"`
	Someday    bool    `json:"someday,omitempty" jsonschema:"Create as an undated Someday task. Start date and deadline are ignored"`
	Public     *bool   `json:"public,omitempty" jsonschema:"Whether friends can see the task. Defaults to true, like the app"`
}

type createTaskOutput struct {
	Task taskSummary `json:"task"`
}

type completeTaskInput struct {
	TaskID     string `json:"task_id" jsonschema:"Id of the open task to complete"`
	CategoryID string `json:"category_id,omitempty" jsonschema:"Optional category id of the task, used as a consistency check"`
}

type completeTaskOutput struct {
	Task          taskSummary `json:"task"`
	CurrentStreak int         `json:"current_streak"`
	StreakChanged bool        `json:"streak_changed"`
	TasksComplete float64     `json:"tasks_complete"`
	NextTask      *taskSummary `json:"next_task,omitempty" jsonschema:"For flexible recurring tasks, the next instance that was created"`
}

// Handlers.

func (t *tools) listWorkspaces(ctx context.Context, req *mcp.CallToolRequest, _ listWorkspacesInput) (*mcp.CallToolResult, listWorkspacesOutput, error) {
	c, err := callerFrom(req)
	if err != nil {
		return nil, listWorkspacesOutput{}, err
	}
	ws, err := t.loadWorkspaces(c)
	if err != nil {
		return nil, listWorkspacesOutput{}, err
	}
	out := listWorkspacesOutput{Workspaces: make([]workspaceSummary, 0, len(ws))}
	for _, w := range ws {
		out.Workspaces = append(out.Workspaces, workspaceSummary{Name: w.name, Color: w.color, Categories: w.summaries()})
	}
	return nil, out, nil
}

func (t *tools) listCategories(ctx context.Context, req *mcp.CallToolRequest, in listCategoriesInput) (*mcp.CallToolResult, listCategoriesOutput, error) {
	c, err := callerFrom(req)
	if err != nil {
		return nil, listCategoriesOutput{}, err
	}
	ws, err := t.loadWorkspaces(c)
	if err != nil {
		return nil, listCategoriesOutput{}, err
	}
	out := listCategoriesOutput{Categories: []categorySummary{}}
	name := strings.TrimSpace(in.Workspace)
	if name != "" {
		w := findWorkspace(ws, name)
		if w == nil {
			return nil, out, fmt.Errorf("workspace %q not found", name)
		}
		ws = []workspace{*w}
	}
	for _, w := range ws {
		out.Categories = append(out.Categories, w.summaries()...)
	}
	return nil, out, nil
}

func (t *tools) listTasks(ctx context.Context, req *mcp.CallToolRequest, in listTasksInput) (*mcp.CallToolResult, listTasksOutput, error) {
	c, err := callerFrom(req)
	if err != nil {
		return nil, listTasksOutput{}, err
	}
	out := listTasksOutput{Tasks: []taskSummary{}, Timezone: c.timezone}

	after, err := parseBound(in.DueAfter, c.loc, false)
	if err != nil {
		return nil, out, fmt.Errorf("due_after: %w", err)
	}
	before, err := parseBound(in.DueBefore, c.loc, true)
	if err != nil {
		return nil, out, fmt.Errorf("due_before: %w", err)
	}
	limit := in.Limit
	if limit <= 0 {
		limit = defaultTaskLimit
	}
	limit = min(limit, maxTaskLimit)

	ws, err := t.loadWorkspaces(c)
	if err != nil {
		return nil, out, err
	}
	scope, err := selectCategories(ws, in.Workspace, in.CategoryID)
	if err != nil {
		return nil, out, err
	}
	inWindow := func(d *time.Time) bool {
		if after == nil && before == nil {
			return true
		}
		if d == nil {
			return false
		}
		return (after == nil || !d.Before(*after)) && (before == nil || !d.After(*before))
	}

	for _, cat := range scope {
		for _, tk := range cat.doc.Tasks {
			if inWindow(tk.Deadline) {
				out.Tasks = append(out.Tasks, summarize(tk, cat, c.loc))
			}
		}
	}
	sortByDeadline(out.Tasks)
	if len(out.Tasks) > limit {
		out.Tasks, out.Truncated = out.Tasks[:limit], true
	}

	if in.IncludeCompleted {
		done, _, err := t.taskService.GetCompletedTasks(c.userID, 1, maxCompleted)
		if err != nil {
			return nil, out, errors.New("could not load completed tasks")
		}
		byID := make(map[primitive.ObjectID]categoryRef, len(scope))
		for _, cat := range scope {
			byID[cat.doc.ID] = cat
		}
		scoped := strings.TrimSpace(in.Workspace) != "" || strings.TrimSpace(in.CategoryID) != ""
		out.Completed = []taskSummary{}
		for _, tk := range done {
			cat, ok := byID[tk.CategoryID]
			if (scoped && !ok) || !inWindow(tk.Deadline) {
				continue
			}
			out.Completed = append(out.Completed, summarize(tk, cat, c.loc))
		}
	}
	return nil, out, nil
}

func (t *tools) createWorkspace(ctx context.Context, req *mcp.CallToolRequest, in createWorkspaceInput) (*mcp.CallToolResult, createWorkspaceOutput, error) {
	c, err := callerFrom(req)
	if err != nil {
		return nil, createWorkspaceOutput{}, err
	}
	name := strings.TrimSpace(in.Name)
	if name == "" {
		return nil, createWorkspaceOutput{}, errors.New("name is required")
	}
	color := strings.TrimSpace(in.Color)
	if color != "" && !hexColor.MatchString(color) {
		return nil, createWorkspaceOutput{}, errors.New("color must be a hex value like #6C5CE7")
	}
	ws, err := t.loadWorkspaces(c)
	if err != nil {
		return nil, createWorkspaceOutput{}, err
	}
	if w := findWorkspace(ws, name); w != nil {
		return nil, createWorkspaceOutput{}, fmt.Errorf("workspace %q already exists", w.name)
	}

	// Mirrors the app: an empty workspace is a placeholder category plus optional metadata.
	doc := category.CategoryDocument{
		ID:            primitive.NewObjectID(),
		Name:          proxyCategoryName,
		WorkspaceName: name,
		User:          c.userID,
		Tasks:         make([]task.TaskDocument, 0),
		LastEdited:    xutils.NowUTC(),
	}
	if _, err := t.categories.CreateCategory(&doc); err != nil {
		return nil, createWorkspaceOutput{}, errors.New("could not create workspace")
	}
	if color != "" {
		if err := t.categories.UpsertWorkspaceMeta(name, c.userID, nil, &color); err != nil {
			return nil, createWorkspaceOutput{}, errors.New("workspace created but its color could not be saved")
		}
	}
	return nil, createWorkspaceOutput{Name: name}, nil
}

func (t *tools) createCategory(ctx context.Context, req *mcp.CallToolRequest, in createCategoryInput) (*mcp.CallToolResult, categorySummary, error) {
	c, err := callerFrom(req)
	if err != nil {
		return nil, categorySummary{}, err
	}
	name, wsName := strings.TrimSpace(in.Name), strings.TrimSpace(in.Workspace)
	if name == "" || wsName == "" {
		return nil, categorySummary{}, errors.New("name and workspace are required")
	}
	if name == proxyCategoryName {
		return nil, categorySummary{}, errors.New("that category name is reserved")
	}
	ws, err := t.loadWorkspaces(c)
	if err != nil {
		return nil, categorySummary{}, err
	}
	w := findWorkspace(ws, wsName)
	if w == nil {
		return nil, categorySummary{}, fmt.Errorf("workspace %q not found; create it with create_workspace first", wsName)
	}
	for _, cat := range w.categories {
		if strings.EqualFold(cat.doc.Name, name) {
			return nil, categorySummary{}, fmt.Errorf("category %q already exists in %q with id %s", cat.doc.Name, w.name, cat.doc.ID.Hex())
		}
	}

	doc := category.CategoryDocument{
		ID:            primitive.NewObjectID(),
		Name:          name,
		WorkspaceName: w.name,
		User:          c.userID,
		Tasks:         make([]task.TaskDocument, 0),
		LastEdited:    xutils.NowUTC(),
	}
	if _, err := t.categories.CreateCategory(&doc); err != nil {
		return nil, categorySummary{}, errors.New("could not create category")
	}
	return nil, categorySummary{ID: doc.ID.Hex(), Name: doc.Name, Workspace: doc.WorkspaceName}, nil
}

func (t *tools) createTask(ctx context.Context, req *mcp.CallToolRequest, in createTaskInput) (*mcp.CallToolResult, createTaskOutput, error) {
	c, err := callerFrom(req)
	if err != nil {
		return nil, createTaskOutput{}, err
	}
	content := strings.TrimSpace(in.Content)
	if content == "" {
		return nil, createTaskOutput{}, errors.New("content is required")
	}
	priority := in.Priority
	if priority == 0 {
		priority = 1
	}
	if priority < 1 || priority > 3 {
		return nil, createTaskOutput{}, errors.New("priority must be 1, 2 or 3")
	}
	difficulty := in.Difficulty
	if difficulty == 0 {
		difficulty = 1
	}
	if difficulty < 1 || difficulty > 10 {
		return nil, createTaskOutput{}, errors.New("difficulty must be between 1 and 10")
	}
	start, startHasTime, err := parseWhen(in.StartDate, c.loc)
	if err != nil {
		return nil, createTaskOutput{}, fmt.Errorf("start_date: %w", err)
	}
	deadline, deadlineHasTime, err := parseWhen(in.Deadline, c.loc)
	if err != nil {
		return nil, createTaskOutput{}, fmt.Errorf("deadline: %w", err)
	}
	if deadline != nil && !deadlineHasTime {
		y, m, d := deadline.Date()
		eod := time.Date(y, m, d, 23, 59, 0, 0, c.loc)
		deadline = &eod
	}

	ws, err := t.loadWorkspaces(c)
	if err != nil {
		return nil, createTaskOutput{}, err
	}
	cat, err := findCategory(ws, in.CategoryID)
	if err != nil {
		return nil, createTaskOutput{}, err
	}
	if cat.doc.Name == proxyCategoryName {
		return nil, createTaskOutput{}, errors.New("that id is a workspace placeholder, not a category; create a category first")
	}

	public := true
	if in.Public != nil {
		public = *in.Public
	}
	params := task.CreateTaskParams{
		Priority:  priority,
		Content:   content,
		Value:     difficulty,
		Public:    public,
		Deadline:  deadline,
		StartDate: start,
		Notes:     strings.TrimSpace(in.Notes),
		Someday:   in.Someday,
	}
	if startHasTime {
		params.StartTime = start
	}

	res, err := t.taskHandler.CreateTask(c.context(ctx), &task.CreateTaskInput{Category: cat.doc.ID.Hex(), Body: params})
	if err != nil {
		return nil, createTaskOutput{}, fmt.Errorf("could not create task: %s", err.Error())
	}
	return nil, createTaskOutput{Task: summarize(res.Body.TaskDocument, cat, c.loc)}, nil
}

func (t *tools) completeTask(ctx context.Context, req *mcp.CallToolRequest, in completeTaskInput) (*mcp.CallToolResult, completeTaskOutput, error) {
	c, err := callerFrom(req)
	if err != nil {
		return nil, completeTaskOutput{}, err
	}
	taskID, err := primitive.ObjectIDFromHex(strings.TrimSpace(in.TaskID))
	if err != nil {
		return nil, completeTaskOutput{}, errors.New("task_id is not a valid id")
	}
	ws, err := t.loadWorkspaces(c)
	if err != nil {
		return nil, completeTaskOutput{}, err
	}
	tk, cat, ok := findTask(ws, taskID)
	if !ok {
		return nil, completeTaskOutput{}, errors.New("open task not found; it may already be complete")
	}
	if id := strings.TrimSpace(in.CategoryID); id != "" && id != cat.doc.ID.Hex() {
		return nil, completeTaskOutput{}, fmt.Errorf("task is in category %s, not %s", cat.doc.ID.Hex(), id)
	}

	res, err := t.taskHandler.CompleteTask(c.context(ctx), &task.CompleteTaskInput{
		ID:       taskID.Hex(),
		Category: cat.doc.ID.Hex(),
		Body:     task.CompleteTaskDocument{TimeCompleted: time.Now().UTC().Format(time.RFC3339), TimeTaken: "PT0S"},
	})
	if err != nil {
		return nil, completeTaskOutput{}, fmt.Errorf("could not complete task: %s", err.Error())
	}

	done := summarize(tk, cat, c.loc)
	done.Completed = true
	out := completeTaskOutput{
		Task:          done,
		CurrentStreak: res.Body.CurrentStreak,
		StreakChanged: res.Body.StreakChanged,
		TasksComplete: res.Body.TasksComplete,
	}
	if next := res.Body.NextFlexTask; next != nil {
		s := summarize(next.Task, cat, c.loc)
		out.NextTask = &s
	}
	return nil, out, nil
}

// context returns ctx carrying the same auth values the JWT middleware sets for Huma handlers.
func (c caller) context(ctx context.Context) context.Context {
	ctx = context.WithValue(ctx, auth.UserIDContextKey, c.userID.Hex())
	return context.WithValue(ctx, auth.TimezoneContextKey, c.timezone)
}
