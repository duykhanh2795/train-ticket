package postgres

import (
	"context"
	"errors"
	"fmt"
	"time"

	"example.com/train-ticket/internal/auth/adapters/outbound/postgres/sqlcgen"
	"example.com/train-ticket/internal/auth/application"
	"example.com/train-ticket/internal/auth/domain"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct{ pool *pgxpool.Pool }

var _ application.Repository = (*Repository)(nil)

func NewRepository(pool *pgxpool.Pool) (*Repository, error) {
	if pool == nil {
		return nil, errors.New("postgres connection pool is required")
	}
	return &Repository{pool: pool}, nil
}

func (r *Repository) CreateUserWithSession(ctx context.Context, user domain.User, tokenHash string, expiresAt time.Time) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin user registration: %w", err)
	}
	defer func() { _ = tx.Rollback(context.Background()) }()
	queries := sqlcgen.New(tx)
	err = queries.CreateAuthUser(ctx, sqlcgen.CreateAuthUserParams{
		ID: user.ID(), Email: user.Email(), FullName: user.FullName(), PasswordHash: user.PasswordHash(),
		CreatedAt: timestamp(user.CreatedAt()),
	})
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" && pgErr.ConstraintName == "auth_users_email_key" {
			return application.ErrEmailTaken
		}
		return fmt.Errorf("insert auth user: %w", err)
	}
	if err := queries.CreateAuthSession(ctx, sqlcgen.CreateAuthSessionParams{
		TokenHash: tokenHash, UserID: user.ID(), CreatedAt: timestamp(user.CreatedAt()), ExpiresAt: timestamp(expiresAt),
	}); err != nil {
		return fmt.Errorf("insert registration session: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit user registration: %w", err)
	}
	return nil
}

func (r *Repository) FindUserByEmail(ctx context.Context, email string) (domain.User, error) {
	row, err := sqlcgen.New(r.pool).FindAuthUserByEmail(ctx, email)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.User{}, application.ErrInvalidCredentials
	}
	if err != nil {
		return domain.User{}, fmt.Errorf("query user by email: %w", err)
	}
	return restore(row)
}

func (r *Repository) CreateSession(ctx context.Context, userID, tokenHash string, createdAt, expiresAt time.Time) error {
	if err := sqlcgen.New(r.pool).CreateAuthSession(ctx, sqlcgen.CreateAuthSessionParams{
		TokenHash: tokenHash, UserID: userID, CreatedAt: timestamp(createdAt), ExpiresAt: timestamp(expiresAt),
	}); err != nil {
		return fmt.Errorf("insert auth session: %w", err)
	}
	return nil
}

func (r *Repository) FindSessionUser(ctx context.Context, tokenHash string, at time.Time) (domain.User, error) {
	row, err := sqlcgen.New(r.pool).FindAuthSessionUser(ctx, sqlcgen.FindAuthSessionUserParams{TokenHash: tokenHash, At: timestamp(at)})
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.User{}, application.ErrUnauthenticated
	}
	if err != nil {
		return domain.User{}, fmt.Errorf("query auth session: %w", err)
	}
	return restore(row)
}

func (r *Repository) DeleteSession(ctx context.Context, tokenHash string) error {
	if err := sqlcgen.New(r.pool).DeleteAuthSession(ctx, tokenHash); err != nil {
		return fmt.Errorf("delete auth session: %w", err)
	}
	return nil
}

func restore(row sqlcgen.AuthUser) (domain.User, error) {
	if !row.CreatedAt.Valid {
		return domain.User{}, errors.New("auth user has no creation timestamp")
	}
	return domain.NewUser(row.ID, row.Email, row.FullName, row.PasswordHash, row.CreatedAt.Time)
}

func timestamp(value time.Time) pgtype.Timestamptz {
	return pgtype.Timestamptz{Time: value, Valid: true}
}
