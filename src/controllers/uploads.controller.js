import crypto from 'crypto';
import { q } from '../db.js';

export async function getUploadSignature(_req, res) {
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = process.env.CLOUDINARY_FOLDER || 'quickchat/avatars';
  const paramsToSign = { folder, timestamp };
  const toSign = Object.keys(paramsToSign).sort().map(k => `${k}=${paramsToSign[k]}`).join('&') + process.env.CLOUDINARY_API_SECRET;
  const signature = crypto.createHash('sha1').update(toSign).digest('hex');

  res.json({
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    folder, timestamp, signature
  });
}

export async function setMyAvatar(req, res) {
  const userId = req.user.sub;
  const { public_id, secure_url, bytes, width, height, format, resource_type } = req.body || {};
  if (!public_id || !secure_url) return res.status(400).json({ error: 'Thiếu thông tin file' });

  const asset = (await q(
    `INSERT INTO assets (kind, provider, provider_public_id, url, mime_type, bytes, width, height)
     VALUES ('avatar','cloudinary',$1,$2,$3,$4,$5,$6)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [public_id, secure_url, format ? `image/${format}` : null, bytes || null, width || null, height || null]
  )).rows[0];

  const assetId = asset?.id || (await q(
    `SELECT id FROM assets WHERE provider='cloudinary' AND provider_public_id=$1`,
    [public_id]
  )).rows[0]?.id;

  if (!assetId) return res.status(500).json({ error: 'Lưu asset thất bại' });

  await q(`UPDATE users SET avatar_asset_id=$1, updated_at=now() WHERE id=$2`, [assetId, userId]);
  res.json({ ok: true, asset_id: assetId, url: secure_url });
}
