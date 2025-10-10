// clientController.js
// This file handles incoming API requests for the client-service

const clientModel = require('../models/clientModel');

/**
 * GET /api/events
 * Returns a list of all events
 */
function getEvents(req, res) {
  clientModel.getAllEvents((err, events) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch events' });
    }
    res.json(events); // send events as JSON
  });
}

/**
 * POST /api/events/:id/purchase
 * Purchase tickets for a specific event
 */
function purchase(req, res) {
  const eventId = parseInt(req.params.id); // event ID from URL
  const { quantity } = req.body; // number of tickets to purchase

  // Validate input
  if (!quantity || quantity <= 0) {
    return res.status(400).json({ error: 'Invalid quantity' });
  }

  clientModel.purchaseTickets(eventId, quantity, (err, updatedEvent) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    res.json({
      message: 'Purchase successful!',
      event: updatedEvent,
    });
  });
}

module.exports = {
  getEvents,
  purchase,
};
