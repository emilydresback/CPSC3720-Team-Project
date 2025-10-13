import React, { useEffect, useState } from 'react';
import './App.css';

function SkipLink() {
  return (
    <a href="#main" className="skip-link">
      Skip to main content
    </a>
  );
}

function App() {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = () => {
    fetch('http://localhost:6001/api/events')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch events');
        return res.json();
      })
      .then((data) => setEvents(data))
      .catch((err) => console.error(err));
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
      .catch((err) => console.error(err.message));
  };

  return (
    <>
      <SkipLink />
      <header>
        <h1>Clemson Campus Events</h1>
      </header>
      <main id="main" tabIndex={-1}>
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
      </main>
    </>
  );
}

export default App;
