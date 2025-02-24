def capitalize(name: str):
    return name.capitalize()
def lowercase(name: str):
    return name.lower()
def generate_service(name: str):
    return F"""
package {name}

import (
	"context"
	"log/slog"

	"github.com/abhikaboy/Kindred/xutils"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// newService receives the map of collections and picks out Jobs
func newService(collections map[string]*mongo.Collection) *Service {{
	return &Service{{
		{name}s: collections["{lowercase(name)}s"],
	}}
}}

// GetAll{name}s fetches all {name} documents from MongoDB
func (s *Service) GetAll{name}s() ([]{name}Document, error) {{
	ctx := context.Background()
	cursor, err := s.{name}s.Find(ctx, bson.M{{}})
	if err != nil {{
		return nil, err
	}}
	defer cursor.Close(ctx)

	var results []{name}Document
	if err := cursor.All(ctx, &results); err != nil {{
		return nil, err
	}}

	return results, nil
}}

// Get{name}ByID returns a single {name} document by its ObjectID
func (s *Service) Get{name}ByID(id primitive.ObjectID) (*{name}Document, error) {{
	ctx := context.Background()
	filter := bson.M{{"_id": id}}

	var {name} {name}Document
	err := s.{name}s.FindOne(ctx, filter).Decode(&{name})

	if err == mongo.ErrNoDocuments {{
		// No matching {name} found
		return nil, mongo.ErrNoDocuments
	}} else if err != nil {{
		// Different error occurred
		return nil, err
	}}

	return &{name}, nil
}}

// Insert{name} adds a new {name} document
func (s *Service) Create{name}(r *{name}Document) (*{name}Document, error) {{
	ctx := context.Background()
	// Insert the document into the collection

	result, err := s.{name}s.InsertOne(ctx, r)
	if err != nil {{
		return nil, err
	}}

	// Cast the inserted ID to ObjectID
	id := result.InsertedID.(primitive.ObjectID)
	r.ID = id
	slog.LogAttrs(ctx, slog.LevelInfo, "{name} inserted", slog.String("id", id.Hex()))

	return r, nil
}}

// UpdatePartial{name} updates only specified fields of a {name} document by ObjectID.
func (s *Service) UpdatePartial{name}(id primitive.ObjectID, updated Update{name}Document) error {{
	ctx := context.Background()
	filter := bson.M{{"_id": id}}

	updateFields, err := xutils.ToDoc(updated)
	if err != nil {{
		return err
	}}

	update := bson.M{{"$set": updateFields}}

	_, err = s.{name}s.UpdateOne(ctx, filter, update)
	return err
}}

// Delete{name} removes a {name} document by ObjectID.
func (s *Service) Delete{name}(id primitive.ObjectID) error {{
	ctx := context.Background()

	filter := bson.M{{"_id": id}}

	_, err := s.{name}s.DeleteOne(ctx, filter)
	return err
}}

"""
def generate_types(name: str):
    return F"""
package {name}

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

type Create{name}Params struct {{
	Field1   string      `validate:"required" json:"field1"`
	Field2   Enumeration `validate:"required" json:"field2"`
	Picture  *string     `validate:"required" json:"picture"`
}}

type {name}Document struct {{
	ID        primitive.ObjectID `bson:"_id" json:"id"`
	Field1    string            `bson:"field1" json:"field1"`
	Field2    Enumeration       `bson:"field2" json:"field2"`
	Picture   *string           `bson:"picture" json:"picture"`
	Timestamp time.Time         `bson:"timestamp" json:"timestamp"`
}}

type Update{name}Document struct {{
	Field1   string      `bson:"field1,omitempty" json:"field1,omitempty"`
	Field2   Enumeration `bson:"field2,omitempty" json:"field2,omitempty"`
	Picture  *string     `bson:"picture,omitempty" json:"picture,omitempty"`
}}

type Enumeration string

const (
	Option1 Enumeration = "Option1"
	Option2 Enumeration = "Option2"
	Option3 Enumeration = "Option3"
)


/*
{name} Service to be used by {name} Handler to interact with the
Database layer of the application
*/

type Service struct {{
	{capitalize(name)}s *mongo.Collection
}}
"""
def generate_handler(name: str):
    return F"""
package {name}

import (
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/go-playground/validator/v10"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Handler struct {{
	service *Service
}}

func (h *Handler) Create{name}(c *fiber.Ctx) error {{
	var params Create{name}Params
	if err := c.BodyParser(&params); err != nil {{
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{{
			"error": "Invalid request body",
		}})
	}}

	validate := validator.New()
	if err := validate.Struct(params); err != nil {{
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{{
			"error": "Validation failed",
		}})
	}}

	doc := {name}Document{{
		ID:        primitive.NewObjectID(),
		Field1:    params.Field1,
		Field2:    params.Field2,
		Picture:   params.Picture,
		Timestamp: time.Now(),
	}}

	_, err := h.service.Create{name}(&doc); 
    if err != nil {{
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{{
			"error": "Failed to create {name}",
		}})
	}}

	return c.Status(fiber.StatusCreated).JSON(doc)
}}

func (h *Handler) Get{name}s(c *fiber.Ctx) error {{
	{name}s, err := h.service.GetAll{name}s()
	if err != nil {{
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{{
			"error": "Failed to fetch {name}s",
		}})
	}}

	return c.JSON({name}s)
}}

func (h *Handler) Get{name}(c *fiber.Ctx) error {{
	id, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {{
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{{
			"error": "Invalid ID format",
		}})
	}}

	{name}, err := h.service.Get{name}ByID(id)
	if err != nil {{
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{{
			"error": "{name} not found",
		}})
	}}

	return c.JSON({name})
}}

func (h *Handler) UpdatePartial{name}(c *fiber.Ctx) error {{
	id, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {{
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{{
			"error": "Invalid ID format",
		}})
	}}

	var update Update{name}Document
	if err := c.BodyParser(&update); err != nil {{
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{{
			"error": "Invalid request body",
		}})
	}}

	if err := h.service.UpdatePartial{name}(id, update); err != nil {{
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{{
			"error": "Failed to update {name}",
		}})
	}}

	return c.SendStatus(fiber.StatusOK)
}}

func (h *Handler) Delete{name}(c *fiber.Ctx) error {{
	id, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {{
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{{
			"error": "Invalid ID format",
		}})
	}}

	if err := h.service.Delete{name}(id); err != nil {{
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{{
			"error": "Failed to delete {name}",
		}})
	}}

	return c.SendStatus(fiber.StatusOK)
}}
"""
def generate_routes(name: str):
    return  F"""
package {name}
import (
    "github.com/gofiber/fiber/v2"
    "go.mongodb.org/mongo-driver/mongo"
)

/*
Router maps endpoints to handlers
*/
func Routes(app *fiber.App, collections map[string]*mongo.Collection) {{
    service := newService(collections)
    handler := Handler{{service}}

    // Add a group for API versioning
    apiV1 := app.Group("/api/v1")

    // Add Sample group under API Version 1
    {name}s := apiV1.Group("/{name}s")

    {name}s.Post("/", handler.Create{name})
    {name}s.Get("/", handler.Get{name}s)
    {name}s.Get("/:id", handler.Get{name})
    {name}s.Patch("/:id", handler.UpdatePartial{name})
    {name}s.Delete("/:id", handler.Delete{name})


}}"""

