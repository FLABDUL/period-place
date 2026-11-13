import "server-only";

import type { Client, InArgs, InStatement, Transaction } from "@libsql/client";
import { locations as officialSeeds } from "@/data/locations";
import { getDatabaseClient } from "@/lib/database-client";
import type { DraftInput } from "@/lib/draft-schema";
import type { NewFeedback } from "@/lib/feedback-schema";
import type { NewContactRequest } from "@/lib/contact-schema";
import type { NewCheckIn } from "@/lib/check-in-schema";
import type { NewSubmission } from "@/lib/submission-schema";
import { absorbencies, productAttributes } from "@/types/location";
import type { Absorbency, AvailabilityStatus, CommunityVerification, EvidenceSource, PeriodLocation, ProductOffering, PublicCheckIn, UkNation } from "@/types/location";

export type SubmissionStatus = "pending" | "approved" | "rejected";
export type DraftStatus = "draft" | "published";
export type LocationOrigin = "official" | "community";
export type SubmissionRecord = NewSubmission & { id: string; createdAt: string; status: SubmissionStatus; reviewedAt: string | null };
export type LocationDraft = Omit<DraftInput, "attributes" | "latitude" | "longitude"> & {
  slug: string; submissionId: string; attributes: string[]; latitude: number | null; longitude: number | null;
  status: DraftStatus; origin: LocationOrigin; archivedAt: string | null; currentRevision: number;
  hasPendingRevision: boolean; createdAt: string; updatedAt: string; publishedAt: string | null;
  products: ProductOffering[]; sources: EvidenceSource[]; needsRecheck: boolean;
};
export type AuditEvent = {
  id: string; occurredAt: string; entityType: "submission" | "location"; entityId: string;
  action: string; actor: "public" | "admin" | "system"; actorId: string | null; actorLabel: string | null;
  details: Record<string, unknown>;
};
export type AdminActor = { id: string; label: string };
export type FeedbackRecord = NewFeedback & { id: string; createdAt: string; excludedAt: string | null; excludedBy: string | null };
export type ContactRequestRecord = NewContactRequest & { id: string; createdAt: string; resolvedAt: string | null };
export type CheckInStatus = "pending" | "approved" | "rejected";
export type CheckInRecord = Omit<NewCheckIn, "userId" | "locationSlug"> & {
  id: string; locationId: string; locationName: string; userId: string; status: CheckInStatus;
  createdAt: string; moderatedAt: string | null;
};

type SubmissionRow = {
  id: string; created_at: string; place: string; city: string; nation: UkNation; admin_area: string; postcode: string;
  products: string; brand: string; seen_at: string; notes: string; status: SubmissionStatus;
  absorbencies_json: string; reviewed_at: string | null; origin: LocationOrigin; report_kind: NewSubmission["reportKind"]; target_slug: string;
};
type DraftRow = {
  id: string; submission_id: string; slug: string; name: string; city: string; nation: UkNation; admin_area: string;
  venue_type: LocationDraft["venueType"]; address: string; postcode: string; latitude: number | null;
  longitude: number | null; access: string; product_types_json: string; brand: string; attributes_json: string;
  absorbencies_json: string;
  evidence: string; status: DraftStatus; created_at: string; updated_at: string; published_at: string | null;
  origin: LocationOrigin; archived_at: string | null; last_verified_at: string | null; current_revision: number;
  products_json: string; sources_json: string; confidence: PeriodLocation["confidence"];
};
type CheckInRow = {
  id: string; location_id: string; user_id: string; availability: AvailabilityStatus;
  observed_at: string; accuracy_rating: number | null; access_rating: number | null;
  privacy_rating: number | null; comment: string; status: CheckInStatus;
  created_at: string; moderated_at: string | null; location_name?: string;
};
type RevisionRow = {
  id: string; location_id: string; revision_number: number; snapshot_json: string;
  status: "draft" | "published" | "superseded"; created_at: string; updated_at: string; published_at: string | null;
};
type AuditRow = {
  id: string; occurred_at: string; entity_type: AuditEvent["entityType"]; entity_id: string;
  action: string; actor: AuditEvent["actor"]; actor_id: string | null; actor_label: string | null; details_json: string;
};

const database = getDatabaseClient();
let initialisation: Promise<void> | null = null;

function statement(sql: string, args: InArgs = []): InStatement { return { sql, args }; }
function rowsAs<T>(rows: unknown) { return rows as T[]; }
function auditStatement(entityType: AuditEvent["entityType"], entityId: string, action: string, actor: AuditEvent["actor"], details: Record<string, unknown> = {}, admin?: AdminActor) {
  return statement("INSERT INTO audit_events (id,occurred_at,entity_type,entity_id,action,actor,actor_id,actor_label,details_json) VALUES (?,?,?,?,?,?,?,?,?)", [crypto.randomUUID(), new Date().toISOString(), entityType, entityId, action, actor, admin?.id || null, admin?.label || null, JSON.stringify(details)]);
}

