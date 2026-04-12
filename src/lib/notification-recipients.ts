/**
 * CRUD operations for the notification_recipients collection.
 *
 * Stores email addresses + alert preferences for people who should receive
 * KidsChat notifications (safety alerts, weekly digests, etc.).
 *
 * Decoupled from user accounts so both parents can receive alerts
 * without needing admin logins.
 */

import { ObjectId } from "mongodb";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NotificationRecipientAlerts {
  safetyAlerts: boolean;
  weeklyDigest: boolean;
  dailySummary: boolean;
  accountActivity: boolean;
}

export interface NotificationRecipient {
  _id?: string;
  email: string;
  name: string;
  alerts: NotificationRecipientAlerts;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const COLLECTION = "notification_recipients";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function getCollection() {
  const getMongoClient = (await import("@/lib/mongodb")).default;
  const client = await getMongoClient();
  return client.db("test").collection(COLLECTION);
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

/** Return all recipients, oldest first. */
export async function getRecipients(): Promise<NotificationRecipient[]> {
  const col = await getCollection();
  const docs = await col.find({}).sort({ createdAt: 1 }).toArray();
  return docs.map((d) => ({ ...d, _id: d._id.toString() })) as unknown as NotificationRecipient[];
}

/**
 * Add a new recipient.
 * All alert types default to true except accountActivity (false).
 * Rejects duplicate emails.
 */
export async function addRecipient(
  email: string,
  name: string
): Promise<{ recipient?: NotificationRecipient; error?: string }> {
  if (!EMAIL_RE.test(email)) {
    return { error: "Invalid email format" };
  }

  const col = await getCollection();

  const existing = await col.findOne({ email: email.toLowerCase() });
  if (existing) {
    return { error: "A recipient with this email already exists" };
  }

  const now = new Date();
  const doc = {
    email: email.toLowerCase(),
    name,
    alerts: {
      safetyAlerts: true,
      weeklyDigest: true,
      dailySummary: true,
      accountActivity: false,
    },
    createdAt: now,
    updatedAt: now,
  };

  const result = await col.insertOne(doc);
  return {
    recipient: { ...doc, _id: result.insertedId.toString() } as NotificationRecipient,
  };
}

/** Remove a recipient by _id. */
export async function removeRecipient(id: string): Promise<boolean> {
  const col = await getCollection();
  const result = await col.deleteOne({ _id: new ObjectId(id) });
  return result.deletedCount === 1;
}

/** Update specific alert preferences for a recipient. */
export async function updateRecipientAlerts(
  id: string,
  alerts: Partial<NotificationRecipientAlerts>
): Promise<boolean> {
  const col = await getCollection();

  const setFields: Record<string, unknown> = { updatedAt: new Date() };
  for (const [key, value] of Object.entries(alerts)) {
    setFields[`alerts.${key}`] = value;
  }

  const result = await col.updateOne(
    { _id: new ObjectId(id) },
    { $set: setFields }
  );
  return result.matchedCount === 1;
}

/**
 * Return email addresses of recipients who have a specific alert type enabled.
 * Used by safety-alert and weekly-digest senders.
 */
export async function getRecipientsForType(
  type: keyof NotificationRecipientAlerts
): Promise<string[]> {
  const col = await getCollection();
  const docs = await col
    .find({ [`alerts.${type}`]: true })
    .project({ email: 1 })
    .toArray();
  return docs.map((d) => d.email as string).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Seed / migration
// ---------------------------------------------------------------------------

/**
 * If the notification_recipients collection is empty, seed it from existing
 * ADMIN users in the users collection. This provides backward compatibility
 * on first run — existing admins automatically become recipients.
 */
export async function ensureDefaultRecipients(): Promise<void> {
  const col = await getCollection();
  const count = await col.countDocuments();
  if (count > 0) return;

  const getMongoClient = (await import("@/lib/mongodb")).default;
  const client = await getMongoClient();
  const db = client.db("test");

  const admins = await db
    .collection("users")
    .find({ role: "ADMIN" })
    .project({ email: 1, name: 1 })
    .toArray();

  if (admins.length === 0) return;

  const now = new Date();
  const docs = admins.map((admin) => ({
    email: (admin.email as string).toLowerCase(),
    name: (admin.name as string) || "Admin",
    alerts: {
      safetyAlerts: true,
      weeklyDigest: true,
      dailySummary: true,
      accountActivity: false,
    },
    createdAt: now,
    updatedAt: now,
  }));

  await col.insertMany(docs);
}
