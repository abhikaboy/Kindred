# MongoDB Local Setup for Testing

## Quick Start

### macOS (Homebrew)

```bash
# Install MongoDB Community Edition
brew tap mongodb/brew
brew install mongodb-community

# Start MongoDB as a service (runs in background)
brew services start mongodb-community

# Verify it's running
brew services list | grep mongodb

# Test connection
mongosh
```

### Alternative: Manual Start (macOS)

```bash
# Start MongoDB manually (stays in foreground)
mongod --config /opt/homebrew/etc/mongod.conf

# Or with custom data directory
mongod --dbpath ~/data/db
```

### Linux (Ubuntu/Debian)

```bash
# Import MongoDB public GPG key
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
   sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor

# Add MongoDB repository
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | \
   sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# Update and install
sudo apt-get update
sudo apt-get install -y mongodb-org

# Start MongoDB
sudo systemctl start mongod

# Enable auto-start on boot
sudo systemctl enable mongod

# Check status
sudo systemctl status mongod
```

### Docker (All Platforms)

```bash
# Pull MongoDB image
docker pull mongo:latest

# Run MongoDB container
docker run -d \
  --name mongodb-test \
  -p 27017:27017 \
  -e MONGO_INITDB_ROOT_USERNAME=admin \
  -e MONGO_INITDB_ROOT_PASSWORD=password \
  mongo:latest

# Check it's running
docker ps | grep mongodb-test

# Connect
mongosh "mongodb://admin:password@localhost:27017"
```

### Docker Compose (Recommended for Development)

Create `docker-compose.yml` in your project root:

```yaml
version: '3.8'

services:
  mongodb:
    image: mongo:latest
    container_name: kindred-mongodb-test
    ports:
      - "27017:27017"
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: password
    volumes:
      - mongodb_data:/data/db
    restart: unless-stopped

volumes:
  mongodb_data:
```

Then run:

```bash
# Start MongoDB
docker-compose up -d

# Stop MongoDB
docker-compose down

# Stop and remove data
docker-compose down -v
```

## Verification

### Quick Check (Recommended)

Use the built-in verification script:

```bash
# From project root
make check-mongodb

# Or directly
./backend/scripts/check-mongodb.sh
```

This will verify:
- ✅ mongosh is installed
- ✅ MongoDB is running and accessible
- ✅ Can create and drop databases
- ✅ No leftover test databases
- ✅ Ready for tests

### Manual Check

```bash
# Method 1: Check process
ps aux | grep mongod

# Method 2: Check port
lsof -i :27017

# Method 3: Try connecting
mongosh
```

### Test with mongosh

```bash
# Connect
mongosh

# Show databases
show dbs

# Create a test database
use test_connection

# Insert a document
db.test.insertOne({ message: "Hello MongoDB!" })

# Query it back
db.test.find()

# Exit
exit
```

## Configuration for Tests

### Option 1: Default (No Configuration Needed)

If MongoDB is running on `localhost:27017`, tests will work automatically:

```bash
# Just run your tests
cd backend
go test ./...
```

### Option 2: Custom URI

If using Docker with authentication or different port:

```bash
# Set environment variable
export TEST_MONGO_URI="mongodb://admin:password@localhost:27017"

# Run tests
cd backend
go test ./...
```

### Option 3: Use Atlas (Cloud)

```bash
# Use your Atlas connection string
export TEST_MONGO_URI="mongodb+srv://username:password@cluster.mongodb.net/"

# Run tests
cd backend
go test ./...
```

## Common Issues

### Issue: "Connection refused" or "No such host"

**Cause**: MongoDB not running

**Solution**:
```bash
# macOS
brew services start mongodb-community

# Linux
sudo systemctl start mongod

# Docker
docker start mongodb-test
```

### Issue: "Authentication failed"

**Cause**: Wrong credentials or auth not configured

**Solution**:
```bash
# For local MongoDB without auth (default)
export TEST_MONGO_URI="mongodb://localhost:27017"

# For Docker with auth
export TEST_MONGO_URI="mongodb://admin:password@localhost:27017"
```

### Issue: Port 27017 already in use

**Cause**: Another process using the port

