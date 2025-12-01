// File: backend/controllers/controller.js (Update and replace the existing file content)

const { getEvents, updateTicketCount } = require('../models/model');

// 1. GET Events Controller
const listEvents = async (req, res) => {
    try {
        const events = await getEvents();
        res.json(events);
    } catch (error) {
        console.error("Error retrieving events:", error);
        res.status(500).json({ error: "Failed to retrieve events from the database." });
    }
};

// 2. POST Purchase Controller
const purchaseTicket = async (req, res) => {
    const eventId = parseInt(req.params.id);
    
    try {
        const result = await updateTicketCount(eventId);

        if (result.success) {
            res.status(200).json({ message: result.message });
        } else {
            res.status(400).send(result.message);
        }
    } catch (error) {
        console.error("Error purchasing ticket:", error);
        res.status(500).send("Internal server error during purchase.");
    }
};

// Handle chat messages with simple rule-based responses
const handleChat = async (req, res) => {
  try {
    const { message, context } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const lowerMessage = message.toLowerCase().trim();
    const events = context?.events || [];
    
    // Simple greeting responses
    if (lowerMessage.match(/^(hi|hello|hey|good morning|good afternoon|good evening)/)) {
      return res.json({
        response: "Hello! I'm your TigerTix assistant. I can help you find events and book tickets. What would you like to do?",
        suggestions: ["Show me events", "Help me book tickets", "What events are available?"]
      });
    }
    
    // Help requests
    if (lowerMessage.includes('help')) {
      return res.json({
        response: "I can help you with:\n• Finding upcoming events\n• Booking tickets\n• Checking event availability\n\nJust ask me something like 'Show me events' or 'I want to book tickets for Game Night'",
        suggestions: ["Show me events", "Book tickets for Game Night", "What's available?"]
      });
    }
    
    // Show events requests
    if (lowerMessage.includes('events') || lowerMessage.includes('show me') || lowerMessage.includes('what') || lowerMessage.includes('available')) {
      if (events.length === 0) {
        return res.json({
          response: "I don't see any events available right now. Please check back later!",
          suggestions: ["Refresh events", "Help"]
        });
      }
      
      const eventList = events.map(event => 
        `• ${event.name} - ${event.date} (${event.tickets_available} tickets available)`
      ).join('\n');
      
      return res.json({
        response: `Here are the upcoming events:\n\n${eventList}\n\nWhich event would you like to book tickets for?`,
        suggestions: events.slice(0, 3).map(event => `Book tickets for ${event.name}`)
      });
    }
    
    // Booking requests - extract event name and quantity
    if (lowerMessage.includes('book') || lowerMessage.includes('ticket') || lowerMessage.includes('want')) {
      // Try to extract quantity
      const quantityMatch = message.match(/(\d+)\s+ticket/i);
      const quantity = quantityMatch ? parseInt(quantityMatch[1]) : 1;
      
      // Try to match event name
      const matchedEvent = events.find(event => 
        lowerMessage.includes(event.name.toLowerCase()) ||
        event.name.toLowerCase().includes(lowerMessage.split(' ').find(word => word.length > 3) || '')
      );
      
      if (matchedEvent) {
        if (matchedEvent.tickets_available >= quantity) {
          return res.json({
            response: `Great! I found ${matchedEvent.name} on ${matchedEvent.date} with ${matchedEvent.tickets_available} tickets available. To book ${quantity} ticket(s), please click the "Book Now" button on the event card.`,
            suggestions: ["Show me more events", "Help with booking"]
          });
        } else {
          return res.json({
            response: `Sorry, ${matchedEvent.name} only has ${matchedEvent.tickets_available} tickets available, but you requested ${quantity}. Would you like to book ${matchedEvent.tickets_available} tickets instead?`,
            suggestions: [`Book ${matchedEvent.tickets_available} tickets for ${matchedEvent.name}`, "Show other events"]
          });
        }
      } else {
        return res.json({
          response: "I'd be happy to help you book tickets! Which event are you interested in? You can see all available events above.",
          suggestions: events.slice(0, 2).map(event => `${event.name}`)
        });
      }
    }
    
    // Default response
    return res.json({
      response: "I'm here to help you with event tickets! You can ask me about upcoming events, ticket availability, or booking help. What would you like to know?",
      suggestions: ["Show me events", "Help me book tickets", "What's available?"]
    });
    
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Failed to process chat message' });
  }
};

module.exports = { listEvents, purchaseTicket, handleChat };