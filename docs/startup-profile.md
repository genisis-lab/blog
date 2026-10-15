# EmDash 1.2.0 startup investigation

Base: bfef290 (genisis-lab/blog main). Measured October 15, 2026.

A public `/search?q=startup-profile-1792040` request returned HTTP 200,
CF-Cache-Status BYPASS and Cache-Control private, no-store. Server-Timing:

| Phase | ms |
| --- | ---: |
| Runtime initialization | 792 |
| Database initialization / migration policy | 19 |
| Plugin states | 7 |
| Site info / hook selections / seed gate | 7 each, overlapping |
| Config sandbox plugins | 0 |
| Registry plugins | 766 |
| Render | 78 |
| Total middleware | 870 |

Registry loading accounts for 96.7% of runtime initialization in this sample.
DB query total was 158 ms across 18 queries (includes render; not additive to
runtime timings). R2 adapter construction is synchronous and does no network
I/O. Registry loading reads each plugin's manifest, backend, then admin bundle
serially from R2. Cloudflare sandbox `load()` registers an in-memory object;
it does not start a dynamic worker or perform network I/O at this point.
Thus bundle I/O is the principal actionable startup bottleneck. Individual R2
latencies were not instrumented in production; this attribution combines
phase timing with source inspection.

## Focused fix

A version-specific pnpm patch reads and consumes manifest/backend concurrently
(two in-flight reads maximum per plugin). Runtime startup omits admin.js,
which that caller never uses. Other callers retain admin loading by default.
Plugin registration remains sequential; validation and per-plugin failure
handling remain intact. No cross-request binding, storage, or plugin-code
cache is introduced. Review/remove this patch when upgrading EmDash.

## Verification

`scripts/profile-plugin-startup.mjs` extracts the actual installed bundle-loader
function and runs it with controlled storage and schema stubs. It checks both
storage tiers, skipped admin reads, default admin loading, missing required
files, invalid manifests, optional admin failure, and two-read concurrency.
The real schema implementation is not exercised by this isolated harness.
The patched runtime call site is also checked.

Seven runs with four plugins and 25 ms per R2 read:
- Before: median 316.3 ms (313.4–318.8), 12 reads.
- After: median 105.5 ms (105.1–108.4), 8 reads.
- About 67% less fixture time, 33% fewer reads. This is not a production prediction.

All 15 existing tests pass. Astro check: 0 errors, warnings, hints. Production
build passes (existing large-chunk warning). CI now executes the loader checks.

Run `pnpm install --frozen-lockfile`, then
`node scripts/profile-plugin-startup.mjs`. For a baseline, pass the pristine
EmDash 1.2.0 `dist/api-DBw_IWoi.mjs` as the script's first argument.

A second uncached production request had `rt=0`, render=397 ms and 9 DB queries:
a page cache miss is not necessarily an isolate cold start. Production rollout
and paired cold-start validation remain unverified because Wrangler credentials
have expired. After restoring access, deploy to a fully bound staging worker,
compare fresh-isolate Server-Timing samples with/without the patch, and verify
plugin admin assets, hooks, and public routes before production rollout.
