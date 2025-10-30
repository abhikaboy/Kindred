# Performance Optimization Guide

This document outlines performance best practices and recommendations for the Kindred application.

## Database Performance

### MongoDB Indexes

To optimize query performance, ensure the following indexes are created:

#### Categories Collection
- Index on `user` field for user-specific queries
- Compound index on `user` + `tasks._id` for task lookups
- Index on `tasks.deadline` for deadline-based queries
- Index on `tasks.startDate` for start date queries

```javascript
db.categories.createIndex({ "user": 1 })
db.categories.createIndex({ "user": 1, "tasks._id": 1 })
db.categories.createIndex({ "tasks.deadline": 1 })
db.categories.createIndex({ "tasks.startDate": 1 })
```

#### Users Collection
- Index on `_id` (default)
- Index on `email` for authentication
- Index on `phoneNumber` for phone-based lookups

```javascript
db.users.createIndex({ "email": 1 }, { unique: true })
db.users.createIndex({ "phoneNumber": 1 }, { unique: true })
```

#### Template Tasks Collection
- Index on `userId` for user-specific template queries
- Index on `categoryId` for category-specific templates
- Compound index on `userId` + `nextGenerated` for cron job queries

```javascript
db["template-tasks"].createIndex({ "userId": 1 })
db["template-tasks"].createIndex({ "categoryId": 1 })
db["template-tasks"].createIndex({ "userId": 1, "nextGenerated": 1 })
```

#### Completed Tasks Collection
- Index on `user` for user-specific completed task queries
- Index on `timeCompleted` for time-based queries
- Compound index on `user` + `timeCompleted` for paginated queries

```javascript
db["completed-tasks"].createIndex({ "user": 1 })
db["completed-tasks"].createIndex({ "timeCompleted": -1 })
db["completed-tasks"].createIndex({ "user": 1, "timeCompleted": -1 })
```

### Query Optimization

1. **Use Context Timeouts**: All database operations should use the `xcontext` package to prevent long-running queries:
   ```go
   ctx, cancel := xcontext.WithTimeout(context.Background())
   defer cancel()
   ```

2. **Limit Result Sets**: Use pagination for large result sets to avoid loading too much data at once.

3. **Project Only Needed Fields**: Use MongoDB projections to return only the fields you need.

4. **Avoid N+1 Queries**: Use aggregation pipelines instead of making multiple queries.

## Backend Performance

### Logging Best Practices

1. **Remove Debug Statements**: Don't use `fmt.Println` or `fmt.Printf` for production code. Use structured logging with `slog` instead:
   ```go
   slog.LogAttrs(ctx, slog.LevelInfo, "Message", slog.String("key", value))
   ```

2. **Log Levels**: Use appropriate log levels:
   - `slog.LevelDebug`: Development/debugging information
   - `slog.LevelInfo`: Normal operational information
   - `slog.LevelWarn`: Warning messages that don't require immediate action
   - `slog.LevelError`: Errors that need attention

### String Operations

1. **Use `fmt.Sprintf` for Concatenation**: Instead of using `+` operator:
   ```go
   // Bad
   url := "http://localhost:8080/ws/" + userType + "/" + id
   
   // Good
   url := fmt.Sprintf("http://localhost:8080/ws/%s/%s", userType, id)
   ```

2. **Use `strings.Builder` for Complex Concatenation**: For building strings in loops:
   ```go
   var builder strings.Builder
   for _, item := range items {
       builder.WriteString(item)
   }
   result := builder.String()
   ```

## Frontend Performance

### React Component Optimization

1. **Use React.memo**: Wrap components that receive stable props:
   ```typescript
   const MyComponent = React.memo(function MyComponent(props) {
       // component logic
   });
   ```

2. **Use useCallback**: Memoize callback functions to prevent unnecessary re-renders:
   ```typescript
   const handleClick = useCallback(() => {
       // handler logic
   }, [dependencies]);
   ```

3. **Use useMemo**: Memoize expensive computations:
   ```typescript
   const filteredData = useMemo(() => {
       return data.filter(item => item.active);
   }, [data]);
   ```

### Logging Best Practices

1. **Remove console.log**: Don't use `console.log` in production code. Use a proper logging library or remove debug statements.

2. **Use Development-Only Logging**: If logging is needed for debugging:
   ```typescript
   if (__DEV__) {
       console.log('Debug info:', data);
   }
   ```

### List Rendering Optimization

1. **Use FlatList for Long Lists**: Instead of mapping over arrays, use `FlatList` or `SectionList` for better performance.

2. **Optimize keyExtractor**: Provide a stable key for list items:
   ```typescript
   <FlatList
       data={items}
       keyExtractor={(item) => item.id}
       renderItem={renderItem}
   />
   ```

3. **Use getItemLayout**: For fixed-height items, provide `getItemLayout` to improve scroll performance.

## Monitoring and Profiling

### Backend Monitoring

Consider adding:
- Request/response time tracking
- Database query performance monitoring
- Error rate tracking
- Memory and CPU usage monitoring

### Frontend Monitoring

Consider adding:
- React DevTools Profiler for component render analysis
- Performance API for measuring load times
- User interaction tracking
- Crash reporting

## Performance Testing

### Load Testing

- Test API endpoints under load to identify bottlenecks
- Monitor database connection pool usage
- Check for memory leaks during extended use

### Frontend Performance Testing

- Measure time to interactive (TTI)
- Monitor frame rates during animations
- Test app performance on lower-end devices
- Profile memory usage during navigation

## Future Improvements

1. **Caching**: Implement Redis or similar for frequently accessed data
2. **CDN**: Use a CDN for static assets
3. **Database Sharding**: Consider sharding if data grows significantly
4. **React Query**: Already using @tanstack/react-query for efficient data fetching
5. **Code Splitting**: Consider lazy loading for large components
