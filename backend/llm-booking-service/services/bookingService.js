/**
 * bookingService.js
 * Purpose: Business logic for listing events, preparing bookings, and confirming bookings
 * Inputs:
 *   - DB and parameters from controller
 * Outputs:
 *   - Validated responses or throws errors for controller to handle
 * Side effects:
 *   - On confirm: atomically decrements tickets_available and inserts into bookings
 */
import db from '../db.js';
import crypto from 'crypto';

// In-memory pending store: { [pendingId]: { eventId, tickets, expiresAt } }
const PENDING = new Map();
const TTL_MS = 10 * 60 * 1000; // 10 minutes

function purgeExpired() {
  const now = Date.now();
  for (const [k, v] of PENDING.entries()) {
    if (v.expiresAt <= now) PENDING.delete(k);
  }
}

export async function listAvailableEvents() {
  return db.all(
    `SELECT id, name, date, tickets_available
    FROM events
    WHERE tickets_available > 0
    ORDER BY date ASC;
`
  );
}

/**
 * Resolve an event by (fuzzy) name
 */
export async function resolveEventByName(name) {
  if (!name) return null;
  // Try exact, then LIKE
  let ev = await db.get(`SELECT id, name, tickets_available FROM events WHERE LOWER(name) = LOWER(?)`, [name]);
  if (ev) return ev;
  ev = await db.get(`SELECT id, name, tickets_available FROM events WHERE LOWER(name) LIKE LOWER(?)`, [`%${name}%`]);
  return ev || null;
}

/**
 * Prepare a pending booking, but DO NOT modify tickets yet
 */
export async function prepareBooking({ eventId, tickets }) {
  if (!eventId || !tickets || tickets <= 0) {
    throw new Error('Invalid booking parameters');
  }
  const ev = await db.get(`SELECT id, name, tickets_available FROM events WHERE id = ?`, [eventId]);
  if (!ev) throw new Error('Event not found');
  if (ev.available_tickets < tickets) throw new Error('Not enough tickets available');

  purgeExpired();
  const pendingId = crypto.randomUUID();
  const expiresAt = Date.now() + TTL_MS;
  PENDING.set(pendingId, { eventId: ev.id, tickets, expiresAt });

  return {
    pendingId,
    expiresAt,
    summary: `Hold ${tickets} ticket(s) for "${ev.name}"`,
    event: ev
  };
}

/**
 * Confirm a pending booking: atomic transaction prevents oversell
 */
export async function confirmBooking(pendingId) {
  purgeExpired();
  const p = PENDING.get(pendingId);
  if (!p) throw new Error('Pending booking not found or expired');

  await db.run('BEGIN IMMEDIATE TRANSACTION;');
  try {
    const ev = await db.get(`SELECT id, name, tickets_available FROM events WHERE id = ?`, [p.eventId]);
    if (!ev) throw new Error('Event not found');

    if (ev.tickets_available < p.tickets) {
      throw new Error('Insufficient tickets at confirmation time');
    }

    await db.run(
      `UPDATE events SET tickets_available = tickets_available - ? WHERE id = ?`,
      [p.tickets, p.eventId]
    );

    await db.run(
      `INSERT INTO bookings (event_id, tickets) VALUES (?, ?)`,
      [p.eventId, p.tickets]
    );

    await db.run('COMMIT;');
    PENDING.delete(pendingId);
    return { success: true, message: `Booked ${p.tickets} ticket(s) for event #${p.eventId}` };
  } catch (e) {
    await db.run('ROLLBACK;');
    throw e;
  }
}
