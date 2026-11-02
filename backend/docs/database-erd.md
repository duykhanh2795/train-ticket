# Database ER diagrams

These diagrams reflect the 19 tables created by `backend/migrations/000001` through
`000014`. They show primary keys, foreign keys, and selected business columns,
not every column, index, or check constraint. Every relationship line below
represents a **database foreign key**. Tables repeated across figures provide
context; they are not extra tables.

For an A4 Word report, export each figure separately as SVG and place it under
its own caption. Figure 2 is the widest and may benefit from a landscape page.
Keep detailed column descriptions in a data dictionary table rather than
shrinking the diagrams to fit all 19 tables on one page.

## Figure 1 — Timetable, seats, and fares

```mermaid
erDiagram
    direction TB
    stations ||--o{ trip_stops : station_id
    train_trips ||--o{ trip_stops : trip_id
    train_trips ||--o{ trip_seats : trip_id
    trip_stops ||--o{ trip_segment_fares : "trip_id, from_stop"

    stations {
        text id PK
        text code UK
        text name
        text city
    }
    train_trips {
        text id PK
        text train_number
        date service_date
        text status
    }
    trip_stops {
        text trip_id PK, FK
        smallint stop_order PK
        text station_id FK
        timestamptz arrival_at
        timestamptz departure_at
    }
    trip_seats {
        text trip_id PK, FK
        text seat_id PK
        text coach_number
        text seat_number
        text seat_type
    }
    trip_segment_fares {
        text trip_id PK, FK
        smallint from_stop PK, FK
        text seat_type PK
        bigint amount_vnd
    }
```

`trip_segment_fares.(trip_id, from_stop)` references
`trip_stops.(trip_id, stop_order)`. Each fare is for one adjacent stop segment
and seat type.

## Figure 2 — Booking, payment, and ticket issuance

```mermaid
erDiagram
    direction TB
    train_trips ||--o{ bookings : trip_id
    bookings ||--o{ seat_reservations : booking_id
    trip_seats ||--o{ seat_reservations : "trip_id, seat_id"
    seat_reservations ||--o| booking_passengers : "booking_id, seat_id"
    bookings ||--o{ payment_attempts : booking_id
    booking_passengers ||--o| tickets : "booking_id, seat_id"

    train_trips {
        text id PK
        text train_number
    }
    trip_seats {
        text trip_id PK, FK
        text seat_id PK
    }
    bookings {
        text id PK
        text customer_id
        text trip_id FK
        text status
        bigint fare_vnd
        timestamptz expires_at
    }
    seat_reservations {
        text booking_id PK, FK
        text seat_id PK, FK
        text trip_id FK
        smallint from_stop
        smallint to_stop
        text status
    }
    booking_passengers {
        text booking_id PK, FK
        text seat_id PK, FK
        text full_name
    }
    payment_attempts {
        bigint id PK
        text booking_id FK
        bigint amount_vnd
        text status
    }
    tickets {
        text id PK
        text booking_id FK
        text seat_id FK
        timestamptz issued_at
    }
```

The reservation references a seat by the **composite** key
`(trip_id, seat_id)`. A passenger belongs to the reservation identified by
`(booking_id, seat_id)`, and a ticket references that passenger by the same
pair. `bookings.customer_id` is a logical account identifier, **not** a
foreign key to `auth_users` in the current schema.

## Figure 3 — Accounts, administration, and gate checks

```mermaid
erDiagram
    direction TB
    auth_users ||--o{ auth_sessions : user_id
    auth_users ||--o{ saved_passengers : owner_id
    auth_users ||--o| admin_users : user_id
    auth_users ||--o| gate_agents : user_id
    stations ||--o{ gate_agents : station_id
    tickets ||--o| ticket_gate_scans : ticket_id
    gate_agents ||--o{ ticket_gate_scans : gate_agent_id
    stations ||--o{ ticket_gate_scans : station_id

    auth_users {
        text id PK
        text email UK
        text full_name
    }
    auth_sessions {
        text token_hash PK
        text user_id FK
        timestamptz expires_at
    }
    saved_passengers {
        text id PK
        text owner_id FK
        text full_name
    }
    admin_users {
        text user_id PK, FK
        timestamptz granted_at
    }
    gate_agents {
        text user_id PK, FK
        text station_id FK
    }
    stations {
        text id PK
        text name
    }
    tickets {
        text id PK
    }
    ticket_gate_scans {
        text ticket_id PK, FK
        text gate_agent_id FK
        text station_id FK
        timestamptz scanned_at
    }
```

`ticket_gate_scans.ticket_id` is both the primary key and a foreign key, so
one ticket can have at most one stored gate scan.

## Figure 4 — Outbox and notification delivery

```mermaid
erDiagram
    direction TB
    notification_inbox ||--o| notification_jobs : "consumer_name, event_id"

    outbox_messages {
        text id PK
        text aggregate_type
        text aggregate_id
        text event_type
        jsonb payload
        timestamptz published_at
    }
    notification_inbox {
        text consumer_name PK
        text event_id PK
        timestamptz processed_at
    }
    notification_jobs {
        bigint id PK
        text consumer_name FK
        text event_id FK
        text booking_id
        text customer_id
        text status
    }
```

`notification_jobs.(consumer_name, event_id)` references
`notification_inbox.(consumer_name, event_id)` and is unique. Outbox messages
reach the notification consumer through Kafka; there is **no database foreign
key** from `outbox_messages` to either notification table. The job's
`booking_id` and `customer_id` are also logical references, not foreign keys.
