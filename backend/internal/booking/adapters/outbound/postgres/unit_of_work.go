package postgres

import (
	"context"
	"errors"
	"fmt"

	bookingapp "example.com/train-ticket/internal/booking/application"
	platformpostgres "example.com/train-ticket/internal/platform/postgres"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type UnitOfWork struct {
	pool *pgxpool.Pool
}

var _ bookingapp.UnitOfWork = (*UnitOfWork)(nil)

func NewUnitOfWork(pool *pgxpool.Pool) (*UnitOfWork, error) {
	if pool == nil {
		return nil, errors.New("postgres connection pool is required")
	}
	return &UnitOfWork{pool: pool}, nil
}

func (u *UnitOfWork) WithinTransaction(ctx context.Context, fn func(context.Context) error) error {
	if fn == nil {
		return errors.New("transaction callback is required")
	}
	if _, exists := platformpostgres.TransactionFromContext(ctx); exists {
		return errors.New("nested transactions are not supported")
	}

	tx, err := u.pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.ReadCommitted})
	if err != nil {
		return fmt.Errorf("begin booking transaction: %w", err)
	}
	defer func() { _ = tx.Rollback(context.Background()) }()

	txCtx := platformpostgres.WithTransaction(ctx, tx)
	if err := fn(txCtx); err != nil {
		return err
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit booking transaction: %w", err)
	}
	return nil
}
