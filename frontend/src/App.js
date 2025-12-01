import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "./context/AuthContext";
import { useNavigate } from "react-router-dom";
import { API_ENDPOINTS } from "./config/api";

function App() {
  // ---------- DATA ----------
  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [chatLog, setChatLog] = useState([]); // {sender:'user'|'ai', text:string}
  const [listening, setListening] = useState(false);
  const [ttsOn, setTtsOn] = useState(true);
  const [pendingBooking, setPendingBooking] = useState(null);

  // Browser Speech APIs
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition || null;
  const canSTT = !!SpeechRecognition;
  const canTTS = !!window.speechSynthesis;

  const recognizerRef = useRef(null);
  const audioCtxRef = useRef(null);

  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // ---------- LOGOUT ----------
  const handleLogoutClick = async () => {
    try {
      await fetch(API_ENDPOINTS.LOGOUT, {
        method: "POST",
        credentials: "include",
      });
  
      logout();
      setStatus("Logged out.");
    } catch (err) {
      console.error("Logout error:", err);
      setStatus("Logout failed.");
    }
  };
  
  // ---------- FETCH EVENTS ----------
  const fetchEvents = async () => {
    try {
      const res = await fetch(API_ENDPOINTS.EVENTS); 
      const data = await res.json();
      setEvents(Array.isArray(data) ? data : data.events || []);
      setStatus(""); // Clear status on success
    } catch (err) {
      console.error(err);
      setStatus("Failed to load events from backend. Check network connection.");
    }
  };

  // ---------- PURCHASE TICKET (Used by both button and LLM action) ----------
  const purchaseTicket = async (id, eventName, quantity = 1) => {
    // Note: The 'events' state is captured at the time 'purchaseTicket' is called, 
    // but the find operation ensures we check the latest state array content.
    const eventToBook = events.find(e => e.id === id);

    if (!eventToBook || eventToBook.tickets_available < quantity || quantity <= 0) {
        setStatus(`Booking aborted: Not enough tickets or invalid quantity for ${eventName}.`);
        return false;
    }

    setStatus(`Attempting to book ${quantity} ticket(s) for ${eventName}...`);
    
    let successfulBookings = 0;
    
    // 1. Optimistic update (decrease count)
    setEvents(prevEvents => prevEvents.map(e => 
        e.id === id
            ? { ...e, tickets_available: e.tickets_available - quantity }
            : e
    ));

    // 2. Perform the booking action by looping the purchase call
    for(let i = 0; i < quantity; i++) {
        try {
            const res = await fetch( 
                `${API_ENDPOINTS.EVENTS}/${id}/purchase`,
                { method: "POST", headers: { "Content-Type": "application/json" } }
            );
            if (res.ok) {
                successfulBookings++;
            } else {
                const errText = await res.text();
                console.error(`Purchase failed for ${eventName}: ${errText}`);
                break; // Stop on first failure
            }
        } catch (err) {
            console.error(err);
            break; // Stop on first failure
        }
    }

    // 3. Final status and fetch
    if (successfulBookings === quantity) {
      // FIX: Set status first and then immediately call fetchEvents()
      const successMessage = `Successfully booked all ${quantity} tickets for ${eventName}!`;
      setStatus(successMessage); 
      
      // Use a short timeout before re-fetching to let the user see the success message
      // before the ticket count updates and the status is potentially cleared/refreshed.
      setTimeout(() => {
          fetchEvents();
          // Clear status after a short delay to keep the UI clean after the booking is done
          setTimeout(() => setStatus(''), 3000); 
      }, 1000); // 1000ms delay to display the success message
      
      return true;
  } else if (successfulBookings > 0) {
      setStatus(`Only ${successfulBookings} of ${quantity} tickets booked for ${eventName}. Restoring ticket count...`);
      fetchEvents();
      return false;
    } 
    else {
      // Full failure (0 successful bookings)
      setStatus(`Failed to book any tickets for ${eventName}. Check availability or network connection.`);
      fetchEvents();
      return false;
    }
  };

  // ---------- LLM CALL: SYSTEM PROMPT ----------
  const systemPrompt = useMemo(
    () =>
      [
        "You are the TigerTix assistant. The user is a guest.",
        "Capabilities:",
        "- Greet the user.",
        "- Show events with available tickets (from context).",
        "- Propose a booking with event name and quantity, but NEVER book automatically.",
        "- Always ask for explicit confirmation before booking.",
        "- Keep answers concise and friendly.",
        "- **CRITICAL RULE:** If a booking is explicitly confirmed, you MUST reply with this EXACT format ONLY: A brief confirmation message, followed by the action tag. NO GREETINGS, NO EMOJIS, NO QUESTIONS about the next step.",
        "- **CONFIRMED BOOKING FORMAT:** [ACTION:BOOK|Event Name|Quantity]",
        "- Example confirmed response: 'Booking confirmed! [ACTION:BOOK|Homecoming Tailgate|2]'",
      ].join("\n"),
    []
  );

  const eventsAsBulletedContext = useMemo(() => {
    if (!events?.length) return "No events available.";
    return events
      .map(
        (e) =>
          `• ${e.name} — ${e.date} — tickets_available=${e.tickets_available}`
      )
      .join("\n");
  }, [events]);

  const speak = (text) => {
    if (!ttsOn || !canTTS || !text) return;
    try {
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 1.0;
      utter.pitch = 1.0;
      utter.lang = "en-US";
      window.speechSynthesis.cancel(); // stop any current speech
      window.speechSynthesis.speak(utter);
    } catch {
      /* ignore */
    }
  };

  // ---------- LLM CALL: sendToLLM (Use simple backend chat service) ----------
  const sendToLLM = async (userText) => {
    const userMsg = { sender: "user", text: userText };
    setChatLog((prev) => [...prev, userMsg]);

    try {
      // Use backend chat service
      const res = await fetch(`${API_ENDPOINTS.CHAT}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userText,
          context: {
            events: events,
            user: user,
            pendingBooking: pendingBooking
          }
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        console.error("Chat Service Error:", res.status, errData);
        const errorMessage = errData?.error || `Service request failed with status: ${res.status}`;
        const fail = `Chat Error: ${errorMessage}. The chat service may be unavailable.`;
        setChatLog((prev) => [...prev, { sender: "ai", text: fail }]);
        speak(fail);
        return;
      }

      const data = await res.json();
      let reply = data?.response || "Sorry, I couldn't get a response.";

      setChatLog((prev) => [...prev, { sender: "ai", text: reply }]);
      speak(reply);
      
      // Handle pending booking context
      if (data.pendingBooking) {
        setPendingBooking(data.pendingBooking);
      } else if (userText.toLowerCase().match(/^(yes|y|confirm|ok|no|n|cancel|nevermind)$/)) {
        // Clear pending booking after confirmation or cancellation
        setPendingBooking(null);
      }
      
      // Check if booking was successful and refresh events
      if (reply.includes('Booking confirmed!') || reply.includes('successfully reserved') || data.confirmationNumber) {
        // Refresh events to show updated ticket counts
        fetchEvents();
      }
      
    } catch (error) {
      console.error("Chat Service Error:", error);
      const fail = `Network error: Could not connect to the chat service.`;
      setChatLog((prev) => [...prev, { sender: "ai", text: fail }]);
      speak(fail);
    }
  };

  const onChatSubmit = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const text = chatInput.trim();
    setChatInput("");
    sendToLLM(text);
  };

  // ---------- MIC (STT) ----------
  const beep = async () => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext ||
          window.webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.type = "sine";
      o.frequency.value = 880; // A5 beep
      g.gain.value = 0.1;
      o.start();
      await new Promise((r) => setTimeout(r, 150));
      o.stop();
    } catch {
      /* ignore beep errors */
    }
  };

  const startListening = async () => {
    if (!canSTT) {
      setStatus("Speech recognition not supported in this browser.");
      return;
    }
    await beep();

    try {
      const recog = new SpeechRecognition();
      recognizerRef.current = recog;
      recog.lang = "en-US";
      recog.interimResults = false;
      recog.maxAlternatives = 1;

      recog.onstart = () => setListening(true);
      recog.onerror = (e) => {
        console.error(e);
        setListening(false);
        setStatus("Microphone error or permission denied.");
      };
      recog.onend = () => setListening(false);
      recog.onresult = (e) => {
        const transcript = e.results?.[0]?.[0]?.transcript || "";
        if (transcript) {
          setChatLog((prev) => [...prev, { sender: "user", text: transcript }]);
          sendToLLM(transcript);
        }
      };

      recog.start();
    } catch (err) {
      console.error(err);
      setStatus("Could not start recognition.");
      setListening(false);
    }
  };

  // ---------- EFFECTS ----------
  useEffect(() => {
    fetchEvents();
  }, []);

  // ---------- UI (WHITE/ORANGE/PURPLE DESIGN - RETAINED) ----------
  return (
    <div className="App" role="main">
      <header className="auth-header">
        <h1 id="app-title">TigerTix Assistant</h1>

        <div className="auth-controls">
          {!user && (
            <>
              <button
                className="auth-btn"
                onClick={() => navigate("/login")}
              >
                Login
              </button>

              <button
                className="auth-btn"
                onClick={() => navigate("/register")}
              >
                Register
              </button>
            </>
          )}

          {user && (
            <>
              <span className="auth-user">Logged in as {user.email}</span>
              <button
                className="auth-btn logout"
                onClick={handleLogoutClick}
              >
                Logout
              </button>
            </>
          )}
        </div>
      </header>


      <div aria-live="polite" className="status-container">
        {status && <p className="status">{status}</p>}
      </div>

      <div className="main-content-layout">
        {/* EVENTS */}
        <section aria-labelledby="events-heading" className="event-section card">
          <h2 id="events-heading">Available Events</h2>
          <ul className="events">
            {events.map((e) => (
              <li key={e.id} className="event-card">
                <h3>{e.name}</h3>
                <p>
                  <strong>Date:</strong> {e.date}
                </p>
                <p className="ticket-info">
                  <strong>Tickets Left:</strong>{" "}
                  <span aria-live="polite" className="ticket-count">
                    {e.tickets_available}
                  </span>
                </p>
                <button
                  onClick={() => purchaseTicket(e.id, e.name, 1)} 
                  aria-label={`Buy ticket for ${e.name}`}
                  disabled={e.tickets_available <= 0}
                  className="buy-button"
                >
                  {e.tickets_available > 0 ? "Book Now (1 Ticket)" : "Sold Out"}
                </button>
              </li>
            ))}
          </ul>
          {events.length === 0 && <p>No events found.</p>}
        </section>

        {/* CHAT + MIC */}
        <section aria-labelledby="assistant-heading" className="chat-section card">
          <h2 id="assistant-heading"> Assistant Chat</h2>

          <div className="chat-box" aria-live="polite">
            {chatLog.map((m, i) => (
              <div
                key={i}
                className={`msg ${m.sender}`}
                aria-label={`${
                  m.sender === "user" ? "You said" : "Assistant replied"
                }`}
              >
                <span className="sender-label">
                  {m.sender === "user" ? "You" : "AI"}:
                </span>{" "}
                {m.text}
              </div>
            ))}
          </div>

          <form onSubmit={onChatSubmit} className="chat-form">
            <input
              id="chat-input"
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Ask about events or book tickets (e.g., '5 tickets expo')"
              aria-label="Ask about events or booking"
              required
            />
            <button type="submit" className="submit-button">
              Send
            </button>
            <button
              type="button"
              onClick={startListening}
              aria-pressed={listening}
              className={`mic-button ${listening ? "listening" : ""}`}
              title={
                canSTT
                  ? "Activate Voice Command"
                  : "Speech recognition not supported"
              }
              disabled={!canSTT}
            >
              {listening ? "🎤 Listening..." : "🎤 Speak"}
            </button>
            <label className="tts-toggle">
              <input
                type="checkbox"
                checked={ttsOn}
                onChange={() => setTtsOn((v) => !v)}
              />
              Voice
            </label>
          </form>
        </section>
      </div>

      {/* INLINE STYLES */}
      <style>{`
        /* --- GLOBAL STYLES (WHITE/PURPLE/ORANGE) --- */
        :root {
            --color-purple: #522D80;
            --color-orange: #F57D00;
            --color-light-gray: #F0F0F0;
            --color-dark-text: #333333;
        }

        body {
            background-color: var(--color-light-gray);
            color: var(--color-dark-text);
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 0;
        }

        .App { 
            max-width: 960px; 
            margin: 2.5rem auto; 
            padding: 1rem; 
            background-color: #FFFFFF;
            border-radius: 12px;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
        }
        
        h1, h2 { 
            color: var(--color-purple);
            border-bottom: 2px solid var(--color-orange);
            padding-bottom: 0.5rem;
            margin-bottom: 1.5rem;
            font-weight: 600;
        }
        
        h3 {
            color: var(--color-dark-text);
            margin-top: 0;
            font-size: 1.15rem;
        }

        /* --- STATUS --- */
        .status-container { 
            min-height: 1.5em; 
            margin-bottom: 1rem;
        }
        
        .status {
            background-color: #FFF3E0; /* Light orange background */
            border: 1px solid var(--color-orange);
            color: var(--color-dark-text);
            padding: 0.75rem;
            border-radius: 8px;
            font-weight: 500;
        }

        /* --- AUTH HEADER --- */
        .auth-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .auth-controls {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .auth-user {
          font-weight: 500;
          color: var(--color-dark-text);
        }

        .auth-btn {
          background-color: var(--color-purple);
          color: white;
          border: none;
          border-radius: 6px;
          padding: 0.4rem 0.9rem;
          cursor: pointer;
          transition: background-color 0.2s ease;
        }

        .auth-btn:hover {
          background-color: var(--color-orange);
        }

        .auth-btn.logout {
          background-color: var(--color-orange);
        }

        .auth-btn.logout:hover {
          background-color: #d96900;
        }

        /* --- LAYOUT --- */
        .main-content-layout {
            display: grid;
            grid-template-columns: 1fr 1.5fr; /* Events section smaller than Chat */
            gap: 2rem;
        }
        @media (max-width: 768px) {
            .main-content-layout {
                grid-template-columns: 1fr;
            }
        }

        .card {
            padding: 1.5rem;
            background-color: #FFFFFF;
            border: 1px solid var(--color-light-gray);
            border-radius: 10px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
        }

        /* --- BUTTONS --- */
        button { 
            background: var(--color-purple); 
            color: #fff; 
            border: none; 
            border-radius: 6px; 
            padding: .6rem 1rem; 
            cursor: pointer; 
            font-weight: 500;
            transition: background-color 0.2s;
        }

        button:hover, button:focus { 
            background: var(--color-orange); 
            outline: 2px solid var(--color-purple);
        }
        
        button:disabled { 
            background: #CCC; 
            color: #888; 
            cursor: not-allowed; 
        }

        /* --- EVENTS SECTION --- */
        .events { 
            list-style: none; 
            padding: 0; 
        }
        
        .event-card { 
            border: 1px solid var(--color-light-gray); 
            border-left: 5px solid var(--color-orange);
            border-radius: 6px; 
            padding: 1rem; 
            margin-bottom: 1rem; 
            background-color: #FAFAFA;
        }

        .ticket-info {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 0.5rem;
        }

        .ticket-count {
            font-size: 1.1em;
            color: var(--color-purple);
            font-weight: bold;
        }

        .buy-button {
            width: 100%;
            margin-top: 1rem;
        }

        /* --- CHAT SECTION --- */
        .chat-section {
            display: flex;
            flex-direction: column;
        }
        
        .chat-box { 
            flex-grow: 1;
            border: 1px solid #DDD; 
            border-radius: 8px; 
            background: #FFFFFF; 
            min-height: 250px; 
            padding: .75rem; 
            margin-bottom: .75rem; 
            overflow-y: auto;
        }
        
        .msg { 
            margin: .5rem 0; 
            line-height: 1.4;
            padding: 0.25rem 0.5rem;
            border-radius: 4px;
        }
        
        .sender-label {
            font-weight: bold;
            padding-right: 0.5rem;
        }

        .msg.user {
            text-align: right;
        }
        .msg.user .sender-label {
            color: var(--color-dark-text);
        }
        .msg.user {
            background-color: #E6E0F0; /* Light purple bubble */
            margin-left: 20%;
        }
        
        .msg.ai { 
            text-align: left;
            background-color: #F0F8FF; /* Very light blue/neutral bubble */
            margin-right: 20%;
        }
        .msg.ai .sender-label { 
            color: var(--color-purple); 
        }

        /* --- CHAT FORM --- */
        .chat-form { 
            display: flex; 
            gap: .5rem; 
            align-items: center; 
            flex-wrap: wrap; 
        }
        
        #chat-input { 
            flex: 1; 
            min-width: 150px; 
            border: 1px solid #CCC; 
            border-radius: 6px; 
            padding: .6rem; 
            background-color: #FFF;
            color: var(--color-dark-text); 
        }
        
        /* MIC Button */
        .mic-button { 
            background: var(--color-orange); 
        }

        .mic-button.listening { 
            background: #E53935; /* Red when recording */
        }
        
        .tts-toggle { 
            display: inline-flex; 
            align-items: center; 
            gap: .35rem; 
            margin-left: .25rem; 
            font-size: .95rem; 
            color: var(--color-dark-text);
        }

        .sr-only { 
            position: absolute; 
            left: -10000px; 
            width: 1px; 
            height: 1px; 
            overflow: hidden; 
        }
      `}</style>
    </div>
  );
}

export default App;