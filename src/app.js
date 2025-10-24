import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes.js';
import { requireAuth } from './middleware/auth.js';
import uploadsRoutes from './routes/uploads.routes.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);

app.get('/api/whoami', requireAuth, (req, res) => res.json(req.user));

app.use('/api/uploads', uploadsRoutes);
export default app;
