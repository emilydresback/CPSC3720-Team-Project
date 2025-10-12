// clientController.js
// This file handles incoming API requests for the client-service

const clientModel = require('../models/clientModel');

/*
 * Handles GET requests to /api/events
 * @function getEvents
 * @description Retrieves all available events from the database and returns them as JSON.
 * @param {Object} req - The Express request object
 * @param {Object} res - The Express response object
 * @returns {void} Sends JSON response with event data or error message
 */

function getEvents(req, res) {
  clientModel.getAllEvents((err, events) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch events' });
    }
     // send events as JSON
    res.json(events);
  });
}

/*
 * Handles POST requests to /api/events/:id/purchase
 * 
 * @function purchase
 * @description Processes a ticket purchase request for a specific event.
 * Validates the quantity and updates the database if sufficient tickets are available.
 * @param {Object} req - The Express request object
 * @param {Object} res - The Express response object
 * @returns {void} Sends JSON response with success message or error
 */
function purchase(req, res) {
  // event ID from URL
  const eventId = parseInt(req.params.id); 
  // number of tickets to purchase
  const { quantity } = req.body; 

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
