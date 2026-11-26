import Database from 'better-sqlite3';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';

const dbPath = path.resolve(process.cwd(), 'lpcs.db');
export const db = new Database(dbPath);

// Enable WAL mode and foreign key constraints for cascade deletes
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize database schema
export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      name TEXT NOT NULL,
      birth_date TEXT NOT NULL,
      address TEXT NOT NULL,
      postal_code TEXT NOT NULL,
      city TEXT NOT NULL,
      nif TEXT NOT NULL UNIQUE,
      phone TEXT NOT NULL,
      member_number TEXT NOT NULL UNIQUE,
      is_admin INTEGER NOT NULL DEFAULT 0,
      is_suspended INTEGER NOT NULL DEFAULT 0,
      google_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS quotas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      plan_type TEXT NOT NULL, -- 'semestral' | 'anual'
      amount_cents INTEGER NOT NULL,
      payment_method TEXT NOT NULL, -- 'mbway' | 'multibanco' | 'card' | 'transferencia' | 'manual'
      reference TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pago', -- 'pago' | 'pendente' | 'cancelado'
      valid_from TEXT NOT NULL,
      valid_until TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS receipts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      quota_id INTEGER REFERENCES quotas(id) ON DELETE SET NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      file_base64 TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS partners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      area TEXT NOT NULL, -- Saúde e Bem-estar, Desporto, Lazer e Cultura, Restauração e Alimentação, Formação e Educação, Serviços
      district TEXT NOT NULL,
      city TEXT NOT NULL,
      benefit_type TEXT NOT NULL, -- 'cupao' | 'codigo' | 'voucher'
      benefit_value TEXT NOT NULL, -- e.g. "5€ por compra (×6)", "25% em análises"
      discount_highlight TEXT NOT NULL, -- e.g. "25% de desconto", "50€ em tratamentos"
      usage_limit TEXT NOT NULL, -- e.g. "Até 6 utilizações por sócio", "Utilização contínua"
      estimated_annual_savings REAL NOT NULL DEFAULT 50.0,
      valid_until TEXT NOT NULL DEFAULT '2027-12-31',
      terms TEXT NOT NULL,
      website TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      secret_code TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS redemptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      partner_id INTEGER NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      secret_salt TEXT NOT NULL,
      reference_code TEXT NOT NULL UNIQUE,
      issued_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'used' | 'expired'
      used_at TEXT,
      used_by_merchant TEXT
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      action TEXT NOT NULL, -- 'emissao_codigo' | 'visualizacao_codigo' | 'validacao_sucesso' | 'validacao_falha' | 'quota_paga' | 'perfil_atualizado'
      details TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS partner_inquiries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_name TEXT NOT NULL,
      nif TEXT,
      address TEXT,
      contact_name TEXT NOT NULL,
      contact_role TEXT,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      area TEXT NOT NULL,
      district TEXT NOT NULL,
      city TEXT NOT NULL,
      benefit_type TEXT NOT NULL,
      proposed_benefit TEXT NOT NULL,
      valid_until TEXT NOT NULL DEFAULT '2027-12-31',
      website TEXT,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'pendente', -- 'pendente' | 'em_analise' | 'aprovada' | 'recusada'
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS partner_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      partner_id INTEGER NOT NULL UNIQUE REFERENCES partners(id) ON DELETE CASCADE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      contact_name TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS partner_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      partner_account_id INTEGER NOT NULL REFERENCES partner_accounts(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS partner_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      partner_id INTEGER NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      file_base64 TEXT NOT NULL,
      caption TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS partner_inquiry_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inquiry_id INTEGER NOT NULL REFERENCES partner_inquiries(id) ON DELETE CASCADE,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      file_base64 TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS email_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipient TEXT NOT NULL DEFAULT 'info@ligacontrasida.org',
      event_type TEXT NOT NULL, -- 'inscricao_socio' | 'inscricao_parceiro'
      subject TEXT NOT NULL,
      body_text TEXT NOT NULL,
      body_html TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'registado', -- 'enviado' | 'registado_sem_smtp' | 'erro'
      error_message TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
    CREATE INDEX IF NOT EXISTS idx_partner_sessions_token ON partner_sessions(token);
    CREATE INDEX IF NOT EXISTS idx_quotas_user ON quotas(user_id);
    CREATE INDEX IF NOT EXISTS idx_receipts_user ON receipts(user_id);
    CREATE INDEX IF NOT EXISTS idx_redemptions_ref ON redemptions(reference_code);
    CREATE INDEX IF NOT EXISTS idx_redemptions_user ON redemptions(user_id, partner_id);
    CREATE INDEX IF NOT EXISTS idx_partner_images_partner ON partner_images(partner_id);
    CREATE INDEX IF NOT EXISTS idx_partner_inquiry_images_inq ON partner_inquiry_images(inquiry_id);
  `);

  ensureColumn('partners', 'logo_mime', 'TEXT');
  ensureColumn('partners', 'logo_base64', 'TEXT');
  ensureColumn('partners', 'max_uses', 'INTEGER');
  ensureColumn('partners', 'code_mode', "TEXT DEFAULT 'rotativo'");
  ensureColumn('partners', 'nif', 'TEXT');
  ensureColumn('partners', 'address', 'TEXT');
  ensureColumn('partners', 'contact_name', 'TEXT');
  ensureColumn('partners', 'contact_role', 'TEXT');
  ensureColumn('partners', 'signed_protocol_name', 'TEXT');
  ensureColumn('partners', 'signed_protocol_mime', 'TEXT');
  ensureColumn('partners', 'signed_protocol_base64', 'TEXT');
  ensureColumn('partners', 'signed_protocol_uploaded_at', 'TEXT');
  ensureColumn('partners', 'counter_signed_protocol_name', 'TEXT');
  ensureColumn('partners', 'counter_signed_protocol_mime', 'TEXT');
  ensureColumn('partners', 'counter_signed_protocol_base64', 'TEXT');
  ensureColumn('partners', 'counter_signed_protocol_uploaded_at', 'TEXT');
  ensureColumn('partners', 'protocol_in_force', 'INTEGER DEFAULT 1');
  ensureColumn('partners', 'protocol_duration', "TEXT DEFAULT 'um ano'");

  ensureColumn('partner_inquiries', 'logo_name', 'TEXT');
  ensureColumn('partner_inquiries', 'logo_mime', 'TEXT');
  ensureColumn('partner_inquiries', 'logo_base64', 'TEXT');
  ensureColumn('partner_inquiries', 'max_uses', 'INTEGER');
  ensureColumn('partner_inquiries', 'code_mode', "TEXT DEFAULT 'rotativo'");
  ensureColumn('partner_inquiries', 'proposed_code', 'TEXT');
  ensureColumn('partner_inquiries', 'valid_until', "TEXT DEFAULT '2027-12-31'");
  ensureColumn('partner_inquiries', 'address', 'TEXT');
  ensureColumn('partner_inquiries', 'contact_role', 'TEXT');
  ensureColumn('partner_inquiries', 'protocol_duration', "TEXT DEFAULT 'um ano'");
  ensureColumn('partner_inquiries', 'signed_protocol_name', 'TEXT');
  ensureColumn('partner_inquiries', 'signed_protocol_mime', 'TEXT');
  ensureColumn('partner_inquiries', 'signed_protocol_base64', 'TEXT');
  ensureColumn('partner_inquiries', 'signed_protocol_uploaded_at', 'TEXT');

  ensureColumn('quotas', 'paid_at', 'TEXT');
  ensureColumn('quotas', 'confirmed_by', 'TEXT');
  ensureColumn('quotas', 'payment_details', 'TEXT');
  ensureColumn('partner_inquiries', 'counter_signed_protocol_name', 'TEXT');
  ensureColumn('partner_inquiries', 'counter_signed_protocol_mime', 'TEXT');
  ensureColumn('partner_inquiries', 'counter_signed_protocol_base64', 'TEXT');
  ensureColumn('partner_inquiries', 'counter_signed_protocol_uploaded_at', 'TEXT');

  seedData();
}

function ensureColumn(table: string, column: string, definition: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function getPartnerBrandTheme(name: string, category: string, area: string, seedIndex: number) {
  const brandPalettes = [
    { bg: '#ECFDF5', fg: '#064E3B', accent: '#059669', badge: '#D1FAE5' },
    { bg: '#EFF6FF', fg: '#1E3A8A', accent: '#2563EB', badge: '#DBEAFE' },
    { bg: '#FFF7ED', fg: '#7C2D12', accent: '#EA580C', badge: '#FFEDD5' },
    { bg: '#FEF2F2', fg: '#7F1D1D', accent: '#DC2626', badge: '#FEE2E2' },
    { bg: '#F5F3FF', fg: '#4C1D95', accent: '#7C3AED', badge: '#EDE9FE' },
    { bg: '#ECFEFF', fg: '#164E63', accent: '#0891B2', badge: '#CFFAFE' },
    { bg: '#FEFCE8', fg: '#713F12', accent: '#CA8A04', badge: '#FEF9C3' },
    { bg: '#F0FDF4', fg: '#14532D', accent: '#16A34A', badge: '#DCFCE7' },
    { bg: '#FDF2F8', fg: '#831843', accent: '#DB2777', badge: '#FCE7F3' },
    { bg: '#F8FAFC', fg: '#0F172A', accent: '#C81E2B', badge: '#E2E8F0' },
  ];

  const palette = brandPalettes[(seedIndex - 1) % brandPalettes.length] || brandPalettes[0];
  const lower = `${name} ${category} ${area}`.toLowerCase();

  let iconPath = '';
  if (lower.includes('farmácia') || lower.includes('farmacia')) {
    iconPath = `<path d="M54 20h12v10h10v12H66v10H54V42H44V30h10V20z" fill="${palette.accent}"/>`;
  } else if (lower.includes('análises') || lower.includes('laboratório') || lower.includes('genoteste')) {
    iconPath = `<path d="M52 18h16m-12 0v11l-10 17a4 4 0 003.5 6h21a4 4 0 003.5-6l-10-17V18" stroke="${palette.accent}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M47 42h26" stroke="${palette.accent}" stroke-width="3"/>`;
  } else if (lower.includes('dent') || lower.includes('sorri')) {
    iconPath = `<path d="M48 22c-5 0-8 4-8 10 0 8 4 18 7 18 2 0 3-5 5-5s3 5 5 5c3 0 7-10 7-18 0-6-3-10-8-10-3 0-5 2-8 2s-5-2-8-2z" stroke="${palette.accent}" stroke-width="3.5" fill="none"/>`;
  } else if (lower.includes('óptica') || lower.includes('ótica') || lower.includes('olhar') || lower.includes('visão')) {
    iconPath = `<circle cx="48" cy="36" r="9" stroke="${palette.accent}" stroke-width="3.5" fill="none"/><circle cx="72" cy="36" r="9" stroke="${palette.accent}" stroke-width="3.5" fill="none"/><path d="M57 36h6" stroke="${palette.accent}" stroke-width="3.5" stroke-linecap="round"/>`;
  } else if (lower.includes('ginásio') || lower.includes('fitness')) {
    iconPath = `<path d="M40 36h40M45 27v18M75 27v18M39 30v12M81 30v12" stroke="${palette.accent}" stroke-width="4" stroke-linecap="round"/>`;
  } else if (lower.includes('padel') || lower.includes('aqua') || lower.includes('natação')) {
    iconPath = `<circle cx="60" cy="34" r="13" stroke="${palette.accent}" stroke-width="3.5" fill="none"/><path d="M50 30c5 4 15 4 20 0M50 38c5-4 15-4 20 0" stroke="${palette.accent}" stroke-width="2.5" fill="none"/>`;
  } else if (lower.includes('restaurante') || lower.includes('bio') || lower.includes('horta') || lower.includes('nutri')) {
    iconPath = `<path d="M60 48V24c0-6 8-10 16-8 2 8-2 16-8 16H60zm0 0c0-8-6-14-14-14 0 8 6 14 14 14z" stroke="${palette.accent}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
  } else if (lower.includes('café') || lower.includes('aurora')) {
    iconPath = `<path d="M44 26h24v12a12 12 0 01-24 0V26zm24 3h4a5 5 0 010 10h-4M42 52h28" stroke="${palette.accent}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
  } else if (lower.includes('livraria') || lower.includes('formatech') || lower.includes('formação')) {
    iconPath = `<path d="M40 24c8-2 14 0 20 4 6-4 12-6 20-4v24c-8-2-14 0-20 4-6-4-12-6-20-4V24zm20 4v24" stroke="${palette.accent}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
  } else if (lower.includes('hotel') || lower.includes('viagens') || lower.includes('teatro')) {
    iconPath = `<path d="M60 20l4.5 9.2 10.1 1.5-7.3 7.1 1.7 10.1L60 43l-9 4.9 1.7-10.1-7.3-7.1 10.1-1.5L60 20z" stroke="${palette.accent}" stroke-width="3" stroke-linejoin="round" fill="none"/>`;
  } else {
    iconPath = `<path d="M60 20l16 6v11c0 9.5-6.8 17.8-16 20-9.2-2.2-16-10.5-16-20V26l16-6zm-6 18l4 4 9-9" stroke="${palette.accent}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
  }

  const cleanWords = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const initials =
    cleanWords.length >= 2
      ? (cleanWords[0][0] + cleanWords[1][0]).toUpperCase()
      : (cleanWords[0] || 'LP').slice(0, 2).toUpperCase();

  const shortBrand = cleanWords.slice(0, 2).join(' ').toUpperCase().slice(0, 14);

  return { palette, iconPath, initials, shortBrand };
}

function generatePartnerLogoSvg(name: string, area: string, seedIndex: number, category = ''): string {
  const { palette, iconPath, initials, shortBrand } = getPartnerBrandTheme(
    name,
    category,
    area,
    seedIndex
  );

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
  <rect width="120" height="120" rx="22" fill="${palette.bg}"/>
  <rect x="4" y="4" width="112" height="112" rx="18" fill="none" stroke="${palette.accent}" stroke-opacity="0.28" stroke-width="2"/>
  <circle cx="60" cy="36" r="22" fill="${palette.badge}"/>
  ${iconPath}
  <text x="60" y="83" text-anchor="middle" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="22" font-weight="800" letter-spacing="0.5" fill="${palette.fg}">${initials}</text>
  <text x="60" y="101" text-anchor="middle" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="8.5" font-weight="700" letter-spacing="0.8" fill="${palette.accent}">${shortBrand}</text>
</svg>`;
}

