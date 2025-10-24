import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
const r = Router();
r.use(requireAuth);

// TODO: GET /me, PUT /me ...
r.get('/me', (req, res) => res.json({ id: req.user.sub, email: req.user.email }));

export default r;
