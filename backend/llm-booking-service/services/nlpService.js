/**
 * nlpService.js
 * Purpose: Extract intent, event name, and ticket count from free text
 * Inputs:
 *   - text: string user message
 * Outputs:
 *   - { intent: 'book'|'show_events'|'unknown', eventName?: string, tickets?: number, raw?: any }
 * Notes:
 *   - Uses LLM if configured; otherwise regex/keyword fallback always runs
 */
import fetch from 'node-fetch';
import { wordToNumber } from '../utils/numberWords.js';

const BOOK_KEYWORDS = ['book', 'buy', 'reserve', 'purchase'];
const SHOW_KEYWORDS = ['show', 'list', 'available', 'events'];

function basicHeuristicParse(text) {
  const lower = text.toLowerCase();

  // Detect intent
  const isBook = BOOK_KEYWORDS.some(k => lower.includes(k));
  const isShow = SHOW_KEYWORDS.some(k => lower.includes(k));
  const intent = isBook ? 'book' : (isShow ? 'show_events' : 'unknown');

  // Tickets: prefer explicit numerals
  let tickets;
  const numMatch = lower.match(/(\d+)\s*(tickets?|tix)?/);
  if (numMatch) tickets = parseInt(numMatch[1], 10);
  if (!tickets) {
    const wordMatch = lower.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/);
    if (wordMatch) tickets = wordToNumber(wordMatch[1]);
  }

  // Event name: try quotes first, then after 'for'
  let eventName;
  const quoted = lower.match(/"(.*?)"|'(.*?)'/);
  if (quoted) {
    eventName = (quoted[1] || quoted[2] || '').trim();
  } else {
    const forIdx = lower.indexOf(' for ');
    if (forIdx !== -1) {
      eventName = lower.slice(forIdx + 5).trim().replace(/\.$/, '');
    }
  }

  return { intent, eventName: eventName || undefined, tickets };
}

async function llmParse(text) {
  const provider = (process.env.LLM_PROVIDER || 'openai').toLowerCase();

  if (provider === 'ollama') {
    const host = process.env.OLLAMA_HOST || 'http://localhost:11434';
    const model = process.env.OLLAMA_MODEL || 'llama3';
    const prompt = `Extract intent ("book" or "show_events" or "unknown"), event name, and ticket count from: ${JSON.stringify(text)}.
Return ONLY strict JSON like: {"intent":"book","eventName":"Jazz Night","tickets":2}
If unknown, use null.`;

    const res = await fetch(`${host}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt, stream: false })
    });
    const data = await res.json();
    // Ollama returns { response: "..." }
    const firstJson = (data.response || '').match(/\{[\s\S]*\}/);
    if (!firstJson) throw new Error('LLM parse failed (no JSON)');
    return JSON.parse(firstJson[0]);
  }

  // default: OpenAI (gpt-4o-mini or similar)
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY missing for openai provider');

  const sys = 'You extract structured fields from natural language. Output strict JSON only.';
  const user = `Text: ${text}
Fields: intent ("book"|"show_events"|"unknown"), eventName (string|null), tickets (number|null)
Example: {"intent":"book","eventName":"Jazz Night","tickets":2}`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: sys }, { role: 'user', content: user }],
      temperature: 0
    })
  });
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content || '';
  const firstJson = content.match(/\{[\s\S]*\}/);
  if (!firstJson) throw new Error('LLM parse failed (no JSON)');
  return JSON.parse(firstJson[0]);
}

export async function parseText(text) {
  // Always try LLM first (if configured), then fallback to heuristic.
  try {
    const llm = await llmParse(text);
    // light sanity check
    if (!llm || typeof llm !== 'object') throw new Error('bad LLM JSON');
    return {
      intent: llm.intent || 'unknown',
      eventName: llm.eventName || undefined,
      tickets: llm.tickets || undefined,
      raw: llm
    };
  } catch {
    const fb = basicHeuristicParse(text);
    return { ...fb, raw: { provider: 'fallback' } };
  }
}
