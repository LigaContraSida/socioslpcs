import crypto from 'crypto';
import { db } from './db.ts';
import { Request, Response } from 'express';

export interface UserSession {
  id: number;
  email: string;
  name: string;
  member_number: string;
  is_admin: number;
  is_suspended: number;
  birth_date: string;
  address: string;
  postal_code: string;
  city: string;
  nif: string;
  phone: string;
  google_id?: string | null;
  quota_status: {
    has_active_quota: boolean;
    status: 'valida' | 'expirar' | 'expirada' | 'sem_quota';
    valid_until: string | null;
    days_remaining: number;
    days_expired: number;
    progress_percentage: number;
    total_paid_count: number;
    total_paid_euros: number;
  };
}

// Portuguese NIF validation using modulo 11 algorithm
export function validateNif(nif: string): boolean {
  const clean = nif.trim();
  if (!/^[0-9]{9}$/.test(clean)) return false;

  const firstDigit = clean[0];
  // Allowed first digits in Portugal: 1, 2, 3 (individuals), 5 (enterprises), 6 (public bodies), 8 (non-residents), 9 (special/irregulares)
  if (!['1', '2', '3', '5', '6', '8', '9'].includes(firstDigit)) return false;

  let sum = 0;
  for (let i = 0; i < 8; i++) {
    sum += parseInt(clean[i], 10) * (9 - i);
  }

  const remainder = sum % 11;
  const checkDigit = remainder < 2 ? 0 : 11 - remainder;

  return checkDigit === parseInt(clean[8], 10);
}

// Portuguese phone validation: 9 digits starting with 91, 92, 93, 96
export function validatePortuguesePhone(phone: string): boolean {
  const clean = phone.replace(/\s+/g, '').replace(/^\+351/, '');
  return /^(91|92|93|96)[0-9]{7}$/.test(clean);
}

// Portuguese postal code: 0000-000
export function validatePostalCode(postalCode: string): boolean {
  return /^\d{4}-\d{3}$/.test(postalCode.trim());
}

// Minimum age check: 16 years old
export function validateAge(birthDateString: string): boolean {
  const birth = new Date(birthDateString);
  if (isNaN(birth.getTime())) return false;

  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age >= 16;
}

// Generate unique LPCS member number: LPCS-XXXXX
export function generateMemberNumber(): string {
  while (true) {
    const num = Math.floor(10000 + Math.random() * 90000);
    const memberNumber = `LPCS-${num}`;
    const exists = db.prepare('SELECT id FROM users WHERE member_number = ?').get(memberNumber);
    if (!exists) {
      return memberNumber;
    }
  }
}

// Calculate user's quota status and details
export function getQuotaStatus(userId: number) {
  // Query all quotas for user ordered by valid_until descending
  const quotas = db.prepare(`
    SELECT * FROM quotas 
    WHERE user_id = ? AND status = 'pago' 
    ORDER BY valid_until DESC
  `).all(userId) as Array<{
    id: number;
    plan_type: string;
    amount_cents: number;
    payment_method: string;
    reference: string;
    status: string;
    valid_from: string;
    valid_until: string;
    created_at: string;
  }>;

  const totalPaidCount = quotas.length;
  const totalPaidEuros = quotas.reduce((acc, q) => acc + q.amount_cents / 100, 0);

  if (quotas.length === 0) {
    return {
      has_active_quota: false,
      status: 'sem_quota' as const,
      valid_until: null,
      days_remaining: 0,
      days_expired: 0,
      progress_percentage: 0,
      total_paid_count: 0,
      total_paid_euros: 0,
    };
  }

  // Find the latest valid_until
  const latestQuota = quotas[0];
  const validUntilDate = new Date(latestQuota.valid_until + 'T23:59:59');
  const now = new Date();
  const diffTime = validUntilDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays > 0) {
    const isExpiring = diffDays <= 30;
    // Calculate progress percentage: assuming roughly 365 days max for full cycle
    const progress = Math.min(100, Math.max(5, Math.round((diffDays / 365) * 100)));

    return {
      has_active_quota: true,
      status: isExpiring ? ('expirar' as const) : ('valida' as const),
      valid_until: latestQuota.valid_until,
      days_remaining: diffDays,
      days_expired: 0,
      progress_percentage: progress,
      total_paid_count: totalPaidCount,
      total_paid_euros: totalPaidEuros,
    };
  } else {
    const daysExpired = Math.abs(diffDays);
    return {
      has_active_quota: false,
      status: 'expirada' as const,
      valid_until: latestQuota.valid_until,
      days_remaining: 0,
      days_expired: daysExpired,
      progress_percentage: 0,
      total_paid_count: totalPaidCount,
      total_paid_euros: totalPaidEuros,
    };
  }
}

function getCookieOptions(req: Request) {
  const forwardedProto = req.headers['x-forwarded-proto'];
  const isHttps =
    req.secure ||
    forwardedProto === 'https' ||
    (Array.isArray(forwardedProto) && forwardedProto.includes('https'));

  return {
    httpOnly: true,
    sameSite: (isHttps ? 'none' : 'lax') as 'none' | 'lax',
    secure: isHttps,
    path: '/',
  };
}

// Session management
export function createSession(userId: number, req: Request, res: Response): string {
  const token = crypto.randomBytes(32).toString('hex');
  // 30 days session
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  db.prepare(`
    INSERT INTO sessions (user_id, token, expires_at)
    VALUES (?, ?, ?)
  `).run(userId, token, expiresAt);

  res.cookie('lpcs_session', token, {
    ...getCookieOptions(req),
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });

  return token;
}

