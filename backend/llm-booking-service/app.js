/**
 * app.js
 * Express app for LLM-driven booking
 * - CORS limited to frontend origin (.env)
 * - JSON API
 * - Routes under /api/llm/*
 */
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import llmRoutes from './routes/llmRoutes.js';

const app = express();
app.use(express.json());

const allowOrigin = process.env.CORS_ALLOW_ORIGIN || '*';
app.use(cors({ origin: allowOrigin }));

app.get('/health', (_req, res) => res.json({ ok: true, service: 'llm-booking' }));
app.use('/api/llm', llmRoutes);

// Centralized 404
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

const port = process.env.PORT || 7001;
app.listen(port, () => console.log(`[llm-booking] listening on :${port}`));
