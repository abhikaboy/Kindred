package auth

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"

	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"github.com/abhikaboy/Kindred/internal/xerr"
	"github.com/abhikaboy/Kindred/internal/xvalidator"
	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

/*
	Handler to execute business logic for Health Endpoint
*/

/*
	Given an email/username and password, check if the credentials are valid and return
	both an access token and a refresh token.
*/

func (h *Handler) Login(c *fiber.Ctx) error {
	var req LoginRequest
	err := c.BodyParser(&req)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(xerr.InvalidJSON())
	}

	errs := xvalidator.Validator.Validate(req)
	if len(errs) > 0 {
		return c.Status(fiber.StatusBadRequest).JSON(errs)
	}

	// database call to find the user and verify credentials and get count
	id, count, user, err := h.service.LoginFromCredentials(req.Email, req.Password)
	if err != nil {
		return err
	}

	access, refresh, err := h.service.GenerateTokens(id.Hex(), *count)
	c.Response().Header.Add("access_token", access)
	c.Response().Header.Add("refresh_token", refresh)

	return c.Status(fiber.StatusOK).JSON(user)
}

func (h *Handler) LoginWithToken(c *fiber.Ctx) error {
	// use the user_id from the context
	user_id := c.UserContext().Value("user_id")
	if user_id == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(xerr.BadRequest(errors.New("User ID is not found")))
	}

	user, err := h.service.GetUser(user_id.(string))
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(xerr.BadRequest(err))
	}

	return c.Status(fiber.StatusOK).JSON(user)
}

func (h *Handler) RegisterWithApple(c *fiber.Ctx) error {
	var req RegisterRequestApple
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(xerr.InvalidJSON())
	}
	slog.Info("Register Request With Apple", "request", req.AppleID)
	c.SetUserContext(context.WithValue(c.Context(), "apple_id", req.AppleID))

	return h.Register(c)
}

func (h *Handler) Register(c *fiber.Ctx) error {
	var req RegisterRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(xerr.InvalidJSON())
	}

	slog.Info("Register Request", "request", req, "apple_id", c.UserContext().Value("apple_id"))

	errs := xvalidator.Validator.Validate(&req)
	if len(errs) > 0 {
		return c.Status(fiber.StatusBadRequest).JSON(errs)
	}

	id := primitive.NewObjectID()

	access, refresh, err := h.service.GenerateTokens(id.Hex(), 0) // new users use count = 0

	if err != nil {
		return err
	}

	c.Response().Header.Add("access_token", access)
	c.Response().Header.Add("refresh_token", refresh)

	aaid := c.UserContext().Value("apple_id")
	googleid := c.UserContext().Value("google_id")

	fmt.Println(aaid)
	fmt.Println(googleid)

	if aaid == nil {
		aaid = ""
	}

	if googleid == nil {
		googleid = ""
	}

	user := User{
		Email:        req.Email,
		Password:     req.Password,
		ID:           id,
		RefreshToken: refresh,
		TokenUsed:    false,
		Count:        0,

		Categories:     make([]types.CategoryDocument, 0),
		Friends:        make([]primitive.ObjectID, 0),
		TasksComplete:  0,
		RecentActivity: make([]types.ActivityDocument, 0),

		DisplayName:    "Default Username",
		Handle:         "@default",
		ProfilePicture: "https://i.pinimg.com/736x/bd/46/35/bd463547b9ae986ba4d44d717828eb09.jpg",

		AppleID:  aaid.(string),
		GoogleID: googleid.(string),
	}

	// TODO: Validate using go validator package

	// if err = user.Validate(); err != nil {
	// 	return c.Status(fiber.StatusBadRequest).JSON(xerr.BadRequest(err))
	// }

	err = h.service.CreateUser(user)

	/*
		Create user could fail for the following reasons:
		1. User already exists
		   - Do a Login instead
		2. User started account creation but didn't finish
	*/

	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(xerr.BadRequest(err))
	}
	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"message": "User Created Successfully",
	})
}

func (h *Handler) LoginWithApple(c *fiber.Ctx) error {
	var req LoginRequestApple
	err := c.BodyParser(&req)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(xerr.InvalidJSON())
	}

	errs := xvalidator.Validator.Validate(req)
	if len(errs) > 0 {
		return c.Status(fiber.StatusBadRequest).JSON(errs)
	}

	// database call to find the user and verify credentials and get count
	id, count, user, err := h.service.LoginFromApple(req.AppleID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(err)
	}

	access, refresh, err := h.service.GenerateTokens(id.Hex(), *count)
	c.Response().Header.Add("access_token", access)
	c.Response().Header.Add("refresh_token", refresh)
	return c.Status(fiber.StatusOK).JSON(user)
}

func (h *Handler) Test(c *fiber.Ctx) error {
	return c.SendString("Authorized!")
}

