import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
const r = Router();
r.use(requireAuth);

// TODO: GET /, POST /direct, POST /group, PUT /:id/hidden ...
r.get('/', (_req, res) => res.json([]));
export default r;
