import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { q } from '../db.js';

const TOKEN_TTL = '2h';

function sign(user) {
  return jwt.sign({ sub: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: TOKEN_TTL });
}

export async function signUp(req, res) {
  try {
    const { email, password, displayName } = req.body || {};
    if (!email || !password || !displayName) return res.status(400).json({ error: 'Thiếu tham số' });
    const exists = await q(`SELECT 1 FROM users WHERE email=$1`, [email]);
    if (exists.rowCount) return res.status(409).json({ error: 'Email đã tồn tại' });

    const hash = await bcrypt.hash(password, 10);
    const { rows } = await q(
      `INSERT INTO users (email, password_hash, display_name)
       VALUES ($1,$2,$3) RETURNING id, email, display_name`,
      [email, hash, displayName]
    );
    const user = rows[0];
    res.json({ user, accessToken: sign(user) });
  } catch (e) {
    res.status(500).json({ error: 'Lỗi server', detail: String(e) });
  }
}

export async function signIn(req, res) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Thiếu tham số' });

    const { rows } = await q(
      `SELECT id, email, password_hash, display_name FROM users WHERE email=$1`,
      [email]
    );
    const user = rows[0];
    if (!user) return res.status(400).json({ error: 'Email không tồn tại' });
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(400).json({ error: 'Sai mật khẩu' });

    res.json({
      user: { id: user.id, email: user.email, display_name: user.display_name },
      accessToken: sign(user),
    });
  } catch (e) {
    res.status(500).json({ error: 'Lỗi server', detail: String(e) });
  }
}
