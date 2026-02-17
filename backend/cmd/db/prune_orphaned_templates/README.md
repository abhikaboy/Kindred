# Prune Orphaned Templates Script

This script identifies and removes orphaned template tasks from the database. Template tasks become orphaned when their associated categories are deleted but the template records remain in the database.

## What it does

1. Fetches all existing category IDs from the `categories` collection
2. Scans all template tasks in the `templateTasks` collection
3. Identifies template tasks that reference non-existent category IDs
4. Deletes the orphaned template tasks (or shows what would be deleted in dry-run mode)

## Usage

### Dry Run (Recommended First)

To see what would be deleted without making any changes:

```bash
cd backend
go run cmd/db/prune_orphaned_templates/main.go --dry-run
```

### Actual Deletion

To actually delete the orphaned templates:

```bash
cd backend
go run cmd/db/prune_orphaned_templates/main.go
```

## Output

The script provides detailed logging:
- Number of valid categories found
- Total number of template tasks scanned
- Details of each orphaned template found (ID, category ID, content)
- Number of templates deleted (or would be deleted in dry-run mode)

## Example Output

```
INFO Found valid categories count=42
INFO Fetching all template tasks...
INFO Found orphaned template templateID=507f1f77bcf86cd799439011 categoryID=507f1f77bcf86cd799439012 content="Daily standup"
INFO Template analysis complete totalTemplates=150 orphanedTemplates=3
INFO Successfully deleted orphaned templates deletedCount=3
INFO Script completed successfully
```

## When to Run

- After fixing the workspace/category deletion logic to clean up existing orphaned data
- As part of database maintenance
- If you suspect there are orphaned template tasks in the database

## Safety

- Always run with `--dry-run` first to review what will be deleted
- The script only deletes template tasks, not categories or regular tasks
- Requires valid MongoDB connection via environment variables
