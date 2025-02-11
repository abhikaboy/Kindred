package xmongo

import "context"

type CollectionOperation func(ctx context.Context, name string) error
