# Security Specification: Access Control & User Management

## 1. Data Invariants

1. **Self-Promotion Guard**: A standard user cannot elevate their own role to \`admin\` or modify their access status from \`pending\` or \`suspended\` to \`active\`.
2. **Identity Match**: A user document at \`/users/{userId}\` can only be initialized by the user whose \`request.auth.uid\` strictly matches \`{userId}\`.
3. **Bootstrap and Ordinary Admin Authority**: The configured trusted UID, or the configured bootstrap email with `email_verified == true`, can initialise bootstrap access. An ordinary administrator requires a verified identity, an active `/users/{uid}` profile with `role: "admin"`, and `/admins/{uid}` authority marker. A marker alone does not confer authority.
4. **Tenant Isolation**: Non-admin users cannot grant themselves access to arbitrary client tenants or change their \`allowedTenants\` list.
5. **Admin Authority**: Only administrators meeting invariant 3 can create/update documents in `/admins`, `/accessInvites`, and `/platformConfig`.
6. **Audit Log Immutability**: Documents in \`/auditLogs\` are append-only. Once created, they can never be modified or deleted.
7. **PII & User Directory Protection**: Standard users can only read their own user profile document. Full user list query is strictly restricted to authenticated administrators.
8. **Document ID Format Guard**: Guarded write paths require IDs of 1–128 characters containing letters, digits, underscores or hyphens.
9. **Atomic Access Changes**: `changeUserAccess` reads and changes the profile and its authority marker in one transaction. An active admin receives a marker containing the matching UID and email; suspension or demotion removes it. `removeUserAccess` deletes both documents in one batch. `saveBootstrapProfile` creates both atomically, with `getAfter()` validation in the rules.

The browser and rules share the bootstrap identities in `src/lib/authAccess.ts` and `firestore.rules`. Ordinary registration remains pending, including when an invitation supplies a desired role. Firebase administration is separate from analytical API access: signed IAP identity and `CX_ACCESS_POLICY_JSON` still govern server-side tenant grants.

---

## 2. Historical Threat-Model Payloads

This matrix records intended denial scenarios. The executable coverage and its current limits are listed in section 3; the matrix itself is not a claim that every case has an automated regression.

1. **Payload 1 (Self-Assigned Admin Attack)**:
   Non-admin creates user document with \`role: "admin"\` on registration.
   *Expected: PERMISSION_DENIED*

2. **Payload 2 (Self-Activation Attack)**:
   A pending or suspended user sends an update setting \`status: "active"\`.
   *Expected: PERMISSION_DENIED*

3. **Payload 3 (Tenant Escalation Attack)**:
   A user modifies their \`allowedTenants\` array from \`["mondo"]\` to \`["*"]\`.
   *Expected: PERMISSION_DENIED*

4. **Payload 4 (Ghost Identity Write)**:
   User \`userA\` writes to \`/users/userB\`.
   *Expected: PERMISSION_DENIED*

5. **Payload 5 (Directory Scraping Attack)**:
   Non-admin executes \`collection("users").getDocs()\` without admin authority.
   *Expected: PERMISSION_DENIED*

6. **Payload 6 (Admin Marker Forgery)**:
   Standard user attempts to create a document in \`/admins/{request.auth.uid}\`.
   *Expected: PERMISSION_DENIED*

7. **Payload 7 (Audit Log Tampering)**:
   User attempts to update or delete a log record in \`/auditLogs/{logId}\`.
   *Expected: PERMISSION_DENIED*

8. **Payload 8 (Whitelist Injection)**:
   Non-admin writes an email into \`/accessInvites/{inviteId}\` with \`role: "admin"\`.
   *Expected: PERMISSION_DENIED*

9. **Payload 9 (ID Injection Attack)**:
   Request targeting a 2000-character malicious path ID \`/users/{longGarbageId}\`.
   *Expected: PERMISSION_DENIED*

10. **Payload 10 (Spoofed Unverified Email Admin)**:
    User with email \`warrens@bastionflowe.com\` but \`email_verified: false\` attempts admin write.
    *Expected: PERMISSION_DENIED*

11. **Payload 11 (Shadow Field Injection)**:
    Update payload includes unregistered ghost properties like \`isSuperUser: true\` or \`bypassAuth: true\`.
    *Expected: PERMISSION_DENIED*

12. **Payload 12 (Negative or Type-Polluted Timestamp)**:
    Payload supplies arbitrary spoofed client dates instead of valid format.
    *Expected: PERMISSION_DENIED*

---

## 3. Test Runner Definition

Run the local access-lifecycle suite with Node.js 22 and Java 21 or newer on `PATH` or selected by `JAVA_HOME`:

```sh
npm ci
npm run test:rules
```

The command runs `scripts/test-firestore-rules.mjs`. It downloads the official Firestore emulator v1.22.0 JAR, checks its pinned SHA-256 digest, and caches it under `path.join(os.tmpdir(), 'cx3-firebase-emulators')`. Set `CX3_FIRESTORE_EMULATOR_CACHE` to choose a persistent cache directory. The first download requires network access. The runner selects a free loopback port, starts the isolated `demo-cx3-access` project, and supplies `FIRESTORE_EMULATOR_HOST` to the child test process. It requires no Firebase CLI or cloud credentials.

`tests/firestore-access.emulator.test.ts` loads the checked-in rules into that emulator and exercises:

- trusted-UID and verified-email bootstrap from an empty database, including rejected unverified or missing verification claims;
- pending ordinary registration and rejected self-promotion, self-activation and tenant changes;
- atomic promotion, activation, suspension, demotion and deletion through the same administration helpers as the UI;
- rejection of privileged reads/writes from existing sessions after revocation, including stale authority markers;
- rejected mutations leaving the profile unchanged;
- administrator invite creation, updates and deletion, and rejection of mismatched invite IDs.

`npm test` includes the suite but skips its emulator cases when `FIRESTORE_EMULATOR_HOST` is absent. CI runs `npm run test:rules` separately after installing Java 21. The in-process identity checks are also covered by `tests/auth-access.test.ts`.

## 4. Production Rule Deployment

Publish the reviewed `firestore.rules` to the intended Firebase project/database through the approved deployment process and confirm that the deployed rules match this revision. Repository commits, application builds, and emulator tests do not deploy Firestore rules. Until that separate deployment is completed, production Firestore continues to enforce its existing rules.

The emulator suite validates local rule behaviour with synthetic identities and records. Production IAP configuration, live Firebase token issuance, deployed rule state, and BigQuery tenant grants require separate deployment verification.
