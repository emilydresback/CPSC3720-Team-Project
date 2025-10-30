/**
 * Routes for LLM booking assistant
 */
import { Router } from 'express';
import { parseHandler, listEventsHandler, prepareHandler, confirmHandler } from '../controllers/llmController.js';

const r = Router();

r.post('/parse', parseHandler);
r.get('/events', listEventsHandler);
r.post('/prepare', prepareHandler);
r.post('/confirm', confirmHandler);

export default r;