func (h *Handler) AuthenticateMiddleware(c *fiber.Ctx) error {
	header := c.Get("Authorization")
	refreshToken := c.Get("refresh_token")

	if len(header) == 0 {
		return fiber.NewError(400, "Not Authorized, Tokens not passed")
	}

	split := strings.Split(header, " ")

	if len(split) != 2 {
		return fiber.NewError(400, "Not Authorized, Invalid Token Format")
	}
	tokenType, accessToken := split[0], split[1]

	if tokenType != "Bearer" {
		return fiber.NewError(400, "Not Authorized, Invalid Token Type")
	}

	access, refresh, user_id, err := h.ValidateAndGenerateTokens(c, accessToken, refreshToken)

	fmt.Println("saving user in this request: " + *user_id)

	context := context.WithValue(c.Context(), "user_id", *user_id)
	c.Request().Header.Set("id", accessToken)
	c.SetUserContext(context)

	c.Response().Header.Add("access_token", *access)
	c.Response().Header.Add("refresh_token", *refresh)

	if err != nil {
		return err
	}

	return c.Next()
}

func (h *Handler) ValidateRefreshToken(c *fiber.Ctx, refreshToken string) (float64, error) {
	// Okay, so the access token is invalid now we check if the refresh token is valid
	user_id, count, err := h.service.ValidateToken(refreshToken)
	if err != nil {
		return 0, fiber.NewError(400, "Not Authorized: Access and Refresh Tokens are Expired "+err.Error())
	}
	// Check if the refresh token is unused
	id, err := primitive.ObjectIDFromHex(user_id)
	if err != nil {
		return 0, fiber.NewError(400, "Not Authorized, Error Validating Token Reusage Invalid ID "+err.Error())
	}

	used, err := h.service.CheckIfTokenUsed(id)
	if err != nil {
		return 0, fiber.NewError(400, "Not Authorized, Error Validating Token Reusage "+err.Error())
	} else if used {
		return 0, fiber.NewError(400, "Not Authorized, Token Reuse Detected")
	}
	return count, nil
}

/*
	Given an access and refresh token, check if they are valid
	and return a new pair of tokens if refresh token is valid.
*/

func (h *Handler) ValidateAndGenerateTokens(c *fiber.Ctx, accessToken string, refreshToken string) (*string, *string, *string, error) {
	/*
		Check our tokens are valid by first checking if the access token is valid
		and then checking if the refresh token is valid if the access token is invalid
	*/
	user_id, count, err := h.service.ValidateToken(accessToken)
	var access_error error
	if err != nil {
		fmt.Println("access token is invalid or expired")
		access_error = fiber.NewError(400, "Not Authorized, Access Token is Invalid "+err.Error())
		count, err = h.ValidateRefreshToken(c, refreshToken)
		if err != nil {
			fmt.Println("refresh token is invalid or expired")
			return nil, nil, nil, err
		}
		fmt.Println("refresh token is valid")
		// now that we know the refresh is token, we can reset the error and get the user_id again.
		user_id, _, _ = h.service.ValidateToken(refreshToken)
		access_error = nil // reset the error since the refresh token is valid
	}
	// use the same count as the existing token
	// Our refresh token is valid and unused, so we can use it to generate a new set of tokens
	access, refresh, err := h.service.GenerateTokens(user_id, count)
	if err != nil {
		return nil, nil, nil, fiber.NewError(400, "Not Authorized, Error Generating Tokens")
	}

	if err := h.service.UseToken(user_id); err != nil {
		return nil, nil, nil, fiber.NewError(400, "Not Authorized, Error Updating Token Usage")
	}

	return &access, &refresh, &user_id, access_error
}

/*
	Given an access token, invalidate the access token and refresh token.
	Invalidate the token by increasing the "count" field by one.
*/

func (h *Handler) Logout(c *fiber.Ctx) error {
	header := c.Get("Authorization")

	if len(header) == 0 {
		return fiber.NewError(400, "Not Authorized, Tokens not passed")
	}

	split := strings.Split(header, " ")

	if len(split) != 2 {
		return fiber.NewError(400, "Not Authorized, Invalid Token Format")
	}
	tokenType, accessToken := split[0], split[1]

	if tokenType != "Bearer" {
		return fiber.NewError(400, "Not Authorized, Invalid Token Type")
	}
	// increase the count by one
	user_id, _, err := h.service.ValidateToken(accessToken)
	if err != nil {
		return err
	}
	err = h.service.InvalidateTokens(user_id)
	if err != nil {
		return err
	}
	return c.SendString("Logout Successful")
}

func (h *Handler) UpdatePushToken(c *fiber.Ctx) error {
	user_id := c.UserContext().Value("user_id")
	if user_id == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(xerr.BadRequest(errors.New("User ID is not found")))
	}

	var req UpdatePushTokenRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(xerr.InvalidJSON())
	}

	errs := xvalidator.Validator.Validate(req)
	if len(errs) > 0 {
		return c.Status(fiber.StatusBadRequest).JSON(errs)
	}

	user_id_obj, err := primitive.ObjectIDFromHex(user_id.(string))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(xerr.BadRequest(err))
	}

	err = h.service.UpdatePushToken(user_id_obj, req.PushToken)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(xerr.BadRequest(err))
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"message": "Push Token Updated Successfully",
	})
}
