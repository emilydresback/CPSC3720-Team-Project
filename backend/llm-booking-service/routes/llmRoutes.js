/**
 * llmRoutes.js
 * Routes for LLM-driven booking
 */
import express from 'express';
import { parseHandler, listEventsHandler, prepareHandler, confirmHandler } from '../controllers/llmController.js';
import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Connect to SHARED database (where events table exists)
const dbPath = path.join(__dirname, '../../shared-db/database.sqlite');
const db = new sqlite3.Database(dbPath);

const router = express.Router();

// Database helper functions
function queryDb(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function getDb(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function runDb(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

// Existing structured endpoints
router.post('/parse', parseHandler);
router.get('/events', listEventsHandler);
router.post('/prepare', prepareHandler);
router.post('/confirm', confirmHandler);

/**
 * POST / (root)
 * Unified chat interface that handles conversational flow
 * Body: { message: string, sessionId?: string }
 * Returns: { reply: string, intent: string, data?: any, state?: string }
 */
router.post('/', async (req, res) => {
  try {
    const { message, sessionId = 'guest' } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Import services
    const { parseText } = await import('../services/nlpService.js');
    const { listAvailableEvents, resolveEventByName, prepareBooking, confirmBooking } = await import('../services/bookingService.js');
    
    // Simple session management (in-memory, could be Redis)
    if (!router.sessions) router.sessions = new Map();
    const sessions = router.sessions;
    
    let session = sessions.get(sessionId) || { state: 'idle', context: {} };
    const lowerMessage = message.toLowerCase();
    
    // 1. GREETING
    if (lowerMessage.match(/\b(hi|hello|hey|greetings)\b/) && session.state === 'idle') {
      return res.json({
        reply: "Hello! I'm your TigerTix assistant. I can help you:\n• View available events\n• Book tickets for events\n\nWhat would you like to do today?",
        intent: "greeting",
        state: "idle"
      });
    }
    
    // 2. SHOW EVENTS
    if (lowerMessage.match(/\b(show|list|see|view|what|available)\b.*\b(events|tickets)\b/)) {
      let events;
      try {
        // Try using bookingService first
        const { listAvailableEvents } = await import('../services/bookingService.js');
        events = await listAvailableEvents();
      } catch (err) {
        // Fallback: query database directly
        console.log('Using direct database query for events');
        events = await queryDb('SELECT * FROM events WHERE tickets_available > 0 ORDER BY date ASC');
      }
      
      if (events.length === 0) {
        return res.json({
          reply: "Sorry, there are no events available at the moment.",
          intent: "show_events",
          events: []
        });
      }
      
      const eventList = events.map(e => 
        `• ${e.name} (${e.date}) - ${e.tickets_available} tickets available`
      ).join('\n');
      
      return res.json({
        reply: `Here are the available events:\n\n${eventList}\n\nWould you like to book tickets for any of these?`,
        intent: "show_events",
        events: events,
        state: "idle"
      });
    }
    
    // 3. BOOKING INTENT
    const bookMatch = lowerMessage.match(/\b(book|buy|purchase|get)\b/);
    
    if (bookMatch && session.state !== 'awaiting_confirmation') {
      // Parse the request
      let quantity = 1;
      let eventName = null;
      
      try {
        const { parseText } = await import('../services/nlpService.js');
        const parsed = await parseText(message);
        quantity = parsed.tickets || 1;
        eventName = parsed.eventName;
      } catch (err) {
        // Fallback: basic parsing
        const numMatch = message.match(/(\d+)\s*(ticket|tickets)?/);
        if (numMatch) quantity = parseInt(numMatch[1], 10);
        
        const forMatch = lowerMessage.match(/\bfor\s+(.+)/);
        if (forMatch) {
          eventName = forMatch[1].replace(/^\d+\s*(ticket|tickets)?\s*/, '').trim();
        }
      }
      
      if (!eventName) {
        return res.json({
          reply: "I'd be happy to help you book tickets! Which event would you like to attend? Try saying 'Book 2 tickets for Campus Concert Series'",
          intent: "booking_clarification",
          state: "idle"
        });
      }
      
      // Find the event in database
      const event = await getDb(
        'SELECT * FROM events WHERE LOWER(name) LIKE LOWER(?) AND tickets_available > 0',
        [`%${eventName}%`]
      );
      
      if (!event) {
        const suggestions = await queryDb('SELECT * FROM events WHERE tickets_available > 0 LIMIT 3');
        const eventList = suggestions.map(e => `• ${e.name}`).join('\n');
        
        return res.json({
          reply: `I couldn't find an event matching "${eventName}". Here are some available events:\n${eventList}\n\nWhich one would you like?`,
          intent: "event_not_found",
          suggestions: suggestions,
          state: "idle"
        });
      }
      
      // Check availability
      if (event.tickets_available < quantity) {
        return res.json({
          reply: `Sorry, ${event.name} only has ${event.tickets_available} ticket${event.tickets_available === 1 ? '' : 's'} available. Would you like to book ${event.tickets_available} instead?`,
          intent: "insufficient_tickets",
          event: event,
          state: "idle"
        });
      }
      
      // Prepare booking (save to session)
      const pendingId = `PENDING-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      session.state = 'awaiting_confirmation';
      session.context = {
        pendingId: pendingId,
        eventId: event.id,
        eventName: event.name,
        quantity: quantity,
        eventDate: event.date
      };
      sessions.set(sessionId, session);
      
      return res.json({
        reply: `Perfect! I can book ${quantity} ticket${quantity > 1 ? 's' : ''} for "${event.name}" on ${event.date}.\n\n⚠️ Please confirm: Would you like to proceed with this booking?\n\n(Reply 'yes' to confirm or 'no' to cancel)`,
        intent: "booking_intent",
        data: session.context,
        state: "awaiting_confirmation"
      });
    }
    
    // 5. CONFIRMATION HANDLING
    if (session.state === 'awaiting_confirmation') {
      if (lowerMessage.match(/\b(yes|confirm|proceed|go ahead|sure|ok|okay)\b/)) {
        try {
          // COMPLETE THE BOOKING WITH TRANSACTION
          const eventId = session.context.eventId;
          const quantity = session.context.quantity;
          
          await new Promise((resolve, reject) => {
            db.serialize(() => {
              db.run('BEGIN TRANSACTION');
              
              // Check availability again
              db.get('SELECT * FROM events WHERE id = ?', [eventId], (err, event) => {
                if (err || !event) {
                  db.run('ROLLBACK');
                  return reject(new Error('Event not found'));
                }
                
                if (event.tickets_available < quantity) {
                  db.run('ROLLBACK');
                  return reject(new Error('Not enough tickets available'));
                }
                
                // Update ticket count
                db.run(
                  'UPDATE events SET tickets_available = tickets_available - ? WHERE id = ?',
                  [quantity, eventId],
                  (err) => {
                    if (err) {
                      db.run('ROLLBACK');
                      return reject(new Error('Failed to update tickets'));
                    }
                    
                    // Create booking record
                    db.run(
                      'INSERT INTO bookings (event_id, tickets) VALUES (?, ?)',
                      [eventId, quantity],
                      function(err) {
                        if (err) {
                          db.run('ROLLBACK');
                          return reject(new Error('Failed to create booking'));
                        }
                        
                        db.run('COMMIT', (err) => {
                          if (err) return reject(new Error('Transaction failed'));
                          resolve({ bookingId: this.lastID });
                        });
                      }
                    );
                  }
                );
              });
            });
          });
          
          const confirmationId = `TKT-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
          
          session.state = 'idle';
          const eventName = session.context.eventName;
          const eventDate = session.context.eventDate;
          const bookedQty = session.context.quantity;
          session.context = {};
          sessions.set(sessionId, session);
          
          return res.json({
            reply: `✅ Success! Your booking is confirmed!\n\n📋 Booking Details:\n• Event: ${eventName}\n• Date: ${eventDate}\n• Tickets: ${bookedQty}\n• Confirmation: ${confirmationId}\n\nYour tickets have been reserved. Enjoy the event!`,
            intent: "booking_confirmed",
            confirmationId: confirmationId,
            state: "idle"
          });
        } catch (error) {
          session.state = 'idle';
          sessions.set(sessionId, session);
          
          return res.json({
            reply: `❌ Sorry, the booking failed: ${error.message}\n\nWould you like to try booking something else?`,
            intent: "booking_failed",
            error: error.message,
            state: "idle"
          });
        }
      } else if (lowerMessage.match(/\b(no|cancel|nevermind|stop)\b/)) {
        session.state = 'idle';
        session.context = {};
        sessions.set(sessionId, session);
        
        return res.json({
          reply: "No problem! Your booking has been cancelled. Is there anything else I can help you with?",
          intent: "booking_cancelled",
          state: "idle"
        });
      } else {
        return res.json({
          reply: `I'm waiting for your confirmation to book ${session.context.quantity} ticket${session.context.quantity > 1 ? 's' : ''} for ${session.context.eventName}.\n\nPlease reply 'yes' to confirm or 'no' to cancel.`,
          intent: "awaiting_confirmation",
          state: "awaiting_confirmation"
        });
      }
    }
    
    // HELP
    if (lowerMessage.match(/\b(help|assist|support)\b/)) {
      return res.json({
        reply: "I can help you with:\n• Viewing available events - say 'show events'\n• Booking tickets - say 'book 2 tickets for [event name]'\n• Checking availability\n\nWhat would you like to do?",
        intent: "help",
        state: "idle"
      });
    }
    
    // Default: didn't understand
    return res.json({
      reply: "I'm not sure I understood that. You can:\n• Say 'show events' to see what's available\n• Say 'book tickets for [event name]'\n• Say 'help' for more options",
      intent: "unknown",
      state: "idle"
    });
    
  } catch (error) {
    console.error('Chat Error:', error);
    res.status(500).json({ 
      error: 'Failed to process request',
      reply: "I'm having trouble processing that request. Please try again.",
      detail: error.message
    });
  }
});

export default router;