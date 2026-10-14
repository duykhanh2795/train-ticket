package http

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
)

// APIError describes safe public information. Cause is only written to logs.
type APIError struct {
	Status  int
	Code    string
	Message string
	Cause   error
}

func (e *APIError) Error() string { return e.Message }
func (e *APIError) Unwrap() error { return e.Cause }

type ErrorResponse struct {
	Error     string `json:"error"`
	Code      string `json:"code"`
	RequestID string `json:"request_id"`
}

type Result struct {
	Status int
	Body   any
}
type HandlerFunc func(*gin.Context) (Result, error)

// Wrap keeps successful response DTOs unchanged and centralizes error rendering.
func Wrap(handler HandlerFunc) gin.HandlerFunc {
	return func(c *gin.Context) {
		result, err := handler(c)
		if err != nil {
			WriteError(c, err)
			return
		}
		c.JSON(result.Status, result.Body)
	}
}

func WriteError(c *gin.Context, err error) {
	var apiErr *APIError
	if !errors.As(err, &apiErr) || apiErr == nil {
		apiErr = &APIError{Status: http.StatusInternalServerError, Code: "internal_error", Message: "could not process request", Cause: err}
	}
	if apiErr.Status >= 500 && apiErr.Cause != nil {
		_ = c.Error(apiErr.Cause).SetType(gin.ErrorTypePrivate)
	}
	c.AbortWithStatusJSON(apiErr.Status, ErrorResponse{Error: apiErr.Message, Code: apiErr.Code, RequestID: RequestID(c.Request.Context())})
}
