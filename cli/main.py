import typer 
import os
import util 
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




if __name__ == "__main__":
    app()
