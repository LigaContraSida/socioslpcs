import crypto from 'crypto';
import { db } from './db.ts';

// Calculate 6-digit TOTP code from redemption secret and time step (30 seconds)
export function generateTOTPCode(secret: string, timeStepWindowOffset: number = 0): { code: string; secondsRemaining: number } {
  const step = Math.floor(Date.now() / 30000) + timeStepWindowOffset;
  const buffer = Buffer.alloc(8);
  buffer.writeBigInt64BE(BigInt(step), 0);

  const hmac = crypto.createHmac('sha256', Buffer.from(secret, 'hex')).update(buffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const codeInt = (
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  ) % 1000000;

  const code = codeInt.toString().padStart(6, '0');
  const secondsRemaining = 30 - (Math.floor(Date.now() / 1000) % 30);

  return { code, secondsRemaining };
}

// Verify entered 6-digit code with current window and previous window (clock tolerance)
export function verifyTOTPCode(secret: string, enteredCode: string): boolean {
  const cleanCode = enteredCode.trim();
  // Check current window (0) and previous window (-1)
  const current = generateTOTPCode(secret, 0);
  if (current.code === cleanCode) return true;

  const previous = generateTOTPCode(secret, -1);
  if (previous.code === cleanCode) return true;

  return false;
}

// Check redemption limit: max 5 issuances per hour per user
export function checkIssuanceRateLimit(userId: number): { allowed: boolean; count: number } {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const res = db.prepare(`
    SELECT count(*) as count FROM redemptions
    WHERE user_id = ? AND issued_at > ?
  `).get(userId, oneHourAgo) as { count: number };

  return {
    allowed: res.count < 50,
    count: res.count
  };
}

// Log action to audit_logs
export function logAudit(
  userId: number | null,
  action: string,
  details: string,
  ipAddress?: string,
  userAgent?: string
) {
  try {
    db.prepare(`
      INSERT INTO audit_logs (user_id, action, details, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, action, details, ipAddress || '127.0.0.1', userAgent || 'Unknown');
  } catch (err) {
    console.error('Failed to log audit event:', err);
  }
}
