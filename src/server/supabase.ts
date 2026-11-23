import 'dotenv/config';
import { db } from './db.ts';

export interface SupabaseStatus {
  configured: boolean;
  url: string | null;
  hasServiceRoleKey: boolean;
  hasAnonKey: boolean;
}

const DEFAULT_SUPABASE_URL = '';
const DEFAULT_SUPABASE_ANON_KEY = '';
const DEFAULT_SUPABASE_SERVICE_ROLE_KEY = '';

function normalizeSupabaseUrl(raw: string): string {
  return (raw || '')
    .trim()
    .replace(/\/rest\/v1\/?$/i, '')
    .replace(/\/+$/, '');
}

function ensureSettingsTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

function getSetting(key: string): string {
  try {
    ensureSettingsTable();
    const row = db.prepare('SELECT value FROM system_settings WHERE key = ?').get(key) as
      | { value: string }
      | undefined;
    return row?.value || '';
  } catch {
    return '';
  }
}

export function saveSupabaseConfig(input: {
  url: string;
  anonKey?: string;
  serviceRoleKey?: string;
}) {
  ensureSettingsTable();
  const upsert = db.prepare(`
    INSERT INTO system_settings (key, value, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
  `);

  const cleanUrl = normalizeSupabaseUrl(input.url);
  const cleanAnon = (input.anonKey || '').trim();
  const cleanService = (input.serviceRoleKey || '').trim();

  if (cleanUrl) {
    upsert.run('SUPABASE_URL', cleanUrl);
    process.env.SUPABASE_URL = cleanUrl;
  }
  if (cleanAnon) {
    upsert.run('SUPABASE_ANON_KEY', cleanAnon);
    process.env.SUPABASE_ANON_KEY = cleanAnon;
  }
  if (cleanService) {
    upsert.run('SUPABASE_SERVICE_ROLE_KEY', cleanService);
    process.env.SUPABASE_SERVICE_ROLE_KEY = cleanService;
  }
}

export function getSupabaseConfig(): SupabaseStatus & { apiKey: string | null } {
  const url = normalizeSupabaseUrl(
    getSetting('SUPABASE_URL') ||
      process.env.SUPABASE_URL ||
      process.env.VITE_SUPABASE_URL ||
      DEFAULT_SUPABASE_URL
  );
  const serviceRoleKey = (
    getSetting('SUPABASE_SERVICE_ROLE_KEY') ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    DEFAULT_SUPABASE_SERVICE_ROLE_KEY
  ).trim();
  const anonKey = (
    getSetting('SUPABASE_ANON_KEY') ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    DEFAULT_SUPABASE_ANON_KEY
  ).trim();
  const apiKey = serviceRoleKey || anonKey || null;

  return {
    configured: Boolean(url && apiKey),
    url: url || null,
    hasServiceRoleKey: Boolean(serviceRoleKey),
    hasAnonKey: Boolean(anonKey),
    apiKey,
  };
}

