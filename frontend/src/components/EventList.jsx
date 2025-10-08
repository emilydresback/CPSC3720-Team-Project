import { useRef, useState } from "react";

export default function EventList({ events, setEvents }) {
  const liveRef = useRef(null);
  const [status, setStatus] = useState("");

  // Simulated “buy” action just to demonstrate aria-live + focus handling
  const handleBuy = (id) => {
    setEvents((prev) =>
      prev.map((e) =>
        e.id === id && e.total_tickets > 0
          ? { ...e, total_tickets: e.total_tickets - 1 }
          : e
      )
    );
    const bought = events.find((e) => e.id === id);
    const msg =
      bought && bought.total_tickets > 0
        ? `Purchased 1 ticket for ${bought.name}. ${bought.total_tickets - 1} tickets remaining.`
        : `No tickets remaining for ${bought?.name ?? "this event"}.`;

    setStatus(msg);
    // aria-live will announce; we also ensure screen readers catch the update
    if (liveRef.current) {
      liveRef.current.textContent = msg;
    }
  };

  return (
    <section aria-labelledby="events-heading">
      <h2 id="events-heading">Upcoming Events</h2>

      {/* Live region announces purchases/updates to screen readers */}
      <div
        ref={liveRef}
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {status}
      </div>

      <ul>
        {events.map((e) => (
          <li key={e.id}>
            <article aria-labelledby={`event-${e.id}-name`}>
              <h3 id={`event-${e.id}-name`}>{e.name}</h3>

              <p>
                <span className="sr-only">Date: </span>
                {e.date}
              </p>

              <p>
                <span className="sr-only">Tickets available: </span>
                {e.total_tickets}
              </p>

              {/* Use a real <button> (not a div) for native keyboard support */}
              <button
                type="button"
                onClick={() => handleBuy(e.id)}
                aria-label={`Buy one ticket for ${e.name}. ${e.total_tickets} available.`}
              >
                Buy Ticket
              </button>
            </article>
          </li>
        ))}
      </ul>
    </section>
  );
}
