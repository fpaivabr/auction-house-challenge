# Database Design

## 1. Overview

Auction House uses **PostgreSQL 17** as its relational database and **Prisma ORM 7** for schema management, migrations, and type-safe data access.

The database design prioritizes:

- Financial consistency.
- Concurrent bid processing.
- Referential integrity.
- Traceability of wallet operations.
- Auditable bid history.
- Reproducible database migrations.

## 2. Why PostgreSQL?

PostgreSQL was selected because the auction domain involves strongly related entities and transactional operations.

The system must coordinate bid creation, wallet reservations, releases, and settlement without leaving inconsistent financial records.

PostgreSQL supports ACID transactions, row-level locking, foreign keys, unique constraints, and indexes, making it suitable for these requirements.

## 3. Why Prisma?

Prisma provides:

- Type-safe database queries.
- Declarative data models.
- Version-controlled migrations.
- Integration with TypeScript.
- A consistent data access interface.

Prisma does not replace SQL knowledge. Database-specific operations, such as explicit row locking and certain constraints, may require SQL.

## 4. Data Model

The initial domain model includes:

| Entity            | Responsibility                                 |
| ----------------- | ---------------------------------------------- |
| User              | Stores account information and roles           |
| Lot               | Represents an auction lot and its lifecycle    |
| Bid               | Records accepted bids                          |
| Wallet            | Stores the user's simulated balance            |
| WalletHold        | Represents funds reserved by bids              |
| WalletTransaction | Tracks financial movements                     |
| Settlement        | Records the financial settlement of an auction |
| Receipt           | Represents a shareable auction receipt         |
| AuditEntry        | Stores events for integrity verification       |

The Prisma schema is the source of truth for the current declarative data model.

## 5. Monetary Representation

Financial values are represented as **integer cents using BigInt**.

For example, BRL 150.75 is stored as `15075`.

This avoids binary floating-point rounding errors during monetary comparisons and calculations.

API responses must serialize these values appropriately because JavaScript BigInt values cannot be directly serialized using JSON.stringify.

## 6. Wallet Consistency

Each user has a wallet containing a simulated balance.

The available balance is calculated by subtracting active reservations from the wallet balance.

The intended invariant is:

`availableBalance = balance - sum(activeHolds)`

Bid placement must verify sufficient available funds before reserving the new amount.

When another bidder takes the lead, the previous reservation must be released within the same database transaction.

## 7. Concurrent Bidding

Concurrent bids must not cause lost updates or inconsistent wallet reservations.

The implementation will use PostgreSQL transactions and a defined locking order for affected records.

Bid validation, reservation updates, and lot price updates must be performed atomically.

The database is authoritative; frontend validation is only a user-experience improvement.

## 8. Auction Settlement

Settlement must be idempotent.

Each lot may have at most one settlement record, enforced through a unique constraint on `Settlement.lotId`.

Closing an auction must atomically:

1. Verify the final auction state.
2. Identify the winning bidder.
3. Capture the winning reservation.
4. Debit the winner's wallet.
5. Credit the auctioneer's wallet.
6. Record the corresponding financial movements.
7. Mark the lot as closed.

Retries must not produce duplicate financial transfers.

## 9. Referential Integrity and Constraints

The initial schema uses primary keys, foreign keys, unique constraints, and indexes.

Additional PostgreSQL constraints will be reviewed before the first migration, including:

- Nonnegative wallet balances.
- Positive bid amounts.
- Valid auction prices and increments.
- Valid financial reservation amounts.
- Consistent auction date ranges.
- Reservation uniqueness where required.

These constraints complement application-layer validation.

## 10. Audit Integrity

Audit entries contain an event payload, sequence, previous hash, and current hash.

A hash chain alone is not sufficient to guarantee tamper detection against an attacker who can rewrite database records and recompute hashes.

The implementation must define an independent integrity anchor, an appropriate verification mechanism, and a threat model covering unauthorized database modifications.

Audit verification will require dedicated automated tests.

## 11. External Catalog Resilience

Lots store a snapshot of relevant external product information.

This prevents existing auctions from depending on continued availability of the external catalog API.

External product identifiers are retained for traceability.

## 12. Indexing Strategy

Initial indexes support common access patterns such as:

- Listing lots by status and closing time.
- Finding lots created by an auctioneer.
- Retrieving bids for a lot.
- Retrieving wallet reservations by user and status.
- Retrieving wallet transactions chronologically.

Index usage and query performance should be reviewed as the application evolves.

## 13. Migration Strategy

Database structure changes will be managed through version-controlled Prisma migrations.

Migration files will be committed to Git.

Production deployment must apply existing migrations rather than recreate the schema or reset stored data.

Destructive migrations require explicit review.

## 14. Current Status

**Schema validated; initial migration pending.**

The data model and financial consistency rules are still under review. This document describes architectural decisions and intended guarantees, not a declaration that every mechanism has already been implemented and tested.
