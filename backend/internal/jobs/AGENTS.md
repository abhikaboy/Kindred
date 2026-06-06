# jobs — Agent Guide

Scheduled background jobs (`robfig/cron/v3`). Currently Google Calendar integration.

## Key files
- `calendar_watch_renewal.go` — renews Calendar watch channels (`@every 6h`).
- `calendar_heartbeat.go` — health checks (`@every 1h`).
- `calendar_push_worker.go` — drains the `calendar_push_outbox`, syncing Kindred tasks to Google Calendar.
- Wired in `internal/server/server.go` (~L202–219).

## Job shape
```go
NewJob(collections..., cfg) *Job
func (j *Job) StartCron(c *cron.Cron)   // register schedule
func (j *Job) Run(ctx context.Context) error
```

## Conventions
- Each cron callback wraps work in `defer recover()` → `slog.Error` + Sentry, so one job's panic doesn't kill the scheduler.
- Jobs run with `context.Background()` (not request-scoped).

## Gotchas
- Server checks for a nil collection before constructing/starting a job — guard new jobs the same way.
- Allow ~2s for Sentry flush on shutdown paths.
