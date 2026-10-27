# Auction House Challenge

A full-stack real-time auction platform built with React, Node.js, TypeScript, and PostgreSQL.

> **Project Status: Work in Progress**
>
> This project is currently under active development. Features, documentation, and deployment will be added progressively.

## About

Auction House Challenge is a web application designed to support online auctions, allowing auctioneers to manage lots and bidders to participate in real-time bidding.

Developed as part of the **Verzel Elite Dev 2026** technical challenge.

## Tech Stack

**Backend**

- Node.js
- TypeScript
- Express
- PostgreSQL
- Prisma
- Socket.IO (planned)

**Frontend (planned)**

- React
- TypeScript
- Vite
- Tailwind CSS

**Development Tools**

- Docker Compose
- ESLint
- Prettier
- Git & GitHub

## Current Progress

- [x] Initial monorepo configuration
- [x] Express API setup
- [x] PostgreSQL environment with Docker Compose
- [x] TypeScript, ESLint, and Prettier configuration
- [x] Database schema and migrations
- [x] Authentication and authorization
- [x] Auction management
- [ ] Real-time bidding
- [x] Wallet and settlement system
- [x] Bid history integrity verification (HMAC-SHA256, global consistency checks, signed checkpoints)
- [ ] Frontend implementation
- [x] Automated tests
- [ ] Deployment

> **Deployment note:** Bid history integrity verification is implemented and
> covered by automated tests. External checkpoint persistence and
> tamper-resistant retention must be configured and validated during deployment.

## Audit and Bid Integrity

The API maintains a tamper-evident audit chain for auction bids.

Each `BID_PLACED` event contains a cryptographic HMAC-SHA256
signature and a reference to the previous event.

The verification process checks:

- Audit chain continuity and cryptographic signatures.
- Consistency between database bids and signed audit events.
- Signed, versioned checkpoints stored outside PostgreSQL.
- Whether a checkpoint matches the corresponding database event.

### Administrative verification

`GET /api/audit/verify`

Requires authentication with the `AUCTIONEER` role.

The endpoint returns the verification result and, when
configured, checkpoint status and pending entries.

### Checkpoint configuration

Set `AUDIT_CHECKPOINT_DIR` to a persistent directory outside
the application repository.

The first checkpoint must be initialized explicitly against
a verified database state. Subsequent checkpoints are
synchronized periodically.

### Security limitations

Checkpoint synchronization is eventually consistent with
PostgreSQL commits. A successfully committed bid may not
yet have an external checkpoint.

Local files or ordinary persistent volumes are not immutable
storage. Protection against privileged deletion or rollback
requires independently managed, tamper-resistant retention.

The system does not claim that local checkpoint files alone
provide complete protection against privileged attackers.

## Documentation

Detailed setup instructions, architecture decisions, and API documentation will be added as development progresses.

---

**Status:** Under active development.
