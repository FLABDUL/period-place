# Period Place — public source edition

[Try the interactive portfolio demo](https://www.madebyhakim.com/demos/period-place/) · [Read the case study](https://www.madebyhakim.com/projects/period-place/)

Period Place was a UK finder for free period products, built with Next.js, TypeScript, MapLibre and libSQL/Turso. The service was retired in November 2026 after a measured launch. This clean public snapshot preserves the application architecture for technical review without private correspondence, production records, credentials or historical datasets with unresolved reuse permissions. The original Git history remains private.

## Try it

The `demo/` directory is the browser demonstration hosted on the portfolio. It recreates the original burgundy/pink interface and typography, homepage, searchable finder, combined product filters, interactive geographic map, location evidence, coverage, visitor reports and moderation queue. Serve it with a static web server that serves `.mjs` as JavaScript. All venues, products and reports are fictional. Approved sample reports update the demonstration in memory; reloading resets them. Nothing is submitted to a backend.

MapLibre GL JS 6.6.0 and the DM Sans and Fraunces fonts are included locally with their respective BSD and SIL Open Font licences. Map tiles load from OpenStreetMap only when the finder is opened; visible attribution is retained. Automated browser checks should stub tile requests rather than download public map tiles. The main application source and the static demonstration remain distinct: the demonstration does not reconnect the retired service.

## Explore the original application architecture

`src/` contains the original server-backed application with fictional seed records substituted. It demonstrates searchable location facets, evidence confidence, authenticated moderation, audit history, guarded database maintenance and privacy-conscious analytics design. Do not use the sample locations as real provision information.

For local exploration, install Node.js 24, run `npm ci`, then `npm run dev`. No hosted credentials are required for the public finder; it uses an ignored local SQLite database. Administration requires local credentials configured through the environment. The original optional Clerk and Turso integrations are source examples only; the retired resources no longer exist. The local application can persist reports in SQLite, unlike the hosted static demo.

Run `npm test` for unit and database workflow tests and `npm run build` for the production compilation. Historical data-import scripts and dataset-dependent browser suites are excluded from this edition. Do not deploy the historical server application as a public service without a fresh operational, privacy and data review.

The public edition is a new source snapshot, not a claim that the original product has relaunched. No new software licence is granted by making this repository visible.
