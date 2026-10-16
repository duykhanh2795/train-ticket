# syntax=docker/dockerfile:1

ARG GO_VERSION=1.27.2
FROM --platform=$BUILDPLATFORM golang:${GO_VERSION}-bookworm AS build

WORKDIR /src
COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod go mod download

COPY cmd/ ./cmd/
COPY internal/ ./internal/

ARG TARGETOS
ARG TARGETARCH
ARG APP=api
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    case "$APP" in api|worker|migrate) ;; *) echo "invalid APP: $APP" >&2; exit 1 ;; esac && \
    CGO_ENABLED=0 GOOS="${TARGETOS:-linux}" GOARCH="${TARGETARCH:-amd64}" \
    go build -trimpath -buildvcs=false -ldflags="-s -w" -o /out/app "./cmd/$APP"

FROM gcr.io/distroless/static-debian13:nonroot AS runtime
WORKDIR /app
COPY --from=build --chown=65532:65532 /out/app /app/app
# The migration command reads ./migrations from its working directory.
COPY --chown=65532:65532 migrations/ /app/migrations/
USER 65532:65532
EXPOSE 8080
ENTRYPOINT ["/app/app"]
