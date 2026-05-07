import { sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  primaryKey,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const cuid = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

// Auth.js / NextAuth requires a specific column shape on these four tables.
// See https://authjs.dev/getting-started/adapters/drizzle.

export const users = sqliteTable("users", {
  id: cuid(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "timestamp_ms" }),
  image: text("image"),
});

export const accounts = sqliteTable(
  "accounts",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.provider, t.providerAccountId] }),
  })
);

export const sessions = sqliteTable("sessions", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
});

export const verificationTokens = sqliteTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.identifier, t.token] }),
  })
);

// App tables ----------------------------------------------------------------

export const jobs = sqliteTable(
  "jobs",
  {
    id: cuid(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    canonicalUrl: text("canonical_url").notNull(),
    site: text("site").notNull(),
    title: text("title"),
    company: text("company"),
    location: text("location"),
    lat: integer("lat"),
    lng: integer("lng"),
    isRemote: integer("is_remote", { mode: "boolean" }).default(false),
    salaryMin: integer("salary_min"),
    salaryMax: integer("salary_max"),
    deadline: integer("deadline", { mode: "timestamp_ms" }),
    postedAt: integer("posted_at", { mode: "timestamp_ms" }),
    /**
     * When the user expects to apply (e.g., a 2027 cohort). Nullable.
     * Used to keep "watching" jobs around indefinitely without cluttering
     * the active list.
     */
    targetApplyDate: integer("target_apply_date", { mode: "timestamp_ms" }),
    status: text("status", {
      enum: [
        "active",
        "watching",
        "removed",
        "applied",
        "rejected",
        "offered",
        "withdrawn",
      ],
    })
      .notNull()
      .default("active"),
    notes: text("notes"),
    /** Plain-text job description, populated by adapters when available. */
    description: text("description"),
    /** LLM-parsed requirements: { yoeMin, yoeMax, education, skills_required, skills_nice }. */
    requirements: text("requirements", { mode: "json" }).$type<{
      yoeMin?: number;
      yoeMax?: number;
      education?: "highschool" | "associate" | "bachelor" | "master" | "phd";
      skillsRequired?: string[];
      skillsNice?: string[];
    }>(),
    requirementsParsedAt: integer("requirements_parsed_at", { mode: "timestamp_ms" }),
    lastFetchedAt: integer("last_fetched_at", { mode: "timestamp_ms" }),
    lastSeenAt: integer("last_seen_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    userIdx: index("jobs_user_idx").on(t.userId),
    canonicalIdx: uniqueIndex("jobs_user_canonical_idx").on(
      t.userId,
      t.canonicalUrl
    ),
  })
);

export const snapshots = sqliteTable(
  "snapshots",
  {
    id: cuid(),
    jobId: text("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    fetchedAt: integer("fetched_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    httpStatus: integer("http_status"),
    available: integer("available", { mode: "boolean" }).notNull(),
    contentHash: text("content_hash"),
    diff: text("diff", { mode: "json" }).$type<Record<string, unknown>>(),
  },
  (t) => ({
    jobIdx: index("snapshots_job_idx").on(t.jobId, t.fetchedAt),
  })
);

export const similarJobs = sqliteTable(
  "similar_jobs",
  {
    id: cuid(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sourceJobId: text("source_job_id").references(() => jobs.id, {
      onDelete: "set null",
    }),
    url: text("url").notNull(),
    site: text("site").notNull(),
    title: text("title"),
    company: text("company"),
    location: text("location"),
    discoveredAt: integer("discovered_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    dismissedAt: integer("dismissed_at", { mode: "timestamp_ms" }),
    promotedJobId: text("promoted_job_id").references(() => jobs.id, {
      onDelete: "set null",
    }),
  },
  (t) => ({
    userIdx: index("similar_jobs_user_idx").on(t.userId),
    urlIdx: uniqueIndex("similar_jobs_user_url_idx").on(t.userId, t.url),
  })
);

export const agentTokens = sqliteTable(
  "agent_tokens",
  {
    id: cuid(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    label: text("label"),
    lastUsedAt: integer("last_used_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
  },
  (t) => ({
    userIdx: index("agent_tokens_user_idx").on(t.userId),
  })
);

export const notifications = sqliteTable(
  "notifications",
  {
    id: cuid(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    jobId: text("job_id").references(() => jobs.id, { onDelete: "set null" }),
    kind: text("kind", {
      enum: [
        "deadline_soon",
        "deadline_set",
        "job_opened",
        "job_removed",
        "job_unlocked",
        "new_similar",
        "fetch_failed",
        "digest",
      ],
    }).notNull(),
    payload: text("payload", { mode: "json" }).$type<Record<string, unknown>>(),
    sentAt: integer("sent_at", { mode: "timestamp_ms" }),
    deliveredVia: text("delivered_via"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    userIdx: index("notifications_user_idx").on(t.userId, t.createdAt),
  })
);

export const resumes = sqliteTable("resumes", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  /** Raw resume text. Optional — once parsed we don't need it for matching. */
  rawText: text("raw_text"),
  /** Structured snapshot the agent extracts via Ollama. */
  parsed: text("parsed", { mode: "json" }).$type<{
    yoe?: number;
    education?: "highschool" | "associate" | "bachelor" | "master" | "phd";
    skills?: string[];
    currentRole?: string | null;
    industries?: string[];
  }>(),
  parsedAt: integer("parsed_at", { mode: "timestamp_ms" }),
  /**
   * When the user last said their resume reflects current state. Used to
   * compute current YoE: yoe + (now - lastUpdatedAt) in years.
   */
  lastUpdatedAt: integer("last_updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const eligibility = sqliteTable(
  "eligibility",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    jobId: text("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    status: text("status", {
      enum: ["ready", "stretch", "future", "unknown"],
    }).notNull(),
    gaps: text("gaps", { mode: "json" }).$type<{
      missingYoe?: number;
      missingSkills?: string[];
      missingEducation?: string;
      reason?: string;
    }>(),
    /**
     * Per-skill RAG verifications. The agent does cosine top-k on the user's
     * resume chunks for each required skill, then asks the LLM a grounded
     * yes/no with a quoted excerpt. Cached so the dashboard can show the
     * actual resume line that backed each "ready".
     */
    evidence: text("evidence", { mode: "json" }).$type<
      Array<{
        skill: string;
        covered: boolean;
        confidence: "high" | "medium" | "low";
        quote?: string;
        required: boolean;
      }>
    >(),
    /** For status='future': when the user's YoE will satisfy the requirement. */
    unlockAt: integer("unlock_at", { mode: "timestamp_ms" }),
    computedAt: integer("computed_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.jobId] }),
    userIdx: index("eligibility_user_idx").on(t.userId, t.status),
  })
);

export type User = typeof users.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type Resume = typeof resumes.$inferSelect;
export type Eligibility = typeof eligibility.$inferSelect;
export type Snapshot = typeof snapshots.$inferSelect;
export type SimilarJob = typeof similarJobs.$inferSelect;
export type AgentToken = typeof agentTokens.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
