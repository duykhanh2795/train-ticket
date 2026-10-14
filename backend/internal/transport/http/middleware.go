package http

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	platformid "example.com/train-ticket/internal/platform/id"
	"github.com/gin-gonic/gin"
)

type requestIDKey struct{}

func RequestID(ctx context.Context) string { id, _ := ctx.Value(requestIDKey{}).(string); return id }

func requestContext(logger *slog.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Generate an ID locally so arbitrary client headers cannot spoof log IDs.
		id, err := (platformid.UUIDGenerator{}).NewID()
		if err != nil {
			WriteError(c, err)
			logger.Error("generate request ID", "error", err)
			return
		}
		c.Request = c.Request.WithContext(context.WithValue(c.Request.Context(), requestIDKey{}, id))
		c.Header("X-Request-ID", id)
		started := time.Now()
		c.Next()
		route := c.FullPath()
		if route == "" {
			route = "unmatched"
		}
		attrs := []any{"request_id", id, "method", c.Request.Method, "route", route, "status", c.Writer.Status(), "duration", time.Since(started)}
		if errs := c.Errors.ByType(gin.ErrorTypePrivate); len(errs) > 0 {
			attrs = append(attrs, "errors", errs.Errors())
		}
		if c.Writer.Status() >= 500 {
			logger.ErrorContext(c.Request.Context(), "http request", attrs...)
		} else {
			logger.InfoContext(c.Request.Context(), "http request", attrs...)
		}
	}
}

func recoverRequest() gin.HandlerFunc {
	return gin.CustomRecoveryWithWriter(nil, func(c *gin.Context, recovered any) {
		WriteError(c, &APIError{Status: http.StatusInternalServerError, Code: "internal_error", Message: "could not process request", Cause: fmt.Errorf("handler panic: %v", recovered)})
	})
}

func limitRequestBody(maxBytes int64) gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.ContentLength > maxBytes {
			WriteError(c, &APIError{Status: http.StatusRequestEntityTooLarge, Code: "request_too_large", Message: "request body is too large"})
			return
		}
		if c.Request.Body != nil {
			c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxBytes)
		}
		c.Next()
	}
}

func InvalidBody(err error) error {
	var tooLarge *http.MaxBytesError
	if errors.As(err, &tooLarge) {
		return &APIError{Status: http.StatusRequestEntityTooLarge, Code: "request_too_large", Message: "request body is too large"}
	}
	return &APIError{Status: http.StatusBadRequest, Code: "invalid_request", Message: "invalid request body or fields"}
}
