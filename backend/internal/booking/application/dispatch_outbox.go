package application

import (
	"context"
	"errors"
	"fmt"
	"time"
)

type DispatchOutbox struct {
	outbox    OutboxRepository
	publisher EventPublisher
	owner     string
	clock     Clock
	batchSize int
	lease     time.Duration
}

func NewDispatchOutbox(
	outbox OutboxRepository,
	publisher EventPublisher,
	owner string,
	clock Clock,
	batchSize int,
	lease time.Duration,
) (*DispatchOutbox, error) {
	if outbox == nil || publisher == nil || owner == "" || clock == nil || batchSize <= 0 || lease <= 0 {
		return nil, errors.New("invalid outbox dispatcher dependencies")
	}
	return &DispatchOutbox{
		outbox: outbox, publisher: publisher, owner: owner,
		clock: clock, batchSize: batchSize, lease: lease,
	}, nil
}

// RunOnce publishes one leased batch. A crash after Kafka accepts a message
// but before MarkPublished can cause redelivery; consumers must deduplicate by
// message ID, so delivery is intentionally at-least-once.
func (d *DispatchOutbox) RunOnce(ctx context.Context) (int, error) {
	now := d.clock.Now()
	messages, err := d.outbox.Claim(ctx, d.owner, now, now.Add(d.lease), d.batchSize)
	if err != nil {
		return 0, fmt.Errorf("claim outbox messages: %w", err)
	}

	published := 0
	for _, message := range messages {
		if err := d.publisher.Publish(ctx, message); err != nil {
			if markErr := d.outbox.MarkFailed(ctx, message.ID, d.owner, d.clock.Now(), err); markErr != nil {
				return published, errors.Join(
					fmt.Errorf("publish outbox message %q: %w", message.ID, err),
					fmt.Errorf("record failed outbox message: %w", markErr),
				)
			}
			return published, fmt.Errorf("publish outbox message %q: %w", message.ID, err)
		}
		if err := d.outbox.MarkPublished(ctx, message.ID, d.owner, d.clock.Now()); err != nil {
			return published, fmt.Errorf("mark outbox message %q published: %w", message.ID, err)
		}
		published++
	}
	return published, nil
}