async function supabaseRestUpsert(table: string, rows: any[], onConflict = 'id') {
  const cfg = getSupabaseConfig();
  if (!cfg.configured || !cfg.url || !cfg.apiKey || rows.length === 0) {
    return { ok: false, skipped: true };
  }

  const endpoint = `${cfg.url}/rest/v1/${table}?on_conflict=${encodeURIComponent(onConflict)}`;
  const headers: Record<string, string> = {
    apikey: cfg.apiKey,
    'Content-Type': 'application/json',
    Prefer: 'resolution=merge-duplicates,return=minimal',
  };
  if (cfg.apiKey.startsWith('eyJ')) {
    headers.Authorization = `Bearer ${cfg.apiKey}`;
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(rows),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Supabase erro na tabela "${table}" (${res.status}): ${errText}`);
  }

  return { ok: true, count: rows.length };
}

export async function syncAllDataToSupabase() {
  const cfg = getSupabaseConfig();
  if (!cfg.configured) {
    return {
      ok: false,
      error:
        'Chaves do Supabase ainda não configuradas. Preencha o Project URL e a Service Role Key.',
    };
  }

  const users = (db.prepare('SELECT * FROM users').all() as any[]).map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    password_hash: u.password_hash,
    salt: u.salt,
    birth_date: u.birth_date,
    address: u.address,
    postal_code: u.postal_code,
    city: u.city,
    nif: u.nif,
    phone: u.phone,
    member_number: u.member_number,
    is_admin: Boolean(u.is_admin),
    is_suspended: Boolean(u.is_suspended),
    created_at: u.created_at,
  }));

  const quotas = (db.prepare('SELECT * FROM quotas').all() as any[]).map((q) => ({
    id: q.id,
    user_id: q.user_id,
    plan_type: q.plan_type,
    amount_cents: q.amount_cents,
    payment_method: q.payment_method,
    reference: q.reference,
    status: q.status,
    valid_from: q.valid_from,
    valid_until: q.valid_until,
    created_at: q.created_at,
  }));

  const partners = (db.prepare('SELECT * FROM partners').all() as any[]).map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    description: p.description,
    area: p.area,
    district: p.district,
    city: p.city,
    benefit_type: p.benefit_type,
    benefit_value: p.benefit_value,
    discount_highlight: p.discount_highlight,
    usage_limit: p.usage_limit,
    max_uses: p.max_uses,
    code_mode: p.code_mode || 'rotativo',
    estimated_annual_savings: p.estimated_annual_savings,
    valid_until: p.valid_until || '2027-12-31',
    terms: p.terms,
    website: p.website,
    is_active: Boolean(p.is_active),
    secret_code: p.secret_code,
    logo_mime: p.logo_mime,
    logo_base64: p.logo_base64,
    nif: p.nif,
    address: p.address,
    contact_name: p.contact_name,
    contact_role: p.contact_role,
    protocol_duration: p.protocol_duration || 'um ano',
    signed_protocol_name: p.signed_protocol_name,
    signed_protocol_mime: p.signed_protocol_mime,
    signed_protocol_base64: p.signed_protocol_base64,
    signed_protocol_uploaded_at: p.signed_protocol_uploaded_at,
    counter_signed_protocol_name: p.counter_signed_protocol_name,
    counter_signed_protocol_mime: p.counter_signed_protocol_mime,
    counter_signed_protocol_base64: p.counter_signed_protocol_base64,
    counter_signed_protocol_uploaded_at: p.counter_signed_protocol_uploaded_at,
    protocol_in_force: Boolean(p.protocol_in_force),
    created_at: p.created_at,
  }));

  const partnerAccounts = (db.prepare('SELECT * FROM partner_accounts').all() as any[]).map((pa) => ({
    id: pa.id,
    partner_id: pa.partner_id,
    email: pa.email,
    password_hash: pa.password_hash,
    salt: pa.salt,
    contact_name: pa.contact_name,
    is_active: Boolean(pa.is_active),
    created_at: pa.created_at,
    updated_at: pa.updated_at,
  }));

  const inquiries = (db.prepare('SELECT * FROM partner_inquiries').all() as any[]).map((inq) => ({
    id: inq.id,
    company_name: inq.company_name,
    nif: inq.nif,
    address: inq.address,
    contact_name: inq.contact_name,
    contact_role: inq.contact_role,
    email: inq.email,
    phone: inq.phone,
    area: inq.area,
    district: inq.district,
    city: inq.city,
    benefit_type: inq.benefit_type,
    proposed_benefit: inq.proposed_benefit,
    protocol_duration: inq.protocol_duration || 'um ano',
    valid_until: inq.valid_until || '2027-12-31',
    max_uses: inq.max_uses,
    code_mode: inq.code_mode || 'rotativo',
    proposed_code: inq.proposed_code,
    website: inq.website,
    notes: inq.notes,
    logo_name: inq.logo_name,
    logo_mime: inq.logo_mime,
    logo_base64: inq.logo_base64,
    signed_protocol_name: inq.signed_protocol_name,
    signed_protocol_mime: inq.signed_protocol_mime,
    signed_protocol_base64: inq.signed_protocol_base64,
    signed_protocol_uploaded_at: inq.signed_protocol_uploaded_at,
    counter_signed_protocol_name: inq.counter_signed_protocol_name,
    counter_signed_protocol_mime: inq.counter_signed_protocol_mime,
    counter_signed_protocol_base64: inq.counter_signed_protocol_base64,
    counter_signed_protocol_uploaded_at: inq.counter_signed_protocol_uploaded_at,
    status: inq.status,
    created_at: inq.created_at,
  }));

  const redemptions = (db.prepare('SELECT * FROM redemptions').all() as any[]).map((r) => ({
    id: r.id,
    partner_id: r.partner_id,
    user_id: r.user_id,
    secret_salt: r.secret_salt,
    reference_code: r.reference_code,
    issued_at: r.issued_at,
    expires_at: r.expires_at,
    status: r.status,
    used_at: r.used_at,
    used_by_merchant: r.used_by_merchant,
  }));

  await supabaseRestUpsert('users', users, 'id');
  await supabaseRestUpsert('quotas', quotas, 'id');
  await supabaseRestUpsert('partners', partners, 'id');
  await supabaseRestUpsert('partner_accounts', partnerAccounts, 'id');
  await supabaseRestUpsert('partner_inquiries', inquiries, 'id');
  await supabaseRestUpsert('redemptions', redemptions, 'id');

  return {
    ok: true,
    counts: {
      users: users.length,
      quotas: quotas.length,
      partners: partners.length,
      partner_accounts: partnerAccounts.length,
      partner_inquiries: inquiries.length,
      redemptions: redemptions.length,
    },
  };
}
