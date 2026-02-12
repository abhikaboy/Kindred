
<img width="1920" height="1080" alt="Kindred Cover" src="https://github.com/user-attachments/assets/983c1d19-cd20-426a-9623-f698528654bc" />
<img width="1740" height="3013" alt="Foreward" src="https://github.com/user-attachments/assets/f5feca73-673d-4b27-bdd9-6034c9439c4a" />


# Tech Stack

-   **Backend:** Go, Fiber, Websockets + Genkit
-   **Frontend**: React Native, TypeScript, Expo SDK 52
-   **Database**: MongoDB Atlas
-   **Analytics**: PostHog

# Environment Setup

## PostHog Analytics

PostHog is integrated for automatic event tracking across all API endpoints. See [backend/POSTHOG_SETUP.md](backend/POSTHOG_SETUP.md) for detailed setup instructions.

Required environment variable:
```bash
POSTHOG_API_KEY=your_api_key_here
```

# Development Environment Setup

```text
DEVELOPMENT ENVIRONMENT
╭──────────────────┬─────────────────────────────────────────────────╮
│ scripts          │ description                                     │
├──────────────────┼─────────────────────────────────────────────────┤
│ backend-lint     │ # Lints backend code.                           │
│ backend-run      │ # Runs the backend server in development mode.  │
│ backend-test     │ # Tests backend code.                           │
│ database-script  │ # Runs a script against the connected Database  │
│ frontend-lint    │ # Lints frontend code.                          │
│ frontend-run     │ # Runs the frontend server in development mode. │
│ frontend-run-wsl │ # Runs the frontend server in tunnel mode.      │
│ frontend-test    │ # Runs the frontend tests.                      │
╰──────────────────┴─────────────────────────────────────────────────╯

```

This guide assumes that you are using Linux/macOS. **If you are using Windows, please install [WSL](https://learn.microsoft.com/en-us/windows/wsl/install)**.

To get started, clone the repository via HTTPS by running `git clone https://github.com/abhikaboy/Kindred-template.git`.
If you'd prefer, you can [clone it via SSH](https://docs.github.com/en/repositories/creating-and-managing-repositories/cloning-a-repository).

### NIX Installation (Recommended)

1. [Install Nix](https://zero-to-nix.com/start/install)
    <!-- markdownlint-disable MD013 -->
    ```sh
    curl --proto '=https' --tlsv1.2 -sSf -L https://install.determinate.systems/nix | sh -s -- install
    ```
    <!-- markdownlint-enable MD013 -->

-   Type in computer password if prompted.
-   Say yes to prompt.

2. In a new terminal activate the development environment by running the following:

<!-- markdownlint-disable MD013 -->

```sh
nix develop --impure
```

<!-- markdownlint-enable MD013 -->

# Testing

## Backend Tests

The backend uses an **ephemeral database** system for testing. Each test gets a fresh, isolated MongoDB database that's automatically created and destroyed.

### Quick Start

**[→ 5-Minute Quick Start Guide](TESTING_QUICKSTART.md)**

```bash
# 1. Install MongoDB
brew install mongodb-community && brew services start mongodb-community

# 2. Verify setup
make check-mongodb

# 3. Run tests
make test-backend
```

### Documentation

- **[Quick Start](TESTING_QUICKSTART.md)** - Get running in 5 minutes ⚡
- **[Testing Setup](TESTING_SETUP.md)** - Complete reference guide
- **[CI/CD & Hooks](TESTING_CI_CD.md)** - GitHub Actions and pre-commit hooks
- **[Nix Integration](NIX_TESTING_SETUP.md)** - Automatic setup in Nix environment
- **[MongoDB Setup](backend/internal/testing/MONGODB_SETUP.md)** - Detailed installation instructions
- **[Testing README](backend/internal/testing/README.md)** - Test infrastructure details
- **[Architecture](backend/internal/testing/ARCHITECTURE.md)** - Design decisions and patterns

### Key Features

- ✅ **True isolation** - Each test gets its own database
- ✅ **Parallel safe** - Run tests concurrently
- ✅ **Auto cleanup** - Databases automatically dropped
- ✅ **Fixtures included** - All 16 collections pre-seeded
- ✅ **Works anywhere** - Local MongoDB or Atlas
- ✅ **CI/CD ready** - GitHub Actions workflows included
- ✅ **Pre-commit hooks** - Auto-installed in Nix environment
