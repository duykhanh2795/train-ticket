-- +goose Up
-- Gate access is provisioned by an operator; public registration never grants it.
CREATE TABLE gate_agents (
    user_id TEXT PRIMARY KEY REFERENCES auth_users(id) ON DELETE RESTRICT,
    station_id TEXT NOT NULL REFERENCES stations(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ticket_gate_scans (
    ticket_id TEXT PRIMARY KEY REFERENCES tickets(id) ON DELETE RESTRICT,
    gate_agent_id TEXT NOT NULL REFERENCES gate_agents(user_id) ON DELETE RESTRICT,
    station_id TEXT NOT NULL REFERENCES stations(id) ON DELETE RESTRICT,
    scanned_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX ticket_gate_scans_agent_time_idx
    ON ticket_gate_scans (gate_agent_id, scanned_at DESC);

-- +goose Down
DROP TABLE ticket_gate_scans;
DROP TABLE gate_agents;
