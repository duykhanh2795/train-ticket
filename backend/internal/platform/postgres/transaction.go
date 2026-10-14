package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrTransactionRequired = errors.New("database operation requires an active transaction")

type DBTX interface {
	Exec(context.Context, string, ...interface{}) (pgconn.CommandTag, error)
	Query(context.Context, string, ...interface{}) (pgx.Rows, error)
	QueryRow(context.Context, string, ...interface{}) pgx.Row
}

type transactionContextKey struct{}

// WithTransaction attaches a transaction to the context for repositories that
// participate in the current application unit of work.
func WithTransaction(ctx context.Context, tx pgx.Tx) context.Context {
	return context.WithValue(ctx, transactionContextKey{}, tx)
}

// TransactionFromContext returns the transaction carried by the context.
func TransactionFromContext(ctx context.Context) (pgx.Tx, bool) {
	tx, ok := ctx.Value(transactionContextKey{}).(pgx.Tx)
	return tx, ok
}

func RequireTransaction(ctx context.Context) error {
	if _, ok := TransactionFromContext(ctx); !ok {
		return ErrTransactionRequired
	}
	return nil
}

// Executor selects the transaction when present and otherwise uses the pool.
// This lets read repositories work both inside and outside a unit of work.
func Executor(ctx context.Context, pool *pgxpool.Pool) DBTX {
	if tx, ok := TransactionFromContext(ctx); ok {
		return tx
	}
	return pool
}
