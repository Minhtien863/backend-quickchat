import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getUploadSignature, setMyAvatar } from '../controllers/uploads.controller.js';
const r = Router();
r.get('/signature', requireAuth, getUploadSignature);
r.put('/me/avatar', requireAuth, setMyAvatar);
export default r;