def generate_location_service(name: str):
    return F"""
package {name}

import (
    "context"
    "log/slog"

    "github.com/abhikaboy/Kindred/xutils"
    "go.mongodb.org/mongo-driver/bson"
    "go.mongodb.org/mongo-driver/bson/primitive"
    "go.mongodb.org/mongo-driver/mongo"
)

// newService receives the map of collections and picks out Jobs
func newService(collections map[string]*mongo.Collection) *Service {{
    return &Service{{
        {name}s: collections["{lowercase(name)}s"],
    }}
}}

// GetAll{name}s fetches all {name} documents from MongoDB
func (s *Service) GetAll{name}s() ([]{name}Document, error) {{
    ctx := context.Background()
    cursor, err := s.{name}s.Find(ctx, bson.M{{}})
    if err != nil {{
        return nil, err
    }}
    defer cursor.Close(ctx)

    var results []{name}Document
    if err := cursor.All(ctx, &results); err != nil {{
        return nil, err
    }}

    return results, nil
}}

// Get{name}ByID returns a single {name} document by its ObjectID
func (s *Service) Get{name}ByID(id primitive.ObjectID) (*{name}Document, error) {{
    ctx := context.Background()
    filter := bson.M{{"_id": id}}

    var {name} {name}Document
    err := s.{name}s.FindOne(ctx, filter).Decode(&{name})

    if err == mongo.ErrNoDocuments {{
        return nil, mongo.ErrNoDocuments
    }} else if err != nil {{
        return nil, err
    }}

    return &{name}, nil
}}

// Insert{name} adds a new {name} document
func (s *Service) Insert{name}(r {name}Document) (*{name}Document, error) {{
    ctx := context.Background()
    result, err := s.{name}s.InsertOne(ctx, r)
    if err != nil {{
        return nil, err
    }}

    id := result.InsertedID.(primitive.ObjectID)
    r.ID = id
    slog.LogAttrs(ctx, slog.LevelInfo, "{name} inserted", slog.String("id", id.Hex()))

    return &r, nil
}}

// UpdatePartial{name} updates only specified fields of a {name} document by ObjectID.
func (s *Service) UpdatePartial{name}(id primitive.ObjectID, updated Update{name}Document) error {{
    ctx := context.Background()
    filter := bson.M{{"_id": id}}

    updateFields, err := xutils.ToDoc(updated)
    if err != nil {{
        return err
    }}

    update := bson.M{{"$set": updateFields}}

    _, err = s.{name}s.UpdateOne(ctx, filter, update)
    return err
}}

// Delete{name} removes a {name} document by ObjectID.
func (s *Service) Delete{name}(id primitive.ObjectID) error {{
    ctx := context.Background()
    filter := bson.M{{"_id": id}}
    _, err := s.{name}s.DeleteOne(ctx, filter)
    return err
}}

// GetNearby{name}s fetches {name} documents within a radius of a location
func (s *Service) GetNearby{name}s(location []float64, radius float64) ([]{name}Document, error) {{
    ctx := context.Background()
    filter := bson.M{{
        "location": bson.M{{
            "$near": location,
            "$maxDistance": radius,
        }},
    }}
    cursor, err := s.{name}s.Find(ctx, filter)
    if err != nil {{
        return nil, err
    }}

    defer cursor.Close(ctx)

    var results []{name}Document
    if err := cursor.All(ctx, &results); err != nil {{
        return nil, err
    }}

    return results, nil
}}
"""

