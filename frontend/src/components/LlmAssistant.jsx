import React, { useState, useEffect } from 'react';

const API = 'http://localhost:7001/api/llm';

export default function LlmAssistant() {
  const [input, setInput] = useState('');
  const [events, setEvents] = useState([]);
  const [parsed, setParsed] = useState(null);
  const [pending, setPending] = useState(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch(`${API}/events`).then(r => r.json()).then(d => setEvents(d.events || []));
  }, []);

  async function handleParse() {
    setMessage('');
    const res = await fetch(`${API}/parse`, {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ text: input })
    });
    const data = await res.json();
    setParsed(data);
    // If ask to show events:
    if (data.intent === 'show_events') {
      setMessage('Here are events with tickets available.');
    } else if (data.intent === 'book') {
      setMessage(`I can prepare a booking for "${data.event}" x${data.tickets}. Review and confirm?`);
    } else {
      setMessage('Sorry—I didn’t catch that. Try: "Book two tickets for Jazz Night."');
    }
  }

  async function handlePrepare() {
    if (!parsed || parsed.intent !== 'book') return;
    const res = await fetch(`${API}/prepare`, {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ event: parsed.event, tickets: parsed.tickets })
    });
    const data = await res.json();
    if (data.error) { setMessage(data.error); return; }
    setPending(data);
    setMessage(`Ready to book: ${data.summary}. Click Confirm to finalize.`);
  }

  async function handleConfirm() {
    if (!pending?.pendingId) return;
    const res = await fetch(`${API}/confirm`, {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ pendingId: pending.pendingId })
    });
    const data = await res.json();
    if (data.error) { setMessage(data.error); return; }
    setMessage(data.message || 'Booked!');
    setPending(null);
    // refresh events list to reflect updated counts
    const e = await fetch(`${API}/events`).then(r => r.json());
    setEvents(e.events || []);
  }

  return (
    <div className="llm-assistant" style={{maxWidth: 600, margin: '2rem auto'}}>
      <h2>LLM Booking Assistant (Guest)</h2>

      <div style={{display:'flex', gap:8}}>
        <input
          aria-label="Chat message"
          placeholder='Try: "Book two tickets for Jazz Night." or "Show available events".'
          value={input}
          onChange={e=>setInput(e.target.value)}
          style={{flex:1, padding:8}}
        />
        <button onClick={handleParse}>Send</button>
      </div>

      {message && <p style={{marginTop:12}}>{message}</p>}

      {parsed?.intent === 'show_events' && (
        <div style={{marginTop:16}}>
          <h3>Available Events</h3>
          <ul>
            {events.map(ev => (
              <li key={ev.id}>
                <strong>{ev.name}</strong> — {ev.date} — {ev.available_tickets} left
              </li>
            ))}
          </ul>
        </div>
      )}

      {parsed?.intent === 'book' && !pending && (
        <div style={{marginTop:16}}>
          <button onClick={handlePrepare} aria-label="Prepare booking">Prepare Booking</button>
        </div>
      )}

      {pending && (
        <div style={{marginTop:16, border:'1px solid #ccc', padding:12}}>
          <p><strong>Pending:</strong> {pending.summary}</p>
          <button onClick={handleConfirm} aria-label="Confirm booking">Confirm Booking</button>
        </div>
      )}
    </div>
  );
}
