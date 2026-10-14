-- name: CreateAuthUser :exec
INSERT INTO auth_users (id, email, full_name, password_hash, created_at)
VALUES (sqlc.arg(id), sqlc.arg(email), sqlc.arg(full_name), sqlc.arg(password_hash), sqlc.arg(created_at));

-- name: FindAuthUserByEmail :one
SELECT id, email, full_name, password_hash, created_at
FROM auth_users
WHERE email = sqlc.arg(email);

-- name: CreateAuthSession :exec
INSERT INTO auth_sessions (token_hash, user_id, created_at, expires_at)
VALUES (sqlc.arg(token_hash), sqlc.arg(user_id), sqlc.arg(created_at), sqlc.arg(expires_at));

-- name: FindAuthSessionUser :one
SELECT users.id, users.email, users.full_name, users.password_hash, users.created_at
FROM auth_sessions AS sessions
JOIN auth_users AS users ON users.id = sessions.user_id
WHERE sessions.token_hash = sqlc.arg(token_hash)
  AND sessions.expires_at > sqlc.arg(at);

-- name: DeleteAuthSession :exec
DELETE FROM auth_sessions WHERE token_hash = sqlc.arg(token_hash);
