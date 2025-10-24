import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { q } from '../db.js';
import { OAuth2Client } from 'google-auth-library';
import { cloudinary } from '../services/cloudinary.js';

const TOKEN_TTL = '2h';

const AUDIENCES = (process.env.GOOGLE_CLIENT_IDS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const googleClient = new OAuth2Client();

function sign(user) {
  return jwt.sign({ sub: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: TOKEN_TTL });
}

// OAuth2 client dùng Web Client ID/Secret
const oauth2 = new OAuth2Client(
  process.env.GOOGLE_OAUTH_CLIENT_ID,
  process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  'postmessage' // redirect URI đặc biệt cho app cài đặt
);
// Sign in with Google
export async function signInWithGoogleServerCode(req, res) {
  try {
    const { serverAuthCode } = req.body || {};
    if (!serverAuthCode) return res.status(400).json({ error: 'Thiếu serverAuthCode' });

    // 1) Đổi code lấy tokens
    const { tokens } = await oauth2.getToken({ code: serverAuthCode });
    const idToken = tokens.id_token;
    if (!idToken) return res.status(401).json({ error: 'Không nhận được id_token' });

    // 2) Verify id_token
    const ticket = await oauth2.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_OAUTH_CLIENT_ID,
    });
    const p = ticket.getPayload();
    if (!p?.email) return res.status(401).json({ error: 'Token không hợp lệ' });

    const sub = p.sub;
    const email = p.email;
    const emailVerified = !!p.email_verified;
    const name = p.name || 'User';
    const picture = p.picture;

    // 3) Upsert user (ưu tiên google_sub, sau đó email)
    let user = (await q(`SELECT id, email, display_name, avatar_asset_id FROM users WHERE google_sub=$1`, [sub])).rows[0];
    if (!user) {
      const existed = (await q(`SELECT id, email, display_name, avatar_asset_id FROM users WHERE email=$1`, [email])).rows[0];
      if (existed) {
        await q(`UPDATE users SET google_sub=$1, email_verified=$2 WHERE id=$3`, [sub, emailVerified, existed.id]);
        user = existed;
      } else {
        user = (await q(
          `INSERT INTO users (email, display_name, email_verified, google_sub, password_hash)
           VALUES ($1,$2,$3,$4,'') RETURNING id, email, display_name, avatar_asset_id`,
          [email, name, emailVerified, sub]
        )).rows[0];
      }
    }

    // 4) Mirror avatar Google về Cloudinary nếu user chưa có
    if (picture && !user.avatar_asset_id) {
      try {
        const uploaded = await cloudinary.uploader.upload(picture, {
          folder: process.env.CLOUDINARY_FOLDER || 'quickchat/avatars',
          resource_type: 'image', overwrite: true, invalidate: true
        });
        const asset = (await q(
          `INSERT INTO assets (kind, provider, provider_public_id, url, mime_type, bytes, width, height)
           VALUES ('avatar','cloudinary',$1,$2,$3,$4,$5,$6)
           ON CONFLICT DO NOTHING
           RETURNING id`,
          [uploaded.public_id, uploaded.secure_url, uploaded.format ? `image/${uploaded.format}` : null,
           uploaded.bytes || null, uploaded.width || null, uploaded.height || null]
        )).rows[0];
        if (asset?.id) await q(`UPDATE users SET avatar_asset_id=$1 WHERE id=$2`, [asset.id, user.id]);
      } catch { /* ignore mirror error */ }
    }

    return res.json({
      user: { id: user.id, email, display_name: user.display_name || name },
      accessToken: sign({ id: user.id, email }),
    });
  } catch (e) {
    return res.status(500).json({ error: 'Lỗi server', detail: String(e) });
  }
}

//SignUp
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


// SignIn
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
