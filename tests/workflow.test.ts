import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createClient } from "@libsql/client";
import type * as DatabaseModule from "@/lib/db";
import { locations } from "@/data/locations";
import type { PeriodLocation } from "@/types/location";

const testDirectory = path.join(os.tmpdir(), "period-place-tests");
const databasePath = path.join(testDirectory, `workflow-${process.pid}.db`);
let db: typeof DatabaseModule;
let submissionId = "";
let draftId = "";
let slug = "";
let feedbackId = "";

beforeAll(async () => {
  fs.mkdirSync(testDirectory, { recursive: true });
  fs.rmSync(databasePath, { force: true });
  process.env.TURSO_DATABASE_URL = "";
  process.env.TURSO_AUTH_TOKEN = "";
  process.env.PERIOD_PLACE_DB_PATH = databasePath;
  process.env.PERIOD_PLACE_ENVIRONMENT = "test";
  db = await import("@/lib/db");
  await db.initialisePeriodPlaceDatabase();
});

describe.sequential("official source reconciliation", () => {
  let backup: Awaited<ReturnType<typeof db.exportDatabaseSnapshot>>;
  const seed = locations.find((location) => location.slug === "demo-riverside")!;
  const updatedSeed: PeriodLocation = {
    ...seed,
    access: "Updated official access evidence for this test.",
    products: [{ type: "Pads", brand: null, attributes: ["Disposable"], absorbencies: ["Heavy"], evidence: "Updated official product evidence for this test." }],
    sources: [{ label: "Updated official source", url: "https://example.invalid/official-update", checked: "6 October 2026", scope: "Updated official venue and product evidence for this test." }],
    lastVerifiedAt: "2026-10-06",
  };
  const seedsWith = (replacement: PeriodLocation) => locations.map((location) => location.slug === replacement.slug ? replacement : location);
  const tableRows = (snapshot: typeof backup, table: string) => snapshot.tables[table] as Array<Record<string, unknown>>;
  const locationRow = (snapshot: typeof backup) => tableRows(snapshot, "location_drafts").find((row) => row.slug === seed.slug)!;

  beforeEach(async () => { backup = await db.exportDatabaseSnapshot(); });
  afterEach(async () => { await db.restoreDatabaseSnapshot(backup); });

  it("refreshes official evidence with a new revision while preserving identity, history and moderated visits", async () => {
    expect(db.syncOfficialLocationSeeds).toBeTypeOf("function");
    await db.createLocationRevision(String(locationRow(backup).id));
    await db.publishDraft(String(locationRow(backup).id));
    const original = locationRow(await db.exportDatabaseSnapshot());
    await db.createCheckIn({ locationSlug: seed.slug, userId: "official-refresh-visitor", availability: "available", observedAt: "2026-10-06", comment: "Approved visit retained during refresh." });
    const checkIn = (await db.listCheckIns()).find((item) => item.userId === "official-refresh-visitor")!;
    await db.moderateCheckIn(checkIn.id, "approved");
    const before = await db.exportDatabaseSnapshot();
    await db.syncOfficialLocationSeeds(seedsWith(updatedSeed));
    const after = await db.exportDatabaseSnapshot();
    const refreshed = locationRow(after);
    expect(refreshed).toMatchObject({ id: original.id, submission_id: original.submission_id, created_at: original.created_at, current_revision: Number(original.current_revision) + 1 });
    expect(tableRows(after, "submissions")).toEqual(tableRows(before, "submissions"));
    const oldRevisions = tableRows(before, "location_revisions").filter((row) => row.location_id === original.id);
    const revisions = tableRows(after, "location_revisions").filter((row) => row.location_id === original.id);
    expect(revisions).toHaveLength(oldRevisions.length + 1);
    for (const revision of oldRevisions) expect(revisions).toContainEqual({ ...revision, status: revision.status === "published" ? "superseded" : revision.status });
    const published = revisions.find((row) => row.status === "published")!;
    expect(published.revision_number).toBe(Number(original.current_revision) + 1);
    expect(JSON.parse(String(published.snapshot_json))).toMatchObject({ products: updatedSeed.products, sources: updatedSeed.sources, confidence: seed.confidence });
    expect(tableRows(after, "location_check_ins")).toEqual(tableRows(before, "location_check_ins"));
    expect((await db.listPublishedLocations()).find((location) => location.slug === seed.slug)).toMatchObject({ access: updatedSeed.access, products: updatedSeed.products, sources: updatedSeed.sources, communityVerification: { approvedCount: 1, comments: [expect.objectContaining({ id: checkIn.id })] } });
    expect((await db.listAuditEvents(100)).filter((event) => event.entityId === original.id && event.action === "official_source_refreshed")).toHaveLength(1);
  });

  it.each([false, true])("defers changed official evidence while an admin revision is pending (archived=%s)", async (archived) => {
    expect(db.syncOfficialLocationSeeds).toBeTypeOf("function");
    const original = locationRow(backup);
    await db.createLocationRevision(String(original.id));
    const draft = await db.getDraft(String(original.id));
    await db.saveDraft({ ...draft!, latitude: seed.latitude, longitude: seed.longitude, attributes: [], access: "Pending admin access correction." });
    if (archived) await db.archiveLocation(String(original.id));
    const before = await db.exportDatabaseSnapshot();
    const publicBefore = (await db.listPublishedLocations()).find((location) => location.slug === seed.slug);
    await db.syncOfficialLocationSeeds(seedsWith(updatedSeed));
    const after = await db.exportDatabaseSnapshot();
    expect(locationRow(after)).toEqual(locationRow(before));
    expect(tableRows(after, "location_revisions")).toEqual(tableRows(before, "location_revisions"));
    expect((await db.listPublishedLocations()).find((location) => location.slug === seed.slug)).toEqual(publicBefore);
    expect((await db.listAuditEvents(100)).filter((event) => event.entityId === original.id && event.action === "official_source_refresh_deferred")).toHaveLength(1);
  });

  it.each([false, true])("retains a published administrator correction when the official baseline is unchanged (previousRefresh=%s)", async (previousRefresh) => {
    const appliedSeed = previousRefresh ? updatedSeed : seed;
    if (previousRefresh) await db.syncOfficialLocationSeeds(seedsWith(appliedSeed));
    const id = String(locationRow(backup).id);
    await db.createLocationRevision(id);
    const draft = (await db.getDraft(id))!;
    await db.saveDraft({ ...draft, latitude: seed.latitude, longitude: seed.longitude, attributes: [], access: "Administrator-confirmed accessible entrance." });
    await db.publishDraft(id);
    const before = await db.exportDatabaseSnapshot();
    await db.syncOfficialLocationSeeds(seedsWith(appliedSeed));
    expect((await db.exportDatabaseSnapshot()).tables).toEqual(before.tables);
    expect((await db.listPublishedLocations()).find((location) => location.slug === seed.slug)?.access).toBe("Administrator-confirmed accessible entrance.");
  });

  it("defers a changed official source that conflicts with a published administrator correction", async () => {
    const id = String(locationRow(backup).id);
    await db.createLocationRevision(id);
    const draft = (await db.getDraft(id))!;
    await db.saveDraft({ ...draft, latitude: seed.latitude, longitude: seed.longitude, attributes: [], access: "Administrator-confirmed accessible entrance." });
    await db.publishDraft(id);
    const before = await db.exportDatabaseSnapshot();
    const publicBefore = (await db.listPublishedLocations()).find((location) => location.slug === seed.slug);
    await db.syncOfficialLocationSeeds(seedsWith(updatedSeed));
    const after = await db.exportDatabaseSnapshot();
    expect(locationRow(after)).toEqual(locationRow(before));
    expect(tableRows(after, "location_revisions")).toEqual(tableRows(before, "location_revisions"));
    expect(tableRows(after, "submissions")).toEqual(tableRows(before, "submissions"));
    expect(tableRows(after, "location_check_ins")).toEqual(tableRows(before, "location_check_ins"));
    expect((await db.listPublishedLocations()).find((location) => location.slug === seed.slug)).toEqual(publicBefore);
    expect((await db.listAuditEvents(100)).filter((event) => event.entityId === id && event.action === "official_source_refresh_deferred")).toEqual([expect.objectContaining({ details: expect.objectContaining({ reason: "Published administrator corrections differ from the last applied official source." }) })]);
    expect((await db.listAuditEvents(100)).filter((event) => event.entityId === id && event.action === "official_source_refreshed")).toHaveLength(0);
    await db.syncOfficialLocationSeeds();
    const unchanged = await db.exportDatabaseSnapshot();
    expect(unchanged.tables).toEqual(after.tables);
  });

  it("defers source removal when the published record contains an administrator correction", async () => {
    const id = String(locationRow(backup).id);
    await db.createLocationRevision(id);
    const draft = (await db.getDraft(id))!;
    await db.saveDraft({ ...draft, latitude: seed.latitude, longitude: seed.longitude, attributes: [], address: "Administrator-confirmed venue address." });
    await db.publishDraft(id);
    const before = await db.exportDatabaseSnapshot();
    await db.syncOfficialLocationSeeds(locations.filter((location) => location.slug !== seed.slug));
    const after = await db.exportDatabaseSnapshot();
    expect(locationRow(after)).toEqual(locationRow(before));
    expect(tableRows(after, "location_revisions")).toEqual(tableRows(before, "location_revisions"));
    expect((await db.listPublishedLocations()).some((location) => location.slug === seed.slug)).toBe(true);
    expect((await db.listAuditEvents(100)).filter((event) => event.entityId === id && event.action === "official_source_refresh_deferred")).toHaveLength(1);
  });

  it("uses legacy official revision fields to preserve a later administrator correction", async () => {
    const legacy = await db.exportDatabaseSnapshot();
    const id = String(locationRow(legacy).id);
    const originalRevision = tableRows(legacy, "location_revisions").find((row) => row.location_id === id && row.revision_number === 1)!;
    const snapshot = JSON.parse(String(originalRevision.snapshot_json));
    delete snapshot.products;
    delete snapshot.sources;
    delete snapshot.confidence;
    originalRevision.snapshot_json = JSON.stringify(snapshot);
    await db.restoreDatabaseSnapshot(legacy);
    await db.createLocationRevision(id);
    const draft = (await db.getDraft(id))!;
    await db.saveDraft({ ...draft, latitude: seed.latitude, longitude: seed.longitude, attributes: [], access: "Administrator-confirmed accessible entrance." });
    await db.publishDraft(id);
    const before = await db.exportDatabaseSnapshot();
    await db.syncOfficialLocationSeeds();
    expect((await db.exportDatabaseSnapshot()).tables).toEqual(before.tables);
  });

  it("defers incomplete legacy official baselines instead of guessing the original administrative fields", async () => {
    const legacy = await db.exportDatabaseSnapshot();
    const id = String(locationRow(legacy).id);
    const originalRevision = tableRows(legacy, "location_revisions").find((row) => row.location_id === id && row.revision_number === 1)!;
    const snapshot = JSON.parse(String(originalRevision.snapshot_json));
    delete snapshot.nation;
    delete snapshot.adminArea;
    originalRevision.snapshot_json = JSON.stringify(snapshot);
    await db.restoreDatabaseSnapshot(legacy);
    await db.createLocationRevision(id);
    const draft = (await db.getDraft(id))!;
    await db.saveDraft({ ...draft, latitude: seed.latitude, longitude: seed.longitude, attributes: [], nation: "England", adminArea: "Administrator-confirmed area" });
    await db.publishDraft(id);
    const before = await db.exportDatabaseSnapshot();
    await db.syncOfficialLocationSeeds();
    const after = await db.exportDatabaseSnapshot();
    expect(locationRow(after)).toEqual(locationRow(before));
    expect(tableRows(after, "location_revisions")).toEqual(tableRows(before, "location_revisions"));
    expect((await db.listAuditEvents(100)).filter((event) => event.entityId === id && event.action === "official_source_refresh_deferred")).toEqual([expect.objectContaining({ details: expect.objectContaining({ reason: "The last applied official source baseline is unavailable." }) })]);
  });

  it("does nothing for normalised identical evidence, even if timestamps or array order differ", async () => {
    expect(db.syncOfficialLocationSeeds).toBeTypeOf("function");
    await db.syncOfficialLocationSeeds(seedsWith({ ...seed, lastVerifiedAt: "2026-10-07", products: [...seed.products].reverse().map((product) => ({ ...product, attributes: [...product.attributes].reverse(), absorbencies: product.absorbencies || [] })), sources: seed.sources.map((source) => ({ ...source, checked: "7 October 2026" })) }));
    const after = await db.exportDatabaseSnapshot();
    expect(after.tables).toEqual(backup.tables);
  });

  it("reactivates identical official records without rewriting revisions", async () => {
    expect(db.syncOfficialLocationSeeds).toBeTypeOf("function");
    const original = locationRow(backup);
    await db.archiveLocation(String(original.id));
    const before = await db.exportDatabaseSnapshot();
    await db.syncOfficialLocationSeeds();
    const after = await db.exportDatabaseSnapshot();
    expect(locationRow(after)).toMatchObject({ id: original.id, archived_at: null, current_revision: original.current_revision });
    expect(tableRows(after, "location_revisions")).toEqual(tableRows(before, "location_revisions"));
    expect((await db.listAuditEvents(100)).filter((event) => event.entityId === original.id && event.action === "official_source_reactivated")).toHaveLength(1);
  });

  it("archives inactive official sources once and restores a changed source with its history", async () => {
    expect(db.syncOfficialLocationSeeds).toBeTypeOf("function");
    const original = locationRow(backup);
    const remaining = locations.filter((location) => location.slug !== seed.slug);
    await db.syncOfficialLocationSeeds(remaining);
    expect((await db.listPublishedLocations()).some((location) => location.slug === seed.slug)).toBe(false);
    const inactive = await db.exportDatabaseSnapshot();
    await db.syncOfficialLocationSeeds(remaining);
    expect((await db.exportDatabaseSnapshot()).tables).toEqual(inactive.tables);
    await db.syncOfficialLocationSeeds(seedsWith(updatedSeed));
    expect(locationRow(await db.exportDatabaseSnapshot())).toMatchObject({ id: original.id, archived_at: null, current_revision: Number(original.current_revision) + 1 });
    const events = (await db.listAuditEvents(100)).filter((event) => event.entityId === original.id);
    expect(events.filter((event) => event.action === "official_source_inactive")).toHaveLength(1);
    expect(events.filter((event) => event.action === "official_source_refreshed")).toHaveLength(1);
  });

  it("preserves a community-origin record when an incoming official seed has the same slug", async () => {
    expect(db.syncOfficialLocationSeeds).toBeTypeOf("function");
    const communitySnapshot = await db.exportDatabaseSnapshot();
    locationRow(communitySnapshot).origin = "community";
    await db.restoreDatabaseSnapshot(communitySnapshot);
    const before = await db.exportDatabaseSnapshot();
    await db.syncOfficialLocationSeeds(seedsWith(updatedSeed));
    expect((await db.exportDatabaseSnapshot()).tables).toEqual(before.tables);
  });

  it("rolls back the refreshed row and revisions when its audit insert fails", async () => {
    expect(db.syncOfficialLocationSeeds).toBeTypeOf("function");
    const client = createClient({ url: `file:${databasePath.replaceAll("\\", "/")}` });
    try {
      await client.execute("CREATE TRIGGER fail_official_refresh BEFORE INSERT ON audit_events WHEN NEW.action='official_source_refreshed' BEGIN SELECT RAISE(ABORT, 'test refresh audit failure'); END");
      await expect(db.syncOfficialLocationSeeds(seedsWith(updatedSeed))).rejects.toThrow("test refresh audit failure");
      expect((await db.exportDatabaseSnapshot()).tables).toEqual(backup.tables);
    } finally {
      await client.execute("DROP TRIGGER IF EXISTS fail_official_refresh");
      client.close();
    }
  });
});