**Solution**:
```bash
# Find what's using the port
lsof -i :27017

# Kill the process (use PID from above)
kill -9 <PID>

# Or use a different port
mongod --port 27018
export TEST_MONGO_URI="mongodb://localhost:27018"
```

### Issue: "Permission denied" on data directory

**Cause**: MongoDB can't write to data directory

**Solution**:
```bash
# Create data directory with correct permissions
sudo mkdir -p /data/db
sudo chown -R $(whoami) /data/db

# Or use a custom directory
mkdir -p ~/mongodb-data
mongod --dbpath ~/mongodb-data
```

## Recommended Setup for Development

### 1. Use Docker Compose (Easiest)

**Pros**:
- ✅ Isolated from system
- ✅ Easy to start/stop
- ✅ Consistent across team
- ✅ Easy to reset

**Setup**:
```bash
# Add docker-compose.yml to project root (see above)
docker-compose up -d

# Tests work automatically
cd backend
go test ./...
```

### 2. Use Homebrew Service (macOS Native)

**Pros**:
- ✅ Runs in background
- ✅ Auto-starts on boot
- ✅ Native performance

**Setup**:
```bash
brew services start mongodb-community

# Tests work automatically
cd backend
go test ./...
```

### 3. Use Atlas (Cloud)

**Pros**:
- ✅ No local setup needed
- ✅ Same as production
- ✅ Accessible from anywhere

**Cons**:
- ❌ Requires internet
- ❌ Slower than local
- ❌ May have rate limits

**Setup**:
```bash
export TEST_MONGO_URI="mongodb+srv://..."
cd backend
go test ./...
```

## Performance Tips

### For Faster Tests

1. **Use Local MongoDB** (not Atlas)
   - Network latency matters for tests
   - Local is 10-100x faster

2. **Use SSD for Data Directory**
   - Faster disk = faster tests
   - Default locations are usually on SSD

3. **Disable Journaling for Tests** (optional)
   ```bash
   mongod --nojournal --dbpath ~/test-data
   ```

4. **Use In-Memory Storage** (fastest)
   ```bash
   mongod --storageEngine inMemory --dbpath /tmp/mongo-mem
   ```

## Cleanup

### Remove Test Databases

```bash
# Connect to MongoDB
mongosh

# List all test databases
show dbs

# Drop test databases (one by one)
use test_1706234567890123456
db.dropDatabase()

# Or use this script to drop all test_* databases
mongosh --eval '
  db.adminCommand("listDatabases").databases
    .filter(d => d.name.startsWith("test_"))
    .forEach(d => {
      print("Dropping: " + d.name);
      db.getSiblingDB(d.name).dropDatabase();
    })
'
```

### Stop MongoDB

```bash
# Homebrew
brew services stop mongodb-community

# Linux
sudo systemctl stop mongod

# Docker
docker stop mongodb-test
# or
docker-compose down
```

### Uninstall MongoDB

```bash
# Homebrew
brew services stop mongodb-community
brew uninstall mongodb-community
rm -rf /opt/homebrew/var/mongodb

# Linux
sudo systemctl stop mongod
sudo apt-get purge mongodb-org*
sudo rm -rf /var/log/mongodb
sudo rm -rf /var/lib/mongodb

# Docker
docker stop mongodb-test
docker rm mongodb-test
docker rmi mongo
```

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      mongodb:
        image: mongo:latest
        ports:
          - 27017:27017
        options: >-
          --health-cmd "mongosh --eval 'db.adminCommand(\"ping\")'"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3

      - name: Set up Go
        uses: actions/setup-go@v4
        with:
          go-version: '1.25.6'

      - name: Run tests
        run: |
          cd backend
          go test ./...
        env:
          TEST_MONGO_URI: mongodb://localhost:27017
```

## Summary

**Recommended for most developers**:
```bash
# Install
brew install mongodb-community

# Start
brew services start mongodb-community

# Run tests
cd backend
go test ./...

# That's it! 🎉
```

The test infrastructure will automatically:
- Create ephemeral databases for each test
- Seed them with fixtures
- Drop them when tests complete
- Work with your local MongoDB instance