def generate_location_types(name: str):
    return F"""
package {name}

import (
    "time"

    "go.mongodb.org/mongo-driver/bson/primitive"
    "go.mongodb.org/mongo-driver/mongo"
)

type Create{name}Params struct {{
    Field1    string      `validate:"required" json:"field1"`
    Field2    Enumeration `validate:"required" json:"field2"`
    Location *[]float64   `validate:"required" json:"location"`
    Picture   *string     `validate:"required" json:"picture"`
}}

type {name}Document struct {{
    ID        primitive.ObjectID `bson:"_id" json:"id"`
    Field1    string            `bson:"field1" json:"field1"`
    Field2    Enumeration       `bson:"field2" json:"field2"`
    Location  *[]float64        `bson:"location" json:"location"`
    Picture   *string           `bson:"picture" json:"picture"`
    Timestamp time.Time         `bson:"timestamp" json:"timestamp"`
}}

type Update{name}Document struct {{
    Field1    string      `bson:"field1,omitempty" json:"field1,omitempty"`
    Field2    Enumeration `bson:"field2,omitempty" json:"field2,omitempty"`
    Location *[]float64   `bson:"location,omitempty" json:"location,omitempty"`
    Picture   *string     `bson:"picture,omitempty" json:"picture,omitempty"`
}}

type GetNearby{name}sParams struct {{
    Location []float64 `validate:"required" json:"location"`
    Radius   float64   `validate:"required" json:"radius"`
}}

type Enumeration string

const (
    Option1 Enumeration = "Option1"
    Option2 Enumeration = "Option2"
    Option3 Enumeration = "Option3"
)

type Service struct {{
    {name}s *mongo.Collection
}}
"""

