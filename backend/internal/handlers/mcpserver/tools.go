package mcpserver

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"regexp"
	"slices"
	"strings"
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/auth"
	category "github.com/abhikaboy/Kindred/internal/handlers/category"
	"github.com/abhikaboy/Kindred/internal/handlers/oauth"
	"github.com/abhikaboy/Kindred/internal/handlers/rings"
	"github.com/abhikaboy/Kindred/internal/handlers/task"
	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"github.com/abhikaboy/Kindred/xutils"
	"github.com/modelcontextprotocol/go-sdk/mcp"
	"go.mongodb.org/mongo-driver/bson"
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
	categoryDB  *mongo.Collection
	audit       *AuditLog
	limits      limits
}

func newTools(collections map[string]*mongo.Collection, ringService *rings.RingService, l limits) *tools {
	if collections["workspaces"] == nil && collections["categories"] != nil {
		collections["workspaces"] = collections["categories"].Database().Collection("workspaces")
	}
	return &tools{
		taskHandler: task.NewStreamHandler(collections, nil, ringService),
		taskService: task.NewService(collections),
		categories:  category.NewService(collections),
		categoryDB:  collections["categories"],
		audit:       NewAuditLog(collections),
		limits:      l,
	}
}

var (
	createTools   = []string{"create_workspace", "create_category", "create_task"}
	completeTools = []string{"complete_task"}
)

// register adds only the tools the granted scopes allow.
func (t *tools) register(s *mcp.Server, scopes []string) {
	if slices.Contains(scopes, oauth.ScopeRead) {
		readOnly := &mcp.ToolAnnotations{ReadOnlyHint: true}
		mcp.AddTool(s, &mcp.Tool{
			Name:        "list_workspaces",
			Title:       "List workspaces",
			Description: "List the user's workspaces with the categories inside each one, including category ids and open task counts.",
			Annotations: readOnly,
		}, readTool(t.listWorkspaces))
		mcp.AddTool(s, &mcp.Tool{
			Name:        "list_categories",
			Title:       "List categories",
			Description: "List the user's categories, optionally limited to one workspace. Use the returned id as category_id for other tools.",
			Annotations: readOnly,
		}, readTool(t.listCategories))
		mcp.AddTool(s, &mcp.Tool{
			Name:        "list_tasks",
			Title:       "List tasks",
			Description: "List the user's open tasks, optionally filtered by workspace, category or deadline window. Set include_completed to also get recently completed tasks.",
			Annotations: readOnly,
		}, readTool(t.listTasks))
	}
	if slices.Contains(scopes, oauth.ScopeWrite) {
		mcp.AddTool(s, &mcp.Tool{
			Name:        "create_workspace",
			Title:       "Create workspace",
			Description: "Create a new, empty workspace. Add categories to it with create_category before creating tasks.",
		}, auditedTool(t, "create_workspace", "create workspace", oauth.ScopeWrite, t.createWorkspace))
		mcp.AddTool(s, &mcp.Tool{
			Name:        "create_category",
			Title:       "Create category",
			Description: "Create a category inside an existing workspace. Returns the new category id.",
		}, auditedTool(t, "create_category", "create category", oauth.ScopeWrite, t.createCategory))
		mcp.AddTool(s, &mcp.Tool{
			Name:        "create_task",
			Title:       "Create task",
			Description: "Create a task in a category. Behaves like creating a task in the Kindred app, including ring progress. Tasks are private unless the user explicitly asks to share them with friends.",
		}, auditedTool(t, "create_task", "create task", oauth.ScopeWrite, t.createTask))
	}
	if slices.Contains(scopes, oauth.ScopeComplete) {
		mcp.AddTool(s, &mcp.Tool{
			Name:        "complete_task",
			Title:       "Complete task",
			Description: "Mark an open task as complete. Only use this when the user explicitly says the task is done. This moves it to the user's completed history and updates their streak and rings, exactly as the app does. It cannot be undone through this server.",
		}, auditedTool(t, "complete_task", "complete task", oauth.ScopeComplete, t.completeTask))
	}
}

// readTool enforces the read scope inside the handler, in case a tool is reached without being listed.
func readTool[In, Out any](fn func(context.Context, caller, In) (Out, error)) mcp.ToolHandlerFor[In, Out] {
	return func(ctx context.Context, req *mcp.CallToolRequest, in In) (*mcp.CallToolResult, Out, error) {
		var zero Out
		c, err := callerFrom(req)
		if err != nil {
			return nil, zero, err
		}
		if !c.can(oauth.ScopeRead) {
			return nil, zero, scopeError(oauth.ScopeRead)
		}
		out, err := fn(ctx, c, in)
		return nil, out, err
	}
}

