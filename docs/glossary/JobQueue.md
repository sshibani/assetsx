# JobQueue

**Category:** Infrastructure abstraction (package: `@assetx/queue`)

## Description

`JobQueue` is the interface for enqueuing and consuming background jobs (for example,
asset processing and publishing). It decouples producers (the API) from consumers
(the worker) and the underlying transport.

## Responsibilities

- Enqueue a named job with a typed payload.
- Allow a consumer to register a handler for a job type and process jobs.

## Implementations

- `InMemoryJobQueue` — in-process queue used for tests and local development.
- (Production) BullMQ-backed queue over Redis.

## Notes

- Job consumers run in the `@assetx/worker` app.
