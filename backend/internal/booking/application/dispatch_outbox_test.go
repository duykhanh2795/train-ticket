package application

import (
	"context"
	"errors"
	"reflect"
	"testing"
	"time"
)

type outboxStub struct {
	calls     *[]string
	markError error
}

func (o outboxStub) Enqueue(context.Context, OutboxMessage) error { return nil }
func (o outboxStub) Claim(context.Context, string, time.Time, time.Time, int) ([]OutboxMessage, error) {
	*o.calls = append(*o.calls, "claim")
	return []OutboxMessage{{ID: "one"}}, nil
}
func (o outboxStub) MarkPublished(context.Context, string, string, time.Time) error {
	*o.calls = append(*o.calls, "published")
	return o.markError
}
func (o outboxStub) MarkFailed(context.Context, string, string, time.Time, error) error {
	*o.calls = append(*o.calls, "failed")
	return nil
}

type publisherStub struct {
	calls   *[]string
	failure error
}

func (p publisherStub) Publish(context.Context, OutboxMessage) error {
	*p.calls = append(*p.calls, "publish")
	return p.failure
}

type fixedClock struct{}

func (fixedClock) Now() time.Time { return time.Unix(123, 0) }

func TestDispatchAcknowledgesOnlySuccessfulPublish(t *testing.T) {
	for _, tc := range []struct {
		name                string
		publishErr, markErr error
		count               int
		calls               []string
	}{
		{name: "success", count: 1, calls: []string{"claim", "publish", "published"}},
		{name: "broker failure", publishErr: errors.New("offline"), calls: []string{"claim", "publish", "failed"}},
		{name: "acknowledgement failure allows redelivery", markErr: errors.New("db offline"), calls: []string{"claim", "publish", "published"}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			calls := []string{}
			dispatcher, err := NewDispatchOutbox(outboxStub{calls: &calls, markError: tc.markErr}, publisherStub{calls: &calls, failure: tc.publishErr}, "worker", fixedClock{}, 1, time.Minute)
			if err != nil {
				t.Fatal(err)
			}
			count, err := dispatcher.RunOnce(context.Background())
			if count != tc.count || (err != nil) != (tc.publishErr != nil || tc.markErr != nil) {
				t.Fatalf("count=%d err=%v", count, err)
			}
			if !reflect.DeepEqual(calls, tc.calls) {
				t.Fatalf("calls=%v, want %v", calls, tc.calls)
			}
		})
	}
}
