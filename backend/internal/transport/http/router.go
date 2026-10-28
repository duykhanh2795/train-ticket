package http

import (
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"
)

type RouteRegistrar interface {
	RegisterRoutes(routes *gin.RouterGroup)
}

func NewRouter(logger *slog.Logger, registrars ...RouteRegistrar) *gin.Engine {
	router := gin.New()
	// Gin otherwise trusts forwarded IP headers from every client by default.
	_ = router.SetTrustedProxies(nil)
	router.Use(requestContext(logger), recoverRequest(), limitRequestBody(1<<20))
	router.HandleMethodNotAllowed = true
	router.NoRoute(func(c *gin.Context) {
		WriteError(c, &APIError{Status: http.StatusNotFound, Code: "route_not_found", Message: "route was not found"})
	})
	router.NoMethod(func(c *gin.Context) {
		WriteError(c, &APIError{Status: http.StatusMethodNotAllowed, Code: "method_not_allowed", Message: "method is not allowed"})
	})

	router.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	api := router.Group("/api/v1")
	for _, registrar := range registrars {
		registrar.RegisterRoutes(api)
	}

	return router
}
