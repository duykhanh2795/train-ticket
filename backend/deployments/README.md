# Container deployment

The [Dockerfile](../Dockerfile) builds separate API, worker, and migration images
from the same Go module. It uses a cached build stage, a minimal runtime image,
and a non-root user. The build context excludes `config.yaml` and `.env` files.
Use environment variables at runtime; never put Neon credentials in build args
or commit them to Git.

## Local Compose with Neon and Kafka

Start Docker Desktop with the Linux container engine. In `backend/`:

```powershell
Copy-Item deployments/.env.example deployments/.env
```

Edit `deployments/.env` and set `DATABASE_URL` to your Neon connection string.
The `.env` file is ignored by Git. Then run:

```powershell
docker compose --env-file deployments/.env -f deployments/compose.kafka.yaml -f deployments/compose.backend.yaml --profile tools run --build --rm migrate
docker compose --env-file deployments/.env -f deployments/compose.kafka.yaml -f deployments/compose.backend.yaml up --build -d kafka kafka-init api worker frontend
docker compose --env-file deployments/.env -f deployments/compose.kafka.yaml -f deployments/compose.backend.yaml logs -f api worker frontend
```

Open `http://127.0.0.1:3000` for the frontend and
`http://127.0.0.1:8080/healthz` to check the API. The frontend reaches the API
over the Compose network at `http://api:8080`; browsers call the Next.js route
handlers, so this internal address is not exposed to them. The worker's metrics
server listens on port 9091 inside its container; it is not exposed publicly.
Run the migration command once per schema change before rolling out new API
and worker images. The migration command is a one-off container, not a long-lived
service. To stop the local services, run
`docker compose --env-file deployments/.env -f deployments/compose.kafka.yaml -f deployments/compose.backend.yaml down`.
Add `-v` only if you intend to remove the local Kafka volume.

The API and worker connect to Neon through `DATABASE_URL`. The worker releases
expired holds every five seconds and publishes outbox events to the local Kafka
broker at `kafka:19092`. Upstash Redis is not connected; PostgreSQL remains the
source of truth for seat reservations.

For a deployed environment, use your platform's secret manager to inject
`DATABASE_URL` at runtime, and provide a production Kafka endpoint. The local
Compose file is for development and demonstration; its single-node Kafka broker
is not a production cluster.
