// backend/admin-service/controllers/adminController.js
const model = require("../models/adminModel");

// POST /api/admin/events
async function createEvent(req, res) {
  const { name, date, tickets } = req.body || {};
  if (!name || !date || Number.isNaN(Number(tickets)))
    return res.status(400).json({ error: "name, date, tickets required" });

  try {
    const created = await model.createEvent({
      name: String(name),
      date: String(date),
      total_tickets: Number(tickets),
    });
    return res.status(201).json(created);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to create event" });
  }
}

// GET /api/admin/events
async function listEvents(_req, res) {
  try {
    const rows = await model.listEvents();
    return res.json(rows);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to load events" });
  }
}

// PUT /api/admin/events/:id
// Accepts partial: { name?, date?, tickets? }
// If tickets is provided, we interpret it as TOTAL tickets and adjust tickets_available if needed.
async function updateEvent(req, res) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Bad id" });

  const { name, date, tickets } = req.body || {};
  try {
    const updated = await model.updateEvent(id, {
      name,
      date,
      total_tickets:
        tickets !== undefined && tickets !== null ? Number(tickets) : undefined,
    });
    if (!updated) return res.status(404).json({ error: "Event not found" });
    return res.json(updated);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to update event" });
  }
}

module.exports = { createEvent, listEvents, updateEvent };