async function addColumn(table: string, column: string, declaration: string) {
  const result = await database.execute(`PRAGMA table_info(${table})`);
  if (!rowsAs<{ name: string }>(result.rows).some((item) => item.name === column)) {
    await database.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${declaration}`);
  }
}

async function removeLegacyCityChecks() {
  const schema = await database.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='submissions' LIMIT 1");
  const sql = String(schema.rows[0]?.sql || "");
  if (!/CHECK\s*\(\s*city\s+IN\s*\(\s*'Glasgow'\s*,\s*'Edinburgh'\s*\)\s*\)/i.test(sql)) return;

  await database.execute("PRAGMA foreign_keys = OFF");
  try {
    await database.batch([
      statement("DROP INDEX IF EXISTS submissions_status_created_idx"),
      statement("DROP INDEX IF EXISTS location_drafts_status_idx"),
      statement("DROP INDEX IF EXISTS location_revisions_location_idx"),
      statement("DROP INDEX IF EXISTS location_check_ins_location_idx"),
      statement("DROP INDEX IF EXISTS location_check_ins_status_idx"),
      statement("ALTER TABLE location_check_ins RENAME TO location_check_ins_legacy"),
      statement("ALTER TABLE location_revisions RENAME TO location_revisions_legacy"),
      statement("ALTER TABLE location_drafts RENAME TO location_drafts_legacy"),
      statement("ALTER TABLE submissions RENAME TO submissions_legacy"),
      statement(`CREATE TABLE submissions (
        id TEXT PRIMARY KEY, created_at TEXT NOT NULL, place TEXT NOT NULL, city TEXT NOT NULL,
        nation TEXT NOT NULL DEFAULT 'Scotland', admin_area TEXT NOT NULL DEFAULT '', postcode TEXT NOT NULL,
        products TEXT NOT NULL, brand TEXT NOT NULL DEFAULT '', seen_at TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', absorbencies_json TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')), reviewed_at TEXT,
        origin TEXT NOT NULL DEFAULT 'community', report_kind TEXT NOT NULL DEFAULT 'new_location', target_slug TEXT NOT NULL DEFAULT ''
      )`),
      statement(`CREATE TABLE location_drafts (
        id TEXT PRIMARY KEY, submission_id TEXT NOT NULL UNIQUE REFERENCES submissions(id), slug TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL, city TEXT NOT NULL, nation TEXT NOT NULL DEFAULT 'Scotland', admin_area TEXT NOT NULL DEFAULT '',
        venue_type TEXT NOT NULL DEFAULT 'Other', address TEXT NOT NULL DEFAULT '', postcode TEXT NOT NULL,
        latitude REAL, longitude REAL, access TEXT NOT NULL DEFAULT 'Free period products available',
        product_types_json TEXT NOT NULL DEFAULT '["Pads"]', brand TEXT NOT NULL DEFAULT '', attributes_json TEXT NOT NULL DEFAULT '[]', absorbencies_json TEXT NOT NULL DEFAULT '[]',
        evidence TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL, published_at TEXT, origin TEXT NOT NULL DEFAULT 'community',
        archived_at TEXT, last_verified_at TEXT, current_revision INTEGER NOT NULL DEFAULT 1,
        products_json TEXT NOT NULL DEFAULT '[]', sources_json TEXT NOT NULL DEFAULT '[]', confidence TEXT NOT NULL DEFAULT 'community-reported'
      )`),
      statement(`CREATE TABLE location_revisions (
        id TEXT PRIMARY KEY, location_id TEXT NOT NULL REFERENCES location_drafts(id), revision_number INTEGER NOT NULL,
        snapshot_json TEXT NOT NULL, status TEXT NOT NULL CHECK (status IN ('draft','published','superseded')),
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL, published_at TEXT, UNIQUE(location_id,revision_number)
      )`),
      statement(`CREATE TABLE location_check_ins (
        id TEXT PRIMARY KEY, location_id TEXT NOT NULL REFERENCES location_drafts(id), user_id TEXT NOT NULL,
        availability TEXT NOT NULL CHECK (availability IN ('available','low_stock','out_of_stock','could_not_find','location_unavailable')),
        observed_at TEXT NOT NULL, accuracy_rating INTEGER CHECK (accuracy_rating BETWEEN 1 AND 5),
        access_rating INTEGER CHECK (access_rating BETWEEN 1 AND 5), privacy_rating INTEGER CHECK (privacy_rating BETWEEN 1 AND 5),
        comment TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
        created_at TEXT NOT NULL, moderated_at TEXT, UNIQUE(location_id,user_id,observed_at)
      )`),
      statement("INSERT INTO submissions SELECT id,created_at,place,city,nation,admin_area,postcode,products,brand,seen_at,notes,absorbencies_json,status,reviewed_at,origin,report_kind,target_slug FROM submissions_legacy"),
      statement("INSERT INTO location_drafts SELECT id,submission_id,slug,name,city,nation,admin_area,venue_type,address,postcode,latitude,longitude,access,product_types_json,brand,attributes_json,absorbencies_json,evidence,status,created_at,updated_at,published_at,origin,archived_at,last_verified_at,current_revision,products_json,sources_json,confidence FROM location_drafts_legacy"),
      statement("INSERT INTO location_revisions SELECT * FROM location_revisions_legacy"),
      statement("INSERT INTO location_check_ins SELECT * FROM location_check_ins_legacy"),
      statement("DROP TABLE location_check_ins_legacy"),
      statement("DROP TABLE location_revisions_legacy"),
      statement("DROP TABLE location_drafts_legacy"),
      statement("DROP TABLE submissions_legacy"),
    ], "write");
  } finally {
    await database.execute("PRAGMA foreign_keys = ON");
  }
}

async function enforceEnvironmentLock() {
  const environment = process.env.PERIOD_PLACE_ENVIRONMENT || process.env.VERCEL_ENV;
  if (!environment) return;
  if (!new Set(["development", "preview", "production", "test"]).has(environment)) {
    throw new Error("PERIOD_PLACE_ENVIRONMENT must be development, preview, production or test.");
  }
  const result = await database.execute(statement("SELECT value FROM app_metadata WHERE key='environment' LIMIT 1"));
  const storedEnvironment = result.rows[0]?.value ? String(result.rows[0].value) : null;
  if (storedEnvironment && storedEnvironment !== environment) {
    throw new Error(`Database belongs to the ${storedEnvironment} environment, but this app is running as ${environment}. Configure a separate database.`);
  }
  if (!storedEnvironment) {
    await database.execute(statement("INSERT INTO app_metadata (key,value,updated_at) VALUES ('environment',?,?)", [environment, new Date().toISOString()]));
  }
}

async function initialiseDatabase() {
  await database.execute("PRAGMA foreign_keys = ON");
  await database.batch([
    statement(`CREATE TABLE IF NOT EXISTS submissions (
      id TEXT PRIMARY KEY, created_at TEXT NOT NULL, place TEXT NOT NULL,
      city TEXT NOT NULL, nation TEXT NOT NULL DEFAULT 'Scotland', admin_area TEXT NOT NULL DEFAULT '', postcode TEXT NOT NULL,
      products TEXT NOT NULL, brand TEXT NOT NULL DEFAULT '', seen_at TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '', absorbencies_json TEXT NOT NULL DEFAULT '[]', status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','approved','rejected')), reviewed_at TEXT
    )`),
    statement(`CREATE TABLE IF NOT EXISTS location_drafts (
      id TEXT PRIMARY KEY, submission_id TEXT NOT NULL UNIQUE REFERENCES submissions(id),
      slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL, city TEXT NOT NULL,
      nation TEXT NOT NULL DEFAULT 'Scotland', admin_area TEXT NOT NULL DEFAULT '',
      venue_type TEXT NOT NULL DEFAULT 'Other', address TEXT NOT NULL DEFAULT '', postcode TEXT NOT NULL,
      latitude REAL, longitude REAL, access TEXT NOT NULL DEFAULT 'Free period products available',
      product_types_json TEXT NOT NULL DEFAULT '["Pads"]', brand TEXT NOT NULL DEFAULT '',
      attributes_json TEXT NOT NULL DEFAULT '[]', absorbencies_json TEXT NOT NULL DEFAULT '[]', evidence TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, published_at TEXT
    )`),
    statement(`CREATE TABLE IF NOT EXISTS audit_events (
      id TEXT PRIMARY KEY, occurred_at TEXT NOT NULL,
      entity_type TEXT NOT NULL CHECK (entity_type IN ('submission','location')), entity_id TEXT NOT NULL,
      action TEXT NOT NULL, actor TEXT NOT NULL CHECK (actor IN ('public','admin','system')),
      details_json TEXT NOT NULL DEFAULT '{}'
    )`),
    statement(`CREATE TABLE IF NOT EXISTS app_metadata (
      key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL
    )`),
    statement(`CREATE TABLE IF NOT EXISTS submission_rate_limits (
      key_hash TEXT PRIMARY KEY, window_started_at INTEGER NOT NULL, request_count INTEGER NOT NULL
    )`),
    statement(`CREATE TABLE IF NOT EXISTS beta_feedback (
      id TEXT PRIMARY KEY, created_at TEXT NOT NULL, usefulness INTEGER NOT NULL CHECK (usefulness BETWEEN 1 AND 5),
      found_what_needed TEXT NOT NULL CHECK (found_what_needed IN ('yes','partly','no')),
      trusted_results TEXT NOT NULL DEFAULT 'partly' CHECK (trusted_results IN ('yes','partly','no')),
      submitted_update TEXT NOT NULL DEFAULT 'not_tried' CHECK (submitted_update IN ('yes','no','not_tried')),
      would_use_again TEXT NOT NULL DEFAULT 'maybe' CHECK (would_use_again IN ('yes','maybe','no')),
      comments TEXT NOT NULL, excluded_at TEXT, excluded_by TEXT
    )`),
    statement(`CREATE TABLE IF NOT EXISTS contact_requests (
      id TEXT PRIMARY KEY, created_at TEXT NOT NULL, kind TEXT NOT NULL CHECK (kind IN ('general','sponsorship','privacy_deletion')),
      email TEXT NOT NULL, message TEXT NOT NULL, resolved_at TEXT
    )`),
    statement(`CREATE TABLE IF NOT EXISTS location_check_ins (
      id TEXT PRIMARY KEY, location_id TEXT NOT NULL REFERENCES location_drafts(id), user_id TEXT NOT NULL,
      availability TEXT NOT NULL CHECK (availability IN ('available','low_stock','out_of_stock','could_not_find','location_unavailable')),
      observed_at TEXT NOT NULL, accuracy_rating INTEGER CHECK (accuracy_rating BETWEEN 1 AND 5),
      access_rating INTEGER CHECK (access_rating BETWEEN 1 AND 5), privacy_rating INTEGER CHECK (privacy_rating BETWEEN 1 AND 5),
      comment TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
      created_at TEXT NOT NULL, moderated_at TEXT, UNIQUE(location_id,user_id,observed_at)
    )`),
  ], "write");

  await addColumn("submissions", "nation", "TEXT NOT NULL DEFAULT 'Scotland'");
  await addColumn("submissions", "admin_area", "TEXT NOT NULL DEFAULT ''");
  await addColumn("submissions", "origin", "TEXT NOT NULL DEFAULT 'community'");
  await addColumn("submissions", "report_kind", "TEXT NOT NULL DEFAULT 'new_location'");
  await addColumn("submissions", "target_slug", "TEXT NOT NULL DEFAULT ''");
  await addColumn("submissions", "absorbencies_json", "TEXT NOT NULL DEFAULT '[]'");
  await addColumn("audit_events", "actor_id", "TEXT");
  await addColumn("audit_events", "actor_label", "TEXT");
  await addColumn("location_drafts", "origin", "TEXT NOT NULL DEFAULT 'community'");
  await addColumn("location_drafts", "archived_at", "TEXT");
  await addColumn("location_drafts", "last_verified_at", "TEXT");
  await addColumn("location_drafts", "current_revision", "INTEGER NOT NULL DEFAULT 1");
  await addColumn("location_drafts", "products_json", "TEXT NOT NULL DEFAULT '[]'");
  await addColumn("location_drafts", "sources_json", "TEXT NOT NULL DEFAULT '[]'");
  await addColumn("location_drafts", "confidence", "TEXT NOT NULL DEFAULT 'community-reported'");
  await addColumn("location_drafts", "nation", "TEXT NOT NULL DEFAULT 'Scotland'");
  await addColumn("location_drafts", "admin_area", "TEXT NOT NULL DEFAULT ''");
  await addColumn("location_drafts", "absorbencies_json", "TEXT NOT NULL DEFAULT '[]'");
  await addColumn("beta_feedback", "trusted_results", "TEXT NOT NULL DEFAULT 'partly'");
  await addColumn("beta_feedback", "submitted_update", "TEXT NOT NULL DEFAULT 'not_tried'");
  await addColumn("beta_feedback", "would_use_again", "TEXT NOT NULL DEFAULT 'maybe'");
  await addColumn("beta_feedback", "excluded_at", "TEXT");
  await addColumn("beta_feedback", "excluded_by", "TEXT");

  await database.batch([
    statement(`CREATE TABLE IF NOT EXISTS location_revisions (
      id TEXT PRIMARY KEY, location_id TEXT NOT NULL REFERENCES location_drafts(id), revision_number INTEGER NOT NULL,
      snapshot_json TEXT NOT NULL, status TEXT NOT NULL CHECK (status IN ('draft','published','superseded')),
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, published_at TEXT, UNIQUE(location_id,revision_number)
    )`),
  ], "write");

  await removeLegacyCityChecks();

  const twelveMonthsAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
  await database.batch([
    statement("DELETE FROM beta_feedback WHERE created_at<?", [twelveMonthsAgo]),
    statement("DELETE FROM contact_requests WHERE resolved_at IS NOT NULL AND resolved_at<?", [twelveMonthsAgo]),
    statement("DELETE FROM submissions WHERE status='rejected' AND reviewed_at IS NOT NULL AND reviewed_at<?", [twelveMonthsAgo]),
  ], "write");

  await database.batch([
    statement("CREATE INDEX IF NOT EXISTS submissions_status_created_idx ON submissions(status,created_at DESC)"),
    statement("CREATE INDEX IF NOT EXISTS location_drafts_status_idx ON location_drafts(status,published_at DESC)"),
    statement("CREATE INDEX IF NOT EXISTS audit_events_time_idx ON audit_events(occurred_at DESC)"),
    statement("CREATE INDEX IF NOT EXISTS submission_rate_limits_window_idx ON submission_rate_limits(window_started_at)"),
    statement("CREATE INDEX IF NOT EXISTS location_revisions_location_idx ON location_revisions(location_id,status)"),
    statement("CREATE INDEX IF NOT EXISTS location_check_ins_location_idx ON location_check_ins(location_id,status,observed_at DESC)"),
    statement("CREATE INDEX IF NOT EXISTS location_check_ins_status_idx ON location_check_ins(status,created_at DESC)"),
  ], "write");

  await database.batch([
    statement("UPDATE submissions SET admin_area=CASE city WHEN 'Glasgow' THEN 'Glasgow City' WHEN 'Edinburgh' THEN 'City of Edinburgh' ELSE admin_area END WHERE admin_area=''"),
    statement("UPDATE location_drafts SET admin_area=CASE city WHEN 'Glasgow' THEN 'Glasgow City' WHEN 'Edinburgh' THEN 'City of Edinburgh' ELSE admin_area END WHERE admin_area=''"),
  ], "write");

  await enforceEnvironmentLock();
  await migrateLegacyRecords();
  await syncOfficialLocationSeeds(officialSeeds);
  await backfillApprovedSubmissions();
}

async function ensureDatabase() { initialisation ??= initialiseDatabase(); await initialisation; }
export async function initialisePeriodPlaceDatabase() { await ensureDatabase(); }
export async function closeDatabaseConnection() { await database.close(); }
function safeArray<T>(value: string): T[] { try { const parsed: unknown = JSON.parse(value); return Array.isArray(parsed) ? parsed as T[] : []; } catch { return []; } }
function slugify(value: string) { return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70) || "community-location"; }
function inferredProducts(value: string, brand: string, selectedAbsorbencies: Absorbency[] = []): ProductOffering[] {
  const lower = value.toLowerCase(); const types: ProductOffering["type"][] = [];
  if (lower.includes("liner")) types.push("Pantyliners"); else if (lower.includes("pad")) types.push("Pads");
  if (lower.includes("tampon")) types.push("Tampons"); if (lower.includes("pant")) types.push("Period pants");
  if (lower.includes("reusable pad")) types.push("Reusable pads"); if (lower.includes("cup")) types.push("Menstrual cups");
  if (lower.includes("disc")) types.push("Menstrual discs");
  const selected: ProductOffering["type"][] = types.length ? types : ["Pads"];
  return selected.map((type) => normaliseProduct({ type, brand: brand || null, attributes: [], absorbencies: selectedAbsorbencies, evidence: "Reviewed community submission" }));
}
function normaliseProduct(product: ProductOffering): ProductOffering {
  const attributes = product.attributes.map((attribute) => attribute === "Plastic-free" ? "Plastic-free product" : attribute);
  const productAbsorbencies = (product.absorbencies || []).filter((value): value is Absorbency => absorbencies.includes(value as Absorbency));
  const reusable = new Set<ProductOffering["type"]>(["Period pants", "Reusable pads", "Menstrual cups", "Menstrual discs"]);
  if (reusable.has(product.type) && !attributes.includes("Reusable")) attributes.push("Reusable");
  if (!reusable.has(product.type) && product.type !== "Other / specialist" && !attributes.includes("Disposable")) attributes.push("Disposable");
  return { ...product, attributes: [...new Set(attributes)], absorbencies: [...new Set(productAbsorbencies)] };
}
function legacyProducts(row: DraftRow): ProductOffering[] {
  const stored = safeArray<ProductOffering>(row.products_json); if (stored.length) return stored.map(normaliseProduct);
  return safeArray<ProductOffering["type"]>(row.product_types_json).map((type) => normaliseProduct({ type, brand: row.brand || null, attributes: safeArray<string>(row.attributes_json), absorbencies: safeArray<Absorbency>(row.absorbencies_json), evidence: row.evidence || "Reviewed community submission" }));
}
function legacySources(row: DraftRow): EvidenceSource[] {
  const stored = safeArray<EvidenceSource>(row.sources_json); if (stored.length) return stored;
  return [{ label: "Reviewed community submission", url: "/about", checked: row.last_verified_at || row.published_at || row.updated_at, scope: row.evidence || "Community report reviewed by an administrator." }];
}
function normaliseDraftInput(value: DraftInput | (Omit<DraftInput, "attributes" | "absorbencies" | "nation" | "adminArea"> & { attributes: string | DraftInput["attributes"]; absorbencies?: DraftInput["absorbencies"]; nation?: UkNation; adminArea?: string })): DraftInput {
  const rawAttributes = Array.isArray(value.attributes) ? value.attributes : value.attributes.split(",").map((item) => item.trim());
  const attributes = rawAttributes.filter((item): item is DraftInput["attributes"][number] => productAttributes.includes(item as DraftInput["attributes"][number]));
  const selectedAbsorbencies = (value.absorbencies || []).filter((item): item is Absorbency => absorbencies.includes(item as Absorbency));
  return { ...value, nation: value.nation || "Scotland", adminArea: value.adminArea || (value.city === "Edinburgh" ? "City of Edinburgh" : value.city === "Glasgow" ? "Glasgow City" : ""), attributes, absorbencies: selectedAbsorbencies };
}
function snapshotFromRow(row: DraftRow): DraftInput {
  const products = legacyProducts(row);
  return normaliseDraftInput({ id: row.id, name: row.name, city: row.city, nation: row.nation || "Scotland", adminArea: row.admin_area || "", venueType: row.venue_type, address: row.address, postcode: row.postcode, latitude: row.latitude ?? 0, longitude: row.longitude ?? 0, access: row.access, productTypes: products.map((item) => item.type), brand: products.find((item) => item.brand)?.brand || "", attributes: [...new Set(products.flatMap((item) => item.attributes))] as DraftInput["attributes"], absorbencies: [...new Set(products.flatMap((item) => item.absorbencies || []))], evidence: legacySources(row)[0]?.scope || row.evidence, lastVerifiedAt: (row.last_verified_at || row.updated_at).slice(0, 10) });
}
function toSubmission(row: SubmissionRow): SubmissionRecord {
  return { id: row.id, createdAt: row.created_at, reportKind: row.report_kind, targetSlug: row.target_slug, place: row.place, city: row.city, nation: row.nation || "Scotland", adminArea: row.admin_area || "", postcode: row.postcode, products: row.products, absorbencies: safeArray<Absorbency>(row.absorbencies_json), brand: row.brand, seenAt: row.seen_at, notes: row.notes, status: row.status, reviewedAt: row.reviewed_at };
}
async function pendingRevision(locationId: string, executor: Client | Transaction = database) {
  const result = await executor.execute(statement("SELECT * FROM location_revisions WHERE location_id=? AND status='draft' ORDER BY revision_number DESC LIMIT 1", [locationId]));
  return rowsAs<RevisionRow>(result.rows)[0];
}
async function toDraft(row: DraftRow): Promise<LocationDraft> {
  const revision = await pendingRevision(row.id); const input = revision ? normaliseDraftInput(JSON.parse(revision.snapshot_json) as DraftInput) : snapshotFromRow(row);
  return { ...input, slug: row.slug, submissionId: row.submission_id, attributes: input.attributes, latitude: row.status === "draft" ? row.latitude : input.latitude, longitude: row.status === "draft" ? row.longitude : input.longitude, status: row.status, origin: row.origin, archivedAt: row.archived_at, currentRevision: row.current_revision, hasPendingRevision: Boolean(revision), createdAt: row.created_at, updatedAt: revision?.updated_at || row.updated_at, publishedAt: row.published_at, products: legacyProducts(row), sources: legacySources(row), needsRecheck: Date.now() - new Date(input.lastVerifiedAt).getTime() > 180 * 24 * 60 * 60 * 1000 };
}

async function migrateLegacyRecords() {
  const result = await database.execute("SELECT * FROM location_drafts"); const statements: InStatement[] = [];
  for (const row of rowsAs<DraftRow>(result.rows)) {
    if (!safeArray<ProductOffering>(row.products_json).length) statements.push(statement("UPDATE location_drafts SET products_json=?,sources_json=?,last_verified_at=COALESCE(last_verified_at,?),confidence=? WHERE id=?", [JSON.stringify(legacyProducts(row)), JSON.stringify(legacySources(row)), row.published_at || row.updated_at, "community-reported", row.id]));
    if (row.status === "published") {
      const existing = await database.execute(statement("SELECT id FROM location_revisions WHERE location_id=? AND status='published' LIMIT 1", [row.id]));
      if (!existing.rows.length) statements.push(statement("INSERT INTO location_revisions (id,location_id,revision_number,snapshot_json,status,created_at,updated_at,published_at) VALUES (?,?,?,?,?,?,?,?)", [crypto.randomUUID(), row.id, row.current_revision, JSON.stringify(snapshotFromRow(row)), "published", row.created_at, row.updated_at, row.published_at || row.updated_at]));
    }
  }
  if (statements.length) await database.batch(statements, "write");
}

function officialSnapshot(locationId: string, seed: PeriodLocation): DraftInput & Pick<PeriodLocation, "products" | "sources" | "confidence"> {
  return { id: locationId, name: seed.name, city: seed.city, nation: seed.nation, adminArea: seed.adminArea, venueType: seed.venueType, address: seed.address, postcode: seed.postcode, latitude: seed.latitude, longitude: seed.longitude, access: seed.access, productTypes: seed.products.map((product) => product.type), brand: seed.products.find((product) => product.brand)?.brand || "", attributes: [...new Set(seed.products.flatMap((product) => product.attributes))] as DraftInput["attributes"], absorbencies: [...new Set(seed.products.flatMap((product) => product.absorbencies || []))], evidence: seed.sources[0]?.scope || "Official source evidence", lastVerifiedAt: seed.lastVerifiedAt || "2026-08-30", products: seed.products, sources: seed.sources, confidence: seed.confidence };
}

function normalisedOfficialSnapshot(location: PeriodLocation): string {
  const products = location.products.map(normaliseProduct).map((product) => JSON.stringify({ type: product.type, brand: product.brand, attributes: [...new Set(product.attributes)].sort(), absorbencies: [...new Set(product.absorbencies || [])].sort(), evidence: product.evidence })).sort();
  const sources = location.sources.map((source) => JSON.stringify({ label: source.label, url: source.url, scope: source.scope })).sort();
  return JSON.stringify({ slug: location.slug, name: location.name, city: location.city, nation: location.nation, adminArea: location.adminArea, venueType: location.venueType, address: location.address, postcode: location.postcode, latitude: location.latitude, longitude: location.longitude, access: location.access, confidence: location.confidence, products, sources });
}

async function lastAppliedOfficialSnapshots(transaction: Transaction) {
  const result = await transaction.execute(`SELECT r.location_id,r.snapshot_json FROM location_revisions r
    JOIN (
      SELECT entity_id,MAX(CASE WHEN action='official_seeded' THEN 1 ELSE CAST(json_extract(details_json,'$.revision') AS INTEGER) END) AS revision_number
      FROM audit_events WHERE entity_type='location' AND actor='system'
        AND action IN ('official_seeded','official_source_refreshed','official_source_migrated')
      GROUP BY entity_id
    ) applied ON applied.entity_id=r.location_id AND applied.revision_number=r.revision_number`);
  return new Map(rowsAs<{ location_id: string; snapshot_json: string }>(result.rows).map((row) => [row.location_id, row.snapshot_json]));
}

function officialBaselineFromRow(row: DraftRow, snapshotJson: string | undefined): string | null {
  if (!snapshotJson) return null;
  const snapshot = JSON.parse(snapshotJson) as Partial<DraftInput & Pick<PeriodLocation, "products" | "sources" | "confidence">>;
  const requiredFields = ["name", "city", "nation", "adminArea", "venueType", "address", "postcode", "latitude", "longitude", "access"] as const;
  if (requiredFields.some((field) => snapshot[field] === undefined)) return null;
  // Legacy official snapshots hold draft fields only. Admin publication keeps the official product/source columns intact.
  return normalisedOfficialSnapshot({ ...publicFromRow(row), ...snapshot, slug: row.slug, products: snapshot.products || legacyProducts(row), sources: snapshot.sources || legacySources(row), confidence: snapshot.confidence || row.confidence });
}

// Seeds are the complete active source set. Initialisation prepares the schema before calling this entry point.
export async function syncOfficialLocationSeeds(seeds: PeriodLocation[] = officialSeeds): Promise<void> {
  const activeOfficialSlugs = new Set(seeds.map((seed) => seed.slug));
  const transaction = await database.transaction("write");
  try {
    const officialSnapshots = await lastAppliedOfficialSnapshots(transaction);
    for (const seed of seeds) {
      const existing = await transaction.execute(statement("SELECT * FROM location_drafts WHERE slug=? LIMIT 1", [seed.slug]));
      const row = rowsAs<DraftRow>(existing.rows)[0];
      const now = new Date().toISOString();
      if (row) {
        if (row.origin !== "official") continue;
        const current = normalisedOfficialSnapshot(publicFromRow(row));
        const baseline = officialBaselineFromRow(row, officialSnapshots.get(row.id));
        const changed = (baseline || current) !== normalisedOfficialSnapshot(seed);
        if (!changed && !row.archived_at) continue;
        if (await pendingRevision(row.id, transaction)) {
          await transaction.execute(auditStatement("location", row.id, "official_source_refresh_deferred", "system", { slug: seed.slug, reason: "An admin revision is pending." }));
          continue;
        }
        if (!changed) {
          await transaction.execute(statement("UPDATE location_drafts SET archived_at=NULL,updated_at=? WHERE id=?", [now, row.id]));
          await transaction.execute(auditStatement("location", row.id, "official_source_reactivated", "system", { slug: seed.slug }));
          continue;
        }
        if (!baseline || current !== baseline) {
          await transaction.execute(auditStatement("location", row.id, "official_source_refresh_deferred", "system", { slug: seed.slug, reason: baseline ? "Published administrator corrections differ from the last applied official source." : "The last applied official source baseline is unavailable." }));
          continue;
        }
        const revision = row.current_revision + 1;
        const snapshot = officialSnapshot(row.id, seed);
        await transaction.execute(statement("UPDATE location_revisions SET status='superseded' WHERE location_id=? AND status='published'", [row.id]));
        await transaction.execute(statement("INSERT INTO location_revisions (id,location_id,revision_number,snapshot_json,status,created_at,updated_at,published_at) VALUES (?,?,?,?,?,?,?,?)", [crypto.randomUUID(), row.id, revision, JSON.stringify(snapshot), "published", now, now, now]));
        await transaction.execute(statement(`UPDATE location_drafts SET name=?,city=?,nation=?,admin_area=?,venue_type=?,address=?,postcode=?,latitude=?,longitude=?,access=?,product_types_json=?,brand=?,attributes_json=?,absorbencies_json=?,evidence=?,last_verified_at=?,products_json=?,sources_json=?,confidence=?,updated_at=?,published_at=?,current_revision=?,status='published',archived_at=NULL WHERE id=?`, [seed.name, seed.city, seed.nation, seed.adminArea, seed.venueType, seed.address, seed.postcode, seed.latitude, seed.longitude, seed.access, JSON.stringify(snapshot.productTypes), snapshot.brand, JSON.stringify(snapshot.attributes), JSON.stringify(snapshot.absorbencies), snapshot.evidence, snapshot.lastVerifiedAt, JSON.stringify(seed.products), JSON.stringify(seed.sources), seed.confidence, now, now, revision, row.id]));
        await transaction.execute(auditStatement("location", row.id, "official_source_refreshed", "system", { slug: seed.slug, revision, reactivated: Boolean(row.archived_at) }));
        officialSnapshots.set(row.id, JSON.stringify(snapshot));
        continue;
      }
      const submissionId = crypto.randomUUID(); const locationId = crypto.randomUUID(); const snapshot = officialSnapshot(locationId, seed);
      await transaction.execute(statement("INSERT INTO submissions (id,created_at,place,city,nation,admin_area,postcode,products,brand,seen_at,notes,status,reviewed_at,origin,report_kind,target_slug) VALUES (?,?,?,?,?,?,?,?,?,?,'Seeded from official source evidence','approved',?,'official','new_location','')", [submissionId, now, seed.name, seed.city, seed.nation, seed.adminArea, seed.postcode, snapshot.productTypes.join(", "), snapshot.brand, snapshot.lastVerifiedAt, now]));
      await transaction.execute(statement(`INSERT INTO location_drafts (id,submission_id,slug,name,city,nation,admin_area,venue_type,address,postcode,latitude,longitude,access,product_types_json,brand,attributes_json,absorbencies_json,evidence,status,created_at,updated_at,published_at,origin,last_verified_at,current_revision,products_json,sources_json,confidence) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [locationId, submissionId, seed.slug, seed.name, seed.city, seed.nation, seed.adminArea, seed.venueType, seed.address, seed.postcode, seed.latitude, seed.longitude, seed.access, JSON.stringify(snapshot.productTypes), snapshot.brand, JSON.stringify(snapshot.attributes), JSON.stringify(snapshot.absorbencies), snapshot.evidence, "published", now, now, now, "official", snapshot.lastVerifiedAt, 1, JSON.stringify(seed.products), JSON.stringify(seed.sources), seed.confidence]));
      await transaction.execute(statement("INSERT INTO location_revisions (id,location_id,revision_number,snapshot_json,status,created_at,updated_at,published_at) VALUES (?,?,?,?,?,?,?,?)", [crypto.randomUUID(), locationId, 1, JSON.stringify(snapshot), "published", now, now, now]));
      await transaction.execute(auditStatement("location", locationId, "official_seeded", "system", { slug: seed.slug }));
      officialSnapshots.set(locationId, JSON.stringify(snapshot));
    }
    const activeOfficial = await transaction.execute("SELECT * FROM location_drafts WHERE origin='official' AND archived_at IS NULL");
    for (const row of rowsAs<DraftRow>(activeOfficial.rows)) {
      const slug = row.slug; const locationId = row.id;
      if (activeOfficialSlugs.has(slug)) continue;
      if (await pendingRevision(locationId, transaction)) {
        await transaction.execute(auditStatement("location", locationId, "official_source_refresh_deferred", "system", { slug, reason: "An admin revision is pending; inactive-source handling deferred." }));
        continue;
      }
      const baseline = officialBaselineFromRow(row, officialSnapshots.get(locationId));
      if (!baseline || normalisedOfficialSnapshot(publicFromRow(row)) !== baseline) {
        await transaction.execute(auditStatement("location", locationId, "official_source_refresh_deferred", "system", { slug, reason: "Inactive-source handling deferred because published corrections or the missing official baseline require review." }));
        continue;
      }
      const now = new Date().toISOString();
      await transaction.execute(statement("UPDATE location_drafts SET archived_at=?,updated_at=? WHERE id=?", [now, now, locationId]));
      await transaction.execute(auditStatement("location", locationId, "official_source_inactive", "system", { slug, reason: "Not present in the active source set for this environment." }));
    }
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  } finally {
    transaction.close();
  }
}

