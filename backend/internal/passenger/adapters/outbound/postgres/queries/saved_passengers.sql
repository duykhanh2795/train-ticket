-- name: CreateSavedPassenger :exec
INSERT INTO saved_passengers (id, owner_id, full_name, created_at)
VALUES ($1, $2, $3, $4);

-- name: ListSavedPassengersByOwner :many
SELECT id, owner_id, full_name, created_at
FROM saved_passengers
WHERE owner_id = $1
ORDER BY created_at DESC, id DESC;

-- name: GetSavedPassengerByIDAndOwner :one
SELECT id, owner_id, full_name, created_at
FROM saved_passengers
WHERE id = $1 AND owner_id = $2;

-- name: UpdateSavedPassenger :execrows
UPDATE saved_passengers
SET full_name = $3
WHERE id = $1 AND owner_id = $2;

-- name: DeleteSavedPassenger :execrows
DELETE FROM saved_passengers
WHERE id = $1 AND owner_id = $2;
