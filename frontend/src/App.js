import React, { useEffect, useState } from 'react';
import './App.css';

// simple SkipLink component
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
    fetch('http://localhost:5000/api/events')
      .then((res) => res.json())
      .then((data) => setEvents(data))
      .catch((err) => console.error(err));
  }, []);

  const buyTicket = (eventName) => {
    alert(`Ticket purchased for: ${eventName}`);
  };

  return (
    <>
      {/* #2: Skip link goes right at the top so keyboard users can reach it first */}
      <SkipLink />

      <header>
        <h1>Clemson Campus Events</h1>
      </header>

      {/* main landmark for accessibility */}
      <main id="main" tabIndex={-1}>
        <ul>
          {events.map((event) => (
            <li key={event.id}>
              {event.name} – {event.date}{' '}
              <button
                onClick={() => buyTicket(event.name)}
                aria-label={`Buy one ticket for ${event.name}`}
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
