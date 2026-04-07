# Emotion Data Privacy Encryption Design

## Summary

This design protects sensitive user business data in the Emotion project while preserving the existing login experience.

The current frontend already delegates password handling to Supabase Auth, so this project does not currently store passwords in its own business tables. The main privacy issue is that sensitive user content is stored in plaintext in `user_files`, especially:

- `file_content`
- `blocks_data`
- `mappings_data`

The selected design keeps Supabase Auth for authentication, adds a trusted backend boundary for sensitive reads and writes, encrypts sensitive fields at the application layer, and keeps non-sensitive metadata in plaintext for basic listing and filtering.

## Goals

- Prevent ordinary database readers, operators, or developers from seeing transcript plaintext by directly querying tables.
- Preserve automatic decryption after the user signs in.
- Keep the current authentication model based on Supabase Auth.
- Keep basic metadata search and listing working.
- Avoid data migration work because there is no production data to migrate yet.
- Record the eventual implementation changes in the branch README.

## Non-Goals

- Replacing Supabase Auth with a custom password system.
- Designing end-to-end encryption with a second user-managed secret.
- Protecting against a fully compromised trusted backend.
- Adding full-text search over encrypted transcript content.
- Refactoring the AI analysis flow in this change.

## Confirmed Product Decisions

- Continue using Supabase Auth.
- Use a trusted backend or edge function layer.
- Optimize for automatic decryption after login.
- Defend primarily against direct database inspection by ordinary operators or developers.
- Keep `original_name` in plaintext.
- Do not migrate old data.
- Do not handle `analysis_data` in this change.
- Update the current branch README during implementation.

## Password and Authentication Boundary

Passwords must not be stored with reversible encryption. They must be verified through salted one-way hashing handled by the authentication provider.

This design keeps all password responsibilities inside Supabase Auth:

- Registration stays on `supabase.auth.signUp`.
- Login stays on `supabase.auth.signInWithPassword`.
- The new trusted backend validates the Supabase session or JWT.
- The trusted backend never stores, logs, forwards, or transforms raw user passwords.

Implication: the privacy redesign focuses on business data encryption, not custom password storage.

## Sensitive Data Scope

### Plaintext metadata retained

These fields remain plaintext to support basic UX and search:

- `id`
- `user_id`
- `folder_id`
- `file_name`
- `original_name`
- `file_meta`
- `created_at`
- `updated_at`

### Encrypted fields

These fields become application-layer encrypted:

- `file_content`
- `blocks_data`
- `mappings_data`

### Explicitly out of scope for this change

- `analysis_data`

The AI analysis feature is not active yet, so it is intentionally excluded from the first privacy rollout. It should be covered by a future security design when that workflow is enabled.

## Cryptography Design

### Algorithm

Use `AES-256-GCM` for application-layer field encryption.

Reasons:

- Standard AEAD scheme.
- Supported well by modern backend runtimes.
- Provides confidentiality and integrity in one primitive.
- Good fit for a trusted backend or edge-function architecture.

### IV and integrity

For every encryption operation:

- Generate a fresh random IV or nonce.
- Never reuse the IV with the same key.
- Reject decryption if authentication fails.

### AAD binding

Use AEAD additional authenticated data to bind encrypted values to their context:

- `user_id`
- `file_id`
- `field_name`
- `crypto_version`

This prevents ciphertext from being copied across users or fields without detection.

### Salt clarification

Salt is for password hashing or password-based key derivation. This design does not derive data-encryption keys from a user password, so transcript encryption does not use a traditional password salt.

For business data encryption, the critical randomness is the per-encryption IV or nonce.

## Key Management Design

### Model

Use envelope encryption:

- `DEK`: per-user data encryption key
- `KEK`: system-managed key encryption key

### Storage

Store only wrapped user data keys in persistence:

- `user_id`
- `dek_id`
- `wrapped_dek`
- `kek_version`
- `status`
- timestamps

The plaintext DEK is only available in trusted backend memory during request handling.

### Rotation

Support versioned keys from the beginning:

- `crypto_version` on encrypted payloads
- `dek_id` or equivalent key reference
- `kek_version` for wrapped keys

This allows later key rotation without redesigning the data model.

## Data Model Design

This project will directly adapt the existing `user_files` table instead of introducing a second payload table.

### `user_files` after change

Plaintext columns remain as-is for metadata and listing.

Sensitive columns are repurposed to store encrypted envelopes instead of raw values:

- `file_content`
- `blocks_data`
- `mappings_data`

Recommended representation for each encrypted field:

```json
{
  "alg": "AES-256-GCM",
  "version": 1,
  "iv": "...",
  "ciphertext": "..."
}
```

If needed by the runtime or library, the auth tag may either be embedded into ciphertext or stored separately inside the same JSON structure.

### Column type recommendation

Prefer `jsonb` for encrypted payload columns because it:

- stores versioned envelopes cleanly
- supports future algorithm changes
- avoids overloading raw text columns with opaque serialized blobs

Since there is no existing production data, column type changes can be made directly.

## Architecture

### Components

