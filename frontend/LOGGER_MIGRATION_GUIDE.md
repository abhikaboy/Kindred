# Logger Migration Guide

## Overview

This guide helps you migrate from `console.log` to the new custom logger system.

## Migration Status

### ✅ Completed
- [x] `contexts/AlertContext.tsx`
- [x] `contexts/tasksContext.tsx`
- [x] `utils/cacheCleanup.ts`
- [x] `hooks/useCacheCleanup.tsx`
- [x] `app/_layout.tsx`
- [x] `api/client.ts`

### 🔄 In Progress
- [ ] Other API files
- [ ] Hooks
- [ ] Components
- [ ] App screens

## Quick Migration Reference

### Step 1: Import the logger

```typescript
// At the top of your file
import { logger } from '@/utils/logger';
// OR for scoped logging:
import { createLogger } from '@/utils/logger';
const logger = createLogger('YourModuleName');
```

### Step 2: Replace console statements

| Old | New |
|-----|-----|
| `console.log('message')` | `logger.debug('message')` or `logger.info('message')` |
| `console.info('message')` | `logger.info('message')` |
| `console.warn('message')` | `logger.warn('message')` |
| `console.error('message', error)` | `logger.error('message', error)` |
| `console.log('data:', data)` | `logger.debug('data', data)` |

### Step 3: Choose appropriate log level

- **`logger.debug()`** - Detailed debugging info (only in development)
  - Variable values
  - Function entry/exit
  - Cache hits/misses

- **`logger.info()`** - General informational messages
  - API requests completed
  - User actions
  - State changes

- **`logger.warn()`** - Warning messages
  - Deprecated features
  - Fallback behavior
  - Unexpected but handled situations

- **`logger.error()`** - Error messages
  - API failures
  - Exceptions
  - Critical issues

## Common Patterns

### Pattern 1: Simple logging
```typescript
// Before
console.log('User logged in');

// After
logger.info('User logged in');
```

### Pattern 2: Logging with data
```typescript
// Before
console.log('Fetching workspaces:', workspaces);

// After
logger.debug('Fetching workspaces', { count: workspaces.length });
```

### Pattern 3: Error logging
```typescript
// Before
console.error('Failed to fetch:', error);

// After
logger.error('Failed to fetch data', error);
```

### Pattern 4: Conditional logging
```typescript
// Before
if (__DEV__) {
    console.log('Debug info:', data);
}

// After
logger.debug('Debug info', data); // Automatically respects log level
```

### Pattern 5: API request logging
```typescript
// Before
console.log('🚀 Making request to:', url);
console.log('📦 Response:', response);

// After
logger.debug('Making request', { url });
logger.debug('Response received', { status: response.status });
```

### Pattern 6: Scoped logging
```typescript
// Create a scoped logger for your module
const authLogger = createLogger('Auth');

authLogger.info('Starting authentication');
authLogger.debug('Checking credentials');
authLogger.error('Authentication failed', error);
// All logs will be prefixed with [Auth]
```

## File-by-File Migration

### API Files

```typescript
// api/task.ts
import { createLogger } from '@/utils/logger';
const logger = createLogger('TaskAPI');

export async function fetchTasks() {
    logger.debug('Fetching tasks');
    try {
        const response = await client.GET('/tasks');
        logger.info('Tasks fetched successfully', { count: response.data.length });
        return response.data;
    } catch (error) {
        logger.error('Failed to fetch tasks', error);
        throw error;
    }
}
```

### Hooks

```typescript
// hooks/useAuth.tsx
import { createLogger } from '@/utils/logger';
const logger = createLogger('useAuth');

export function useAuth() {
    const login = async (email: string) => {
        logger.info('User login attempt', { email });
        try {
            // ...
            logger.info('Login successful');
        } catch (error) {
            logger.error('Login failed', error);
        }
    };
}
```

### Components

```typescript
// components/FeedScreen.tsx
import { createLogger } from '@/utils/logger';
const logger = createLogger('FeedScreen');

export function FeedScreen() {
    useEffect(() => {
        logger.debug('Component mounted');
        return () => logger.debug('Component unmounted');
    }, []);

    const handleRefresh = () => {
        logger.info('User triggered refresh');
        // ...
    };
}
```

### Contexts

```typescript
// contexts/UserContext.tsx
import { createLogger } from '@/utils/logger';
const logger = createLogger('UserContext');

export function UserProvider({ children }) {
    const [user, setUser] = useState(null);

    const fetchUser = async () => {
        logger.debug('Fetching user data');
        try {
            const data = await api.getUser();
            logger.info('User data fetched', { userId: data.id });
            setUser(data);
        } catch (error) {
            logger.error('Failed to fetch user', error);
        }
    };
}
```

## Automated Migration Script

You can use this bash script to help with migration:

```bash
#!/bin/bash
# migrate-logger.sh

# Find all console.log and suggest replacements
find frontend -name "*.ts" -o -name "*.tsx" | while read file; do
    if grep -q "console\.\(log\|warn\|error\|info\)" "$file"; then
        echo "File needs migration: $file"
        grep -n "console\.\(log\|warn\|error\|info\)" "$file"
    fi
done
```

## Testing Your Migration

1. Set `EXPO_PUBLIC_LOG_LEVEL=DEBUG` in `.env`
2. Run your app and verify logs appear
3. Set `EXPO_PUBLIC_LOG_LEVEL=NONE`
4. Verify no logs appear (performance mode)
5. Set `EXPO_PUBLIC_LOG_LEVEL=ERROR`
6. Verify only errors appear

## Performance Benefits

### Before (with console.log)
- All console statements execute in production
- String concatenation happens even if not logged
- No way to disable logging
- Performance impact: ~5-10ms per log statement

### After (with logger)
- Logs can be completely disabled (`LOG_LEVEL=NONE`)
- Early return if log level not met (no string processing)
- Structured logging with data objects
- Performance impact when disabled: ~0.1ms per log statement

## Production Configuration

```bash
# .env.production
EXPO_PUBLIC_LOG_LEVEL=NONE  # No logging in production
```

```bash
# .env.development
EXPO_PUBLIC_LOG_LEVEL=DEBUG  # All logs in development
```

```bash
# .env.staging
EXPO_PUBLIC_LOG_LEVEL=WARN  # Warnings and errors only
```

## Best Practices

1. **Use scoped loggers** for modules
   ```typescript
   const logger = createLogger('ModuleName');
   ```

2. **Log structured data** instead of strings
   ```typescript
   // Good
   logger.info('User action', { action: 'click', button: 'submit' });

   // Avoid
   logger.info('User clicked submit button');
   ```

3. **Choose appropriate levels**
   - Debug: Development-only details
   - Info: Important events
   - Warn: Unexpected but handled
   - Error: Failures

4. **Don't log sensitive data**
   ```typescript
   // Bad
   logger.debug('User credentials', { password: user.password });

   // Good
   logger.debug('User authenticated', { userId: user.id });
   ```

5. **Use performance timing**
   ```typescript
   logger.time('fetchData');
   await fetchData();
   logger.timeEnd('fetchData');
   ```

## Remaining Files to Migrate

Run this command to see remaining files:

```bash
grep -r "console\.\(log\|warn\|error\|info\|debug\)" frontend --include="*.ts" --include="*.tsx" | wc -l
```

## Need Help?

- Check `utils/logger.examples.ts` for more examples
- Review already migrated files for patterns
- Test with different log levels to ensure proper behavior
