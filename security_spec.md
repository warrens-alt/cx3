# Security Specification: Access Control & User Management

## 1. Data Invariants

1. **Self-Promotion Guard**: A standard user cannot elevate their own role to \`admin\` or modify their access status from \`pending\` or \`suspended\` to \`active\`.
2. **Identity Match**: A user document at \`/users/{userId}\` can only be initialized by the user whose \`request.auth.uid\` strictly matches \`{userId}\`.
3. **Bootstrapped Admin Authority**: The user \`warrens@bastionflowe.com\` with \`email_verified == true\` and users with documents in \`/admins/{userId}\` have administrative rights.
4. **Tenant Isolation**: Non-admin users cannot grant themselves access to arbitrary client tenants or change their \`allowedTenants\` list.
5. **Admin Authority**: Only verified admins can create/update documents in \`/admins\`, \`/accessInvites\`, and \`/platformConfig\`.
6. **Audit Log Immutability**: Documents in \`/auditLogs\` are append-only. Once created, they can never be modified or deleted.
7. **PII & User Directory Protection**: Standard users can only read their own user profile document. Full user list query is strictly restricted to authenticated administrators.
8. **Document ID Format Guard**: All path variables must satisfy alphanumeric format and length constraints (<= 128 chars).

---

## 2. The Dirty Dozen Payloads (Designed to Fail)

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

The security tests verify that all 12 Dirty Dozen payloads fail with PERMISSION_DENIED across all collections.
