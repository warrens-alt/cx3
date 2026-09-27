# CLI archive activation checks

The archive implementation is not a deployment. Run these checks in an authorised copy
of the complete repository with its locked dependencies installed. No real reports belong
in this public repository, test fixtures, build logs or GitHub Actions artifacts.

## Validate a report without touching storage

```bash
npx --no-install tsx scripts/check-cli-archive.ts --file /private/path/daily-cli-report.csv
```

This uses the same archive and analytical CSV validators as the import route. Output is
limited to counts, source-date bounds and anomaly count; rows and caller IDs are not printed.
A successful file check does not approve data ownership, certify metric definitions, test
conflicts against existing history, or import anything. Review anomalies before proceeding.

## Check storage without writing

Run in the **actual API runtime's authorised environment**, with a configured canonical
client ID and the same server-only archive configuration that the API will use:

```bash
npx --no-install tsx scripts/check-cli-archive.ts --storage --client <canonical-client-id>
```

`NOT_CONFIGURED` means `CX_CLI_IMPORT_BUCKET` is absent. Configure an approved private
bucket on the API host. Reuse the existing authorised runtime service identity where possible.
The optional `CX_CLI_IMPORT_CREDENTIALS` belongs in the host's secret manager, never in a
browser, command-line argument, source file, VITE variable or chat. Do not borrow the
read-only warehouse credential. See `CLI-CSV-ARCHIVE.md` for required narrow permissions.

`READ_CHECK_PASSED` proves only that this execution identity passed the existing privacy
and read checks at that time. It does not prove write access, retention compatibility,
API authentication, deployment state or successful report persistence. A local user's
Cloud Shell/ADC identity is not evidence about a different deployed service identity.
A missing archive object is reported separately from permission and connectivity failures.

For an existing Cloud Run backend only, an authorised operator can add the bucket variable
without replacing unrelated environment variables:

```bash
gcloud run services update "$SERVICE" --project="$PROJECT" --region="$REGION" \
  --update-env-vars="CX_CLI_IMPORT_BUCKET=$BUCKET"
```

This is an explicit deployment mutation, not executed by the check script. Confirm SERVICE,
PROJECT, REGION and BUCKET before running. Do not change ingress, authentication or IAM to
make a failing check pass. For another host, use that host's server-side environment/secret
configuration instead. Static-only hosting cannot execute this Express storage adapter.

Official references:
- https://docs.cloud.google.com/run/docs/configuring/services/environment-variables
- https://docs.cloud.google.com/storage/docs/access-control/iam-permissions

## First end-to-end import

Sign in as an existing authorised administrator. Open CLI Performance > Import CSV and
confirm the intended client. Upload the authorised all-attempts daily report. Verify its
source date, count totals and anomalies; retain the original file outside the repository.
Reupload the same file and verify zero added rows. Reload through another instance or
approved restart and verify the same archived population and IMPORTED_REPORT provenance.
Live warehouse data retains its existing precedence and is not added to imported totals.

Read-only checks alone are not sufficient to call the archive activated. Activation requires
a successful authenticated write, saved-history reconciliation and subsequent persisted read.
The checker never uploads data, creates buckets, grants permissions or automates email.
