import React, { useEffect, useMemo, useRef, useState } from "react";

function App() {
  // ---------- DATA ----------
  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [chatLog, setChatLog] = useState([]); // {sender:'user'|'ai', text:string}
  const [listening, setListening] = useState(false);
  const [ttsOn, setTtsOn] = useState(true);

  // Browser Speech APIs
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition || null;
  const canSTT = !!SpeechRecognition;
  const canTTS = !!window.speechSynthesis;

  const recognizerRef = useRef(null);
  const audioCtxRef = useRef(null);

  // ---------- FETCH EVENTS ----------
  const fetchEvents = async () => {
    try {
      const res = await fetch("http://localhost:6001/api/events");
      const data = await res.json();
      setEvents(Array.isArray(data) ? data : data.events || []);
    } catch (err) {
      console.error(err);
      setStatus("⚠️ Failed to load events from backend.");
    }
  };

  // ---------- PURCHASE TICKET (Used by both button and LLM action) ----------
  const purchaseTicket = async (id, eventName, quantity = 1) => {
    // Note: The 'events' state is captured at the time 'purchaseTicket' is called, 
    // but the find operation ensures we check the latest state array content.
    const eventToBook = events.find(e => e.id === id);

    if (!eventToBook || eventToBook.tickets_available < quantity || quantity <= 0) {
        setStatus(`❌ Booking aborted: Not enough tickets or invalid quantity for ${eventName}.`);
        return false;
    }

    setStatus(`⏳ Attempting to book ${quantity} ticket(s) for ${eventName}...`);
    
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
                `http://localhost:6001/api/events/${id}/purchase`,
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
        setStatus(`✅ Successfully booked all ${quantity} tickets for ${eventName}!`);
        // Re-fetch to ensure sync with backend, reversing optimistic update if necessary
        fetchEvents();
        return true;
    } else {
        setStatus(`⚠️ Only ${successfulBookings} of ${quantity} tickets booked for ${eventName}. Check backend log. Restoring ticket count...`);
        // Re-fetch to restore correct ticket count if partial failure occurred
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

  // ---------- LLM CALL: sendToLLM (FINAL FIX: Quantity Bug Fix) ----------
  const sendToLLM = async (userText) => {
    const userMsg = { sender: "user", text: userText };
    setChatLog((prev) => [...prev, userMsg]);

    // CORS Proxy and API Key setup (retained for context)
    const corsProxy = 'https://corsproxy.io/?';
    const openaiUrl = 'https://api.openai.com/v1/chat/completions';
    const finalUrl = `${corsProxy}${encodeURIComponent(openaiUrl)}`;
    const OPENAI_API_KEY = "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";

    // --- Message Construction for LLM ---
    let messages = [
      { role: "system", content: systemPrompt },
      {
        role: "system",
        content:
          "Current events context (name, date, tickets_available):\n" +
          eventsAsBulletedContext,
      },
    ];

    // Check if the user's message is a simple confirmation
    const isConfirmation = /^\s*(yes|yep|confirm|book\s+it|ok)\s*$/i.test(userText.trim());
    let forcedActionTag = null; 
    let aiReplyText = null; 

    // **CRITICAL FIX: ATTEMPT CLIENT-SIDE CONFIRMATION EXECUTION**
    if (isConfirmation) {
        const lastAIMessage = chatLog.findLast(m => m.sender === 'ai'); 
        
        if (lastAIMessage) {
            
            // Pattern 1: Find the Event Name (highly resilient)
            // Captures text between an introductory phrase (The/for the) and a closing phrase (has X tickets/on/?)
            const eventNameMatch = lastAIMessage.text.match(/(?:The|for the|for)\s+(.*?)\s+(?:has\s+\d+\s+tickets\s+available|on|\?|\.$)/i);
            
            // Pattern 2: Find the Quantity (FIXED: Now requires 'book' or 'confirm' nearby to prioritize requested quantity)
            // Captures the number/word X from "book X tickets" or "confirm the booking for X tickets"
            const quantityMatch = lastAIMessage.text.match(/(?:book|booking for|confirming)\s+(\d+|\w+)\s+tickets?/i);

            if (eventNameMatch && quantityMatch) {
                
                // 1. Extract and Clean Event Name
                let proposedEventName = eventNameMatch[1].trim(); 
                // Aggressively clean up any trailing dates/commas the LLM might have left in Group 1
                proposedEventName = proposedEventName.replace(/\s+on\s+.*$/i, '').replace(/,$/, '').trim();
                
                // 2. Extract and Convert Quantity
                // We use the first capture group from the quantity match
                const proposedQuantityText = quantityMatch[1].trim(); 
                let proposedQuantity = parseInt(proposedQuantityText, 10);
                if (isNaN(proposedQuantity)) {
                    const numberMap = { 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10 };
                    proposedQuantity = numberMap[proposedQuantityText.toLowerCase()] || 0;
                }
                
                // 3. Match against Canonical Events
                const matchedEvent = events.find(e => 
                    // Match if the full canonical name contains the proposed name, or vice versa (for partial matches like "expo")
                    e.name.toLowerCase().includes(proposedEventName.toLowerCase()) ||
                    proposedEventName.toLowerCase().includes(e.name.toLowerCase())
                );
                
                if (matchedEvent && proposedQuantity > 0) {
                    const canonicalEventName = matchedEvent.name; 
                    
                    // Create the guaranteed action tag
                    forcedActionTag = `[ACTION:BOOK|${canonicalEventName}|${proposedQuantity}]`;
                    aiReplyText = `Booking confirmed! ${forcedActionTag}`;
                }
            }
        }
    }
    
    // --------------------------------------------------------------------------
    // ---------------------- CRITICAL FIX: BYPASS LLM ON CONFIRMATION ----------------------
    // --------------------------------------------------------------------------
    if (forcedActionTag && aiReplyText) {
        // If we found a valid action, we execute it directly without hitting the LLM API.
        
        // --- ACTION PARSING & EXECUTION (Guaranteed correct logic) ---
        const actionMatch = aiReplyText.match(/\[ACTION:BOOK\|(.*?)\|(.*?)\]/i);
        const eventName = actionMatch[1].trim();
        const quantity = parseInt(actionMatch[2], 10);

        let eventToBook = events.find(e => eventName.toLowerCase() === e.name.toLowerCase());

        let reply = aiReplyText.replace(/\[ACTION:BOOK\|.*?\|.*?\]/ig, '').trim(); 
        
        if (eventToBook && eventToBook.tickets_available >= quantity && quantity > 0) {
            
            const success = await purchaseTicket(eventToBook.id, eventToBook.name, quantity);
            if (!success) {
                 reply = `Booking partially failed. Only ${eventToBook.tickets_available} tickets were booked for the ${eventName}.`;
            } else {
                 // Success case
                 reply = `Booking confirmed! You have successfully booked ${quantity} ticket(s) for the ${eventName}.`;
            }
        } else {
            reply = `Sorry, I couldn't complete the booking. The event was not found, the quantity was invalid (${quantity}), or tickets sold out.`;
            setStatus(`❌ Booking aborted: Check availability or event name.`);
        }
        
        setChatLog((prev) => [...prev, { sender: "ai", text: reply }]);
        speak(reply);
        return; // *** EXIT THE FUNCTION HERE - LLM API call is skipped ***
    }
    // --------------------------------------------------------------------------

    // If not a confirmation, or if confirmation context failed, proceed to LLM.
    messages.push({ role: "user", content: userText });
    // --- End Message Construction ---


    try {
      const res = await fetch(finalUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: messages, // Now guaranteed to be defined
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        console.error("OpenAI API Error:", res.status, errData);
        const errorMessage = errData?.error?.message || `API request failed with status: ${res.status}`;
        const fail = `❌ LLM Error: ${errorMessage}. The CORS proxy may be unstable, or the API key may be invalid/expired.`;
        setChatLog((prev) => [...prev, { sender: "ai", text: fail }]);
        speak(fail);
        return;
      }

      const data = await res.json();
      let reply =
        data?.choices?.[0]?.message?.content ||
        "Sorry, I couldn't get a response.";

      // --- ACTION PARSING LOGIC (Handles tag from LLM's own response) ---
      const actionMatch = reply.match(/\[ACTION:BOOK\|(.*?)\|(.*?)\]/i);

      if (actionMatch) {
          // Remove the action tag from the reply
          reply = reply.replace(/(\*\*?)\[ACTION:BOOK\|.*?\|.*?\](\*\*?)/ig, '').trim();
          
          const eventName = actionMatch[1].trim();
          const quantity = parseInt(actionMatch[2], 10);

          let eventToBook = events.find(e =>
              eventName.toLowerCase() === e.name.toLowerCase() 
          );

          if (eventToBook && eventToBook.tickets_available >= quantity && quantity > 0) {
              
              const success = await purchaseTicket(eventToBook.id, eventToBook.name, quantity);

              if (!success) {
                   reply += ` (Internal App Note: Booking partially or fully failed).`;
              }

          } else {
              reply += ` (Internal App Note: Booking failed—event not found, quantity invalid, or sold out: ${eventToBook ? eventToBook.tickets_available : 'N/A'}).`;
              setStatus(`❌ Booking aborted: Check availability or event name.`);
          }
      }
      // --- END ACTION PARSING LOGIC ---

      setChatLog((prev) => [...prev, { sender: "ai", text: reply }]);
      speak(reply);
    } catch (err) {
      console.error(err);
      const fail = "⚠️ Error contacting the LLM.";
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
      setStatus("⚠️ Speech recognition not supported in this browser.");
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
        setStatus("⚠️ Microphone error or permission denied.");
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
      setStatus("⚠️ Could not start recognition.");
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
      <header>
        <h1 id="app-title">🎟️ TigerTix Assistant</h1>
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
          <h2 id="assistant-heading">💬 Assistant Chat</h2>

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

      {/* INLINE STYLES (NEW WHITE/ORANGE/PURPLE THEME - RETAINED) */}
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