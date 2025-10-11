import React, { useEffect, useState } from 'react';
import './App.css';

/**
 * SkipLink component for accessibility
 * Allows keyboard users to skip directly to main content
 */
function SkipLink() {
  return (
    <a href="#main" className="skip-link">
      Skip to main content
    </a>
  );
}

/**
 * Main App component for TigerTix
 * Fetches events from client microservice and handles ticket purchases
 * @returns {JSX.Element} The main application component
 */
function App() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [purchaseMessage, setPurchaseMessage] = useState('');

  /**
   * Fetches all events from the client service API
   * Updates events state with fetched data
   * Handles loading and error states
   */
  useEffect(() => {
    fetchEvents();
  }, []);

  /**
   * Fetches events from client microservice
   * @async
   * @function fetchEvents
   * @returns {Promise<void>}
   */
  const fetchEvents = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Connect to client service on port 6001
      const response = await fetch('http://localhost:6001/api/events');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setEvents(data);
    } catch (err) {
      console.error('Error fetching events:', err);
      setError('Failed to load events. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handles ticket purchase for a specific event
   * Sends POST request to client service and updates UI
   * @async
   * @param {number} eventId - The ID of the event to purchase ticket for
   * @param {string} eventName - The name of the event (for display purposes)
   * @returns {Promise<void>}
   */
  const buyTicket = async (eventId, eventName) => {
    try {
      // Send POST request to purchase endpoint
      const response = await fetch(
        `http://localhost:6001/api/events/${eventId}/purchase`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Purchase failed');
      }

      const result = await response.json();
      
      //Update the UI by refetching events to show new ticket count
      await fetchEvents();
      
      // Show success message
      setPurchaseMessage(`✓ Ticket purchased successfully for ${eventName}!`);
      
      // Clear message after 3 seconds
      setTimeout(() => setPurchaseMessage(''), 3000);
      
    } catch (err) {
      console.error('Purchase error:', err);
      setPurchaseMessage(`✗ Error: ${err.message}`);
      setTimeout(() => setPurchaseMessage(''), 3000);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="loading-container" role="status" aria-live="polite">
        <p>Loading events...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="error-container" role="alert" aria-live="assertive">
        <h2>Error</h2>
        <p>{error}</p>
        <button onClick={fetchEvents}>Try Again</button>
      </div>
    );
  }

  return (
    <>
      {/* Skip link for accessibility: allows keyboard users to skip to main content */}
      <SkipLink />

      {/* Header with semantic HTML */}
      <header role="banner">
        <h1>Clemson Campus Events</h1>
        <p>Browse and purchase tickets for upcoming events</p>
      </header>

      {/* Main content area with proper landmark */}
      <main id="main" tabIndex={-1} role="main">
        
        {/* Purchase confirmation/error message with ARIA live region */}
        {purchaseMessage && (
          <div 
            className={`message ${purchaseMessage.includes('✓') ? 'success' : 'error'}`}
            role="alert" 
            aria-live="polite"
            aria-atomic="true"
          >
            {purchaseMessage}
          </div>
        )}

        {/* Events section */}
        <section aria-labelledby="events-heading">
          <h2 id="events-heading">Available Events</h2>
          
          {events.length === 0 ? (
            <p className="no-events">No events available at this time.</p>
          ) : (
            <ul className="events-list" role="list">
              {events.map((event) => (
                <li key={event.id} className="event-item">
                  <div className="event-info">
                    <h3>{event.name}</h3>
                    <p className="event-date">
                      <span aria-label="Event date">
                        Date: {new Date(event.date).toLocaleDateString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </span>
                    </p>
                    <p className="ticket-count">
                      <span aria-label="Available tickets">
                        Available Tickets: <strong>{event.availableTickets || event.tickets}</strong>
                      </span>
                    </p>
                  </div>
                  
                  <button
                    onClick={() => buyTicket(event.id, event.name)}
                    disabled={(event.availableTickets || event.tickets) <= 0}
                    aria-label={`Buy one ticket for ${event.name}. ${event.availableTickets || event.tickets} tickets available.`}
                    className="buy-button"
                  >
                    {(event.availableTickets || event.tickets) > 0 ? 'Buy Ticket' : 'Sold Out'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      {/* Footer with proper semantic HTML */}
      <footer role="contentinfo">
        <p>&copy; 2025 Clemson TigerTix. All rights reserved.</p>
      </footer>
    </>
  );
}

export default App;