export function clearSession(req: Request, res: Response) {
  const token = req.cookies?.lpcs_session;
  if (token) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  }
  res.clearCookie('lpcs_session', getCookieOptions(req));
}

export function getSessionUser(req: Request): UserSession | null {
  const token = req.cookies?.lpcs_session;
  if (!token) return null;

  const session = db.prepare(`
    SELECT s.user_id, s.expires_at, u.*
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token = ?
  `).get(token) as any;

  if (!session) return null;

  // Check expiration
  if (new Date(session.expires_at).getTime() < Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return null;
  }

  // Check if suspended
  if (session.is_suspended) {
    return null;
  }

  const quota_status = getQuotaStatus(session.id);

  return {
    id: session.id,
    email: session.email,
    name: session.name,
    member_number: session.member_number,
    is_admin: session.is_admin,
    is_suspended: session.is_suspended,
    birth_date: session.birth_date,
    address: session.address,
    postal_code: session.postal_code,
    city: session.city,
    nif: session.nif,
    phone: session.phone,
    google_id: session.google_id,
    quota_status,
  };
}

export function isUserAdmin(user: UserSession | null): boolean {
  if (!user) return false;
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@lpcs.pt';
  return user.email.toLowerCase() === adminEmail.toLowerCase() && user.is_admin === 1;
}

// ==========================================
// PARTNER SESSION MANAGEMENT
// ==========================================

export interface PartnerSession {
  id: number;
  partner_id: number;
  email: string;
  contact_name: string | null;
  contact_role: string | null;
  partner_name: string;
  partner_category: string;
  discount_highlight: string;
  nif: string | null;
  address: string | null;
  city: string | null;
  district: string | null;
  protocol_duration: string;
  valid_until: string;
  protocol_in_force: boolean;
  has_partner_signed_protocol: boolean;
  partner_signed_protocol_name: string | null;
  partner_signed_protocol_uploaded_at: string | null;
  has_counter_signed_protocol: boolean;
  counter_signed_protocol_name: string | null;
  counter_signed_protocol_uploaded_at: string | null;
}

export function createPartnerSession(partnerAccountId: number, req: Request, res: Response): string {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  db.prepare(`
    INSERT INTO partner_sessions (partner_account_id, token, expires_at)
    VALUES (?, ?, ?)
  `).run(partnerAccountId, token, expiresAt);

  res.cookie('lpcs_partner_session', token, {
    ...getCookieOptions(req),
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });

  return token;
}

export function clearPartnerSession(req: Request, res: Response) {
  const token = req.cookies?.lpcs_partner_session;
  if (token) {
    db.prepare('DELETE FROM partner_sessions WHERE token = ?').run(token);
  }
  res.clearCookie('lpcs_partner_session', getCookieOptions(req));
}

export function getSessionPartner(req: Request): PartnerSession | null {
  const token = req.cookies?.lpcs_partner_session;
  if (!token) return null;

  const session = db.prepare(`
    SELECT ps.expires_at,
           pa.id, pa.partner_id, pa.email, pa.contact_name as acc_contact_name, pa.is_active as account_active,
           p.name as partner_name, p.category as partner_category,
           p.discount_highlight, p.is_active as partner_active, p.valid_until,
           p.nif, p.address, p.city, p.district, p.contact_name as p_contact_name, p.contact_role,
           p.protocol_duration,
           p.protocol_in_force,
           p.signed_protocol_name, p.signed_protocol_uploaded_at,
           length(p.signed_protocol_base64) as signed_len,
           p.counter_signed_protocol_name, p.counter_signed_protocol_uploaded_at,
           length(p.counter_signed_protocol_base64) as counter_signed_len
    FROM partner_sessions ps
    JOIN partner_accounts pa ON pa.id = ps.partner_account_id
    JOIN partners p ON p.id = pa.partner_id
    WHERE ps.token = ?
  `).get(token) as any;

  if (!session) return null;

  if (new Date(session.expires_at).getTime() < Date.now()) {
    db.prepare('DELETE FROM partner_sessions WHERE token = ?').run(token);
    return null;
  }

  if (!session.account_active) {
    return null;
  }

  const protocolInForce = Boolean(
    session.protocol_in_force === 1 || session.counter_signed_len > 0
  );

  return {
    id: session.id,
    partner_id: session.partner_id,
    email: session.email,
    contact_name: session.p_contact_name || session.acc_contact_name || null,
    contact_role: session.contact_role || null,
    partner_name: session.partner_name,
    partner_category: session.partner_category,
    discount_highlight: session.discount_highlight,
    nif: session.nif || null,
    address: session.address || null,
    city: session.city || null,
    district: session.district || null,
    protocol_duration: session.protocol_duration || 'um ano',
    valid_until: session.valid_until || '2027-12-31',
    protocol_in_force: protocolInForce,
    has_partner_signed_protocol: Boolean(session.signed_len > 0),
    partner_signed_protocol_name: session.signed_protocol_name || null,
    partner_signed_protocol_uploaded_at: session.signed_protocol_uploaded_at || null,
    has_counter_signed_protocol: Boolean(session.counter_signed_len > 0 || protocolInForce),
    counter_signed_protocol_name:
      session.counter_signed_protocol_name ||
      (protocolInForce ? `Protocolo_Assinado_LPCS_${session.partner_name.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf` : null),
    counter_signed_protocol_uploaded_at: session.counter_signed_protocol_uploaded_at || null,
  };
}
