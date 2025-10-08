/* adminController.js
Handles the logic for admin-related API endpoints
Validates inputs, communicates with the model, and sends responses to the client */

/**
 * Controller layer for admin endpoints
 * Validates input and handles API responses
 */
const adminModel = require('../models/adminModel');

/**
 * POST /api/events
 * Validates JSON body and inserts event into DB
 */
exports.createEvent = (req, res) => {
  try {
    const { name, date, total_tickets } = req.body;

    // Validation
    if (!name || !date || total_tickets === undefined) {
      return res.status(400).json({
        error: 'Missing required fields: name, date, total_tickets',
      });
    }
    if (typeof total_tickets !== 'number' || total_tickets < 0) {
      return res
        .status(400)
        .json({ error: 'total_tickets must be a non-negative number' });
    }

    // Persist to DB
    adminModel.createEvent({ name, date, total_tickets }, (err, event) => {
      if (err) {
        console.error('DB error:', err.message);
        return res.status(500).json({ error: 'Database write failed' });
      }
      return res.status(201).json({
        message: 'Event created successfully',
        event,
      });
    });
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