- Frontend Vue app
- Supabase Auth
- Trusted backend or edge functions
- Supabase Postgres
- Key storage for wrapped DEKs and KEK configuration

### Trust boundary

Sensitive plaintext is allowed only in:

- the authenticated user session in the browser
- trusted backend request memory

Sensitive plaintext must not be stored directly in:

- Postgres business tables
- frontend-accessible direct-write paths
- logs

### High-level flow

1. User signs in through Supabase Auth.
2. Frontend gets a valid session or JWT.
3. Frontend sends sensitive read or write requests to trusted backend endpoints.
4. Backend validates session identity.
5. Backend unwraps the user DEK using the current KEK.
6. Backend encrypts or decrypts sensitive fields.
7. Database stores encrypted payloads and plaintext metadata only.

## API Design

Sensitive file operations move behind trusted backend APIs.

### Metadata list endpoint

`GET /api/files`

Returns only plaintext metadata needed for:

- file lists
- file names
- folder placement
- timestamps

No transcript or encrypted payload bodies are returned here.

### File detail endpoint

`GET /api/files/:id`

Returns decrypted file content for the authenticated owner:

- `file_content`
- `blocks_data`
- `mappings_data`

The response should not expose low-level encrypted envelope internals to the frontend.

### File create endpoint

`POST /api/files`

Behavior:

- validate authenticated user
- create or fetch wrapped DEK
- encrypt sensitive fields
- write metadata and encrypted values into `user_files`

### Sensitive update endpoints

Use explicit update endpoints for:

- blocks
- mappings
- transcript content if edited later

Example:

- `PATCH /api/files/:id/blocks`
- `PATCH /api/files/:id/mappings`

## Frontend Changes

### Keep direct Supabase Auth usage

The frontend can continue to use Supabase directly for:

- sign up
- sign in
- sign out
- session state

### Remove direct sensitive data writes

The frontend should stop directly inserting or updating plaintext transcript fields in `user_files`.

Affected areas include:

- initial file upload flow
- file open flow
- block save flow
- mapping save flow

### Continue direct metadata usage where safe

The file list UI can still use metadata-oriented queries as long as the result set excludes sensitive encrypted content.

## Access Control

### Database

- Keep Row Level Security enabled.
- Restrict direct frontend access to sensitive columns.
- Allow frontend metadata list access only if it does not leak encrypted payloads unnecessarily.

### Backend

Every sensitive endpoint must:

- validate Supabase session identity
- enforce ownership checks by `user_id`
- reject cross-user file access

## Logging and Operational Safety

The trusted backend must never log:

- transcript plaintext
- block plaintext
- mapping plaintext
- decrypted payloads

Allowed log content:

- `user_id`
- `file_id`
- endpoint name
- request id
- success or failure
- high-level error category

Sensitive endpoints should also use:

- `Cache-Control: no-store`
- request identifiers
- rate limiting where appropriate

## Error Handling

### Decryption failure

Return a generic user-safe message such as:

- file could not be securely opened
- please retry or contact support

Do not expose:

- key ids
- raw crypto errors
- internal stack traces

### Ownership failure

Return standard not-found or forbidden behavior without leaking whether another user owns the file.

### Key mismatch or version mismatch

Fail closed. Do not return partially decrypted or best-effort data.

## No-Migration Rollout Plan

Because there is no real data yet, this rollout can skip migration entirely.

Implementation assumptions:

- existing sensitive columns can be repurposed immediately
- no backward-compatibility read path is required
- no temporary dual-read or dual-write mode is required

This materially reduces complexity and shortens the implementation path.

## Testing Strategy

### Unit tests

- encrypt then decrypt returns original payload
- same plaintext encrypted twice produces different ciphertext
- modified ciphertext fails decryption
- wrong AAD context fails decryption

### Backend integration tests

- authenticated owner can read decrypted file data
- non-owner cannot read another user file
- metadata list endpoint excludes sensitive payloads
- writes persist encrypted payloads, not plaintext

### Database verification

- direct table reads do not expose readable transcript plaintext in encrypted fields
- metadata fields remain readable and queryable

### Frontend regression tests

- upload still works
- reopen file still works
- blocks still save and reload
- mappings still save and reload
- folder management remains unchanged

## README Requirement

Implementation must update the current branch README to record the security change, including:

- Supabase Auth remains the authentication system
- sensitive file data is now encrypted at the application layer
- `original_name` remains plaintext
- `analysis_data` is intentionally not included in this change
- trusted backend boundary is required for sensitive file operations

## Residual Risks

This design reduces direct database exposure but does not eliminate all plaintext exposure.

Remaining trusted locations include:

- browser memory while the user is viewing content
- trusted backend memory during request processing

This design does not protect against:

- a fully compromised trusted backend
- user-controlled export or screenshot behavior
- sensitive information placed into plaintext metadata such as file names

## Implementation Scope Check

This scope is small enough for a single implementation plan because it is limited to:

- trusted backend boundary for sensitive file operations
- field encryption for selected `user_files` columns
- frontend integration changes for those operations
- documentation updates

It does not include:

- AI analysis security redesign
- search redesign
- password-system replacement
