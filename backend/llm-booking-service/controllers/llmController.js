/**
 * llmController.js
 * Express controllers for LLM parse, show events, prepare, and confirm booking
 */
import { parseText } from '../services/nlpService.js';
import { listAvailableEvents, resolveEventByName, prepareBooking, confirmBooking } from '../services/bookingService.js';

/**
 * POST /api/llm/parse
 * Body: { text: string }
 * Returns: { intent, eventName, tickets }
 */
export async function parseHandler(req, res) {
  try {
    const { text } = req.body || {};
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Missing text' });
    }
    const parsed = await parseText(text);
    // Only return the structured fields
    return res.json({ intent: parsed.intent, event: parsed.eventName || null, tickets: parsed.tickets || null });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to parse input', detail: e.message });
  }
}

/**
 * GET /api/llm/events
 * Returns events that have available tickets
 */
export async function listEventsHandler(_req, res) {
  try {
    const events = await listAvailableEvents();
    return res.json({ events });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to list events', detail: e.message });
  }
}

/**
 * POST /api/llm/prepare
 * Body: { event: string | eventId: number, tickets: number }
 * Returns: { pendingId, summary, event }
 */
export async function prepareHandler(req, res) {
  try {
    const { event, eventId, tickets } = req.body || {};
    let target = null;

    if (eventId) {
      target = await resolveEventByName(null);
      target = await (await import('../db.js')).default.get(`SELECT id, name, available_tickets FROM events WHERE id=?`, [eventId]);
    } else {
      target = await resolveEventByName(event);
    }
    if (!target) return res.status(404).json({ error: 'Event not found' });
    if (!tickets || tickets <= 0) return res.status(400).json({ error: 'Invalid tickets' });

    const pending = await prepareBooking({ eventId: target.id, tickets: Number(tickets) });
    return res.json(pending);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
}

/**
 * POST /api/llm/confirm
 * Body: { pendingId: string }
 * Returns: { success: true, message }
 */
export async function confirmHandler(req, res) {
  try {
    const { pendingId } = req.body || {};
    if (!pendingId) return res.status(400).json({ error: 'Missing pendingId' });

    const result = await confirmBooking(pendingId);
    return res.json(result);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
}
