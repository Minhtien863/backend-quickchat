import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
const r = Router();
r.use(requireAuth);

// TODO: GET /:conversationId, POST /:conversationId/text, POST /reaction, POST /read ...
r.get('/:conversationId', (_req, res) => res.json([]));

export default r;