function generatePartnerShowcaseSvg(partner: {
  id: number;
  name: string;
  category: string;
  area: string;
  city: string;
  district: string;
  discount_highlight: string;
}): string {
  const { palette, iconPath, initials } = getPartnerBrandTheme(
    partner.name,
    partner.category,
    partner.area,
    partner.id
  );
  const safeName = partner.name.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const safeCat = partner.category.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const safeHighlight = partner.discount_highlight.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const safeLoc = `${partner.city} · ${partner.district}`.replace(/&/g, '&amp;');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" width="800" height="500">
  <defs>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${palette.bg}"/>
      <stop offset="100%" stop-color="#FFFFFF"/>
    </linearGradient>
  </defs>
  <rect width="800" height="500" fill="url(#bgGrad)"/>
  <circle cx="710" cy="90" r="180" fill="${palette.badge}" opacity="0.65"/>
  <circle cx="90" cy="440" r="140" fill="${palette.badge}" opacity="0.45"/>
  <rect x="44" y="40" width="712" height="420" rx="28" fill="#FFFFFF" fill-opacity="0.9" stroke="${palette.accent}" stroke-opacity="0.22" stroke-width="2"/>
  <g transform="translate(80, 74)">
    <rect width="88" height="88" rx="20" fill="${palette.bg}" stroke="${palette.accent}" stroke-opacity="0.3" stroke-width="2"/>
    <g transform="translate(-16, -2)">
      ${iconPath}
    </g>
    <text x="44" y="74" text-anchor="middle" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="16" font-weight="800" fill="${palette.fg}">${initials}</text>
  </g>
  <rect x="540" y="78" width="180" height="34" rx="17" fill="#C81E2B"/>
  <text x="630" y="100" text-anchor="middle" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="12" font-weight="700" letter-spacing="1.2" fill="#FFFFFF">PARCEIRO OFICIAL LPCS</text>
  <text x="84" y="212" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="14" font-weight="700" letter-spacing="1.5" fill="${palette.accent}">${safeCat.toUpperCase()}</text>
  <text x="84" y="260" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="38" font-weight="800" fill="#141619">${safeName}</text>
  <text x="84" y="296" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="18" font-weight="500" fill="#57534E">${safeLoc}</text>
  <rect x="84" y="332" width="632" height="90" rx="18" fill="${palette.bg}" stroke="${palette.accent}" stroke-opacity="0.3" stroke-width="1.5"/>
  <text x="112" y="366" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="13" font-weight="700" letter-spacing="1" fill="${palette.fg}">BENEFÍCIO EXCLUSIVO ASSOCIADOS LPCS</text>
  <text x="112" y="400" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="26" font-weight="800" fill="#C81E2B">${safeHighlight}</text>
</svg>`;
}

export function slugifyPartnerEmail(name: string): string {
  const baseSlug = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '') || 'parceiro';

  let candidate = `${baseSlug}@parceiro.lpcs.pt`;
  let counter = 2;
  while (db.prepare('SELECT id FROM partner_accounts WHERE email = ?').get(candidate)) {
    candidate = `${baseSlug}${counter}@parceiro.lpcs.pt`;
    counter++;
  }
  return candidate;
}

// Scrypt password hashing helper
export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(derived, 'hex'), Buffer.from(hash, 'hex'));
}

function seedData() {
  // Check if admin already exists
  const adminCheck = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@lpcs.pt');
  if (!adminCheck) {
    const adminPass = hashPassword('Admin!2026');
    db.prepare(`
      INSERT INTO users (
        email, password_hash, salt, name, birth_date, address, postal_code,
        city, nif, phone, member_number, is_admin, is_suspended
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0)
    `).run(
      'admin@lpcs.pt',
      adminPass.hash,
      adminPass.salt,
      'Administrador LPCS',
      '1980-05-15',
      'Rua de Santa Maria Maior, 42',
      '1100-001',
      'Lisboa',
      '123456789', // Special admin seed NIF
      '912345678',
      'LPCS-00001'
    );
  }

  // Check if demo member exists
  const demoCheck = db.prepare('SELECT id FROM users WHERE email = ?').get('demo@lpcs.pt');
  let demoUserId: number;
  if (!demoCheck) {
    const demoPass = hashPassword('demo1234');
    const result = db.prepare(`
      INSERT INTO users (
        email, password_hash, salt, name, birth_date, address, postal_code,
        city, nif, phone, member_number, is_admin, is_suspended
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)
    `).run(
      'demo@lpcs.pt',
      demoPass.hash,
      demoPass.salt,
      'Ana Maria Silva Ferreira',
      '1992-04-18',
      'Avenida da Liberdade, 120, 3º Dto',
      '1250-142',
      'Lisboa',
      '234567890',
      '961234567',
      'LPCS-10842'
    );
    demoUserId = Number(result.lastInsertRowid);

    // Seed 1 expired semestral quota (from 18 months ago to 12 months ago)
    const pastStart = new Date(Date.now() - 540 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const pastEnd = new Date(Date.now() - 360 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    db.prepare(`
      INSERT INTO quotas (
        user_id, plan_type, amount_cents, payment_method, reference, status, valid_from, valid_until
      ) VALUES (?, 'semestral', 1750, 'multibanco', '21876-948102847', 'pago', ?, ?)
    `).run(demoUserId, pastStart, pastEnd);

    // Seed 1 active annual quota valid until next year
    const nowStart = new Date().toISOString().split('T')[0];
    const activeEnd = new Date(Date.now() + 320 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const quotaRes = db.prepare(`
      INSERT INTO quotas (
        user_id, plan_type, amount_cents, payment_method, reference, status, valid_from, valid_until
      ) VALUES (?, 'anual', 3500, 'mbway', 'MBWAY-961234567', 'pago', ?, ?)
    `).run(demoUserId, nowStart, activeEnd);

    const quotaId = Number(quotaRes.lastInsertRowid);

    // Seed 1 archived sample receipt for demo user
    const sampleReceiptBase64 = Buffer.from(
      `LIGA PORTUGUESA CONTRA A SIDA\nRecibo de Quota Anual 2026\nSócio: Ana Maria Silva Ferreira (LPCS-10842)\nNIF: 234567890\nValor: 35.00 EUR (Isento de IVA art. 9º CIVA)\nData: ${nowStart}\nObrigado pelo seu apoio à nossa causa!`
    ).toString('base64');

    db.prepare(`
      INSERT INTO receipts (
        user_id, quota_id, original_name, mime_type, file_size, file_base64, notes
      ) VALUES (?, ?, 'Recibo_Quota_LPCS_2026.pdf', 'application/pdf', 2048, ?, 'Recibo oficial da quota anual de 35,00€')
    `).run(demoUserId, quotaId, sampleReceiptBase64);
  }

  // Seed the 28 partners specified in requirements
  const partnersCount = db.prepare('SELECT count(*) as count FROM partners').get() as { count: number };
  if (partnersCount.count < 28) {
    db.prepare('DELETE FROM partners').run();

    const initialPartners = [
      {
        name: 'Farmácia Saúde+',
        category: 'Farmácias & Parafarmácia',
        area: 'Saúde e Bem-estar',
        district: 'Lisboa',
        city: 'Lisboa',
        benefit_type: 'cupao',
        benefit_value: '5€ por compra (×6)',
        discount_highlight: '5€ de desconto por compra',
        usage_limit: 'Cupão de 5,00€ · até 6 utilizações por ano',
        estimated_annual_savings: 30.0,
        secret_code: 'FARMA5',
        terms: 'Válido em compras superiores a 25€ em produtos de saúde e bem-estar. Não acumulável com outras campanhas.',
        description: 'Rede de farmácias com aconselhamento farmacêutico dedicado, dermocosmética e testes rápidos preventivos.'
      },
      {
        name: 'Clínica Vida Lab',
        category: 'Análises Clínicas',
        area: 'Saúde e Bem-estar',
        district: 'Lisboa',
        city: 'Lisboa',
        benefit_type: 'codigo',
        benefit_value: '25% em análises',
        discount_highlight: '25% de desconto em análises',
        usage_limit: 'Código de desconto · Utilização contínua',
        estimated_annual_savings: 45.0,
        secret_code: 'VIDA25',
        terms: 'Aplicável a todas as análises clínicas gerais e rastreios de infeções sexualmente transmissíveis.',
        description: 'Laboratório de análises clínicas moderno e discreto com resultados rápidos online e atendimento humanizado.'
      },
      {
        name: 'Centro Diagnóstico Norte',
        category: 'Diagnóstico & Imagiologia',
        area: 'Saúde e Bem-estar',
        district: 'Porto',
        city: 'Porto',
        benefit_type: 'voucher',
        benefit_value: '1 exame gratuito',
        discount_highlight: '1 exame gratuito',
        usage_limit: 'Voucher nominal · Uso único por associado',
        estimated_annual_savings: 60.0,
        secret_code: 'DIAGNOR',
        terms: 'Válido para ecografia simples, eletrocardiograma ou rastreio cardiológico mediante marcação prévia.',
        description: 'Centro de referência no norte do país para exames de diagnóstico de alta resolução com tecnologia de ponta.'
      },
      {
        name: 'Ginásio BodyFit',
        category: 'Fitness & Ginásios',
        area: 'Desporto',
        district: 'Lisboa',
        city: 'Amadora',
        benefit_type: 'codigo',
        benefit_value: '30% na mensalidade',
        discount_highlight: '30% de desconto na mensalidade',
        usage_limit: 'Código de desconto · Utilização contínua mensal',
        estimated_annual_savings: 144.0,
        secret_code: 'FIT30',
        terms: 'Desconto direto nas mensalidades com livre-trânsito. Isenção de jóia de inscrição para sócios LPCS.',
        description: 'Clube de fitness com sala de musculação completa, aulas de grupo variadas e acompanhamento personalizado.'
      },
      {
        name: 'Padel Club Lisboa',
        category: 'Clubes de Padel & Ténis',
        area: 'Desporto',
        district: 'Lisboa',
        city: 'Lisboa',
        benefit_type: 'voucher',
        benefit_value: '1 hora de campo grátis',
        discount_highlight: '1 hora de campo gratuita',
        usage_limit: 'Voucher nominal · Uso único',
        estimated_annual_savings: 28.0,
        secret_code: 'PADELVC',
        terms: 'Válido para reservas de segunda a sexta entre as 09h e as 17h. Inclui empréstimo de raquetes e bolas.',
        description: 'Complexo desportivo com 8 campos cobertos panorâmicos de padel, balneários de luxo e zona lounge.'
      },
      {
        name: 'Óptica Visão Clara',
        category: 'Ópticas & Oftalmologia',
        area: 'Saúde e Bem-estar',
        district: 'Porto',
        city: 'Matosinhos',
        benefit_type: 'codigo',
        benefit_value: '20% + consulta grátis',
        discount_highlight: '20% em armações e lentes + consulta grátis',
        usage_limit: 'Código de desconto · Utilização contínua',
        estimated_annual_savings: 70.0,
        secret_code: 'VER20',
        terms: 'Inclui exame visual completo gratuito e 20% de desconto em armações, lentes oftálmicas e óculos de sol.',
        description: 'Especialistas em optometria clínica e contactologia com vasta seleção das melhores marcas internacionais.'
      },
      {
        name: 'Dental Sorriso',
        category: 'Medicina Dentária',
        area: 'Saúde e Bem-estar',
        district: 'Lisboa',
        city: 'Oeiras',
        benefit_type: 'cupao',
        benefit_value: '10€ por consulta (×4)',
        discount_highlight: '10€ de desconto por consulta',
        usage_limit: 'Cupão de 10,00€ · até 4 consultas por ano',
        estimated_annual_savings: 40.0,
        secret_code: 'SORRI10',
        terms: 'Válido em limpezas dentárias, restaurações, destartarizações e tratamentos de prevenção oral.',
        description: 'Clínica dentária familiar com ambiente relaxante, tecnologia indolor e especialistas em todas as áreas.'
      },
      {
        name: 'Psicologia Ponto de Apoio',
        category: 'Saúde Mental & Psicologia',
        area: 'Saúde e Bem-estar',
        district: 'Nacional',
        city: 'Online',
        benefit_type: 'voucher',
        benefit_value: '1ª consulta gratuita',
        discount_highlight: '1ª consulta de psicologia gratuita',
        usage_limit: 'Voucher nominal · Uso único por associado',
        estimated_annual_savings: 50.0,
        secret_code: 'PSIVOU',
        terms: 'Primeira sessão de avaliação psicológica e aconselhamento emocional online totalmente gratuita (50 min).',
        description: 'Rede de psicólogos clínicos certificados especializados em ansiedade, gestão de stress e apoio psicossocial.'
      },
      {
        name: 'Restaurante Terra Verde',
        category: 'Restauração Saudável & Bio',
        area: 'Restauração e Alimentação',
        district: 'Lisboa',
        city: 'Lisboa',
        benefit_type: 'cupao',
        benefit_value: '3€ na refeição (×10)',
        discount_highlight: '3€ de desconto na refeição',
        usage_limit: 'Cupão de 3,00€ · até 10 utilizações por ano',
        estimated_annual_savings: 30.0,
        secret_code: 'TERRA3',
        terms: 'Válido em consumos superiores a 15€ ao almoço ou jantar. Não acumulável com menus do dia promocionais.',
        description: 'Cozinha mediterrânica saudável, ingredientes de época de produtores locais e opções vegetarianas e vegan.'
      },
      {
        name: 'Café Solidário Aurora',
        category: 'Cafés & Pastelarias',
        area: 'Restauração e Alimentação',
        district: 'Coimbra',
        city: 'Coimbra',
        benefit_type: 'codigo',
        benefit_value: '15% na conta',
        discount_highlight: '15% de desconto na fatura',
        usage_limit: 'Código de desconto · Utilização contínua',
        estimated_annual_savings: 24.0,
        secret_code: 'AURO15',
        terms: 'Válido todos os dias em cafetaria, pastelaria artesanal, pequenos-almoços e lanches ligeiros.',
        description: 'Espaço cultural e café com história no centro de Coimbra, famoso pela sua pastelaria tradicional e ambiente calmo.'
      },
      {
        name: 'Livraria Página Viva',
        category: 'Livrarias & Papelarias',
        area: 'Lazer e Cultura',
        district: 'Porto',
        city: 'Porto',
        benefit_type: 'codigo',
        benefit_value: '10% em livros',
        discount_highlight: '10% de desconto em livros e artigos',
        usage_limit: 'Código de desconto · Utilização contínua',
        estimated_annual_savings: 20.0,
        secret_code: 'PAGINA10',
        terms: 'Desconto direto em todos os livros que cumpram a Lei do Preço Fixo e 15% em artigos de papelaria e agendas.',
        description: 'Livraria independente com curadoria literária, secções especializadas em direitos humanos, ficção e ensaio.'
      },
      {
        name: 'Teatro Municipal Estrela',
        category: 'Teatro & Espetáculos',
        area: 'Lazer e Cultura',
        district: 'Lisboa',
        city: 'Lisboa',
        benefit_type: 'voucher',
        benefit_value: '2 bilhetes por 1',
        discount_highlight: '2 bilhetes pelo preço de 1',
        usage_limit: 'Voucher nominal · Válido para 1 espetáculo da temporada',
        estimated_annual_savings: 25.0,
        secret_code: 'TEATRO2X1',
        terms: 'Na compra de 1 bilhete em plateia, receba outro de igual valor. Sujeito à lotação disponível.',
        description: 'Teatro histórico com programação contínua de peças contemporâneas, clássicos e concertos intimistas.'
      },
      {
        name: 'Hotel Costa Azul',
        category: 'Hotelaria & Alojamento',
        area: 'Lazer e Cultura',
        district: 'Faro',
        city: 'Albufeira',
        benefit_type: 'codigo',
        benefit_value: '18% em reservas',
        discount_highlight: '18% de desconto em estadias',
        usage_limit: 'Código de desconto · Utilização contínua',
        estimated_annual_savings: 90.0,
        secret_code: 'COSTA18',
        terms: 'Válido em estadias de no mínimo 2 noites reservadas no website oficial. Inclui pequeno-almoço buffet.',
        description: 'Hotel de 4 estrelas junto à praia com piscina panorâmica, spa relaxante e ambiente acolhedor no Algarve.'
      },
      {
        name: 'RentaCar Atlântico',
        category: 'Mobilidade & Aluguer de Carros',
        area: 'Serviços',
        district: 'Nacional',
        city: 'Nacional',
        benefit_type: 'cupao',
        benefit_value: '20€ por aluguer (×3)',
        discount_highlight: '20€ de desconto por aluguer',
        usage_limit: 'Cupão de 20,00€ · até 3 utilizações anuais',
        estimated_annual_savings: 60.0,
        secret_code: 'ATL20',
        terms: 'Aplicável em reservas a partir de 3 dias de aluguer em qualquer estação de norte a sul do país.',
        description: 'Frota automóvel recente, veículos económicos, elétricos e familiares com seguro incluído sem franquias ocultas.'
      },
      {
        name: 'Seguros Confiança',
        category: 'Mediação de Seguros',
        area: 'Serviços',
        district: 'Nacional',
        city: 'Online',
        benefit_type: 'codigo',
        benefit_value: '12% na apólice',
        discount_highlight: '12% de desconto anual na apólice',
        usage_limit: 'Código de desconto · Aplicação na anuidade',
        estimated_annual_savings: 48.0,
        secret_code: 'CONF12',
        terms: 'Válido para novos seguros de saúde, automóvel ou multirriscos habitação contratados online.',
        description: 'Mediação independente de seguros com assessoria personalizada na escolha da melhor proteção familiar.'
      },
      {
        name: 'Advocacia Direitos+',
        category: 'Serviços Jurídicos',
        area: 'Serviços',
        district: 'Lisboa',
        city: 'Lisboa',
        benefit_type: 'voucher',
        benefit_value: 'consulta jurídica grátis',
        discount_highlight: '1 consulta jurídica inicial gratuita',
        usage_limit: 'Voucher nominal · Uso único por associado',
        estimated_annual_savings: 80.0,
        secret_code: 'JURVOU',
        terms: 'Sessão presencial ou online de esclarecimento e enquadramento jurídico de 60 minutos sem qualquer encargo.',
        description: 'Sociedade de advogados com prática em direito laboral, proteção de dados, direito civil e do consumidor.'
      },
      {
        name: 'FormaTech Academy',
        category: 'Formação Digital & Cursos',
        area: 'Formação e Educação',
        district: 'Nacional',
        city: 'Online',
        benefit_type: 'cupao',
        benefit_value: '25€ por curso (×2)',
        discount_highlight: '25€ de desconto por inscrição',
        usage_limit: 'Cupão de 25,00€ · até 2 cursos por ano',
        estimated_annual_savings: 50.0,
        secret_code: 'FORMA25',
        terms: 'Válido em bootcamps e cursos certificados de programação, marketing digital, excel avançado e design UX.',
        description: 'Academia de formação online com tutoria em direto, projetos práticos e certificados reconhecidos no mercado.'
      },
      {
        name: 'Mercado Bio Horta',
        category: 'Produtos Biológicos & Mercearia',
        area: 'Restauração e Alimentação',
        district: 'Braga',
        city: 'Braga',
        benefit_type: 'codigo',
        benefit_value: '8% em cabazes',
        discount_highlight: '8% de desconto em cabazes biológicos',
        usage_limit: 'Código de desconto · Utilização contínua',
        estimated_annual_savings: 35.0,
        secret_code: 'HORTA8',
        terms: 'Aplicável na encomenda semanal de cabazes de fruta e legumes biológicos certificados de época.',
        description: 'Mercearia bio com produtos frescos colhidos no Minho, azeite biológico, sementes e cosmética natural.'
      },
      {
        name: 'Farmácia Central Ribeira',
        category: 'Farmácias & Parafarmácia',
        area: 'Saúde e Bem-estar',
        district: 'Porto',
        city: 'Porto',
        benefit_type: 'cupao',
        benefit_value: '7,50€ por compra (×8)',
        discount_highlight: '7,50€ de desconto por compra',
        usage_limit: 'Cupão de 7,50€ · até 8 utilizações por ano',
        estimated_annual_savings: 60.0,
        secret_code: 'RIBEIRA750',
        terms: 'Válido em compras acima de 30€ em produtos de saúde, dermocosmética e suplementação alimentar.',
        description: 'Farmácia histórica no coração do Porto com serviço farmacêutico atento e entregas ao domicílio no Grande Porto.'
      },
      {
        name: 'Fisioterapia MoveBem',
        category: 'Fisioterapia & Reabilitação',
        area: 'Saúde e Bem-estar',
        district: 'Setúbal',
        city: 'Almada',
        benefit_type: 'codigo',
        benefit_value: '22% em pacotes',
        discount_highlight: '22% de desconto em tratamentos e pacotes',
        usage_limit: 'Código de desconto · Utilização contínua',
        estimated_annual_savings: 66.0,
        secret_code: 'MOVE22',
        terms: 'Válido em sessões avulsas e packs de fisioterapia músculo-esquelética, pilates clínico e drenagem linfática.',
        description: 'Clínica de reabilitação física com profissionais qualificados dedicados à recuperação funcional e alívio da dor.'
      },
      {
        name: 'Nutricionista Bem-Estar',
        category: 'Nutrição & Dietética',
        area: 'Saúde e Bem-estar',
        district: 'Nacional',
        city: 'Online',
        benefit_type: 'voucher',
        benefit_value: '1ª consulta + plano',
        discount_highlight: '1ª consulta de nutrição + plano alimentar gratuito',
        usage_limit: 'Voucher nominal · Uso único por associado',
        estimated_annual_savings: 55.0,
        secret_code: 'NUTRIVOU',
        terms: 'Inclui anamnese nutricional completa, avaliação de hábitos e entrega de plano alimentar individualizado.',
        description: 'Nutricionistas credenciados com foco em reeducação alimentar, saúde metabólica e bem-estar duradouro.'
      },
      {
        name: 'Laboratório GenoTeste',
        category: 'Genética & Diagnóstico Avançado',
        area: 'Saúde e Bem-estar',
        district: 'Lisboa',
        city: 'Lisboa',
        benefit_type: 'codigo',
        benefit_value: '35% em análises',
        discount_highlight: '35% de desconto em exames laboratoriais',
        usage_limit: 'Código de desconto · Utilização contínua',
        estimated_annual_savings: 70.0,
        secret_code: 'GENO35',
        terms: 'Desconto aplicável em painéis completos de sangue, testes serológicos e despiste precoce de patologias.',
        description: 'Laboratório de biologia molecular e genética clínica de elevada precisão e confidencialidade estrita.'
      },
      {
        name: 'Clínica Dentária SorriMais',
        category: 'Medicina Dentária Avançada',
        area: 'Saúde e Bem-estar',
        district: 'Coimbra',
        city: 'Coimbra',
        benefit_type: 'cupao',
        benefit_value: '50€ em tratamentos (×2)',
        discount_highlight: '50€ de desconto em tratamentos dentários',
        usage_limit: 'Cupão de 50,00€ · até 2 utilizações por ano',
        estimated_annual_savings: 100.0,
        secret_code: 'SORRIMAIS50',
        terms: 'Válido para tratamentos dentários superiores a 150€ (ortodontia, implantes, branqueamento ou coroas).',
        description: 'Centro de implantologia e estética dentária com mais de 15 anos de excelência clínica no centro de Portugal.'
      },
      {
        name: 'Academia Aqua Viva',
        category: 'Natação & Desportos Aquáticos',
        area: 'Desporto',
        district: 'Faro',
        city: 'Faro',
        benefit_type: 'voucher',
        benefit_value: '1 mês de aulas grátis',
        discount_highlight: '1 mês de aulas de hidroginástica/natação gratuito',
        usage_limit: 'Voucher nominal · Uso único por associado',
        estimated_annual_savings: 45.0,
        secret_code: 'AQUAVIVA1M',
        terms: 'Válido para frequência 2 vezes por semana em natação livre ou aulas de hidroginástica durante 30 dias consecutivos.',
        description: 'Complexo aquático com piscinas tratadas com sal, temperatura controlada e escola de natação para todas as idades.'
      },
      {
        name: 'Ótica Novo Olhar',
        category: 'Ópticas & Armações',
        area: 'Saúde e Bem-estar',
        district: 'Braga',
        city: 'Guimarães',
        benefit_type: 'codigo',
        benefit_value: '28% em lentes',
        discount_highlight: '28% de desconto em lentes graduadas',
        usage_limit: 'Código de desconto · Utilização contínua',
        estimated_annual_savings: 84.0,
        secret_code: 'OLHAR28',
        terms: 'Aplicável em lentes monofocais e progressivas digitais de alta gama com tratamento antirreflexo.',
        description: 'Centro ótico tradicional em Guimarães com oficina própria de montagem rápida e tecnologia de centração 3D.'
      },
      {
        name: 'Livraria & Café Semear',
        category: 'Livrarias & Lazer',
        area: 'Lazer e Cultura',
        district: 'Porto',
        city: 'V. N. Gaia',
        benefit_type: 'cupao',
        benefit_value: '4€ por compra (×12)',
        discount_highlight: '4€ de desconto por compra mensal',
        usage_limit: 'Cupão de 4,00€ · até 12 utilizações por ano (1 por mês)',
        estimated_annual_savings: 48.0,
        secret_code: 'SEMEAR4',
        terms: 'Válido em compras de livros e artigos culturais a partir de 20€. Não acumulável com saldos.',
        description: 'Espaço comunitário acolhedor com esplanada, livros selecionados, workshops mensais e cafetaria biológica.'
      },
      {
        name: 'Viagens Horizonte Aberto',
        category: 'Agências de Viagens & Turismo',
        area: 'Lazer e Cultura',
        district: 'Nacional',
        city: 'Online',
        benefit_type: 'voucher',
        benefit_value: '75€ na próxima viagem',
        discount_highlight: '75€ de desconto em pacotes de viagem',
        usage_limit: 'Voucher nominal · Uso único por associado',
        estimated_annual_savings: 75.0,
        secret_code: 'HORIZ75',
        terms: 'Válido em pacotes turísticos de voo + hotel a partir de 500€ em destinos nacionais e internacionais.',
        description: 'Agência de viagens especializada em turismo sustentável, escapadinhas na natureza e viagens à medida.'
      },
      {
        name: 'Cabeleireiro Studio Raiz',
        category: 'Estética & Cabeleireiro',
        area: 'Saúde e Bem-estar',
        district: 'Setúbal',
        city: 'Setúbal',
        benefit_type: 'codigo',
        benefit_value: '20% em serviços',
        discount_highlight: '20% de desconto em corte e tratamentos',
        usage_limit: 'Código de desconto · Utilização contínua',
        estimated_annual_savings: 36.0,
        secret_code: 'RAIZ20',
        terms: 'Válido em serviços de corte, coloração biológica e tratamentos capilares de hidratação profunda.',
        description: 'Salão de beleza sustentável que utiliza produtos vegan e cruelty-free num ambiente relaxante e profissional.'
      }
    ];

    const stmt = db.prepare(`
      INSERT INTO partners (
        name, category, area, district, city, benefit_type, benefit_value,
        discount_highlight, usage_limit, estimated_annual_savings, secret_code,
        terms, description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const p of initialPartners) {
      stmt.run(
        p.name,
        p.category,
        p.area,
        p.district,
        p.city,
        p.benefit_type,
        p.benefit_value,
        p.discount_highlight,
        p.usage_limit,
        p.estimated_annual_savings,
        p.secret_code,
        p.terms,
        p.description
      );
    }
  }

  // Ensure every partner has a partner_accounts login entry
  const partnersWithoutAccount = db
    .prepare(
      `
      SELECT p.id, p.name
      FROM partners p
      LEFT JOIN partner_accounts pa ON pa.partner_id = p.id
      WHERE pa.id IS NULL
    `
    )
    .all() as Array<{ id: number; name: string }>;

  if (partnersWithoutAccount.length > 0) {
    const insertAccountStmt = db.prepare(`
      INSERT INTO partner_accounts (partner_id, email, password_hash, salt, contact_name, is_active)
      VALUES (?, ?, ?, ?, ?, 1)
    `);
    for (const p of partnersWithoutAccount) {
      const email = slugifyPartnerEmail(p.name);
      const { hash, salt } = hashPassword('Parceiro!2026');
      insertAccountStmt.run(p.id, email, hash, salt, `Equipa ${p.name}`);
    }
  }

  // Ensure every partner has max_uses and code_mode populated
  const partnersMissingRules = db
    .prepare(
      "SELECT id, name, benefit_type, benefit_value, usage_limit, max_uses, code_mode FROM partners WHERE max_uses IS NULL OR code_mode IS NULL OR (benefit_type = 'codigo' AND code_mode = 'rotativo' AND usage_limit LIKE '%Utilização contínua%')"
    )
    .all() as Array<{
      id: number;
      name: string;
      benefit_type: string;
      benefit_value: string;
      usage_limit: string;
      max_uses: number | null;
      code_mode: string | null;
    }>;

  if (partnersMissingRules.length > 0) {
    const updateRuleStmt = db.prepare(
      'UPDATE partners SET max_uses = ?, code_mode = ?, usage_limit = ? WHERE id = ?'
    );
    for (const p of partnersMissingRules) {
      let maxUses = p.max_uses;
      if (!maxUses || maxUses <= 0) {
        const match = `${p.benefit_value} ${p.usage_limit}`.match(/(?:×|até\s+)(\d+)/i);
        if (match) {
          maxUses = parseInt(match[1], 10);
        } else if (p.benefit_type === 'voucher') {
          maxUses = 1;
        } else {
          maxUses = 5;
        }
      }

      const codeMode = p.benefit_type === 'codigo' ? 'codigo_unico' : 'rotativo';

      let updatedUsageLimit = p.usage_limit;
      if (codeMode === 'codigo_unico' && !updatedUsageLimit.toLowerCase().includes('utiliza')) {
        updatedUsageLimit = `Código único · até ${maxUses} utilizações por sócio`;
      } else if (codeMode === 'codigo_unico' && updatedUsageLimit.includes('Utilização contínua')) {
        updatedUsageLimit = `Código único · até ${maxUses} utilizações por sócio`;
      }

      updateRuleStmt.run(maxUses, codeMode, updatedUsageLimit, p.id);
    }
  }

  // Ensure every seeded partner has a crisp brand logo with bespoke emblem
  const allSeededForLogos = db
    .prepare(
      "SELECT id, name, category, area, logo_mime FROM partners WHERE logo_base64 IS NULL OR logo_mime = 'image/svg+xml'"
    )
    .all() as Array<{ id: number; name: string; category: string; area: string; logo_mime: string | null }>;

  if (allSeededForLogos.length > 0) {
    const updateLogoStmt = db.prepare(
      'UPDATE partners SET logo_mime = ?, logo_base64 = ? WHERE id = ?'
    );
    for (const p of allSeededForLogos) {
      const svg = generatePartnerLogoSvg(p.name, p.area, p.id, p.category);
      updateLogoStmt.run('image/svg+xml', Buffer.from(svg, 'utf8').toString('base64'), p.id);
    }
  }

  // Ensure ALL partners have demonstration images (photographic + brand showcase)
  const partnersMissingImages = db
    .prepare(
      `
      SELECT p.id, p.name, p.area, p.category, p.city, p.district, p.discount_highlight
      FROM partners p
      LEFT JOIN partner_images pi ON pi.partner_id = p.id
      GROUP BY p.id
      HAVING COUNT(pi.id) < 2
      ORDER BY p.id ASC
    `
    )
    .all() as Array<{
      id: number;
      name: string;
      area: string;
      category: string;
      city: string;
      district: string;
      discount_highlight: string;
    }>;

  if (partnersMissingImages.length > 0) {
    const photoFiles = [
      'service_health_clinic_1794572214767.jpg',
      'member_wellness_benefit_1794510457676.jpg',
      'service_fitness_sport_1794572214895.jpg',
      'service_culture_leisure_1794572215187.jpg',
      'service_food_dining_1794572214969.jpg',
      'service_education_services_1794572215510.jpg',
      'partnership_corporate_alliance_1794510456114.jpg',
      'hero_lpcs_community_1794510456196.jpg',
    ];

    const cachedAssets: Record<string, { base64: string; size: number }> = {};
    for (const filename of photoFiles) {
      const fullPath = path.resolve(process.cwd(), 'src/assets/images', filename);
      if (fs.existsSync(fullPath)) {
        const buf = fs.readFileSync(fullPath);
        cachedAssets[filename] = {
          base64: buf.toString('base64'),
          size: buf.length,
        };
      }
    }

    const pickPhotoForPartner = (p: { id: number; name: string; area: string; category: string }) => {
      const lower = `${p.name} ${p.category}`.toLowerCase();
      if (
        lower.includes('psicologia') ||
        lower.includes('fisioterapia') ||
        lower.includes('nutri') ||
        lower.includes('cabeleireiro') ||
        lower.includes('óptica') ||
        lower.includes('ótica')
      ) {
        return 'member_wellness_benefit_1794510457676.jpg';
      }
      if (p.area === 'Saúde e Bem-estar') {
        return p.id % 2 === 0
          ? 'service_health_clinic_1794572214767.jpg'
          : 'member_wellness_benefit_1794510457676.jpg';
      }
      if (p.area === 'Desporto') {
        return 'service_fitness_sport_1794572214895.jpg';
      }
      if (p.area === 'Lazer e Cultura') {
        return p.id % 2 === 0
          ? 'service_culture_leisure_1794572215187.jpg'
          : 'partnership_corporate_alliance_1794510456114.jpg';
      }
      if (p.area === 'Restauração e Alimentação') {
        return 'service_food_dining_1794572214969.jpg';
      }
      if (p.area === 'Formação e Educação') {
        return 'service_education_services_1794572215510.jpg';
      }
      return p.id % 2 === 0
        ? 'service_education_services_1794572215510.jpg'
        : 'partnership_corporate_alliance_1794510456114.jpg';
    };

    const deleteExistingStmt = db.prepare('DELETE FROM partner_images WHERE partner_id = ?');
    const insertImgStmt = db.prepare(`
      INSERT INTO partner_images (
        partner_id, original_name, mime_type, file_size, file_base64, caption, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const p of partnersMissingImages) {
      deleteExistingStmt.run(p.id);

      const photoFile = pickPhotoForPartner(p);
      const photoAsset = cachedAssets[photoFile];
      if (photoAsset) {
        insertImgStmt.run(
          p.id,
          photoFile,
          'image/jpeg',
          photoAsset.size,
          photoAsset.base64,
          `${p.name} — ${p.category}`,
          0
        );
      }

      const showcaseSvg = generatePartnerShowcaseSvg(p);
      const showcaseBuf = Buffer.from(showcaseSvg, 'utf8');
      insertImgStmt.run(
        p.id,
        `showcase_${p.id}.svg`,
        'image/svg+xml',
        showcaseBuf.length,
        showcaseBuf.toString('base64'),
        `${p.name} — Benefício Exclusivo LPCS`,
        1
      );
    }
  }
}
