![kindred-cover](https://github.com/user-attachments/assets/c3f3bb9b-ecce-41c2-8bdd-e638df07995b)
![Foreward](https://github.com/user-attachments/assets/e4443882-f54a-4b7f-907f-032247fb60d4)


# Tech Stack

- **Backend:** Go, Fiber, Websockets
- **Frontend**: React Native, TypeScript, Expo SDK 52
- **Database**: MongoDB Atlas

# Environment Setup

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

To get started, clone the repository via HTTPS by running `git clone https://github.com/abhikaboy/GERM-template.git`.
If you'd prefer, you can [clone it via SSH](https://docs.github.com/en/repositories/creating-and-managing-repositories/cloning-a-repository).

### NIX Installation (Recommended)

1. [Install Nix](https://zero-to-nix.com/start/install)
   <!-- markdownlint-disable MD013 -->
   ```sh
   curl --proto '=https' --tlsv1.2 -sSf -L https://install.determinate.systems/nix | sh -s -- install
   ```
   <!-- markdownlint-enable MD013 -->

- Type in computer password if prompted.
- Say yes to prompt.

2. In a new terminal activate the development environment by running the following:

<!-- markdownlint-disable MD013 -->

```sh
nix develop --impure
```

<!-- markdownlint-enable MD013 -->