// auditRecord is filled in by a write tool so the audit entry can describe what happened.
type auditRecord struct {
	subject string
	summary string
	targets []primitive.ObjectID
}

// auditedTool enforces scope and daily caps, then writes an mcp_audit entry whether the call succeeds or fails.
func auditedTool[In, Out any](t *tools, name, verb, scope string, fn func(context.Context, caller, In, *auditRecord) (Out, error)) mcp.ToolHandlerFor[In, Out] {
	return func(ctx context.Context, req *mcp.CallToolRequest, in In) (*mcp.CallToolResult, Out, error) {
		var zero Out
		c, err := callerFrom(req)
		if err != nil {
			return nil, zero, err
		}
		rec := &auditRecord{}
		var out Out
		err = t.guard(ctx, c, name, scope)
		if err == nil {
			out, err = fn(ctx, c, in, rec)
		}
		t.recordAudit(ctx, c, name, verb, rec, err)
		if err != nil {
			return nil, zero, err
		}
		return nil, out, nil
	}
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
	Public     *bool   `json:"public,omitempty" jsonschema:"Whether friends can see the task. Defaults to false (private). Set true only when the user explicitly asks to share it"`
}

type createTaskOutput struct {
	Task taskSummary `json:"task"`
}

type completeTaskInput struct {
	TaskID     string `json:"task_id" jsonschema:"Id of the open task to complete"`
	CategoryID string `json:"category_id,omitempty" jsonschema:"Optional category id of the task, used as a consistency check"`
}

type completeTaskOutput struct {
	Task          taskSummary  `json:"task"`
	CurrentStreak int          `json:"current_streak"`
	StreakChanged bool         `json:"streak_changed"`
	TasksComplete float64      `json:"tasks_complete"`
	NextTask      *taskSummary `json:"next_task,omitempty" jsonschema:"For flexible recurring tasks, the next instance that was created"`
}

// Handlers.

func (t *tools) listWorkspaces(_ context.Context, c caller, _ listWorkspacesInput) (listWorkspacesOutput, error) {
	ws, err := t.loadWorkspaces(c)
	if err != nil {
		return listWorkspacesOutput{}, err
	}
	out := listWorkspacesOutput{Workspaces: make([]workspaceSummary, 0, len(ws))}
	for _, w := range ws {
		out.Workspaces = append(out.Workspaces, workspaceSummary{Name: w.name, Color: w.color, Categories: w.summaries()})
	}
	return out, nil
}

func (t *tools) listCategories(_ context.Context, c caller, in listCategoriesInput) (listCategoriesOutput, error) {
	ws, err := t.loadWorkspaces(c)
	if err != nil {
		return listCategoriesOutput{}, err
	}
	out := listCategoriesOutput{Categories: []categorySummary{}}
	name := strings.TrimSpace(in.Workspace)
	if name != "" {
		w := findWorkspace(ws, name)
		if w == nil {
			return out, fmt.Errorf("workspace %q not found", name)
		}
		ws = []workspace{*w}
	}
	for _, w := range ws {
		out.Categories = append(out.Categories, w.summaries()...)
	}
	return out, nil
}

