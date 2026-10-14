package http

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestErrorContractAndRequestCorrelation(t *testing.T) {
	var logs bytes.Buffer
	router := NewRouter(slog.New(slog.NewJSONHandler(&logs, nil)))
	router.GET("/conflict", Wrap(func(c *gin.Context) (Result, error) {
		return Result{}, fmt.Errorf("wrapped: %w", &APIError{Status: 409, Code: "seat_unavailable", Message: "seat unavailable", Cause: errors.New("private database detail")})
	}))
	response := httptest.NewRecorder()
	request := httptest.NewRequest("GET", "/conflict", nil)
	request.Header.Set("X-Request-ID", "client-controlled")
	router.ServeHTTP(response, request)
	var body ErrorResponse
	if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if response.Code != 409 || body.Code != "seat_unavailable" || body.RequestID == "" || body.RequestID == "client-controlled" || body.RequestID != response.Header().Get("X-Request-ID") {
		t.Fatalf("unexpected error: %d %+v", response.Code, body)
	}
	if !strings.Contains(logs.String(), body.RequestID) {
		t.Fatal("request ID missing from log")
	}
	if strings.Contains(response.Body.String(), "private database detail") {
		t.Fatal("private error exposed")
	}
}

func TestInternalErrorAndPanicAreSafeAndLogged(t *testing.T) {
	for _, panicHandler := range []bool{false, true} {
		var logs bytes.Buffer
		router := NewRouter(slog.New(slog.NewJSONHandler(&logs, nil)))
		router.GET("/failure", Wrap(func(*gin.Context) (Result, error) {
			if panicHandler {
				panic("private backend detail")
			}
			return Result{}, errors.New("private backend detail")
		}))
		response := httptest.NewRecorder()
		router.ServeHTTP(response, httptest.NewRequest("GET", "/failure", nil))
		if response.Code != 500 || strings.Contains(response.Body.String(), "private backend detail") {
			t.Fatalf("unsafe response: %d %s", response.Code, response.Body.String())
		}
		if !strings.Contains(logs.String(), "private backend detail") {
			t.Fatal("internal cause missing from log")
		}
	}
}

func TestUnknownRoutesAndOversizedRequests(t *testing.T) {
	router := NewRouter(slog.New(slog.NewJSONHandler(&bytes.Buffer{}, nil)))
	router.POST("/body", Wrap(func(c *gin.Context) (Result, error) {
		var data map[string]any
		if err := c.ShouldBindJSON(&data); err != nil {
			return Result{}, InvalidBody(err)
		}
		return Result{Status: 200, Body: data}, nil
	}))
	for _, tc := range []struct {
		method, path, body string
		status             int
	}{
		{method: "GET", path: "/missing", status: 404},
		{method: "GET", path: "/body", status: 405},
		{method: "POST", path: "/body", body: `{"x":"` + strings.Repeat("x", 1<<20) + `"}`, status: 413},
	} {
		response := httptest.NewRecorder()
		request := httptest.NewRequest(tc.method, tc.path, strings.NewReader(tc.body))
		// Exercise streaming bodies where Content-Length is unknown too.
		if tc.status == 413 {
			request.ContentLength = -1
		}
		router.ServeHTTP(response, request)
		if response.Code != tc.status || response.Header().Get("X-Request-ID") == "" {
			t.Fatalf("status=%d want=%d body=%s", response.Code, tc.status, response.Body.String())
		}
	}
}
