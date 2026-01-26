{inputs, ...}: {
  imports = [
    inputs.devenv.flakeModule
  ];
  perSystem = {pkgs, ...}: {
    devenv = {
      modules = [
        inputs.env-help.devenvModule
      ];
      shells.default = {
        enterShell = ''
          printf "\033[0;1;36mKINDRED DEVELOPMENT ENVIRONMENT\033[0m\n"
          export GOTOOLCHAIN=auto

          # Install Genkit CLI if not already available
          if ! command -v genkit &> /dev/null; then
            echo "Installing Genkit CLI..."
            curl -sL cli.genkit.dev | bash
            export PATH="$HOME/.local/bin:$PATH"
          fi

          # Install pre-commit hooks if not already installed
          if [ -d .git ] && [ ! -f .git/hooks/pre-commit ]; then
            echo "🪝 Installing pre-commit hooks..."
            if [ -f scripts/pre-commit-hook.sh ]; then
              ln -s ../../scripts/pre-commit-hook.sh .git/hooks/pre-commit
              chmod +x .git/hooks/pre-commit
              echo "✅ Pre-commit hooks installed"
            fi
          fi

          # Initialize pre-commit framework if .pre-commit-config.yaml exists
          if [ -f .pre-commit-config.yaml ] && [ -d .git ]; then
            if ! pre-commit install --install-hooks > /dev/null 2>&1; then
              echo "⚠️  Note: pre-commit framework available but not initialized"
              echo "   Run 'pre-commit install' to enable framework hooks"
            fi
          fi

          env-help
        '';

        env-help.enable = true;

        languages = {
          go.enable = true;
          javascript = {
            enable = true;
          };
          nix.enable = true;
          typescript.enable = true;
        };

        packages = with pkgs; [
          nodePackages.eslint
          nodePackages.prettier
          bun
          git
          go
          python3
          python3.pkgs.pip
          python3.pkgs.typer
          dos2unix
          pre-commit
          golangci-lint
        ];

        scripts = {
          "backend-lint" = {
            description = "Lints backend code.";
            exec = ''
              cd "$DEVENV_ROOT"/backend
              go mod tidy
              go fmt ./...
              go vet ./...
              ${pkgs.golangci-lint}/bin/golangci-lint run ./...
            '';
          };
          "backend-run" = {
            description = "Runs the backend server in development mode.";
            exec = ''
              cd "$DEVENV_ROOT"/backend
              kill $(lsof -t -i:8080)
              ${pkgs.gum}/bin/gum spin --spinner dot --title "go mod tidy" -- go mod tidy
              ${pkgs.rubyPackages.dotenv}/bin/dotenv -i -f ""$DEVENV_ROOT"/.env" -- \
              ${pkgs.watchexec}/bin/watchexec -r -e go -- \
              genkit start -- go run cmd/server/main.go
            '';
          };
          "backend-test" = {
            description = "Tests backend code.";
            exec = ''
              cd "$DEVENV_ROOT"/backend
              go test ./...
            '';
          };
          "database-script" = {
            description = "Runs a script against the connected Database";
            exec = ''
              cd "$DEVENV_ROOT"/backend
              ${pkgs.gum}/bin/gum spin --spinner dot --title "go mod tidy" -- go mod tidy
              ${pkgs.rubyPackages.dotenv}/bin/dotenv -i -f ""$DEVENV_ROOT"/.env" -- \
              go run cmd/db/script/main.go
            '';
          };
          "database-clone" = {
            description = "Clone the production database for testing";
            exec = ''
              cd "$DEVENV_ROOT"/backend
              sh ./cmd/db/clone_prod/script.sh
            '';
          };
          "database-apply-schema" = {
            description = "Apply a schema to a given collection";
            exec = ''
              cd "$DEVENV_ROOT"/backend
              sh ./cmd/db/apply_schema/script.sh
            '';
          };
          "database-apply-indexes" = {
            description = "Apply indexes to a given collection";
            exec = ''
              cd "$DEVENV_ROOT"/backend
              go run cmd/db/apply_indexes/main.go
            '';
          };
          "frontend-lint" = {
            description = "Lints frontend code.";
            exec = ''
              cd "$DEVENV_ROOT"/frontend
              prettier . --write
              bun run lint
            '';
          };
          "frontend-run" = {
            description = "Runs the frontend server in development mode.";
            exec = ''
              cd "$DEVENV_ROOT"/frontend
              bunx expo start
            '';
          };
         "frontend-run-wsl" = {
            description = "Runs the frontend server in tunnel mode.";
            exec = ''
              cd "$DEVENV_ROOT"/frontend
              bunx expo start --tunnel
            '';
         };
        "frontend-test" = {
            description = "Runs the frontend tests.";
            exec = ''
              cd "$DEVENV_ROOT"/frontend
              bun run test
            '';
         };
         "cli-run" = {
            description = "Runs the CLI.";
            exec = ''
              cd "$DEVENV_ROOT"/cli
              python3 main.py
            '';
        };
        "generate-api-types" = {
            description = "Generate OpenAPI spec and TypeScript types from backend.";
            exec = ''
              cd "$DEVENV_ROOT"
              echo "🚀 Generating OpenAPI spec and frontend types..."

              # Build backend temporarily
              echo "==> Building backend..."
              cd backend
              go build -o /tmp/kindred-openapi ./cmd/server

              # Generate OpenAPI spec
              echo "==> Generating OpenAPI spec..."
              /tmp/kindred-openapi --generate-openapi --openapi-output="../frontend/api/api-spec.yaml"

              # Generate TypeScript types
              echo "==> Generating TypeScript types..."
              cd ../frontend
              if ! bun run generate-types; then
                echo "⚠️ bun run generate-types failed, using openapi-typescript directly..."
                bunx openapi-typescript api/api-spec.yaml -o api/generated/types.ts
              fi

              # Cleanup
              rm -f /tmp/kindred-openapi
              echo "✅ API types generation completed!"
            '';
        };
        "test-unit" = {
            description = "Run fast unit tests only (no MongoDB required).";
            exec = ''
              cd "$DEVENV_ROOT"/backend
              echo "⚡ Running unit tests..."
              go test -short -v ./...
            '';
        };
        "test-with-coverage" = {
            description = "Run tests and generate coverage report.";
            exec = ''
              cd "$DEVENV_ROOT"/backend
              echo "📊 Running tests with coverage..."
              go test -short -coverprofile=coverage.out ./...
              go tool cover -html=coverage.out -o coverage.html
              echo "✅ Coverage report: backend/coverage.html"
              go tool cover -func=coverage.out | grep total
            '';
        };
        "install-hooks" = {
            description = "Install git pre-commit hooks.";
            exec = ''
              cd "$DEVENV_ROOT"
              if [ -f .git/hooks/pre-commit ]; then
                echo "⚠️  Pre-commit hook already exists. Backing up..."
                mv .git/hooks/pre-commit .git/hooks/pre-commit.backup
              fi
              ln -s ../../scripts/pre-commit-hook.sh .git/hooks/pre-commit
              chmod +x .git/hooks/pre-commit
              echo "✅ Pre-commit hooks installed"
            '';
        };
        "test-hooks" = {
            description = "Test pre-commit hooks without committing.";
            exec = ''
              cd "$DEVENV_ROOT"
              ./scripts/pre-commit-hook.sh
            '';
        };
    };
  };
    };
  };
}