func (t *tools) listTasks(_ context.Context, c caller, in listTasksInput) (listTasksOutput, error) {
	out := listTasksOutput{Tasks: []taskSummary{}, Timezone: c.timezone}

	after, err := parseBound(in.DueAfter, c.loc, false)
	if err != nil {
		return out, fmt.Errorf("due_after: %w", err)
	}
	before, err := parseBound(in.DueBefore, c.loc, true)
	if err != nil {
		return out, fmt.Errorf("due_before: %w", err)
	}
	limit := in.Limit
	if limit <= 0 {
		limit = defaultTaskLimit
	}
	limit = min(limit, maxTaskLimit)

	ws, err := t.loadWorkspaces(c)
	if err != nil {
		return out, err
	}
	scope, err := selectCategories(ws, in.Workspace, in.CategoryID)
	if err != nil {
		return out, err
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
			return out, errors.New("could not load completed tasks")
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
	return out, nil
}

func (t *tools) createWorkspace(_ context.Context, c caller, in createWorkspaceInput, rec *auditRecord) (createWorkspaceOutput, error) {
	name := strings.TrimSpace(in.Name)
	if name == "" {
		return createWorkspaceOutput{}, errors.New("name is required")
	}
	rec.subject = name
	color := strings.TrimSpace(in.Color)
	if color != "" && !hexColor.MatchString(color) {
		return createWorkspaceOutput{}, errors.New("color must be a hex value like #6C5CE7")
	}
	ws, err := t.loadWorkspaces(c)
	if err != nil {
		return createWorkspaceOutput{}, err
	}
	if w := findWorkspace(ws, name); w != nil {
		return createWorkspaceOutput{}, fmt.Errorf("workspace %q already exists", w.name)
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
		return createWorkspaceOutput{}, errors.New("could not create workspace")
	}
	if color != "" {
		if err := t.categories.UpsertWorkspaceMeta(name, c.userID, nil, &color); err != nil {
			return createWorkspaceOutput{}, errors.New("workspace created but its color could not be saved")
		}
	}
	rec.summary = fmt.Sprintf("Created workspace %q", name)
	return createWorkspaceOutput{Name: name}, nil
}

func (t *tools) createCategory(_ context.Context, c caller, in createCategoryInput, rec *auditRecord) (categorySummary, error) {
	name, wsName := strings.TrimSpace(in.Name), strings.TrimSpace(in.Workspace)
	if name == "" || wsName == "" {
		return categorySummary{}, errors.New("name and workspace are required")
	}
	rec.subject = name
	if name == proxyCategoryName {
		return categorySummary{}, errors.New("that category name is reserved")
	}
	ws, err := t.loadWorkspaces(c)
	if err != nil {
		return categorySummary{}, err
	}
	w := findWorkspace(ws, wsName)
	if w == nil {
		return categorySummary{}, fmt.Errorf("workspace %q not found; create it with create_workspace first", wsName)
	}
	for _, cat := range w.categories {
		if strings.EqualFold(cat.doc.Name, name) {
			return categorySummary{}, fmt.Errorf("category %q already exists in %q with id %s", cat.doc.Name, w.name, cat.doc.ID.Hex())
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
		return categorySummary{}, errors.New("could not create category")
	}
	rec.targets = []primitive.ObjectID{doc.ID}
	rec.summary = fmt.Sprintf("Created category %q in %s", doc.Name, doc.WorkspaceName)
	return categorySummary{ID: doc.ID.Hex(), Name: doc.Name, Workspace: doc.WorkspaceName}, nil
}

func (t *tools) createTask(ctx context.Context, c caller, in createTaskInput, rec *auditRecord) (createTaskOutput, error) {
	content := strings.TrimSpace(in.Content)
	if content == "" {
		return createTaskOutput{}, errors.New("content is required")
	}
	rec.subject = content
	priority := in.Priority
	if priority == 0 {
		priority = 1
	}
	if priority < 1 || priority > 3 {
		return createTaskOutput{}, errors.New("priority must be 1, 2 or 3")
	}
	difficulty := in.Difficulty
	if difficulty == 0 {
		difficulty = 1
	}
	if difficulty < 1 || difficulty > 10 {
		return createTaskOutput{}, errors.New("difficulty must be between 1 and 10")
	}
	start, startHasTime, err := parseWhen(in.StartDate, c.loc)
	if err != nil {
		return createTaskOutput{}, fmt.Errorf("start_date: %w", err)
	}
	deadline, deadlineHasTime, err := parseWhen(in.Deadline, c.loc)
	if err != nil {
		return createTaskOutput{}, fmt.Errorf("deadline: %w", err)
	}
	if deadline != nil && !deadlineHasTime {
		y, m, d := deadline.Date()
		eod := time.Date(y, m, d, 23, 59, 0, 0, c.loc)
		deadline = &eod
	}

	ws, err := t.loadWorkspaces(c)
	if err != nil {
		return createTaskOutput{}, err
	}
	cat, err := findCategory(ws, in.CategoryID)
	if err != nil {
		return createTaskOutput{}, err
	}
	if cat.doc.Name == proxyCategoryName {
		return createTaskOutput{}, errors.New("that id is a workspace placeholder, not a category; create a category first")
	}

	public := false
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
		return createTaskOutput{}, fmt.Errorf("could not create task: %s", err.Error())
	}
	created := res.Body.TaskDocument
	rec.targets = []primitive.ObjectID{created.ID, cat.doc.ID}
	rec.summary = fmt.Sprintf("Created task %q in %s", created.Content, cat.doc.Name)
	t.stampOrigin(ctx, c, cat.doc.ID, created.ID)
	return createTaskOutput{Task: summarize(created, cat, c.loc)}, nil
}

func (t *tools) completeTask(ctx context.Context, c caller, in completeTaskInput, rec *auditRecord) (completeTaskOutput, error) {
	taskID, err := primitive.ObjectIDFromHex(strings.TrimSpace(in.TaskID))
	if err != nil {
		return completeTaskOutput{}, errors.New("task_id is not a valid id")
	}
	rec.targets = []primitive.ObjectID{taskID}
	ws, err := t.loadWorkspaces(c)
	if err != nil {
		return completeTaskOutput{}, err
	}
	tk, cat, ok := findTask(ws, taskID)
	if !ok {
		return completeTaskOutput{}, errors.New("open task not found; it may already be complete")
	}
	rec.subject = tk.Content
	if id := strings.TrimSpace(in.CategoryID); id != "" && id != cat.doc.ID.Hex() {
		return completeTaskOutput{}, fmt.Errorf("task is in category %s, not %s", cat.doc.ID.Hex(), id)
	}

	res, err := t.taskHandler.CompleteTask(c.context(ctx), &task.CompleteTaskInput{
		ID:       taskID.Hex(),
		Category: cat.doc.ID.Hex(),
		Body:     task.CompleteTaskDocument{TimeCompleted: time.Now().UTC().Format(time.RFC3339), TimeTaken: "PT0S"},
	})
	if err != nil {
		return completeTaskOutput{}, fmt.Errorf("could not complete task: %s", err.Error())
	}

	rec.summary = fmt.Sprintf("Completed task %q in %s", tk.Content, cat.doc.Name)
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
	return out, nil
}

// context returns ctx carrying the same auth values the JWT middleware sets for Huma handlers.
func (c caller) context(ctx context.Context) context.Context {
	ctx = context.WithValue(ctx, auth.UserIDContextKey, c.userID.Hex())
	return context.WithValue(ctx, auth.TimezoneContextKey, c.timezone)
}

func scopeError(scope string) error {
	return fmt.Errorf("this connection was not granted the %s scope", scope)
}

// guard checks the tool's scope and the connection's rolling 24h cap before a write runs.
func (t *tools) guard(ctx context.Context, c caller, name, scope string) error {
	if !c.can(scope) {
		return scopeError(scope)
	}
	group, limit, noun := createTools, t.limits.dailyCreates, "create"
	if scope == oauth.ScopeComplete {
		group, limit, noun = completeTools, t.limits.dailyCompletes, "complete"
	}
	if limit <= 0 || !slices.Contains(group, name) {
		return nil
	}
	n, err := t.audit.CountSince(ctx, c.principal.ConnectionID, group, time.Now().Add(-24*time.Hour))
	if err != nil {
		slog.ErrorContext(ctx, "MCP daily cap check failed", "error", err)
		return errors.New("could not check this connection's daily limit; try again shortly")
	}
	if n >= int64(limit) {
		return fmt.Errorf("daily limit reached: this connection can %s at most %d items per 24 hours. Ask the user to do more in the Kindred app", noun, limit)
	}
	return nil
}

func (t *tools) recordAudit(ctx context.Context, c caller, name, verb string, rec *auditRecord, callErr error) {
	summary := rec.summary
	if callErr != nil || summary == "" {
		summary = "Failed to " + verb
		if rec.subject != "" {
			summary += fmt.Sprintf(" %q", rec.subject)
		}
		if callErr != nil {
			summary += ": " + callErr.Error()
		}
	}
	ctx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
	defer cancel()
	if err := t.audit.Record(ctx, c.principal, name, rec.targets, summary, callErr); err != nil {
		slog.ErrorContext(ctx, "MCP audit write failed", "tool", name, "error", err)
	}
}

// stampOrigin marks a newly created task with the agent connection that made it.
func (t *tools) stampOrigin(ctx context.Context, c caller, categoryID, taskID primitive.ObjectID) {
	if t.categoryDB == nil {
		return
	}
	p := c.principal
	origin := types.TaskOrigin{Kind: "mcp", ConnectionID: p.ConnectionID, ClientID: p.ClientID, ClientName: p.ClientName, At: time.Now().UTC()}
	_, err := t.categoryDB.UpdateOne(ctx,
		bson.M{"_id": categoryID, "user": c.userID, "tasks._id": taskID},
		bson.M{"$set": bson.M{"tasks.$.origin": origin}},
	)
	if err != nil {
		slog.ErrorContext(ctx, "MCP origin stamp failed", "taskId", taskID.Hex(), "error", err)
	}
}
