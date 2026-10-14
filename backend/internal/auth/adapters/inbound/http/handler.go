package http

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"example.com/train-ticket/internal/auth/application"
	"example.com/train-ticket/internal/auth/domain"
	transporthttp "example.com/train-ticket/internal/transport/http"
	"github.com/gin-gonic/gin"
)

type AuthUseCase interface {
	Register(context.Context, application.RegisterCommand) (application.Session, error)
	Login(context.Context, application.Credentials) (application.Session, error)
	Authenticate(context.Context, string) (domain.User, error)
	Logout(context.Context, string) error
}

type Handler struct{ auth AuthUseCase }

func NewHandler(auth AuthUseCase) *Handler { return &Handler{auth: auth} }

type registerRequest struct {
	Email    string `json:"email" binding:"required,max=254"`
	FullName string `json:"full_name" binding:"required,max=100"`
	Password string `json:"password" binding:"required,max=72"`
}
type loginRequest struct {
	Email    string `json:"email" binding:"required,max=254"`
	Password string `json:"password" binding:"required"`
}
type userResponse struct {
	ID       string `json:"id"`
	Email    string `json:"email"`
	FullName string `json:"full_name"`
}
type sessionResponse struct {
	User         userResponse `json:"user"`
	SessionToken string       `json:"session_token"`
	ExpiresAt    string       `json:"expires_at"`
}

func (h *Handler) RegisterRoutes(routes *gin.RouterGroup) {
	routes.POST("/auth/register", transporthttp.Wrap(h.register))
	routes.POST("/auth/login", transporthttp.Wrap(h.login))
	protected := routes.Group("/auth", h.RequireSession())
	protected.GET("/me", transporthttp.Wrap(h.me))
	protected.POST("/logout", transporthttp.Wrap(h.logout))
}

func (h *Handler) RequireSession() gin.HandlerFunc {
	return func(c *gin.Context) {
		token := bearerToken(c)
		if token == "" {
			transporthttp.WriteError(c, unauthorized())
			return
		}
		user, err := h.auth.Authenticate(c.Request.Context(), token)
		if err != nil {
			if errors.Is(err, application.ErrUnauthenticated) {
				transporthttp.WriteError(c, unauthorized())
				return
			}
			transporthttp.WriteError(c, &transporthttp.APIError{Status: http.StatusInternalServerError, Code: "internal_error", Message: "could not verify session", Cause: err})
			return
		}
		c.Request = c.Request.WithContext(transporthttp.WithUserID(c.Request.Context(), user.ID()))
		c.Next()
	}
}

func (h *Handler) register(c *gin.Context) (transporthttp.Result, error) {
	var request registerRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		return transporthttp.Result{}, transporthttp.InvalidBody(err)
	}
	session, err := h.auth.Register(c.Request.Context(), application.RegisterCommand{Email: request.Email, FullName: request.FullName, Password: request.Password})
	if err != nil {
		return transporthttp.Result{}, mapAuthError(err)
	}
	c.Header("Cache-Control", "no-store")
	return transporthttp.Result{Status: http.StatusCreated, Body: sessionResponse{User: publicUser(session.User), SessionToken: session.Token, ExpiresAt: session.ExpiresAt.Format(http.TimeFormat)}}, nil
}

func (h *Handler) login(c *gin.Context) (transporthttp.Result, error) {
	var request loginRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		return transporthttp.Result{}, transporthttp.InvalidBody(err)
	}
	session, err := h.auth.Login(c.Request.Context(), application.Credentials{Email: request.Email, Password: request.Password})
	if err != nil {
		return transporthttp.Result{}, mapAuthError(err)
	}
	c.Header("Cache-Control", "no-store")
	return transporthttp.Result{Status: http.StatusOK, Body: sessionResponse{User: publicUser(session.User), SessionToken: session.Token, ExpiresAt: session.ExpiresAt.Format(http.TimeFormat)}}, nil
}

func (h *Handler) me(c *gin.Context) (transporthttp.Result, error) {
	token := bearerToken(c)
	user, err := h.auth.Authenticate(c.Request.Context(), token)
	if err != nil {
		return transporthttp.Result{}, mapAuthError(err)
	}
	c.Header("Cache-Control", "no-store")
	return transporthttp.Result{Status: http.StatusOK, Body: gin.H{"user": publicUser(user)}}, nil
}

func (h *Handler) logout(c *gin.Context) (transporthttp.Result, error) {
	if err := h.auth.Logout(c.Request.Context(), bearerToken(c)); err != nil {
		return transporthttp.Result{}, mapAuthError(err)
	}
	return transporthttp.Result{Status: http.StatusOK, Body: gin.H{"status": "ok"}}, nil
}

func publicUser(user domain.User) userResponse {
	return userResponse{ID: user.ID(), Email: user.Email(), FullName: user.FullName()}
}

func bearerToken(c *gin.Context) string {
	value := c.GetHeader("Authorization")
	if len(value) < 8 || !strings.EqualFold(value[:7], "Bearer ") {
		return ""
	}
	token := strings.TrimSpace(value[7:])
	if len(token) < 32 || len(token) > 256 || strings.ContainsAny(token, " \t\r\n") {
		return ""
	}
	return token
}

func unauthorized() error {
	return &transporthttp.APIError{Status: http.StatusUnauthorized, Code: "unauthenticated", Message: "please sign in"}
}

func mapAuthError(err error) error {
	switch {
	case errors.Is(err, application.ErrInvalidRegistration):
		return &transporthttp.APIError{Status: http.StatusBadRequest, Code: "invalid_registration", Message: "use a valid email, name, and password of 12 to 72 bytes"}
	case errors.Is(err, application.ErrEmailTaken):
		return &transporthttp.APIError{Status: http.StatusConflict, Code: "email_taken", Message: "email is already registered"}
	case errors.Is(err, application.ErrInvalidCredentials):
		return &transporthttp.APIError{Status: http.StatusUnauthorized, Code: "invalid_credentials", Message: "invalid email or password"}
	case errors.Is(err, application.ErrUnauthenticated):
		return unauthorized()
	default:
		return &transporthttp.APIError{Status: http.StatusInternalServerError, Code: "internal_error", Message: "could not process authentication", Cause: err}
	}
}
