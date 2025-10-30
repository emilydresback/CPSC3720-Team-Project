import React, { useState, useCallback, useRef, useEffect } from 'react';

/**
 * LLM ASSISTANT COMPONENT - UPDATED VERSION
 * Connects to LLM service on port 7001
 */
const LlmAssistant = () => {
  const [messages, setMessages] = useState([
    { sender: 'llm', text: "Hello! I'm your TigerTix assistant. How can I help you today?" }
  ]);
  const [userInput, setUserInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isLLMLoading, setIsLLMLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [isMinimized, setIsMinimized] = useState(true);
  const chatWindowRef = useRef(null);
  const recognitionRef = useRef(null);

  // ✅ CORRECT PORT - LLM SERVICE ON 7001
  const LLM_API_URL = 'http://localhost:7001/api/llm';

  /** Play beep before recording */
  const playStartBeep = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
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
      console.error("Beep failed:", e);
    }
  };

  /** Text-to-speech */
  const speakResponse = (text) => {
    try {
      const synth = window.speechSynthesis;
      if (!synth) return;
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      synth.speak(utterance);
    } catch (e) {
      console.error("TTS error:", e);
    }
  };

  /** Get LLM response */
  const getLLMResponse = useCallback(async (prompt) => {
    setIsLLMLoading(true);
    try {
      console.log('Calling LLM API at:', LLM_API_URL); // Debug log
      const response = await fetch(LLM_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt })
      });
      
      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }
      
      const data = await response.json();
      console.log('LLM Response:', data); // Debug log
      return data.reply || "Sorry, I didn't get a response.";
    } catch (err) {
      console.error("LLM API Error:", err);
      return `Error: ${err.message}. Make sure LLM service is running on port 7001.`;
    } finally {
      setIsLLMLoading(false);
    }
  }, []);

  /** Process user input */
  const processUserInput = useCallback(async (text) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    
    setMessages(prev => [...prev, { sender: 'user', text: trimmed }]);
    setUserInput('');
    setStatusMessage('Thinking...');
    
    const reply = await getLLMResponse(trimmed);
    
    setMessages(prev => [...prev, { sender: 'llm', text: reply }]);
    speakResponse(reply);
    setStatusMessage('');
  }, [getLLMResponse]);

  /** Speech recognition setup */
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setStatusMessage('Voice not supported in this browser.');
      return;
    }
    
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognitionRef.current = recognition;
    
    recognition.onstart = () => {
      setIsRecording(true);
      setStatusMessage('Listening...');
    };
    
    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      processUserInput(transcript);
    };
    
    recognition.onend = () => setIsRecording(false);
    
    recognition.onerror = (e) => {
      console.error("Speech error:", e);
      setIsRecording(false);
      setStatusMessage('Voice error. Try again.');
    };
  }, [processUserInput]);

  /** Toggle mic */
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

  // Minimized button
  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        style={{
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          backgroundColor: '#f56624',
          color: 'white',
          border: 'none',
          fontSize: '24px',
          cursor: 'pointer',
          boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
        }}
        aria-label="Open chat"
      >
        🎤
      </button>
    );
  }

  // Expanded chat
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
      {/* Header */}
      <div style={{
        padding: '10px',
        backgroundColor: '#f56624',
        color: 'white',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <strong>LLM Booking Assistant</strong>
        <button
          onClick={() => setIsMinimized(true)}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'white',
            fontSize: '18px',
            cursor: 'pointer',
          }}
        >
          ✕
        </button>
      </div>

      {/* Messages */}
      <div
        ref={chatWindowRef}
        style={{
          flexGrow: 1,
          overflowY: 'auto',
          padding: '12px',
          backgroundColor: '#f9f9f9',
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
                background: m.sender === 'user' ? '#a556ef' : '#ee804d',
                color: 'white',
                borderRadius: '10px',
                padding: '8px 10px',
                maxWidth: '80%',
              }}
            >
              {m.text}
            </span>
          </div>
        ))}
        {isLLMLoading && (
          <div style={{ textAlign: 'left' }}>
            <span style={{
              display: 'inline-block',
              background: '#ddd',
              borderRadius: '10px',
              padding: '8px 10px',
            }}>
              ...
            </span>
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{
        borderTop: '1px solid #eee',
        padding: '8px',
        display: 'flex',
        alignItems: 'center',
      }}>
        <button
          onClick={toggleRecording}
          style={{
            background: isRecording ? '#dc3545' : '#f56624',
            color: 'white',
            border: 'none',
            borderRadius: '50%',
            width: '40px',
            height: '40px',
            fontSize: '16px',
            cursor: 'pointer',
            marginRight: '8px',
          }}
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
            border: '1px solid #a71ae4',
            padding: '8px',
          }}
        />
      </div>
      
      {statusMessage && (
        <div style={{
          textAlign: 'center',
          fontSize: '0.8rem',
          color: '#666',
          padding: '6px',
        }}>
          {statusMessage}
        </div>
      )}
    </div>
  );
};

export default LlmAssistant;