import typer 
import os
import util 
import subprocess
import sys

app = typer.Typer()


@app.command()
def hello():
    print("Hello, World!")

@app.command()
def goodbye():
    print("Goodbye, World!")

@app.command()
def defaultCRUD(name: str):
    print("Generating backend CRUD...")
    # Create the directory
    os.makedirs(f"backend/internal/handlers/{util.lowercase(name)}", exist_ok=True)
    # Create the files
    h = open(f"backend/internal/handlers/{name}/{util.lowercase(name)}.go", "w")
    r = open(f"backend/internal/handlers/{name}/routes.go", "w")
    s = open(f"backend/internal/handlers/{name}/service.go", "w")
    t = open(f"backend/internal/handlers/{name}/types.go", "w")

    r.write(util.generate_routes(name))
    s.write(util.generate_service(name))
    t.write(util.generate_types(name))
    h.write(util.generate_handler(name))

@app.command()
def locationCRUD(name: str):
    print("Generating location based backend CRUD...")
    # Create the directory
    os.makedirs(f"backend/internal/handlers/{util.lowercase(name)}", exist_ok=True)
    # Create the files
    h = open(f"backend/internal/handlers/{name}/{util.lowercase(name)}.go", "w")
    r = open(f"backend/internal/handlers/{name}/routes.go", "w")
    s = open(f"backend/internal/handlers/{name}/service.go", "w")
    t = open(f"backend/internal/handlers/{name}/types.go", "w")

    r.write(util.generate_location_routes(name))
    s.write(util.generate_location_service(name))
    t.write(util.generate_location_types(name))
    h.write(util.generate_location_handler(name))

@app.command()
def update_cafe_thumbnails(
    dry_run: bool = typer.Option(True, "--dry-run/--execute", help="Run in dry-run mode by default, use --execute to perform actual updates"),
    connection_string: str = typer.Option(None, "--connection-string", help="MongoDB connection string"),
    database: str = typer.Option("studyapi", "--database", help="Database name"),
    collection: str = typer.Option("cafes", "--collection", help="Collection name"),
    new_url: str = typer.Option("@https://blog.rotacloud.com/content/images/2022/08/tony-lee-8IKf54pc3qk-unsplash-1.jpg", "--new-url", help="New thumbnail URL")
):
    """Update cafe thumbnail URLs that contain 'example' with a new URL."""
    
    script_path = os.path.join(os.path.dirname(__file__), "update_cafe_thumbnails.py")
    
    cmd = [sys.executable, script_path]
    cmd.extend(["--new-url", new_url])
    cmd.extend(["--database", database])
    cmd.extend(["--collection", collection])
    
    if connection_string:
        cmd.extend(["--connection-string", connection_string])
    
    if dry_run:
        cmd.append("--dry-run")
    else:
        cmd.append("--execute")
    
    try:
        result = subprocess.run(cmd, check=True)
        return result.returncode
    except subprocess.CalledProcessError as e:
        print(f"Error running cafe thumbnail update: {e}")
        return e.returncode


if __name__ == "__main__":
    app()
