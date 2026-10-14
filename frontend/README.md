# Train Ticket Frontend

Next.js App Router frontend for the multi-segment railway booking system.

The current demo supports registration, sign-in, trip search, segment-aware seat
availability, authenticated booking holds, and a demonstration confirmation
step. Confirmation does not charge a payment or issue a ticket yet.

## Local development

```powershell
npm run dev
```

Open <http://localhost:3000>. Run the Go API from `../backend` in another
terminal. Its default address is `http://localhost:8080`. Apply the migrations
and load `../backend/deployments/dev-seed.sql` for the sample `DEMO-SE1` trip.
The registration and login pages are available at `/register` and `/login`.
When a visitor tries to hold a seat, login returns them to the booking flow.
The Next.js route handlers keep the API
session token in an HttpOnly cookie; browser code only receives public user
details. Logging out revokes the session in the Go API.

Set `BACKEND_API_URL` in `.env.local` when the API is running at a different
address. Local development defaults to `http://localhost:8080`. Production
requires an explicit `BACKEND_API_URL`. Browser requests go through local
Next.js route handlers, so the backend URL stays on the server.

Application routes belong in `src/app`. Trip search and booking code live under
`src/features`. Reusable API and provider code lives under `src/shared`.
The interface uses a monochrome shadcn/ui theme and Tailwind utilities. The browser API
client and the Next.js backend proxy both use Axios. `globals.css` contains only
Tailwind and shadcn theme setup; page styling stays with the components.
The five station choices currently match the development seed data; station
management and fare calculation are future backend features.

## Build

```powershell
npm run build
```