afterAll(async () => {
  await db.closeDatabaseConnection();
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      fs.rmSync(databasePath, { force: true });
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EPERM") throw error;
      if (attempt < 19) await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
});

describe.sequential("moderated location workflow", () => {
  it("seeds the researched public locations", async () => {
    expect(await db.listPublishedLocations()).toHaveLength(locations.length);
  });

  it("keeps a public report private", async () => {
    submissionId = await db.createSubmission({
      reportKind: "new_location",
      targetSlug: "",
      place: "TEST Workflow Library",
      city: "Glasgow",
      nation: "Scotland",
      adminArea: "Glasgow City",
      postcode: "G1 1AA",
      products: "Pads",
      absorbencies: ["Heavy"],
      brand: "Unknown",
      seenAt: "2026-08-30",
      notes: "Automated workflow test only",
    });
    expect((await db.listSubmissions()).find((item) => item.id === submissionId)?.status).toBe("pending");
    expect(await db.listPublishedLocations()).toHaveLength(locations.length);
  });

  it("records an update report without creating a duplicate location draft", async () => {
    const before = (await db.listDrafts()).length;
    const updateId = await db.createSubmission({
      reportKind: "stock_update",
      targetSlug: "demo-riverside",
      place: "Leith Library",
      city: "Edinburgh",
      nation: "Scotland",
      adminArea: "City of Edinburgh",
      postcode: "EH6 6LU",
      products: "Pads were out of stock",
      absorbencies: [],
      brand: "Grace & Green",
      seenAt: "2026-08-30",
      notes: "Automated workflow test only",
    });
    expect(await db.moderateSubmission(updateId, "approved")).toBe(true);
    expect((await db.listDrafts()).length).toBe(before);
  });

  it("stores a moderated report outside the original two-city pilot", async () => {
    const id = await db.createSubmission({
      reportKind: "new_location",
      targetSlug: "",
      place: "TEST Bristol Community Hub",
      city: "Bristol",
      nation: "England",
      adminArea: "Bristol City",
      postcode: "BS1 1AA",
      products: "Pantyliners, Menstrual discs",
      absorbencies: [],
      brand: "Unknown",
      seenAt: "2026-08-30",
      notes: "Automated UK coverage test only",
    });
    expect((await db.listSubmissions()).find((item) => item.id === id)?.nation).toBe("England");
    expect(await db.moderateSubmission(id, "rejected")).toBe(true);
  });

  it("enforces a durable submission rate limit", async () => {
    const key = "test-rate-limit-key";
    expect(await db.consumeSubmissionRateLimit(key, 2)).toBe(true);
    expect(await db.consumeSubmissionRateLimit(key, 2)).toBe(true);
    expect(await db.consumeSubmissionRateLimit(key, 2)).toBe(false);
  });

  it("stores private beta feedback", async () => {
    feedbackId = await db.createFeedback({ usefulness: 4, foundWhatNeeded: "partly", trustedResults: "yes", submittedUpdate: "not_tried", wouldUseAgain: "yes", comments: "Automated beta feedback test." });
    expect(await db.listFeedback()).toEqual(expect.arrayContaining([expect.objectContaining({ id: feedbackId, usefulness: 4, foundWhatNeeded: "partly", excludedAt: null })]));
  });

  it("reversibly excludes test feedback from metrics without deleting it", async () => {
    expect(await db.setFeedbackMetricInclusion(feedbackId, false, { id: "test-admin", label: "test@example.invalid" })).toBe(true);
    expect((await db.listFeedback()).find((item) => item.id === feedbackId)).toMatchObject({ excludedBy: "test@example.invalid" });
    expect((await db.listFeedback()).find((item) => item.id === feedbackId)?.excludedAt).toBeTruthy();
    expect(await db.setFeedbackMetricInclusion(feedbackId, true, { id: "test-admin", label: "test@example.invalid" })).toBe(true);
    expect((await db.listFeedback()).find((item) => item.id === feedbackId)).toMatchObject({ excludedAt: null, excludedBy: null });
  });

  it("stores and resolves private contact requests", async () => {
    const id = await db.createContactRequest({ kind: "privacy_deletion", email: "person@example.com", message: "Please remove my account-linked information." });
    expect(await db.listContactRequests()).toEqual(expect.arrayContaining([expect.objectContaining({ id, kind: "privacy_deletion", resolvedAt: null })]));
    expect(await db.resolveContactRequest(id, { id: "test-admin", label: "test@example.invalid" })).toBe(true);
    expect((await db.listContactRequests()).find((item) => item.id === id)?.resolvedAt).toBeTruthy();
  });

  it("creates a private draft without matching itself as a duplicate", async () => {
    expect(await db.moderateSubmission(submissionId, "approved", { id: "test-admin", label: "test@example.invalid" })).toBe(true);
    const submission = (await db.listSubmissions()).find((item) => item.id === submissionId);
    const draft = (await db.listDrafts()).find((item) => item.submissionId === submissionId);
    expect(submission?.status).toBe("approved");
    expect(draft?.status).toBe("draft");
    expect(draft?.absorbencies).toEqual(["Heavy"]);
    expect(await db.possibleDuplicates(submission!, await db.listDrafts())).toHaveLength(0);
    draftId = draft!.id;
  });

  it("saves and publishes a complete draft", async () => {
    const draft = await db.getDraft(draftId);
    expect(draft).not.toBeNull();
    expect(await db.saveDraft({
      id: draftId,
      name: draft!.name,
      city: draft!.city,
      nation: draft!.nation,
      adminArea: draft!.adminArea,
      venueType: "Library",
      address: "TEST RECORD - 1 Test Street",
      postcode: draft!.postcode,
      latitude: 55.8642,
      longitude: -4.2518,
      access: "Test access only",
      productTypes: ["Pads"],
      brand: "",
      attributes: [],
      absorbencies: ["Heavy"],
      evidence: "Automated test evidence, not a real location.",
      lastVerifiedAt: "2026-08-30",
    })).toBe(true);
    slug = (await db.publishDraft(draftId))!;
    expect(slug).toBeTruthy();
    expect((await db.listPublishedLocations()).some((item) => item.slug === slug)).toBe(true);
    expect((await db.listPublishedLocations()).find((item) => item.slug === slug)?.products[0].absorbencies).toEqual(["Heavy"]);
  });

  it("moderates structured visits before they affect the public location", async () => {
    const created = await db.createCheckIn({ locationSlug: slug, userId: "test-community-user", availability: "low_stock", observedAt: "2026-08-30", accuracyRating: 5, accessRating: 4, privacyRating: 5, comment: "Test visit comment." });
    expect(created.status).toBe("created");
    expect((await db.listPublishedLocations()).find((item) => item.slug === slug)?.communityVerification).toBeUndefined();
    const checkIn = (await db.listCheckIns()).find((item) => item.locationId === draftId);
    expect(checkIn?.status).toBe("pending");
    expect(await db.moderateCheckIn(checkIn!.id, "approved", { id: "test-admin", label: "test@example.invalid" })).toBe(true);
    const publicLocation = (await db.listPublishedLocations()).find((item) => item.slug === slug);
    expect(publicLocation?.communityVerification).toMatchObject({ approvedCount: 1, latestAvailability: "low_stock", averageAccuracy: 5 });
    expect(publicLocation?.communityVerification?.comments[0]?.comment).toBe("Test visit comment.");
    expect(await db.moderateCheckIn(checkIn!.id, "rejected", { id: "test-admin", label: "test@example.invalid" })).toBe(true);
    expect((await db.listPublishedLocations()).find((item) => item.slug === slug)?.communityVerification).toBeUndefined();
    expect(await db.moderateCheckIn(checkIn!.id, "approved", { id: "test-admin", label: "test@example.invalid" })).toBe(true);
    expect((await db.createCheckIn({ locationSlug: slug, userId: "test-community-user", availability: "available", observedAt: "2026-08-30", comment: "Duplicate." })).status).toBe("duplicate");
  });

  it("archives and restores without deleting history", async () => {
    expect(await db.archiveLocation(draftId)).toBe(true);
    expect((await db.listPublishedLocations()).some((item) => item.slug === slug)).toBe(false);
    expect(await db.restoreLocation(draftId)).toBe(true);
    expect((await db.listPublishedLocations()).some((item) => item.slug === slug)).toBe(true);
    const actions = (await db.listAuditEvents(100)).map((event) => event.action);
    expect(actions).toEqual(expect.arrayContaining(["submitted", "approved", "draft_created", "draft_updated", "published", "archived", "restored"]));
    expect((await db.listAuditEvents(100)).some((event) => event.action === "approved" && event.actorLabel === "test@example.invalid")).toBe(true);
  });

  it("exports and restores a complete backup", async () => {
    const snapshot = await db.exportDatabaseSnapshot();
    for (const row of snapshot.tables.beta_feedback as Array<Record<string, unknown>>) {
      delete row.trusted_results;
      delete row.submitted_update;
      delete row.would_use_again;
    }
    await db.createFeedback({ usefulness: 1, foundWhatNeeded: "no", trustedResults: "no", submittedUpdate: "no", wouldUseAgain: "no", comments: "This row should disappear after restore." });
    await db.restoreDatabaseSnapshot(snapshot);
    expect((await db.listFeedback()).some((item) => item.comments.includes("disappear"))).toBe(false);
    expect(await db.listFeedback()).toEqual(expect.arrayContaining([expect.objectContaining({ trustedResults: "partly", submittedUpdate: "not_tried", wouldUseAgain: "maybe" })]));
    expect(await db.listPublishedLocations()).toHaveLength(locations.length + 1);
  });
});