def generate_location_handler(name: str):
    return F"""
package {name}

import (
    "errors"
    "log/slog"
    "time"

    "github.com/abhikaboy/Kindred/internal/xerr"
    "github.com/abhikaboy/Kindred/internal/xvalidator"
    go_json "github.com/goccy/go-json"
    "github.com/gofiber/fiber/v2"
    "go.mongodb.org/mongo-driver/bson/primitive"
    "go.mongodb.org/mongo-driver/mongo"
)

type Handler struct {{
    service *Service
}}

func (h *Handler) Create{name}(c *fiber.Ctx) error {{
    ctx := c.Context()
    var {name} {name}Document
    var params Create{name}Params

    slog.LogAttrs(ctx, slog.LevelInfo, "Inserting {name}")
    err := c.BodyParser(&params)
    if err != nil {{
        return err
    }}
    errs := xvalidator.Validator.Validate(params)
    if len(errs) > 0 {{
        return c.Status(fiber.StatusBadRequest).JSON(errs)
    }}

    {name} = {name}Document{{
        Field1:    params.Field1,
        Field2:    params.Field2,
        Location:  params.Location,
        Picture:   params.Picture,
        Timestamp: time.Now(),
        ID:        primitive.NewObjectID(),
    }}

    result, err := h.service.Insert{name}({name})
    if err != nil {{
        sErr := err.(mongo.WriteException)
        if sErr.HasErrorCode(121) {{
            return xerr.WriteException(c, sErr)
        }}
    }}

    return c.JSON(result)
}}

func (h *Handler) Get{name}s(c *fiber.Ctx) error {{
    {name}s, err := h.service.GetAll{name}s()
    if err != nil {{
        return err
    }}
    return c.JSON({name}s)
}}

func (h *Handler) Get{name}(c *fiber.Ctx) error {{
    id, err := primitive.ObjectIDFromHex(c.Params("id"))
    if err != nil {{
        return c.Status(fiber.StatusBadRequest).JSON(xerr.BadRequest(err))
    }}

    {name}, err := h.service.Get{name}ByID(id)
    if err != nil {{
        if errors.Is(err, mongo.ErrNoDocuments) {{
            return c.Status(fiber.StatusNotFound).JSON(xerr.NotFound("{name}", "id", id.Hex()))
        }}
        return err
    }}
    return c.JSON({name})
}}

func (h *Handler) UpdatePartial{name}(c *fiber.Ctx) error {{
    id, err := primitive.ObjectIDFromHex(c.Params("id"))
    if err != nil {{
        return c.Status(fiber.StatusBadRequest).JSON(xerr.BadRequest(err))
    }}

    var partialUpdate Update{name}Document
    if err := go_json.Unmarshal(c.Body(), &partialUpdate); err != nil {{
        return c.Status(fiber.StatusBadRequest).JSON(xerr.InvalidJSON())
    }}

    err = h.service.UpdatePartial{name}(id, partialUpdate)
    if err != nil {{
        return err
    }}

    return c.SendStatus(fiber.StatusOK)
}}

func (h *Handler) Delete{name}(c *fiber.Ctx) error {{
    id, err := primitive.ObjectIDFromHex(c.Params("id"))
    if err != nil {{
        return c.Status(fiber.StatusBadRequest).JSON(xerr.BadRequest(err))
    }}

    if err := h.service.Delete{name}(id); err != nil {{
        return err
    }}

    return c.SendStatus(fiber.StatusNoContent)
}}

func (h *Handler) GetNearby{name}s(c *fiber.Ctx) error {{
    var params GetNearby{name}sParams

    err := c.BodyParser(&params)
    if err != nil {{
        return c.Status(fiber.StatusBadRequest).JSON(xerr.InvalidJSON())
    }}

    {name}s, err := h.service.GetNearby{name}s(params.Location, params.Radius)
    if err != nil {{
        return err
    }}

    return c.JSON({name}s)
}}
"""

def generate_location_routes(name: str):
    return F"""
package {name}

import (
    "github.com/gofiber/fiber/v2"
    "go.mongodb.org/mongo-driver/mongo"
)

func Routes(app *fiber.App, collections map[string]*mongo.Collection) {{
    service := newService(collections)
    handler := Handler{{service}}

    apiV1 := app.Group("/api/v1")
    {name}s := apiV1.Group("/{lowercase(name)}s")

    {name}s.Post("/", handler.Create{name})
    {name}s.Get("/", handler.Get{name}s)
    {name}s.Post("/nearby", handler.GetNearby{name}s)
    {name}s.Get("/:id", handler.Get{name})
    {name}s.Patch("/:id", handler.UpdatePartial{name})
    {name}s.Delete("/:id", handler.Delete{name})
}}
"""

