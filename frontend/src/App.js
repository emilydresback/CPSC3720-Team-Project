import React, { useEffect, useState, useCallback, useRef } from 'react';
import './App.css';
import LlmAssistant from './components/LlmAssistant';

/**
 * Skip link for screen readers — allows visually impaired users
 * to skip navigation and jump directly to the main content area.
 */
function SkipLink() {
  return (
    <a href="#main" className="skip-link">
      Skip to main content
    </a>
  );
}

/**
 * The main TigerTix application component.
 * Displays campus events and integrates the floating VoiceAssistant.
 */
function App() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = () => {
    setLoading(true);
    setError(null);
    
    fetch('http://localhost:6001/api/events')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch events');
        return res.json();
      })
      .then((data) => {
        setEvents(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError('Could not load events. Make sure the backend is running on port 6001.');
        setLoading(false);
      });
  };

  const buyTicket = (eventId, eventName) => {
    fetch(`http://localhost:6001/api/events/${eventId}/purchase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: 1 }),
    })
      .then((res) => {
        if (!res.ok) {
          return res.json().then((err) => {
            throw new Error(err.error || 'Purchase failed');
          });
        }
        return res.json();
      })
      .then(() => {
        alert(`Ticket purchased for: ${eventName}`);
        fetchEvents(); // update counts
      })
      .catch((err) => {
        alert(`Error: ${err.message}`);
        console.error(err.message);
      });
  };

  return (
    <>
      <SkipLink />
      <header>
        <h1>Clemson Campus Events</h1>
      </header>
      <main id="main" tabIndex={-1}>
        {loading && <p>Loading events...</p>}
        
        {error && (
          <div style={{ 
            padding: '20px', 
            backgroundColor: '#fee', 
            border: '1px solid #fcc',
            borderRadius: '8px',
            margin: '20px'
          }}>
            <p style={{ color: '#c00', margin: 0 }}>{error}</p>
            <button 
              onClick={fetchEvents}
              style={{ marginTop: '10px' }}
            >
              Retry
            </button>
          </div>
        )}
        
        {!loading && !error && events.length === 0 && (
          <p>No events available at this time.</p>
        )}
        
        {!loading && !error && events.length > 0 && (
          <ul>
            {events.map((event) => (
              <li key={event.id}>
                {event.name} – {event.date} (Available: {event.tickets_available}){' '}
                <button
                  onClick={() => buyTicket(event.id, event.name)}
                  aria-label={`Buy one ticket for ${event.name}`}
                  disabled={event.tickets_available === 0}
                >
                  Buy Ticket
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>

      {/* Floating Voice Assistant Bubble */}
      <div style={{
        position: 'fixed',
        bottom: '1.5rem',
        right: '1.5rem',
        zIndex: 9999,
      }}>
        <LlmAssistant />
      </div>
    </>
  );
}

export default App;