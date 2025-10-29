import React, { useEffect, useState, useCallback, useRef } from 'react';
import './App.css';

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

  /** Floating Voice Assistant integrated below */
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

      {/* Floating Voice Assistant Bubble */}
      <div style={{
        position: 'fixed',
        bottom: '1.5rem',
        right: '1.5rem',
        zIndex: 9999,
      }}>
        <VoiceAssistant />
      </div>
    </>
  );
}

/**
 * VOICE ASSISTANT COMPONENT
 * Handles voice input, chat interface, LLM calls, and text-to-speech.
 */
const VoiceAssistant = () => {
  const [messages, setMessages] = useState([
    { sender: 'llm', text: "Hello! I'm your TigerTix assistant. Tap the mic to speak your request, or type it below. How can I help you find tickets today?" }
  ]);
  const [userInput, setUserInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isLLMLoading, setIsLLMLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const chatWindowRef = useRef(null);
  const recognitionRef = useRef(null);

  const API_URL = 'http://localhost:6001/api/llm'; //local backend for now

  /** Utility: Play a short audio beep before recording */
  const playStartBeep = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return console.error("Web Audio API not supported.");
      const audioContext = new AudioContext();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.5, audioContext.currentTime + 0.05);
      gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.3);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (e) {
      console.error("Failed to play beep:", e);
    }
  };

  /** Utility: Speak text aloud using Web Speech API */
  const speakResponse = (text) => {
    const synth = window.speechSynthesis;
    if (!synth) return console.warn("Text-to-Speech not supported.");
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    synth.speak(utterance);
  };

  /** Fetch helper with exponential backoff */
  async function fetchWithBackoff(url, options, maxRetries = 5) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await fetch(url, options);
        if (!response.ok) {
          if (response.status === 429 && i < maxRetries - 1) {
            const delay = Math.pow(2, i) * 1000 + Math.random() * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          throw new Error(`API call failed: ${response.statusText}`);
        }
        return response;
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        const delay = Math.pow(2, i) * 1000 + Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /** Core LLM Request */
  const getLLMResponse = useCallback(async (prompt) => {
    setIsLLMLoading(true);
    const payload = { message: prompt };
    try {
      const response = await fetchWithBackoff(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      return data.reply || "Sorry, I didn’t get a valid response.";
    } catch (err) {
      console.error(err);
      return "There was a problem contacting the server.";
    } finally {
      setIsLLMLoading(false);
    }
  }, []);

  /** Process User Input */
  const processUserInput = useCallback(async (text) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setMessages(prev => [...prev, { sender: 'user', text: trimmed }]);
    setUserInput('');
    setStatusMessage('Assistant is thinking...');
    const reply = await getLLMResponse(trimmed);
    setMessages(prev => [...prev, { sender: 'llm', text: reply }]);
    speakResponse(reply);
    setStatusMessage('');
  }, [getLLMResponse]);

  /** Speech Recognition Setup */
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setStatusMessage('Voice input not supported in this browser.');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognitionRef.current = recognition;
    recognition.onstart = () => {
      setIsRecording(true);
      setStatusMessage('Recording... Speak now.');
    };
    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      processUserInput(transcript);
    };
    recognition.onend = () => setIsRecording(false);
    recognition.onerror = (e) => {
      console.error(e);
      setIsRecording(false);
      setStatusMessage('Error capturing voice. Try again.');
    };
  }, [processUserInput]);

  /** Mic toggle */
  const toggleRecording = () => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    if (isRecording) {
      recognition.stop();
    } else {
      playStartBeep();
      recognition.start();
    }
  };

  return (
    <div
      style={{
        width: '340px',
        height: '420px',
        backgroundColor: '#fff',
        borderRadius: '16px',
        boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div
        ref={chatWindowRef}
        style={{
          flexGrow: 1,
          overflowY: 'auto',
          padding: '12px',
        }}
      >
        {messages.map((m, i) => (
          <div key={i} style={{
            textAlign: m.sender === 'user' ? 'right' : 'left',
            margin: '8px 0',
          }}>
            <span
              style={{
                display: 'inline-block',
                background: m.sender === 'user' ? '#a556efff' : '#ee804dff',
                borderRadius: '10px',
                padding: '8px 10px',
                maxWidth: '80%',
              }}
            >
              {m.text}
            </span>
          </div>
        ))}
      </div>

      {/* Input area */}
      <div style={{
        borderTop: '1px solid #eee',
        padding: '8px',
        display: 'flex',
        alignItems: 'center',
      }}>
        <button
          onClick={toggleRecording}
          style={{
            background: isRecording ? '#dc3545' : '#f56624ff',
            color: 'white',
            border: 'none',
            borderRadius: '50%',
            width: '40px',
            height: '40px',
            fontSize: '16px',
            cursor: 'pointer',
            marginRight: '8px',
          }}
          aria-label="Toggle voice input"
        >
          🎤
        </button>
        <input
          type="text"
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && processUserInput(userInput)}
          placeholder="Type or speak..."
          style={{
            flex: 1,
            borderRadius: '12px',
            border: '1px solid #a71ae4ff',
            padding: '8px',
          }}
        />
      </div>
      <div style={{
        textAlign: 'center',
        fontSize: '0.8rem',
        color: '#666',
        paddingBottom: '6px',
      }}>
        {statusMessage}
      </div>
    </div>
  );
};

export default App;
