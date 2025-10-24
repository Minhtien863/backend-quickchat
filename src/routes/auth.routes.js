import { Router } from 'express';
import { signUp, signIn } from '../controllers/auth.controller.js';
const r = Router();
r.post('/signup', signUp);
r.post('/signin', signIn);
export default r;
