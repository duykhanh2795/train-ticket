package kafka

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"reflect"
	"testing"

	notificationapp "example.com/train-ticket/internal/notification/application"
	"example.com/train-ticket/internal/platform/observability"
	kafkago "github.com/segmentio/kafka-go"
)

type readerStub struct {
	message      kafkago.Message
	calls        *[]string
	commitErrors int
	cancel       context.CancelFunc
}

func (r *readerStub) FetchMessage(context.Context) (kafkago.Message, error) {
	*r.calls = append(*r.calls, "fetch")
	return r.message, nil
}
func (r *readerStub) CommitMessages(context.Context, ...kafkago.Message) error {
	*r.calls = append(*r.calls, "commit")
	if r.commitErrors > 0 {
		r.commitErrors--
		return errors.New("broker unavailable")
	}
	r.cancel()
	return nil
}
func (r *readerStub) Close() error { return nil }

type receiverStub struct {
	calls   *[]string
	failure error
	cancel  context.CancelFunc
}

func (r receiverStub) Execute(context.Context, notificationapp.BookingEvent) (bool, error) {
	*r.calls = append(*r.calls, "process")
	if r.failure != nil && r.cancel != nil {
		r.cancel()
	}
	return false, r.failure
}

func TestCommitRetryDoesNotFetchAnotherMessage(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	calls := []string{}
	reader := &readerStub{message: kafkago.Message{Value: []byte(`{"event_id":"duplicate-event"}`)}, calls: &calls, commitErrors: 1, cancel: cancel}
	consumer := &Consumer{reader: reader, receiver: receiverStub{calls: &calls}, logger: slog.New(slog.NewTextHandler(io.Discard, nil)), metrics: observability.NewWorkerMetrics()}
	if err := consumer.Run(ctx); err != nil {
		t.Fatal(err)
	}
	if expected := []string{"fetch", "process", "commit", "commit"}; !reflect.DeepEqual(calls, expected) {
		t.Fatalf("calls=%v, want %v", calls, expected)
	}
}

func TestProcessingFailureNeverCommitsOffset(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	calls := []string{}
	consumer := &Consumer{
		reader:   &readerStub{message: kafkago.Message{Value: []byte(`{}`)}, calls: &calls, cancel: cancel},
		receiver: receiverStub{calls: &calls, failure: errors.New("database unavailable"), cancel: cancel},
		logger:   slog.New(slog.NewTextHandler(io.Discard, nil)), metrics: observability.NewWorkerMetrics(),
	}
	if err := consumer.Run(ctx); err != nil {
		t.Fatal(err)
	}
	if expected := []string{"fetch", "process"}; !reflect.DeepEqual(calls, expected) {
		t.Fatalf("calls=%v, want %v", calls, expected)
	}
}

func TestMalformedEventStopsWithoutCommit(t *testing.T) {
	calls := []string{}
	consumer := &Consumer{
		reader:   &readerStub{message: kafkago.Message{Value: []byte(`not-json`), Partition: 2, Offset: 42}, calls: &calls},
		receiver: receiverStub{calls: &calls}, logger: slog.New(slog.NewTextHandler(io.Discard, nil)), metrics: observability.NewWorkerMetrics(),
	}
	if err := consumer.Run(context.Background()); err == nil {
		t.Fatal("expected invalid event error")
	}
	if !reflect.DeepEqual(calls, []string{"fetch"}) {
		t.Fatalf("unexpected processing/commit: %v", calls)
	}
}