async function createDraftForSubmission(executor: Client | Transaction, row: SubmissionRow, actor: AuditEvent["actor"], admin?: AdminActor) {
  const existing = await executor.execute(statement("SELECT id FROM location_drafts WHERE submission_id=? LIMIT 1", [row.id])); if (existing.rows.length) return String(existing.rows[0].id);
  const id = crypto.randomUUID(); const now = new Date().toISOString(); const selectedAbsorbencies = safeArray<Absorbency>(row.absorbencies_json); const products = inferredProducts(row.products, row.brand, selectedAbsorbencies);
  const sources: EvidenceSource[] = [{ label: "Reviewed community submission", url: "/about", checked: row.seen_at || now.slice(0, 10), scope: row.notes || "Community report reviewed by an administrator." }];
  await executor.execute(statement(`INSERT INTO location_drafts (id,submission_id,slug,name,city,nation,admin_area,postcode,product_types_json,brand,absorbencies_json,evidence,created_at,updated_at,origin,last_verified_at,products_json,sources_json,confidence) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [id, row.id, `${slugify(row.place)}-${row.id.slice(0, 8)}`, row.place, row.city, row.nation || "Scotland", row.admin_area || "", row.postcode, JSON.stringify(products.map((product) => product.type)), row.brand, JSON.stringify(selectedAbsorbencies), row.notes, now, now, "community", row.seen_at || now, JSON.stringify(products), JSON.stringify(sources), "community-reported"]));
  await executor.execute(auditStatement("location", id, "draft_created", actor, { submissionId: row.id }, admin)); return id;
}
async function backfillApprovedSubmissions() {
  const result = await database.execute("SELECT s.* FROM submissions s LEFT JOIN location_drafts d ON d.submission_id=s.id WHERE s.status='approved' AND s.origin='community' AND s.report_kind='new_location' AND d.id IS NULL"); if (!result.rows.length) return;
  const transaction = await database.transaction("write");
  try { for (const row of rowsAs<SubmissionRow>(result.rows)) await createDraftForSubmission(transaction, row, "system"); await transaction.commit(); }
  catch (error) { await transaction.rollback(); throw error; } finally { transaction.close(); }
}
function updateCommunityEvidence(input: DraftInput) {
  const attributes = input.attributes;
  const products: ProductOffering[] = input.productTypes.map((type) => ({ type, brand: input.brand || null, attributes, absorbencies: input.absorbencies, evidence: input.evidence }));
  const sources: EvidenceSource[] = [{ label: "Reviewed community submission", url: "/about", checked: input.lastVerifiedAt, scope: input.evidence }];
  return { products, sources, attributes };
}

export async function createSubmission(input: NewSubmission) {
  await ensureDatabase(); const id = crypto.randomUUID(); const createdAt = new Date().toISOString();
  await database.batch([statement("INSERT INTO submissions (id,created_at,place,city,nation,admin_area,postcode,products,brand,seen_at,notes,absorbencies_json,report_kind,target_slug) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)", [id, createdAt, input.place, input.city, input.nation, input.adminArea, input.postcode, input.products, input.brand, input.seenAt, input.notes, JSON.stringify(input.absorbencies), input.reportKind, input.targetSlug]), auditStatement("submission", id, "submitted", "public", { city: input.city, nation: input.nation, reportKind: input.reportKind, targetSlug: input.targetSlug || undefined })], "write"); return id;
}

export async function consumeSubmissionRateLimit(keyHash: string, limit = 5, windowMs = 60 * 60 * 1000) {
  await ensureDatabase();
  const now = Date.now();
  const transaction = await database.transaction("write");
  try {
    await transaction.execute(statement("DELETE FROM submission_rate_limits WHERE window_started_at<?", [now - 2 * windowMs]));
    const result = await transaction.execute(statement("SELECT window_started_at,request_count FROM submission_rate_limits WHERE key_hash=? LIMIT 1", [keyHash]));
    const row = result.rows[0];
    if (!row || Number(row.window_started_at) <= now - windowMs) {
      await transaction.execute(statement("INSERT INTO submission_rate_limits (key_hash,window_started_at,request_count) VALUES (?,?,1) ON CONFLICT(key_hash) DO UPDATE SET window_started_at=excluded.window_started_at,request_count=1", [keyHash, now]));
      await transaction.commit();
      return true;
    }
    if (Number(row.request_count) >= limit) {
      await transaction.commit();
      return false;
    }
    await transaction.execute(statement("UPDATE submission_rate_limits SET request_count=request_count+1 WHERE key_hash=?", [keyHash]));
    await transaction.commit();
    return true;
  } catch (error) {
    await transaction.rollback();
    throw error;
  } finally {
    transaction.close();
  }
}
export async function listSubmissions(): Promise<SubmissionRecord[]> {
  await ensureDatabase(); const result = await database.execute("SELECT * FROM submissions WHERE origin='community' ORDER BY created_at DESC"); return rowsAs<SubmissionRow>(result.rows).map(toSubmission);
}
export async function createFeedback(input: NewFeedback) {
  await ensureDatabase();
  const id = crypto.randomUUID();
  await database.execute(statement("INSERT INTO beta_feedback (id,created_at,usefulness,found_what_needed,trusted_results,submitted_update,would_use_again,comments) VALUES (?,?,?,?,?,?,?,?)", [id, new Date().toISOString(), input.usefulness, input.foundWhatNeeded, input.trustedResults, input.submittedUpdate, input.wouldUseAgain, input.comments]));
  return id;
}
export async function listFeedback(): Promise<FeedbackRecord[]> {
  await ensureDatabase();
  const result = await database.execute("SELECT * FROM beta_feedback ORDER BY created_at DESC LIMIT 100");
  return feedbackRecords(result.rows);
}
export async function listAllFeedback(): Promise<FeedbackRecord[]> {
  await ensureDatabase();
  const result = await database.execute("SELECT * FROM beta_feedback ORDER BY created_at DESC");
  return feedbackRecords(result.rows);
}
function feedbackRecords(rows: Iterable<Record<string, unknown>>): FeedbackRecord[] {
  return [...rows].map((row) => ({ id: String(row.id), createdAt: String(row.created_at), usefulness: Number(row.usefulness), foundWhatNeeded: String(row.found_what_needed) as FeedbackRecord["foundWhatNeeded"], trustedResults: String(row.trusted_results) as FeedbackRecord["trustedResults"], submittedUpdate: String(row.submitted_update) as FeedbackRecord["submittedUpdate"], wouldUseAgain: String(row.would_use_again) as FeedbackRecord["wouldUseAgain"], comments: String(row.comments), excludedAt: row.excluded_at ? String(row.excluded_at) : null, excludedBy: row.excluded_by ? String(row.excluded_by) : null }));
}
export async function setFeedbackMetricInclusion(id: string, included: boolean, admin?: AdminActor) {
  await ensureDatabase();
  const result = included
    ? await database.execute(statement("UPDATE beta_feedback SET excluded_at=NULL,excluded_by=NULL WHERE id=? AND excluded_at IS NOT NULL", [id]))
    : await database.execute(statement("UPDATE beta_feedback SET excluded_at=?,excluded_by=? WHERE id=? AND excluded_at IS NULL", [new Date().toISOString(), admin?.label || admin?.id || "admin", id]));
  return result.rowsAffected === 1;
}

export async function createContactRequest(input: NewContactRequest) {
  await ensureDatabase();
  const id = crypto.randomUUID();
  await database.execute(statement("INSERT INTO contact_requests (id,created_at,kind,email,message) VALUES (?,?,?,?,?)", [id, new Date().toISOString(), input.kind, input.email, input.message]));
  return id;
}

export async function listContactRequests(): Promise<ContactRequestRecord[]> {
  await ensureDatabase();
  const result = await database.execute("SELECT * FROM contact_requests ORDER BY resolved_at IS NULL DESC,created_at DESC LIMIT 100");
  return result.rows.map((row) => ({ id: String(row.id), createdAt: String(row.created_at), kind: String(row.kind) as ContactRequestRecord["kind"], email: String(row.email), message: String(row.message), resolvedAt: row.resolved_at ? String(row.resolved_at) : null }));
}

export async function resolveContactRequest(id: string, admin?: AdminActor) {
  await ensureDatabase();
  const now = new Date().toISOString();
  const result = await database.execute(statement("UPDATE contact_requests SET resolved_at=? WHERE id=? AND resolved_at IS NULL", [now, id]));
  void admin;
  return result.rowsAffected === 1;
}

function toCheckIn(row: CheckInRow): CheckInRecord {
  return {
    id: row.id,
    locationId: row.location_id,
    locationName: row.location_name || "Unknown location",
    userId: row.user_id,
    availability: row.availability,
    observedAt: row.observed_at,
    accuracyRating: row.accuracy_rating ?? undefined,
    accessRating: row.access_rating ?? undefined,
    privacyRating: row.privacy_rating ?? undefined,
    comment: row.comment,
    status: row.status,
    createdAt: row.created_at,
    moderatedAt: row.moderated_at,
  };
}

export async function createCheckIn(input: NewCheckIn) {
  await ensureDatabase();
  const locationResult = await database.execute(statement("SELECT id FROM location_drafts WHERE slug=? AND status='published' AND archived_at IS NULL LIMIT 1", [input.locationSlug]));
  const locationId = locationResult.rows[0]?.id ? String(locationResult.rows[0].id) : null;
  if (!locationId) return { status: "not_found" as const };
  const id = crypto.randomUUID();
  try {
    await database.batch([
      statement("INSERT INTO location_check_ins (id,location_id,user_id,availability,observed_at,accuracy_rating,access_rating,privacy_rating,comment,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,'pending',?)", [id, locationId, input.userId, input.availability, input.observedAt, input.accuracyRating ?? null, input.accessRating ?? null, input.privacyRating ?? null, input.comment, new Date().toISOString()]),
      auditStatement("location", locationId, "check_in_submitted", "public", { checkInId: id, availability: input.availability }),
    ], "write");
    return { status: "created" as const, id };
  } catch (error) {
    if (error instanceof Error && /UNIQUE constraint failed/i.test(error.message)) return { status: "duplicate" as const };
    throw error;
  }
}

export async function listCheckIns(): Promise<CheckInRecord[]> {
  await ensureDatabase();
  const result = await database.execute(`SELECT c.*,l.name AS location_name FROM location_check_ins c
    JOIN location_drafts l ON l.id=c.location_id ORDER BY c.status='pending' DESC,c.created_at DESC LIMIT 200`);
  return rowsAs<CheckInRow>(result.rows).map(toCheckIn);
}

export async function moderateCheckIn(id: string, status: Exclude<CheckInStatus, "pending">, admin?: AdminActor) {
  await ensureDatabase();
  const transaction = await database.transaction("write");
  try {
    const found = await transaction.execute(statement("SELECT location_id,status FROM location_check_ins WHERE id=? LIMIT 1", [id]));
    const locationId = found.rows[0]?.location_id ? String(found.rows[0].location_id) : null;
    if (!locationId) { await transaction.rollback(); return false; }
    if (String(found.rows[0]?.status) === status) { await transaction.rollback(); return true; }
    await transaction.execute(statement("UPDATE location_check_ins SET status=?,moderated_at=? WHERE id=?", [status, new Date().toISOString(), id]));
    await transaction.execute(auditStatement("location", locationId, `check_in_${status}`, "admin", { checkInId: id }, admin));
    await transaction.commit();
    return true;
  } catch (error) {
    await transaction.rollback();
    throw error;
  } finally {
    transaction.close();
  }
}
export async function moderateSubmission(id: string, status: Exclude<SubmissionStatus, "pending">, admin?: AdminActor) {
  await ensureDatabase(); const transaction = await database.transaction("write");
  try {
    const result = await transaction.execute(statement("SELECT * FROM submissions WHERE id=? AND origin='community' LIMIT 1", [id])); const row = rowsAs<SubmissionRow>(result.rows)[0];
    if (!row || row.status !== "pending") { await transaction.rollback(); return false; }
    await transaction.execute(statement("UPDATE submissions SET status=?,reviewed_at=? WHERE id=?", [status, new Date().toISOString(), id])); await transaction.execute(auditStatement("submission", id, status, "admin", {}, admin));
    if (status === "approved" && row.report_kind === "new_location") await createDraftForSubmission(transaction, { ...row, status }, "admin", admin); await transaction.commit(); return true;
  } catch (error) { await transaction.rollback(); throw error; } finally { transaction.close(); }
}
export async function listDrafts(): Promise<LocationDraft[]> {
  await ensureDatabase(); const result = await database.execute("SELECT * FROM location_drafts ORDER BY archived_at IS NOT NULL,updated_at DESC"); return Promise.all(rowsAs<DraftRow>(result.rows).map(toDraft));
}
export async function getDraft(id: string): Promise<LocationDraft | null> {
  await ensureDatabase(); const result = await database.execute(statement("SELECT * FROM location_drafts WHERE id=? LIMIT 1", [id])); const row = rowsAs<DraftRow>(result.rows)[0]; return row ? toDraft(row) : null;
}
export async function createLocationRevision(id: string, admin?: AdminActor) {
  await ensureDatabase(); const transaction = await database.transaction("write");
  try {
    const result = await transaction.execute(statement("SELECT * FROM location_drafts WHERE id=? LIMIT 1", [id])); const row = rowsAs<DraftRow>(result.rows)[0];
    if (!row || row.status !== "published" || row.archived_at) { await transaction.rollback(); return false; }
    if (await pendingRevision(id, transaction)) { await transaction.commit(); return true; }
    const now = new Date().toISOString(); await transaction.execute(statement("INSERT INTO location_revisions (id,location_id,revision_number,snapshot_json,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)", [crypto.randomUUID(), id, row.current_revision + 1, JSON.stringify(snapshotFromRow(row)), "draft", now, now]));
    await transaction.execute(auditStatement("location", id, "revision_created", "admin", { revision: row.current_revision + 1 }, admin)); await transaction.commit(); return true;
  } catch (error) { await transaction.rollback(); throw error; } finally { transaction.close(); }
}
export async function saveDraft(input: DraftInput, admin?: AdminActor) {
  await ensureDatabase(); const transaction = await database.transaction("write");
  try {
    const result = await transaction.execute(statement("SELECT * FROM location_drafts WHERE id=? LIMIT 1", [input.id])); const row = rowsAs<DraftRow>(result.rows)[0]; if (!row || row.archived_at) { await transaction.rollback(); return false; }
    const now = new Date().toISOString();
    if (row.status === "published") {
      const revision = await pendingRevision(row.id, transaction); if (!revision) { await transaction.rollback(); return false; }
      await transaction.execute(statement("UPDATE location_revisions SET snapshot_json=?,updated_at=? WHERE id=?", [JSON.stringify(input), now, revision.id]));
    } else {
      const evidence = updateCommunityEvidence(input);
      await transaction.execute(statement(`UPDATE location_drafts SET name=?,city=?,nation=?,admin_area=?,venue_type=?,address=?,postcode=?,latitude=?,longitude=?,access=?,product_types_json=?,brand=?,attributes_json=?,absorbencies_json=?,evidence=?,last_verified_at=?,products_json=?,sources_json=?,updated_at=? WHERE id=?`, [input.name, input.city, input.nation, input.adminArea, input.venueType, input.address, input.postcode, input.latitude, input.longitude, input.access, JSON.stringify(input.productTypes), input.brand, JSON.stringify(evidence.attributes), JSON.stringify(input.absorbencies), input.evidence, input.lastVerifiedAt, JSON.stringify(evidence.products), JSON.stringify(evidence.sources), now, input.id]));
    }
    await transaction.execute(auditStatement("location", input.id, "draft_updated", "admin", {}, admin)); await transaction.commit(); return true;
  } catch (error) { await transaction.rollback(); throw error; } finally { transaction.close(); }
}
export async function publishDraft(id: string, admin?: AdminActor) {
  await ensureDatabase(); const transaction = await database.transaction("write");
  try {
    const result = await transaction.execute(statement("SELECT * FROM location_drafts WHERE id=? LIMIT 1", [id])); const row = rowsAs<DraftRow>(result.rows)[0]; if (!row || row.archived_at) { await transaction.rollback(); return null; }
    const now = new Date().toISOString();
    if (row.status === "draft") {
      if (row.latitude === null || row.longitude === null || !row.address || !row.evidence) { await transaction.rollback(); return null; }
      await transaction.execute(statement("UPDATE location_drafts SET status='published',published_at=?,updated_at=?,current_revision=1 WHERE id=?", [now, now, id]));
      await transaction.execute(statement("INSERT INTO location_revisions (id,location_id,revision_number,snapshot_json,status,created_at,updated_at,published_at) VALUES (?,?,?,?,?,?,?,?)", [crypto.randomUUID(), id, 1, JSON.stringify(snapshotFromRow({ ...row, status: "published" })), "published", now, now, now]));
    } else {
      const revision = await pendingRevision(id, transaction); if (!revision) { await transaction.rollback(); return null; }
      const input = normaliseDraftInput(JSON.parse(revision.snapshot_json) as DraftInput); const community = updateCommunityEvidence(input);
      const assignments = ["name=?", "city=?", "nation=?", "admin_area=?", "venue_type=?", "address=?", "postcode=?", "latitude=?", "longitude=?", "access=?", "last_verified_at=?", "updated_at=?", "current_revision=?"];
      const args: Array<string | number | null> = [input.name, input.city, input.nation, input.adminArea, input.venueType, input.address, input.postcode, input.latitude, input.longitude, input.access, input.lastVerifiedAt, now, revision.revision_number];
      if (row.origin === "community") { assignments.push("product_types_json=?", "brand=?", "attributes_json=?", "absorbencies_json=?", "evidence=?", "products_json=?", "sources_json=?"); args.push(JSON.stringify(input.productTypes), input.brand, JSON.stringify(community.attributes), JSON.stringify(input.absorbencies), input.evidence, JSON.stringify(community.products), JSON.stringify(community.sources)); }
      args.push(id); await transaction.execute(statement(`UPDATE location_drafts SET ${assignments.join(",")} WHERE id=?`, args));
      await transaction.execute(statement("UPDATE location_revisions SET status='superseded' WHERE location_id=? AND status='published'", [id])); await transaction.execute(statement("UPDATE location_revisions SET status='published',published_at=?,updated_at=? WHERE id=?", [now, now, revision.id]));
    }
    await transaction.execute(auditStatement("location", id, row.status === "draft" ? "published" : "revision_published", "admin", { slug: row.slug }, admin)); await transaction.commit(); return row.slug;
  } catch (error) { await transaction.rollback(); throw error; } finally { transaction.close(); }
}
export async function archiveLocation(id: string, admin?: AdminActor) {
  await ensureDatabase(); const now = new Date().toISOString(); const result = await database.execute(statement("UPDATE location_drafts SET archived_at=?,updated_at=? WHERE id=? AND status='published' AND archived_at IS NULL", [now, now, id])); if (result.rowsAffected) await database.execute(auditStatement("location", id, "archived", "admin", {}, admin)); return result.rowsAffected === 1;
}
export async function restoreLocation(id: string, admin?: AdminActor) {
  await ensureDatabase(); const result = await database.execute(statement("UPDATE location_drafts SET archived_at=NULL,updated_at=? WHERE id=? AND archived_at IS NOT NULL", [new Date().toISOString(), id])); if (result.rowsAffected) await database.execute(auditStatement("location", id, "restored", "admin", {}, admin)); return result.rowsAffected === 1;
}
export async function possibleDuplicates(submission: SubmissionRecord, candidates?: LocationDraft[]) {
  const postcode = submission.postcode.replace(/\s/g, "").toLowerCase(); const name = slugify(submission.place); const locations = candidates || await listDrafts(); return locations.filter((item) => item.submissionId !== submission.id && (item.postcode.replace(/\s/g, "").toLowerCase() === postcode || slugify(item.name) === name)).slice(0, 3);
}
export async function listAuditEvents(limit = 30): Promise<AuditEvent[]> {
  await ensureDatabase(); const result = await database.execute(statement("SELECT * FROM audit_events ORDER BY occurred_at DESC LIMIT ?", [Math.min(Math.max(limit, 1), 100)])); return rowsAs<AuditRow>(result.rows).map((row) => ({ id: row.id, occurredAt: row.occurred_at, entityType: row.entity_type, entityId: row.entity_id, action: row.action, actor: row.actor, actorId: row.actor_id, actorLabel: row.actor_label, details: JSON.parse(row.details_json) as Record<string, unknown> }));
}
function average(values: number[]) {
  return values.length ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10 : null;
}

async function communityVerification(locationIds: string[]) {
  const summaries = new Map<string, CommunityVerification>();
  if (!locationIds.length) return summaries;
  const placeholders = locationIds.map(() => "?").join(",");
  const result = await database.execute(statement(`SELECT * FROM location_check_ins WHERE status='approved' AND location_id IN (${placeholders}) ORDER BY observed_at DESC,created_at DESC`, locationIds));
  const grouped = new Map<string, CheckInRow[]>();
  for (const row of rowsAs<CheckInRow>(result.rows)) grouped.set(row.location_id, [...(grouped.get(row.location_id) || []), row]);
  for (const [locationId, rows] of grouped) {
    const availabilityCounts: CommunityVerification["availabilityCounts"] = {};
    for (const row of rows) availabilityCounts[row.availability] = (availabilityCounts[row.availability] || 0) + 1;
    const comments: PublicCheckIn[] = rows.filter((row) => row.comment).slice(0, 10).map((row) => ({ id: row.id, availability: row.availability, observedAt: row.observed_at, comment: row.comment, createdAt: row.created_at }));
    summaries.set(locationId, {
      approvedCount: rows.length,
      lastObservedAt: rows[0]?.observed_at || null,
      latestAvailability: rows[0]?.availability || null,
      availabilityCounts,
      averageAccuracy: average(rows.flatMap((row) => row.accuracy_rating === null ? [] : [row.accuracy_rating])),
      averageAccess: average(rows.flatMap((row) => row.access_rating === null ? [] : [row.access_rating])),
      averagePrivacy: average(rows.flatMap((row) => row.privacy_rating === null ? [] : [row.privacy_rating])),
      comments,
    });
  }
  return summaries;
}

function publicFromRow(row: DraftRow, verification?: CommunityVerification): PeriodLocation {
  const verified = row.last_verified_at || row.updated_at; return { slug: row.slug, name: row.name, city: row.city, nation: row.nation || "Scotland", adminArea: row.admin_area || "", address: row.address, postcode: row.postcode, latitude: row.latitude as number, longitude: row.longitude as number, venueType: row.venue_type, access: row.access, confidence: row.confidence, products: legacyProducts(row), sources: legacySources(row), lastVerifiedAt: verified, needsRecheck: Date.now() - new Date(verified).getTime() > 180 * 24 * 60 * 60 * 1000, communityVerification: verification };
}
export async function listPublishedLocations(): Promise<PeriodLocation[]> {
  await ensureDatabase();
  const result = await database.execute("SELECT * FROM location_drafts WHERE status='published' AND archived_at IS NULL ORDER BY origin='official' DESC,name");
  const rows = rowsAs<DraftRow>(result.rows);
  const verification = await communityVerification(rows.map((row) => row.id));
  return rows.map((row) => publicFromRow(row, verification.get(row.id)));
}

export async function getDatabaseSummary() {
  await ensureDatabase();
  const [submissions, locations, revisions, audit, checkIns] = await Promise.all([
    database.execute("SELECT status,COUNT(*) AS count FROM submissions GROUP BY status"),
    database.execute("SELECT status,archived_at IS NOT NULL AS archived,COUNT(*) AS count FROM location_drafts GROUP BY status,archived"),
    database.execute("SELECT status,COUNT(*) AS count FROM location_revisions GROUP BY status"),
    database.execute("SELECT COUNT(*) AS count FROM audit_events"),
    database.execute("SELECT status,COUNT(*) AS count FROM location_check_ins GROUP BY status"),
  ]);
  const submissionCounts = Object.fromEntries(submissions.rows.map((row) => [String(row.status), Number(row.count)]));
  const locationRows = locations.rows.map((row) => ({ status: String(row.status), archived: Boolean(row.archived), count: Number(row.count) }));
  return {
    pendingSubmissions: submissionCounts.pending || 0,
    approvedSubmissions: submissionCounts.approved || 0,
    rejectedSubmissions: submissionCounts.rejected || 0,
    publishedLocations: locationRows.filter((row) => row.status === "published" && !row.archived).reduce((sum, row) => sum + row.count, 0),
    draftLocations: locationRows.filter((row) => row.status === "draft").reduce((sum, row) => sum + row.count, 0),
    archivedLocations: locationRows.filter((row) => row.archived).reduce((sum, row) => sum + row.count, 0),
    revisions: Object.fromEntries(revisions.rows.map((row) => [String(row.status), Number(row.count)])),
    auditEvents: Number(audit.rows[0]?.count || 0),
    checkIns: Object.fromEntries(checkIns.rows.map((row) => [String(row.status), Number(row.count)])),
  };
}

export async function exportDatabaseSnapshot() {
  await ensureDatabase();
  const tableNames = ["app_metadata", "submissions", "location_drafts", "location_revisions", "location_check_ins", "audit_events", "beta_feedback", "contact_requests"] as const;
  const tables: Record<string, unknown[]> = {};
  for (const tableName of tableNames) {
    const result = await database.execute(`SELECT * FROM ${tableName}`);
    tables[tableName] = [...result.rows];
  }
  return { format: "period-place-backup-v1", exportedAt: new Date().toISOString(), tables };
}

const restoreColumns = {
  app_metadata: ["key", "value", "updated_at"],
  submissions: ["id", "created_at", "place", "city", "nation", "admin_area", "postcode", "products", "brand", "seen_at", "notes", "absorbencies_json", "status", "reviewed_at", "origin", "report_kind", "target_slug"],
  location_drafts: ["id", "submission_id", "slug", "name", "city", "nation", "admin_area", "venue_type", "address", "postcode", "latitude", "longitude", "access", "product_types_json", "brand", "attributes_json", "absorbencies_json", "evidence", "status", "created_at", "updated_at", "published_at", "origin", "archived_at", "last_verified_at", "current_revision", "products_json", "sources_json", "confidence"],
  location_revisions: ["id", "location_id", "revision_number", "snapshot_json", "status", "created_at", "updated_at", "published_at"],
  location_check_ins: ["id", "location_id", "user_id", "availability", "observed_at", "accuracy_rating", "access_rating", "privacy_rating", "comment", "status", "created_at", "moderated_at"],
  audit_events: ["id", "occurred_at", "entity_type", "entity_id", "action", "actor", "actor_id", "actor_label", "details_json"],
  beta_feedback: ["id", "created_at", "usefulness", "found_what_needed", "trusted_results", "submitted_update", "would_use_again", "comments", "excluded_at", "excluded_by"],
  contact_requests: ["id", "created_at", "kind", "email", "message", "resolved_at"],
} as const;

export async function restoreDatabaseSnapshot(snapshot: unknown) {
  await ensureDatabase();
  if (!snapshot || typeof snapshot !== "object" || (snapshot as { format?: unknown }).format !== "period-place-backup-v1") throw new Error("Unsupported Period Place backup format.");
  const tables = (snapshot as { tables?: unknown }).tables;
  if (!tables || typeof tables !== "object") throw new Error("Backup tables are missing.");
  const tableData = tables as Record<string, unknown>;
  const backupMetadata = Array.isArray(tableData.app_metadata) ? tableData.app_metadata as Array<Record<string, unknown>> : [];
  const backupEnvironment = backupMetadata.find((item) => item.key === "environment")?.value;
  const currentEnvironment = process.env.PERIOD_PLACE_ENVIRONMENT || process.env.VERCEL_ENV;
  if (backupEnvironment && currentEnvironment && backupEnvironment !== currentEnvironment) throw new Error(`Backup belongs to ${String(backupEnvironment)}, not ${currentEnvironment}.`);

  const transaction = await database.transaction("write");
  try {
    for (const tableName of ["location_check_ins", "location_revisions", "location_drafts", "audit_events", "contact_requests", "submissions", "beta_feedback", "app_metadata"] as const) {
      await transaction.execute(`DELETE FROM ${tableName}`);
    }
    for (const [tableName, columns] of Object.entries(restoreColumns)) {
      const records = tableData[tableName];
      if (!Array.isArray(records)) continue;
      for (const value of records) {
        if (!value || typeof value !== "object") throw new Error(`Invalid ${tableName} backup row.`);
        const row = value as Record<string, string | number | null>;
        const presentColumns = columns.filter((column) => Object.prototype.hasOwnProperty.call(row, column));
        if (!presentColumns.length) throw new Error(`Empty ${tableName} backup row.`);
        await transaction.execute(statement(`INSERT INTO ${tableName} (${presentColumns.join(",")}) VALUES (${presentColumns.map(() => "?").join(",")})`, presentColumns.map((column) => row[column])));
      }
    }
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  } finally {
    transaction.close();
  }
}
