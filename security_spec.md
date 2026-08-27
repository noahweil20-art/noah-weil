# Security Specification - Express Tools Hub

## Data Invariants
- A profile must exist for every user with at least 'user' role.
- Workspaces are private by default; only owners and explicitly allowed members (via email or uid) can read/write.
- Sub-resources (orders, promotions, products, competitors) MUST belong to a valid workspace.
- User email verification is required for non-anonymous sensitive operations.

## The "Dirty Dozen" Payloads

1. **Identity Spoofing**: Attempt to create a user profile with someone else's UID.
2. **Privilege Escalation**: User tries to update their own role to 'admin'.
3. **Ghost Field Injection**: Adding an `isVerified: true` field to a user profile update.
4. **ID Poisoning**: Injecting a 2KB string as a document ID.
5. **Relational Bypass**: Creating an order for a workspace the user doesn't belong to.
6. **Orphaned Writes**: Creating a sub-resource with a non-existent workspace ID.
7. **Terminal State Bypass**: Re-opening a 'cancelled' order.
8. **PII Leak**: A user attempting to 'get' another user's profile who is not themselves and they aren't admin.
9. **Query Scraping**: Listing all workspaces without filtering by ownership or membership.
10. **Resource Exhaustion**: Sending a 1MB string in the `displayName` field.
11. **Immutability Breach**: Attempting to change the `ownerId` of a workspace.
12. **Timestamp Fraud**: Providing a client-side `createdAt` timestamp from 2010.

## Test Runner - Placeholder for firestore.rules.test.ts
(The actual test file would be executed in a CI/CD environment with the Firebase Emulator)
