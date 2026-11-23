import { Router, Request, Response } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import { db, hashPassword, verifyPassword, slugifyPartnerEmail } from './db.ts';
import {
  getSessionUser,
  createSession,
  clearSession,
  isUserAdmin,
  getSessionPartner,
  createPartnerSession,
  clearPartnerSession,
  validateNif,
  validatePortuguesePhone,
  validatePostalCode,
  validateAge,
  generateMemberNumber,
  getQuotaStatus,
} from './auth.ts';
import {
  generateTOTPCode,
  verifyTOTPCode,
  checkIssuanceRateLimit,
  logAudit,
} from './totp.ts';
import {
  notifyNewMemberRegistration,
  notifyNewPartnerInquiry,
  getEmailConfigStatus,
  INSTITUTIONAL_NOTIFICATION_EMAIL,
  buildPartnerProtocolText,
  formatPortugueseDate,
} from './mailer.ts';
import { getSupabaseConfig, saveSupabaseConfig, syncAllDataToSupabase } from './supabase.ts';

const router = Router();

// Configure multer for memory storage (max 5MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Formato não suportado. Por favor envie PDF, PNG, JPG ou WEBP.'));
    }
  },
});

const partnerImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 7 },
  fileFilter: (_req, file, cb) => {
    if (file.fieldname === 'signed_protocol' || file.fieldname === 'counter_signed_protocol') {
      const allowedDocs = [
        'application/pdf',
        'image/png',
        'image/jpeg',
        'image/webp',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ];
      if (allowedDocs.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Formato de protocolo não suportado. Utilize PDF, PNG, JPG ou DOCX.'));
      }
      return;
    }
    const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Formato de imagem não suportado. Utilize PNG, JPG, WEBP ou SVG.'));
    }
  },
}).fields([
  { name: 'logo', maxCount: 1 },
  { name: 'service_images', maxCount: 4 },
  { name: 'signed_protocol', maxCount: 1 },
  { name: 'counter_signed_protocol', maxCount: 1 },
]);

function withPartnerMedia(req: Request, res: Response, next: () => void) {
  const ct = req.headers['content-type'] || '';
  if (!ct.includes('multipart/form-data')) {
    return next();
  }
  partnerImageUpload(req, res, (err: any) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Erro ao processar as imagens submetidas.' });
    }
    next();
  });
}

function getPartnerServiceImagesMap(partnerIds: number[]) {
  const map: Record<
    number,
    Array<{ id: number; url: string; original_name: string; caption: string | null }>
  > = {};
  if (partnerIds.length === 0) return map;
  const rows = db
    .prepare(
      `SELECT id, partner_id, original_name, caption FROM partner_images ORDER BY sort_order ASC, id ASC`
    )
    .all() as Array<{
    id: number;
    partner_id: number;
    original_name: string;
    caption: string | null;
  }>;
  for (const r of rows) {
    if (!map[r.partner_id]) map[r.partner_id] = [];
    map[r.partner_id].push({
      id: r.id,
      url: `/api/partners/images/${r.id}`,
      original_name: r.original_name,
      caption: r.caption,
    });
  }
  return map;
}

// Helper for native forms redirect or JSON response
function handleResponse(
  req: Request,
  res: Response,
  successRedirect: string,
  errorRedirect: string,
  data: any,
  error?: string
) {
  const isHtml = req.headers.accept?.includes('text/html') && !req.xhr;
  if (error) {
    if (isHtml) {
      const url = `${errorRedirect}${errorRedirect.includes('?') ? '&' : '?'}error=${encodeURIComponent(error)}`;
      return res.redirect(url);
    }
    return res.status(400).json({ error });
  }

  if (isHtml) {
    return res.redirect(successRedirect);
  }
  return res.json(data);
}

// ==========================================
// 1. AUTHENTICATION (Native Forms + Route Handlers)
// ==========================================

// Register
router.post('/auth/register', (req: Request, res: Response) => {
  const {
    name,
    email,
    password,
    birth_date,
    address,
    postal_code,
    city,
    nif,
    phone,
  } = req.body;

  // Validation
  if (!name || name.trim().split(/\s+/).length < 2) {
    return handleResponse(req, res, '/dashboard', '/registar', null, 'O nome deve conter pelo menos dois termos (ex: Nome e Apelido).');
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return handleResponse(req, res, '/dashboard', '/registar', null, 'Por favor introduza um endereço de e-mail válido.');
  }
  if (!password || password.length < 6) {
    return handleResponse(req, res, '/dashboard', '/registar', null, 'A palavra-passe deve ter pelo menos 6 caracteres.');
  }
  if (!birth_date || !validateAge(birth_date)) {
    return handleResponse(req, res, '/dashboard', '/registar', null, 'Deve ter pelo menos 16 anos para se registar como associado.');
  }
  if (!address || address.trim().length < 5) {
    return handleResponse(req, res, '/dashboard', '/registar', null, 'Por favor indique a morada completa.');
  }
  if (!postal_code || !validatePostalCode(postal_code)) {
    return handleResponse(req, res, '/dashboard', '/registar', null, 'O código postal deve ter o formato português 0000-000.');
  }
  if (!city || city.trim().length < 2) {
    return handleResponse(req, res, '/dashboard', '/registar', null, 'Por favor indique a localidade.');
  }
  if (!nif || !validateNif(nif)) {
    return handleResponse(req, res, '/dashboard', '/registar', null, 'NIF inválido. Verifique o número e o dígito de controlo.');
  }
  if (!phone || !validatePortuguesePhone(phone)) {
    return handleResponse(req, res, '/dashboard', '/registar', null, 'O telemóvel deve ser português (9 dígitos começado por 91, 92, 93 ou 96).');
  }

  // Check unique email and NIF
  const existingEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(email.trim().toLowerCase());
  if (existingEmail) {
    return handleResponse(req, res, '/dashboard', '/registar', null, 'Já existe uma conta associada a este e-mail. Inicie sessão.');
  }
  const existingNif = db.prepare('SELECT id FROM users WHERE nif = ?').get(nif.trim());
  if (existingNif) {
    return handleResponse(req, res, '/dashboard', '/registar', null, 'Já existe um associado registado com este NIF.');
  }

  const { hash, salt } = hashPassword(password);
  const memberNumber = generateMemberNumber();

  try {
    const result = db.prepare(`
      INSERT INTO users (
        name, email, password_hash, salt, birth_date, address, postal_code,
        city, nif, phone, member_number, is_admin, is_suspended
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)
    `).run(
      name.trim(),
      email.trim().toLowerCase(),
      hash,
      salt,
      birth_date,
      address.trim(),
      postal_code.trim(),
      city.trim(),
      nif.trim(),
      phone.trim(),
      memberNumber
    );

    const userId = Number(result.lastInsertRowid);
    createSession(userId, req, res);

    logAudit(userId, 'registo_sócio', `Novo associado registado: ${memberNumber} (notificação enviada para ${INSTITUTIONAL_NOTIFICATION_EMAIL})`, req.ip, req.headers['user-agent']);

    notifyNewMemberRegistration({
      id: userId,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      member_number: memberNumber,
      nif: nif.trim(),
      phone: phone.trim(),
      birth_date,
      address: address.trim(),
      postal_code: postal_code.trim(),
      city: city.trim(),
      origin: 'Formulário de Inscrição Online (/registar)',
    }).catch((mailErr) => console.error('Failed to send member registration email:', mailErr));

    return handleResponse(req, res, '/dashboard', '/registar', {
      success: true,
      memberNumber,
      notificationEmail: INSTITUTIONAL_NOTIFICATION_EMAIL,
      redirect: '/dashboard',
    });
  } catch (err: any) {
    console.error('Registration error:', err);
    return handleResponse(req, res, '/dashboard', '/registar', null, 'Ocorreu um erro ao registar o associado. Tente novamente.');
  }
});

// Login
router.post('/auth/login', (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return handleResponse(req, res, '/dashboard', '/entrar', null, 'Por favor preencha o e-mail e a palavra-passe.');
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase()) as any;
  if (!user) {
    logAudit(null, 'login_falhado', `Tentativa para email inexistente: ${email}`, req.ip, req.headers['user-agent']);
    return handleResponse(req, res, '/dashboard', '/entrar', null, 'E-mail ou palavra-passe incorretos.');
  }

  if (user.is_suspended) {
    logAudit(user.id, 'login_bloqueado', `Tentativa de login em conta suspensa: ${email}`, req.ip, req.headers['user-agent']);
    return handleResponse(req, res, '/dashboard', '/entrar', null, 'A sua conta de associado encontra-se suspensa. Contacte a LPCS.');
  }

  const isValid = verifyPassword(password, user.password_hash, user.salt);
  if (!isValid) {
    logAudit(user.id, 'login_falhado', `Palavra-passe errada para: ${email}`, req.ip, req.headers['user-agent']);
    return handleResponse(req, res, '/dashboard', '/entrar', null, 'E-mail ou palavra-passe incorretos.');
  }

  createSession(user.id, req, res);
  logAudit(user.id, 'login_sucesso', `Login efetuado com sucesso`, req.ip, req.headers['user-agent']);

  const target = user.is_admin === 1 ? '/admin' : '/dashboard';
  return handleResponse(req, res, target, '/entrar', {
    success: true,
    redirect: target,
  });
});

// Logout
router.post('/auth/logout', (req: Request, res: Response) => {
  const user = getSessionUser(req);
  if (user) {
    logAudit(user.id, 'logout', 'Sessão terminada', req.ip, req.headers['user-agent']);
  }
  clearSession(req, res);
  return handleResponse(req, res, '/', '/', { success: true, redirect: '/' });
});

// Current user details
router.get('/auth/me', (req: Request, res: Response) => {
  const user = getSessionUser(req);
  if (!user) {
    return res.json({ user: null });
  }
  return res.json({
    user,
    isAdmin: isUserAdmin(user),
  });
});

// ==========================================
// 1B. PARTNER AUTHENTICATION (Parceiros / Comerciantes)
// ==========================================

router.get('/partner-auth/me', (req: Request, res: Response) => {
  const partner = getSessionPartner(req);
  return res.json({ partner });
});

router.get('/partner-auth/demo-accounts', (_req: Request, res: Response) => {
  const accounts = db
    .prepare(`
      SELECT pa.partner_id, pa.email, p.name as partner_name, p.category
      FROM partner_accounts pa
      JOIN partners p ON p.id = pa.partner_id
      WHERE pa.is_active = 1
      ORDER BY p.id ASC
    `)
    .all();
  return res.json({ accounts });
});

router.post('/partner-auth/login', (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return handleResponse(
      req,
      res,
      '/validar',
      '/validar',
      null,
      'Por favor preencha o e-mail e a palavra-passe do parceiro.'
    );
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const account = db
    .prepare(`
      SELECT pa.*, p.name as partner_name, p.category as partner_category,
             p.discount_highlight, p.is_active as partner_is_active
      FROM partner_accounts pa
      JOIN partners p ON p.id = pa.partner_id
      WHERE pa.email = ?
    `)
    .get(normalizedEmail) as any;

  if (!account) {
    logAudit(
      null,
      'partner_login_falhado',
      `Tentativa de login de parceiro com e-mail inexistente: ${normalizedEmail}`,
      req.ip,
      req.headers['user-agent']
    );
    return handleResponse(
      req,
      res,
      '/validar',
      '/validar',
      null,
      'E-mail ou palavra-passe de parceiro incorretos.'
    );
  }

  if (!account.is_active) {
    return handleResponse(
      req,
      res,
      '/validar',
      '/validar',
      null,
      'Esta conta de parceiro encontra-se desativada. Contacte a LPCS.'
    );
  }

  const isValid = verifyPassword(String(password), account.password_hash, account.salt);
  if (!isValid) {
    logAudit(
      null,
      'partner_login_falhado',
      `Palavra-passe incorreta para o parceiro ${account.partner_name} (${normalizedEmail})`,
      req.ip,
      req.headers['user-agent']
    );
    return handleResponse(
      req,
      res,
      '/validar',
      '/validar',
      null,
      'E-mail ou palavra-passe de parceiro incorretos.'
    );
  }

  createPartnerSession(account.id, req, res);
  logAudit(
    null,
    'partner_login_sucesso',
    `Parceiro ${account.partner_name} (${normalizedEmail}) iniciou sessão na área privada`,
    req.ip,
    req.headers['user-agent']
  );

  return handleResponse(req, res, '/validar', '/validar', {
    success: true,
    partner: {
      id: account.id,
      partner_id: account.partner_id,
      email: account.email,
      contact_name: account.contact_name,
      partner_name: account.partner_name,
      partner_category: account.partner_category,
      discount_highlight: account.discount_highlight,
    },
  });
});

// Update protocol fields from the Partner's Private Area
router.put('/partner-auth/protocol-details', (req: Request, res: Response) => {
  const partner = getSessionPartner(req);
  if (!partner) {
    return res.status(401).json({ error: 'Sessão de parceiro necessária.' });
  }

  const {
    partner_name,
    nif,
    address,
    contact_name,
    contact_role,
    discount_highlight,
    protocol_duration,
  } = req.body;

  const cleanName = (partner_name || partner.partner_name || '').trim();
  const cleanNif = (nif || '').trim();
  const cleanAddress = (address || '').trim();
  const cleanContactName = (contact_name || '').trim();
  const cleanContactRole = (contact_role || '').trim();
  const cleanBenefit = (discount_highlight || partner.discount_highlight || '').trim();
  const cleanDuration = (protocol_duration || 'um ano').trim() || 'um ano';

  db.prepare(`
    UPDATE partners
    SET name = ?,
        nif = ?,
        address = ?,
        contact_name = ?,
        contact_role = ?,
        discount_highlight = ?,
        benefit_value = ?,
        protocol_duration = ?
    WHERE id = ?
  `).run(
    cleanName,
    cleanNif || null,
    cleanAddress || null,
    cleanContactName || null,
    cleanContactRole || null,
    cleanBenefit,
    cleanBenefit,
    cleanDuration,
    partner.partner_id
  );

  db.prepare(`
    UPDATE partner_accounts
    SET contact_name = ?, updated_at = datetime('now')
    WHERE partner_id = ?
  `).run(cleanContactName || partner.contact_name, partner.partner_id);

  // Sync matching inquiry if present
  db.prepare(`
    UPDATE partner_inquiries
    SET company_name = ?,
        nif = ?,
        address = ?,
        contact_name = ?,
        contact_role = ?,
        proposed_benefit = ?,
        protocol_duration = ?
    WHERE LOWER(email) = LOWER(?)
  `).run(
    cleanName,
    cleanNif || null,
    cleanAddress || null,
    cleanContactName || '',
    cleanContactRole || null,
    cleanBenefit,
    cleanDuration,
    partner.email
  );

  return res.json({
    success: true,
    message: 'Dados do protocolo atualizados com sucesso na sua área privada.',
  });
});

// Download / view the protocol signed by the partner (Segundo Outorgante)
router.get('/partner-auth/protocol/partner-signed', (req: Request, res: Response) => {
  const partner = getSessionPartner(req);
  if (!partner) {
    return res.status(401).send('Sessão de parceiro necessária.');
  }

  const row = db
    .prepare(
      'SELECT signed_protocol_name, signed_protocol_mime, signed_protocol_base64 FROM partners WHERE id = ?'
    )
    .get(partner.partner_id) as any;

  if (!row || !row.signed_protocol_base64 || !row.signed_protocol_mime) {
    return res.status(404).send('Ainda não foi submetido o protocolo assinado pelo parceiro.');
  }

  const buf = Buffer.from(row.signed_protocol_base64, 'base64');
  res.setHeader('Content-Type', row.signed_protocol_mime);
  res.setHeader(
    'Content-Disposition',
    `inline; filename="${row.signed_protocol_name || 'protocolo_assinado_parceiro.pdf'}"`
  );
  return res.send(buf);
});

// Partner uploads/updates their signed protocol from their private area
router.post(
  '/partner-auth/protocol/partner-signed',
  upload.single('signed_protocol'),
  (req: Request, res: Response) => {
    const partner = getSessionPartner(req);
    if (!partner) {
      return res.status(401).json({ error: 'Sessão de parceiro necessária.' });
    }
    if (!req.file) {
      return res.status(400).json({
        error: 'Selecione o ficheiro do protocolo devidamente assinado pela empresa (PDF, PNG ou JPG).',
      });
    }

    const now = new Date().toISOString();
    const base64Data = req.file.buffer.toString('base64');
    db.prepare(`
      UPDATE partners
      SET signed_protocol_name = ?,
          signed_protocol_mime = ?,
          signed_protocol_base64 = ?,
          signed_protocol_uploaded_at = ?
      WHERE id = ?
    `).run(
      req.file.originalname,
      req.file.mimetype,
      base64Data,
      now,
      partner.partner_id
    );

    db.prepare(`
      UPDATE partner_inquiries
      SET signed_protocol_name = ?,
          signed_protocol_mime = ?,
          signed_protocol_base64 = ?,
          signed_protocol_uploaded_at = ?
      WHERE LOWER(email) = LOWER(?) OR LOWER(company_name) = LOWER(?)
    `).run(
      req.file.originalname,
      req.file.mimetype,
      base64Data,
      now,
      partner.email,
      partner.partner_name
    );

    logAudit(
      null,
      'partner_upload_protocolo_assinado',
      `Entidade parceira ${partner.partner_name} carregou o protocolo assinado (${req.file.originalname}) na sua área privada`,
      req.ip,
      req.headers['user-agent']
    );

    return res.json({
      success: true,
      message:
        'Protocolo assinado pela entidade parceira submetido com sucesso. A parceria entrará em vigor assim que a LPCS assinar e colocar o protocolo assinado por ambas as partes nesta área privada.',
    });
  }
);

// Download / view the counter-signed protocol (signed by BOTH LPCS and Partner) in the Partner's Private Area
router.get('/partner-auth/protocol/counter-signed', (req: Request, res: Response) => {
  const partner = getSessionPartner(req);
  if (!partner) {
    return res.status(401).send('Sessão de parceiro necessária.');
  }

  const row = db.prepare('SELECT * FROM partners WHERE id = ?').get(partner.partner_id) as any;
  if (!row) {
    return res.status(404).send('Entidade parceira não encontrada.');
  }

  // If LPCS uploaded a raw counter-signed file (PDF/image), serve it directly
  if (row.counter_signed_protocol_base64 && row.counter_signed_protocol_mime) {
    const buf = Buffer.from(row.counter_signed_protocol_base64, 'base64');
    res.setHeader('Content-Type', row.counter_signed_protocol_mime);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${row.counter_signed_protocol_name || 'protocolo_assinado_ambas_as_partes.pdf'}"`
    );
    return res.send(buf);
  }

  // If partnership is not yet counter-signed by LPCS
  if (!row.protocol_in_force) {
    return res
      .status(404)
      .send(
        'O protocolo assinado por ambas as partes ainda não foi disponibilizado pela LPCS nesta área privada.'
      );
  }

  // For active demo partners where protocol_in_force = 1, render the official dual-signed Protocol sheet
  const companyName = (row.name || 'Entidade Parceira').trim();
  const companyAddress = (row.address || `${row.city || 'Lisboa'}, ${row.district || 'Lisboa'}`).trim();
  const companyNif = (row.nif || '509123456').trim();
  const repRole = (row.contact_role || 'Gerente / Representante Legal').trim();
  const repName = (row.contact_name || `Representante Legal de ${companyName}`).trim();
  const benefitConditions = `${row.discount_highlight || row.benefit_value}${row.terms ? ` (${row.terms})` : ''}`;
  const protocolDuration = (row.protocol_duration || 'um ano').trim() || 'um ano';
  const signedDate = formatPortugueseDate(row.counter_signed_protocol_uploaded_at || row.created_at);

  const html = `<!doctype html>
<html lang="pt-PT">
<head>
  <meta charset="UTF-8" />
  <title>Protocolo Assinado por Ambas as Partes — ${companyName}</title>
  <style>
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #141619; background: #f5f5f4; margin: 0; padding: 32px 16px; line-height: 1.65; }
    .toolbar { max-width: 780px; margin: 0 auto 20px; display: flex; justify-content: space-between; align-items: center; background: #064E3B; color: #fff; padding: 14px 20px; border-radius: 10px; }
    .toolbar button { background: #fff; color: #064E3B; border: none; padding: 9px 18px; border-radius: 6px; font-weight: bold; font-size: 13px; cursor: pointer; }
    .sheet { max-width: 780px; margin: 0 auto; background: #fff; padding: 56px 64px; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); font-size: 14.5px; text-align: justify; }
    .seal { background: #ECFDF5; border: 1px solid #A7F3D0; color: #065F46; padding: 10px 16px; border-radius: 8px; font-size: 12px; font-weight: bold; text-align: center; margin-bottom: 24px; }
    .header-logo { text-align: center; margin-bottom: 24px; }
    .header-logo img { height: 76px; width: auto; }
    h1 { text-align: center; font-size: 20px; letter-spacing: 2px; margin: 0 0 28px; }
    .clause-title { text-align: center; font-weight: bold; margin: 24px 0 8px; line-height: 1.35; }
    .highlight-box { margin: 12px 0; padding: 12px 16px; background: #FAF8F5; border-left: 3px solid #C81E2B; font-weight: bold; }
    .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 48px; text-align: center; }
    .sig-script { font-family: Georgia, serif; font-style: italic; font-size: 18px; color: #1e293b; margin-top: 24px; padding-bottom: 4px; border-bottom: 1px solid #141619; }
    @media print { body { background: #fff; padding: 0; } .toolbar { display: none; } .sheet { box-shadow: none; padding: 24px 32px; max-width: 100%; } }
  </style>
</head>
<body>
  <div class="toolbar">
    <div>
      <strong>Protocolo em Vigor — Assinado por Ambas as Partes</strong>
      <div style="font-size: 12px; color: #A7F3D0;">Disponibilizado pela LPCS na Área Privada de ${companyName}</div>
    </div>
    <button onclick="window.print()">Imprimir / Guardar PDF</button>
  </div>
  <div class="sheet">
    <div class="seal">
      PARCERIA EM VIGOR · PROTOCOLO ASSINADO POR AMBAS AS PARTES (PRIMEIRA E SEGUNDO OUTORGANTES)
    </div>
    <div class="header-logo">
      <img src="/assets/aistudio/logo_LPCS_f0a028f9.jpg" alt="Liga Portuguesa Contra a SIDA" />
    </div>
    <h1>PROTOCOLO</h1>
    <p>
      Entre <strong>Liga Portuguesa Contra a SIDA</strong>, Instituição Particular de Solidariedade Social, com sede na Praça Carlos Fabião, Loja 3A 1600-316 Lisboa, pessoa coletiva nº <strong>502665548</strong>, representada pela Presidente da Direção, <strong>Maria Eugénia Saraiva</strong>, na qualidade de Primeira Outorgante
    </p>
    <p style="text-align: center; margin: 10px 0;">e</p>
    <p>
      <strong>${companyName}</strong> adiante designada por Segundo Outorgante, com sede em <strong>${companyAddress}</strong>, pessoa coletiva nº <strong>${companyNif}</strong>, representada pelo(a) <strong>${repRole}</strong>, <strong>${repName}</strong>, na qualidade de segundo outorgante
    </p>
    <p>é celebrado o presente protocolo de cooperação, o qual se irá reger nos termos e de acordo com as cláusulas seguintes:</p>
    <div class="clause-title">Cláusula 1.ª<br/>(Objeto)</div>
    <p>O presente Protocolo enquadra-se dentro do programa “A LIGA EM REDE” e tem por objeto conceder condições preferenciais na utilização dos bens e serviços do Segundo Outorgante aos associados da Primeira Outorgante, podendo o Segundo Outorgante beneficiar de um aumento de clientes/utilizadores destes bens e serviços através dos associados da Primeira Outorgante.</p>
    <div class="clause-title">Cláusula 2.ª<br/>(Objeto)</div>
    <p>1. A Primeira Outorgante obriga-se a divulgar e promover o protocolo junto dos seus associados através dos meios de comunicação disponíveis e designadamente através da internet.<br/>2. O Segundo Outorgante concede os benefícios de acesso aos serviços/bens protocolados, mediante a apresentação de comprovativo em como é associado da Primeira Outorgante.</p>
    <div class="clause-title">Cláusula 3.ª<br/>(Condições preferenciais)</div>
    <p>O Segundo Outorgante disponibiliza aos associados da Primeira Outorgante as seguintes condições preferenciais:</p>
    <div class="highlight-box">${benefitConditions}</div>
    <div class="clause-title">Cláusula 4.ª<br/>(Vigência)</div>
    <p>1. O presente protocolo entra em vigor na data da sua assinatura abaixo mencionada e terá a duração de <strong>${protocolDuration}</strong>, automaticamente renovável por iguais e sucessivos períodos.<br/>2. Qualquer alteração ao presente protocolo apenas será válida se se observar também a forma escrita e ser assinado por ambas as partes.</p>
    <div class="clause-title">Cláusula 5.ª<br/>(Denúncia)</div>
    <p>A denúncia do presente protocolo por qualquer das partes deverá ser efetuada mediante comunicação escrita à outra parte, com uma antecedência de trinta dias seguidos, relativa ao termo da sua vigência.</p>
    <p>O presente documento é feito em duplicado e assinado pelos outorgantes, destinando-se um exemplar a cada uma das partes.</p>
    <p style="margin-top: 28px;">Lisboa, ${signedDate}</p>
    <div class="signatures">
      <div>
        <strong>Responsável do Primeiro Outorgante</strong>
        <div class="sig-script">Maria Eugénia Saraiva</div>
        <div>(Maria Eugénia Saraiva)</div>
        <div>Presidente da Direção · LPCS</div>
      </div>
      <div>
        <strong>Responsável do Segundo Outorgante</strong>
        <div class="sig-script">${repName}</div>
        <div>(${repName})</div>
        <div>(${repRole})</div>
      </div>
    </div>
  </div>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.send(html);
});

router.post('/partner-auth/logout', (req: Request, res: Response) => {
  const partner = getSessionPartner(req);
  if (partner) {
    logAudit(
      null,
      'partner_logout',
      `Parceiro ${partner.partner_name} terminou sessão`,
      req.ip,
      req.headers['user-agent']
    );
  }
  clearPartnerSession(req, res);
  return res.json({ success: true });
});

// ==========================================
// 2. PROFILE MANAGEMENT
// ==========================================

router.get('/profile', (req: Request, res: Response) => {
  const user = getSessionUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Não autenticado' });
  }
  return res.json({ profile: user });
});

router.post('/profile', (req: Request, res: Response) => {
  const user = getSessionUser(req);
  if (!user) {
    return handleResponse(req, res, '/perfil', '/perfil', null, 'Sessão expirada. Por favor inicie sessão.');
  }

  const { name, birth_date, address, postal_code, city, nif, phone } = req.body;

  if (!name || name.trim().split(/\s+/).length < 2) {
    return handleResponse(req, res, '/perfil', '/perfil', null, 'O nome deve conter pelo menos dois termos.');
  }
  if (!birth_date || !validateAge(birth_date)) {
    return handleResponse(req, res, '/perfil', '/perfil', null, 'A idade mínima é de 16 anos.');
  }
  if (!address || address.trim().length < 5) {
    return handleResponse(req, res, '/perfil', '/perfil', null, 'Indique a morada completa.');
  }
  if (!postal_code || !validatePostalCode(postal_code)) {
    return handleResponse(req, res, '/perfil', '/perfil', null, 'Código postal inválido. Use 0000-000.');
  }
  if (!city || city.trim().length < 2) {
    return handleResponse(req, res, '/perfil', '/perfil', null, 'Indique a localidade.');
  }
  if (!nif || !validateNif(nif)) {
    return handleResponse(req, res, '/perfil', '/perfil', null, 'NIF inválido (verifique o dígito de controlo).');
  }
  if (!phone || !validatePortuguesePhone(phone)) {
    return handleResponse(req, res, '/perfil', '/perfil', null, 'Telemóvel deve ser português (9 dígitos, 91/92/93/96).');
  }

  // Check NIF uniqueness if changed
  const existingNif = db.prepare('SELECT id FROM users WHERE nif = ? AND id != ?').get(nif.trim(), user.id);
  if (existingNif) {
    return handleResponse(req, res, '/perfil', '/perfil', null, 'Este NIF já pertence a outro associado.');
  }

  db.prepare(`
    UPDATE users SET
      name = ?, birth_date = ?, address = ?, postal_code = ?,
      city = ?, nif = ?, phone = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(
    name.trim(),
    birth_date,
    address.trim(),
    postal_code.trim(),
    city.trim(),
    nif.trim(),
    phone.trim(),
    user.id
  );

  logAudit(user.id, 'perfil_atualizado', 'Dados pessoais atualizados', req.ip, req.headers['user-agent']);

  return handleResponse(req, res, '/perfil?sucesso=1', '/perfil', {
    success: true,
    message: 'Perfil atualizado com sucesso.',
  });
});

// ==========================================
// 3. QUOTAS & PAYMENTS
// ==========================================

router.post('/quotas/pay', (req: Request, res: Response) => {
  const user = getSessionUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Inicie sessão para pagar a quota.' });
  }

  const { plan_type, payment_method, phone_mbway } = req.body;
  if (!['semestral', 'anual'].includes(plan_type)) {
    return res.status(400).json({ error: 'Plano inválido. Escolha semestral ou anual.' });
  }
  if (!['mbway', 'multibanco', 'card', 'transferencia'].includes(payment_method)) {
    return res.status(400).json({ error: 'Método de pagamento inválido.' });
  }

  const amountCents = plan_type === 'semestral' ? 1750 : 3500;
  const monthsToAdd = plan_type === 'semestral' ? 6 : 12;

  // Calculate accumulated validity date!
  // Find current active quota validity
  const currentStatus = getQuotaStatus(user.id);
  let startDate: Date;

  if (currentStatus.has_active_quota && currentStatus.valid_until) {
    // Accumulate on top of existing valid_until!
    startDate = new Date(currentStatus.valid_until + 'T00:00:00');
  } else {
    // Starts from today
    startDate = new Date();
  }

  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + monthsToAdd);

  const validFromStr = startDate.toISOString().split('T')[0];
  const validUntilStr = endDate.toISOString().split('T')[0];

  // Generate reference
  let reference = '';
  if (payment_method === 'mbway') {
    reference = `MBWAY-${phone_mbway || user.phone}`;
  } else if (payment_method === 'multibanco') {
    const ent = '21876';
    const ref = Math.floor(100000000 + Math.random() * 900000000);
    reference = `Ent: ${ent} | Ref: ${ref}`;
  } else if (payment_method === 'card') {
    reference = `CARD-SIM-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
  } else {
    reference = `TRANSF-LPCS-${Date.now().toString().slice(-6)}`;
  }

  const result = db.prepare(`
    INSERT INTO quotas (
      user_id, plan_type, amount_cents, payment_method, reference, status, valid_from, valid_until
    ) VALUES (?, ?, ?, ?, ?, 'pago', ?, ?)
  `).run(
    user.id,
    plan_type,
    amountCents,
    payment_method,
    reference,
    validFromStr,
    validUntilStr
  );

  const quotaId = Number(result.lastInsertRowid);

  // Automatically generate official LPCS digital receipt
  const receiptText = `================================================
LIGA PORTUGUESA CONTRA A SIDA (LPCS)
IPSS · Pessoa Coletiva de Utilidade Pública
NIPC: 502 665 548
Sede: Praça Carlos Fabião, Loja 3A, 1600-316 Lisboa
Tel: +351 213 479 376 | www.ligacontrasida.org
------------------------------------------------
RECIBO DE QUOTA Nº LPCS-REC-${quotaId.toString().padStart(6, '0')}
Data de Emissão: ${new Date().toISOString().split('T')[0]}
------------------------------------------------
DADOS DO ASSOCIADO:
Nome: ${user.name}
Nº de Sócio: ${user.member_number}
NIF: ${user.nif}
Morada: ${user.address}, ${user.postal_code} ${user.city}
------------------------------------------------
DESCRIÇÃO:
Quota ${plan_type === 'semestral' ? 'Semestral (6 Meses)' : 'Anual (12 Meses)'}
Período de Validade: ${validFromStr} até ${validUntilStr}
Método: ${payment_method.toUpperCase()} (${reference})
Valor Total Pago: ${(amountCents / 100).toFixed(2)} EUR
(Isento de IVA ao abrigo do artigo 9.º do CIVA)
------------------------------------------------
Obrigado pelo seu compromisso contínuo na luta contra
a SIDA, no apoio a quem vive com VIH e na promoção
da saúde e direitos humanos em Portugal.
================================================`;

  const receiptBase64 = Buffer.from(receiptText).toString('base64');
  db.prepare(`
    INSERT INTO receipts (
      user_id, quota_id, original_name, mime_type, file_size, file_base64, notes
    ) VALUES (?, ?, ?, 'text/plain', ?, ?, ?)
  `).run(
    user.id,
    quotaId,
    `Recibo_Quota_${plan_type.toUpperCase()}_LPCS_${validUntilStr}.txt`,
    Buffer.byteLength(receiptText),
    receiptBase64,
    `Recibo emitido automaticamente para o pagamento da quota ${plan_type}`
  );

  logAudit(
    user.id,
    'quota_paga',
    `Quota ${plan_type} de ${(amountCents / 100).toFixed(2)}€ paga via ${payment_method}. Validade acumulada até ${validUntilStr}`,
    req.ip,
    req.headers['user-agent']
  );

  return res.json({
    success: true,
    message: 'Pagamento processado com sucesso! A sua quota foi atualizada.',
    valid_until: validUntilStr,
    quota_id: quotaId,
  });
});

router.get('/quotas/history', (req: Request, res: Response) => {
  const user = getSessionUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  const quotas = db.prepare(`
    SELECT * FROM quotas
    WHERE user_id = ?
    ORDER BY created_at DESC
  `).all(user.id);

  const receipts = db.prepare(`
    SELECT id, quota_id, original_name, mime_type, file_size, notes, created_at
    FROM receipts
    WHERE user_id = ?
    ORDER BY created_at DESC
  `).all(user.id);

  return res.json({
    quotas,
    receipts,
    status: getQuotaStatus(user.id),
  });
});

// ==========================================
// 4. RECEIPTS MANAGEMENT (Protected Route)
// ==========================================

router.post('/receipts/upload', upload.single('receipt_file'), (req: Request, res: Response) => {
  const user = getSessionUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Inicie sessão para enviar recibos.' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'Nenhum ficheiro selecionado.' });
  }

  const { quota_id, notes } = req.body;
  const fileBase64 = req.file.buffer.toString('base64');

  const result = db.prepare(`
    INSERT INTO receipts (
      user_id, quota_id, original_name, mime_type, file_size, file_base64, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    user.id,
    quota_id ? Number(quota_id) : null,
    req.file.originalname,
    req.file.mimetype,
    req.file.size,
    fileBase64,
    notes || null
  );

  logAudit(
    user.id,
    'recibo_enviado',
    `Ficheiro ${req.file.originalname} (${(req.file.size / 1024).toFixed(1)} KB) arquivado`,
    req.ip,
    req.headers['user-agent']
  );

  return res.json({
    success: true,
    message: 'Recibo arquivado com sucesso.',
    receiptId: Number(result.lastInsertRowid),
  });
});

// Secure download route checking session and ownership
router.get('/receipts/:id', (req: Request, res: Response) => {
  const user = getSessionUser(req);
  if (!user) {
    return res.status(401).send('Acesso não autorizado. Por favor inicie sessão.');
  }

  const receipt = db.prepare('SELECT * FROM receipts WHERE id = ?').get(req.params.id) as any;
  if (!receipt) {
    return res.status(404).send('Recibo não encontrado.');
  }

  // Check ownership: must be the owner OR an administrator
  if (receipt.user_id !== user.id && !isUserAdmin(user)) {
    logAudit(user.id, 'acesso_negado_recibo', `Tentativa de aceder ao recibo de outro associado: ID ${receipt.id}`, req.ip, req.headers['user-agent']);
    return res.status(403).send('Não tem permissão para aceder a este documento.');
  }

  const fileBuffer = Buffer.from(receipt.file_base64, 'base64');
  res.setHeader('Content-Type', receipt.mime_type);
  res.setHeader('Content-Disposition', `inline; filename="${receipt.original_name}"`);
  return res.send(fileBuffer);
});

router.delete('/receipts/:id', (req: Request, res: Response) => {
  const user = getSessionUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  const receipt = db.prepare('SELECT * FROM receipts WHERE id = ?').get(req.params.id) as any;
  if (!receipt) {
    return res.status(404).json({ error: 'Recibo não encontrado.' });
  }

  if (receipt.user_id !== user.id && !isUserAdmin(user)) {
    return res.status(403).json({ error: 'Permissão negada.' });
  }

  db.prepare('DELETE FROM receipts WHERE id = ?').run(req.params.id);
  logAudit(user.id, 'recibo_removido', `Recibo ${receipt.original_name} removido`, req.ip, req.headers['user-agent']);

  return res.json({ success: true, message: 'Recibo removido com sucesso.' });
});

// ==========================================
// 5. PARTNERS & DYNAMIC HOMEPAGE STATS (Public with Server Masking)
// ==========================================

router.get('/partners', (req: Request, res: Response) => {
  const user = getSessionUser(req);
  const hasActiveQuota = user?.quota_status?.has_active_quota || false;

  const { area, district, city, benefit_type, search } = req.query;

  let query = 'SELECT * FROM partners WHERE is_active = 1';
  const params: any[] = [];

  if (area && typeof area === 'string' && area !== 'all') {
    query += ' AND area = ?';
    params.push(area);
  }
  if (district && typeof district === 'string' && district !== 'all') {
    query += ' AND district = ?';
    params.push(district);
  }
  if (city && typeof city === 'string' && city !== 'all') {
    query += ' AND city = ?';
    params.push(city);
  }
  if (benefit_type && typeof benefit_type === 'string' && benefit_type !== 'all') {
    query += ' AND benefit_type = ?';
    params.push(benefit_type);
  }
  if (search && typeof search === 'string' && search.trim() !== '') {
    query += ' AND (name LIKE ? OR description LIKE ? OR discount_highlight LIKE ? OR category LIKE ?)';
    const term = `%${search.trim()}%`;
    params.push(term, term, term, term);
  }

  query += ' ORDER BY name ASC';

  const rows = db.prepare(query).all(...params) as any[];
  const imagesMap = getPartnerServiceImagesMap(rows.map((p) => p.id));

  const userUsageMap: Record<number, number> = {};
  if (user) {
    const usageRows = db
      .prepare(
        `SELECT partner_id, COUNT(*) as count
         FROM redemptions
         WHERE user_id = ? AND status IN ('used', 'active')
         GROUP BY partner_id`
      )
      .all(user.id) as Array<{ partner_id: number; count: number }>;
    for (const r of usageRows) {
      userUsageMap[r.partner_id] = r.count;
    }
  }

  // Mask secret_code on the server if user does not have active quota!
  const sanitized = rows.map((p) => {
    const maxUses = p.max_uses && Number(p.max_uses) > 0 ? Number(p.max_uses) : null;
    const usedCount = userUsageMap[p.id] || 0;
    const remainingUses = maxUses !== null ? Math.max(0, maxUses - usedCount) : null;
    const isLimitReached = maxUses !== null && usedCount >= maxUses;
    const codeMode = p.code_mode === 'codigo_unico' ? 'codigo_unico' : 'rotativo';

    return {
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
      max_uses: maxUses,
      code_mode: codeMode,
      used_count: usedCount,
      remaining_uses: remainingUses,
      is_limit_reached: isLimitReached,
      estimated_annual_savings: p.estimated_annual_savings,
      valid_until: p.valid_until,
      terms: p.terms,
      website: p.website,
      logo_url: p.logo_base64 ? `/api/partners/${p.id}/logo?v=${p.logo_base64.length}` : null,
      service_images: imagesMap[p.id] || [],
      // Never send secret_code in public list; only sent upon /api/benefits/redeem check
      secret_code: null,
      can_access_code: hasActiveQuota && !isLimitReached,
    };
  });

  // Calculate distinct filter options and area counts
  const allActive = db.prepare('SELECT area, district, city FROM partners WHERE is_active = 1').all() as any[];
  const areaCounts: Record<string, number> = {};
  const districtsSet = new Set<string>();
  const citiesByDistrict: Record<string, Set<string>> = {};

  for (const item of allActive) {
    areaCounts[item.area] = (areaCounts[item.area] || 0) + 1;
    districtsSet.add(item.district);
    if (!citiesByDistrict[item.district]) {
      citiesByDistrict[item.district] = new Set();
    }
    citiesByDistrict[item.district].add(item.city);
  }

  const citiesFormatted: Record<string, string[]> = {};
  for (const [dist, set] of Object.entries(citiesByDistrict)) {
    citiesFormatted[dist] = Array.from(set).sort();
  }

  return res.json({
    partners: sanitized,
    totalCount: sanitized.length,
    userHasQuota: hasActiveQuota,
    filterMeta: {
      areaCounts,
      districts: Array.from(districtsSet).sort(),
      citiesByDistrict: citiesFormatted,
    },
  });
});

// Public Partner Logo & Illustrative Service Image Routes
router.get('/partners/:id/logo', (req: Request, res: Response) => {
  const row = db
    .prepare('SELECT logo_mime, logo_base64 FROM partners WHERE id = ?')
    .get(Number(req.params.id)) as { logo_mime?: string; logo_base64?: string } | undefined;

  if (!row || !row.logo_base64 || !row.logo_mime) {
    return res.status(404).send('Logótipo não encontrado.');
  }

  const buf = Buffer.from(row.logo_base64, 'base64');
  res.setHeader('Content-Type', row.logo_mime);
  res.setHeader('Cache-Control', 'public, max-age=3600');
  return res.send(buf);
});

router.get('/partners/images/:imageId', (req: Request, res: Response) => {
  const row = db
    .prepare('SELECT mime_type, file_base64 FROM partner_images WHERE id = ?')
    .get(Number(req.params.imageId)) as { mime_type?: string; file_base64?: string } | undefined;

  if (!row || !row.file_base64 || !row.mime_type) {
    return res.status(404).send('Imagem não encontrada.');
  }

  const buf = Buffer.from(row.file_base64, 'base64');
  res.setHeader('Content-Type', row.mime_type);
  res.setHeader('Cache-Control', 'public, max-age=3600');
  return res.send(buf);
});

// Dynamic Hero statistics calculated strictly from the database
router.get('/partners/hero-stats', (_req: Request, res: Response) => {
  const activePartners = db.prepare(`
    SELECT id, name, area, benefit_type, estimated_annual_savings, discount_highlight
    FROM partners
    WHERE is_active = 1
  `).all() as Array<{
    id: number;
    name: string;
    area: string;
    benefit_type: string;
    estimated_annual_savings: number;
    discount_highlight: string;
  }>;

  const totalSavings = activePartners.reduce((acc, p) => acc + (p.estimated_annual_savings || 0), 0);
  const quotaAnnual = 35.0;
  const savingsMultiplier = Math.round((totalSavings / quotaAnnual) * 10) / 10;

  // Count partners that alone pay off the 35€ quota
  const partnersPayingQuota = activePartners.filter((p) => p.estimated_annual_savings >= quotaAnnual);

  // Breakdown by benefit type
  const couponSavings = activePartners
    .filter((p) => p.benefit_type === 'cupao')
    .reduce((acc, p) => acc + p.estimated_annual_savings, 0);
  const voucherSavings = activePartners
    .filter((p) => p.benefit_type === 'voucher')
    .reduce((acc, p) => acc + p.estimated_annual_savings, 0);
  const codeSavings = activePartners
    .filter((p) => p.benefit_type === 'codigo')
    .reduce((acc, p) => acc + p.estimated_annual_savings, 0);

  // Top 4 benefits
  const topBenefits = [...activePartners]
    .sort((a, b) => b.estimated_annual_savings - a.estimated_annual_savings)
    .slice(0, 4)
    .map((p) => ({
      ...p,
      pays_quota: p.estimated_annual_savings >= quotaAnnual,
    }));

  return res.json({
    totalSavings,
    annualQuotaCost: quotaAnnual,
    savingsMultiplier,
    partnersCount: activePartners.length,
    partnersPayingQuotaCount: partnersPayingQuota.length,
    breakdown: {
      couponSavings,
      voucherSavings,
      codeSavings,
    },
    topBenefits,
  });
});

// ==========================================
// 6. ROTATING 6-DIGIT CODE & MERCHANT VALIDATION
// ==========================================

// Issue or retrieve active redemption for an associate
router.post('/benefits/redeem', (req: Request, res: Response) => {
  const user = getSessionUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Inicie sessão para aceder ao código de desconto.' });
  }

  if (!user.quota_status.has_active_quota) {
    return res.status(403).json({
      error: 'O acesso aos códigos é exclusivo para associados com quota ativa. Por favor renove a sua quota.',
    });
  }

  const { partner_id } = req.body;
  if (!partner_id) {
    return res.status(400).json({ error: 'Parceiro não especificado.' });
  }

  const partner = db.prepare('SELECT * FROM partners WHERE id = ? AND is_active = 1').get(partner_id) as any;
  if (!partner) {
    return res.status(404).json({ error: 'Parceiro não encontrado ou inativo.' });
  }

  const todayIso = new Date().toISOString().split('T')[0];
  if (partner.valid_until && String(partner.valid_until).trim() < todayIso) {
    return res.status(403).json({
      error: `Esta parceria expirou em ${partner.valid_until}.`,
    });
  }

  // Check how many times this member has already used this partner's discount
  const priorCountRow = db
    .prepare(
      `SELECT COUNT(*) as count
       FROM redemptions
       WHERE user_id = ? AND partner_id = ? AND status IN ('used', 'active')`
    )
    .get(user.id, partner_id) as { count: number };

  const priorUses = priorCountRow?.count || 0;
  const maxUses = partner.max_uses && Number(partner.max_uses) > 0 ? Number(partner.max_uses) : null;
  const codeMode = partner.code_mode === 'codigo_unico' ? 'codigo_unico' : 'rotativo';

  if (maxUses !== null && priorUses >= maxUses) {
    logAudit(
      user.id,
      'limite_utilizacoes_excedido',
      `Bloqueado: tentativa de exceder limite de ${maxUses} utilizações em ${partner.name} (já utilizado ${priorUses}x)`,
      req.ip,
      req.headers['user-agent']
    );
    return res.status(403).json({
      error: `Desconto bloqueado: já utilizou este desconto ${priorUses} de ${maxUses} ${
        maxUses === 1 ? 'vez possível' : 'vezes possíveis'
      }.`,
      used_count: priorUses,
      max_uses: maxUses,
      is_limit_reached: true,
    });
  }

  // Check rate limit
  const rateLimit = checkIssuanceRateLimit(user.id);
  if (!rateLimit.allowed) {
    logAudit(user.id, 'limite_emissao_atingido', `Tentativa de exceder limite de emissões/hora`, req.ip, req.headers['user-agent']);
    return res.status(429).json({
      error: 'Atingiu o limite de segurança de emissões por hora. Por favor aguarde um momento antes de gerar novo código.',
    });
  }

  const secretSalt = crypto.randomBytes(32).toString('hex');
  const refCode = `LPCS-${partner.name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .substring(0, 3)
    .toUpperCase()}-${Math.floor(100000 + Math.random() * 900000)}`;
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const nowIso = new Date().toISOString();
  const initialStatus = codeMode === 'codigo_unico' ? 'used' : 'active';
  const usedAtVal = codeMode === 'codigo_unico' ? nowIso : null;
  const usedByVal = codeMode === 'codigo_unico' ? `${partner.name} (Código Único)` : null;

  const insert = db.prepare(`
    INSERT INTO redemptions (partner_id, user_id, secret_salt, reference_code, expires_at, status, used_at, used_by_merchant)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(partner_id, user.id, secretSalt, refCode, expiresAt, initialStatus, usedAtVal, usedByVal);

  const redemption = {
    id: Number(insert.lastInsertRowid),
    partner_id,
    user_id: user.id,
    secret_salt: secretSalt,
    reference_code: refCode,
    expires_at: expiresAt,
    status: initialStatus,
  };

  const newUsedCount = priorUses + 1;
  const remainingUses = maxUses !== null ? Math.max(0, maxUses - newUsedCount) : null;

  logAudit(
    user.id,
    'emissao_codigo',
    `Emitido código (${codeMode}) para ${partner.name} (Ref: ${refCode} · Utilização ${newUsedCount}${
      maxUses ? `/${maxUses}` : ''
    })`,
    req.ip,
    req.headers['user-agent']
  );

  const totp = generateTOTPCode(redemption.secret_salt);

  return res.json({
    redemption_id: redemption.id,
    reference_code: redemption.reference_code,
    totp_code: totp.code,
    seconds_remaining: totp.secondsRemaining,
    expires_at: redemption.expires_at,
    partner_name: partner.name,
    benefit_type: partner.benefit_type,
    code_mode: codeMode,
    discount_highlight: partner.discount_highlight,
    benefit_value: partner.benefit_value,
    secret_code: partner.secret_code,
    used_count: newUsedCount,
    prior_uses: priorUses,
    max_uses: maxUses,
    remaining_uses: remainingUses,
    is_limit_reached: maxUses !== null && newUsedCount >= maxUses,
    member_number: user.member_number,
    member_name: user.name,
    timestamp: nowIso,
  });
});

// Refresh 6-digit code for an active redemption
router.get('/benefits/code-refresh/:redemptionId', (req: Request, res: Response) => {
  const user = getSessionUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  const redemption = db.prepare(`
    SELECT * FROM redemptions WHERE id = ? AND user_id = ?
  `).get(req.params.redemptionId, user.id) as any;

  if (!redemption) {
    return res.status(404).json({ error: 'Resgate não encontrado.' });
  }

  if (redemption.status !== 'active' || new Date(redemption.expires_at).getTime() < Date.now()) {
    return res.status(410).json({ error: 'Este código expirou ou já foi utilizado.' });
  }

  const totp = generateTOTPCode(redemption.secret_salt);

  return res.json({
    totp_code: totp.code,
    seconds_remaining: totp.secondsRemaining,
    reference_code: redemption.reference_code,
  });
});

// Merchant Validation Route (`/validar`) — Requires Partner Authentication
router.post('/benefits/verify-code', (req: Request, res: Response) => {
  const partnerSession = getSessionPartner(req);
  if (!partnerSession) {
    return res.status(401).json({
      error: 'Acesso reservado a parceiros autenticados. Inicie sessão como parceiro para validar códigos.',
    });
  }

  if (!partnerSession.protocol_in_force) {
    return res.status(403).json({
      error:
        'A parceria ainda não entrou em vigor. A parceria entra em vigor quando o protocolo for assinado por parte da LPCS e quando a LPCS colocar o protocolo assinado por ambas as partes na área privada da entidade parceira.',
    });
  }

  const { reference_code, code, validation_method } = req.body;
  const methodType = validation_method === 'qr' ? 'qr' : 'manual';

  if (!reference_code || !code) {
    return res.status(400).json({ error: 'Por favor introduza a referência do resgate e o código de 6 dígitos.' });
  }

  const cleanRef = String(reference_code).trim().toUpperCase();
  const cleanCode = String(code).trim();

  const redemption = db.prepare(`
    SELECT r.*, p.name as partner_name, p.benefit_type, p.discount_highlight, p.benefit_value,
           p.max_uses, p.code_mode,
           u.name as member_name, u.member_number, u.nif as member_nif
    FROM redemptions r
    JOIN partners p ON p.id = r.partner_id
    JOIN users u ON u.id = r.user_id
    WHERE r.reference_code = ?
  `).get(cleanRef) as any;

  if (!redemption) {
    logAudit(
      null,
      'validacao_falha',
      `Referência não encontrada (${cleanRef}) por ${partnerSession.partner_name}`,
      req.ip,
      req.headers['user-agent']
    );
    return res.status(404).json({ error: 'Referência de resgate não encontrada no sistema.' });
  }

  if (redemption.partner_id !== partnerSession.partner_id) {
    logAudit(
      redemption.user_id,
      'validacao_falha',
      `Parceiro ${partnerSession.partner_name} tentou validar código de outro parceiro (${redemption.partner_name}, ref: ${cleanRef})`,
      req.ip,
      req.headers['user-agent']
    );
    return res.status(403).json({
      error: `Este código pertence a "${redemption.partner_name}" e não pode ser validado com a conta de "${partnerSession.partner_name}".`,
    });
  }

  if (redemption.status === 'used') {
    logAudit(redemption.user_id, 'validacao_falha', `Tentativa de reutilização do código ${cleanRef} já usado em ${redemption.used_at}`, req.ip, req.headers['user-agent']);
    return res.status(400).json({
      error: `Este código já foi utilizado em ${new Date(redemption.used_at).toLocaleString('pt-PT')} e não pode ser reutilizado.`,
    });
  }

  const usedBeforeRow = db
    .prepare(
      `SELECT COUNT(*) as count
       FROM redemptions
       WHERE user_id = ? AND partner_id = ? AND status = 'used'`
    )
    .get(redemption.user_id, redemption.partner_id) as { count: number };
  const usedBefore = usedBeforeRow?.count || 0;
  const maxUses = redemption.max_uses && Number(redemption.max_uses) > 0 ? Number(redemption.max_uses) : null;

  if (maxUses !== null && usedBefore >= maxUses) {
    logAudit(
      redemption.user_id,
      'validacao_falha',
      `Limite de ${maxUses} utilizações excedido para ${redemption.partner_name} (${usedBefore}/${maxUses})`,
      req.ip,
      req.headers['user-agent']
    );
    return res.status(403).json({
      error: `Bloqueado: O associado ${redemption.member_name} (${redemption.member_number}) já utilizou este desconto ${usedBefore} de ${maxUses} ${
        maxUses === 1 ? 'vez possível' : 'vezes possíveis'
      }.`,
    });
  }

  if (new Date(redemption.expires_at).getTime() < Date.now()) {
    logAudit(redemption.user_id, 'validacao_falha', `Tentativa de validar código expirado: ${cleanRef}`, req.ip, req.headers['user-agent']);
    return res.status(400).json({ error: 'A janela de validade deste resgate (15 minutos) expirou. Solicite ao associado que gere um novo código.' });
  }

  // Verify HMAC TOTP code with clock drift tolerance
  const isValid = verifyTOTPCode(redemption.secret_salt, cleanCode);
  if (!isValid) {
    logAudit(redemption.user_id, 'validacao_falha', `Código de 6 dígitos inválido (${cleanCode}) para ${cleanRef}`, req.ip, req.headers['user-agent']);
    return res.status(400).json({
      error: 'Código de 6 dígitos inválido ou expirado. O código muda a cada 30 segundos. Verifique o ecrã do associado.',
    });
  }

  // Consume the code atomically!
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE redemptions
    SET status = 'used', used_at = ?, used_by_merchant = ?
    WHERE id = ?
  `).run(now, partnerSession.partner_name, redemption.id);

  logAudit(
    redemption.user_id,
    'validacao_sucesso',
    `Desconto validado com sucesso (${methodType === 'qr' ? 'via QR Code' : 'código manual'}) para ${redemption.partner_name} (${partnerSession.email})`,
    req.ip,
    req.headers['user-agent']
  );

  return res.json({
    success: true,
    message: 'Desconto validado e consumido com sucesso!',
    validation_method: methodType,
    validated_at: now,
    partner_name: redemption.partner_name,
    discount_highlight: redemption.discount_highlight,
    benefit_value: redemption.benefit_value,
    member_name: redemption.member_name,
    member_number: redemption.member_number,
    reference_code: redemption.reference_code,
    used_count: usedBefore + 1,
    max_uses: maxUses,
  });
});

// ==========================================
// 7. BACKOFFICE ADMINISTRATION (`/admin`)
// Restricted to ADMIN_EMAIL and is_admin = true
// ==========================================

function requireAdmin(req: Request, res: Response, next: () => void) {
  const user = getSessionUser(req);
  if (!user || !isUserAdmin(user)) {
    logAudit(user?.id || null, 'acesso_admin_negado', `Tentativa de acesso não autorizado a rota administrativa`, req.ip, req.headers['user-agent']);
    return res.status(403).json({ error: 'Acesso restrito ao administrador oficial da LPCS.' });
  }
  next();
}

router.get('/admin/summary', requireAdmin, (_req: Request, res: Response) => {
  const usersCount = db.prepare('SELECT count(*) as count FROM users WHERE is_admin = 0').get() as { count: number };
  const suspendedCount = db.prepare('SELECT count(*) as count FROM users WHERE is_suspended = 1').get() as { count: number };
  const partnersActive = db.prepare('SELECT count(*) as count FROM partners WHERE is_active = 1').get() as { count: number };
  const partnersInactive = db.prepare('SELECT count(*) as count FROM partners WHERE is_active = 0').get() as { count: number };
  const totalRevenueCents = db.prepare("SELECT COALESCE(SUM(amount_cents), 0) as total FROM quotas WHERE status = 'pago'").get() as { total: number };
  const redemptionsUsed = db.prepare("SELECT count(*) as count FROM redemptions WHERE status = 'used'").get() as { count: number };
  const redemptionsTotal = db.prepare('SELECT count(*) as count FROM redemptions').get() as { count: number };

  // Count active quotas
  const today = new Date().toISOString().split('T')[0];
  const activeQuotasCount = db.prepare(`
    SELECT count(DISTINCT user_id) as count FROM quotas
    WHERE status = 'pago' AND valid_until >= ?
  `).get(today) as { count: number };

  const recentLogs = db.prepare(`
    SELECT a.*, u.name as user_name, u.member_number
    FROM audit_logs a
    LEFT JOIN users u ON u.id = a.user_id
    ORDER BY a.created_at DESC LIMIT 20
  `).all();

  return res.json({
    metrics: {
      totalAssociados: usersCount.count,
      associadosQuotaAtiva: activeQuotasCount.count,
      associadosInativos: usersCount.count - activeQuotasCount.count,
      associadosSuspensos: suspendedCount.count,
      parceirosAtivos: partnersActive.count,
      parceirosInativos: partnersInactive.count,
      receitaTotalEuros: totalRevenueCents.total / 100,
      descontosResgatados: redemptionsUsed.count,
      descontosEmitidosTotal: redemptionsTotal.count,
    },
    recentLogs,
  });
});

router.get('/admin/users', requireAdmin, (req: Request, res: Response) => {
  const { filter, search } = req.query;

  let query = 'SELECT * FROM users WHERE 1=1';
  const params: any[] = [];

  if (search && typeof search === 'string' && search.trim() !== '') {
    query += ' AND (name LIKE ? OR email LIKE ? OR member_number LIKE ? OR nif LIKE ? OR city LIKE ?)';
    const term = `%${search.trim()}%`;
    params.push(term, term, term, term, term);
  }

  if (filter === 'suspensos') {
    query += ' AND is_suspended = 1';
  }

  query += ' ORDER BY created_at DESC';

  const rows = db.prepare(query).all(...params) as any[];

  // Augment with quota status and full safe profile fields
  const usersWithQuota = rows.map((u) => {
    const qStatus = getQuotaStatus(u.id);
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      member_number: u.member_number,
      birth_date: u.birth_date,
      address: u.address,
      postal_code: u.postal_code,
      city: u.city,
      nif: u.nif,
      phone: u.phone,
      is_admin: u.is_admin,
      is_suspended: u.is_suspended,
      created_at: u.created_at,
      updated_at: u.updated_at,
      quota_status: qStatus,
    };
  });

  let filtered = usersWithQuota;
  if (filter === 'ativos') {
    filtered = usersWithQuota.filter((u) => u.quota_status.has_active_quota);
  } else if (filter === 'expirar') {
    filtered = usersWithQuota.filter((u) => u.quota_status.status === 'expirar');
  } else if (filter === 'inativos') {
    filtered = usersWithQuota.filter((u) => !u.quota_status.has_active_quota && !u.is_suspended);
  }

  return res.json({ users: filtered });
});

// Admit a new member directly from Administration
router.post('/admin/users', requireAdmin, (req: Request, res: Response) => {
  const admin = getSessionUser(req)!;
  const {
    name,
    email,
    password,
    birth_date,
    address,
    postal_code,
    city,
    nif,
    phone,
    member_number,
    initial_quota,
    initial_quota_method,
    initial_quota_notes,
    is_suspended,
  } = req.body;

  if (!name || String(name).trim().split(/\s+/).length < 2) {
    return res.status(400).json({ error: 'O nome completo deve conter pelo menos dois termos.' });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
    return res.status(400).json({ error: 'Por favor introduza um endereço de e-mail válido.' });
  }
  if (!password || String(password).length < 6) {
    return res.status(400).json({ error: 'A palavra-passe inicial deve ter pelo menos 6 carateres.' });
  }
  if (!birth_date || !validateAge(String(birth_date))) {
    return res.status(400).json({ error: 'O associado deve ter pelo menos 16 anos de idade.' });
  }
  if (!address || String(address).trim().length < 5) {
    return res.status(400).json({ error: 'Por favor indique a morada completa.' });
  }
  if (!postal_code || !validatePostalCode(String(postal_code))) {
    return res.status(400).json({ error: 'O código postal deve seguir o formato português 0000-000.' });
  }
  if (!city || String(city).trim().length < 2) {
    return res.status(400).json({ error: 'Por favor indique a localidade.' });
  }
  if (!nif || !validateNif(String(nif))) {
    return res.status(400).json({ error: 'NIF inválido segundo o algoritmo oficial (Módulo 11).' });
  }
  if (!phone || !validatePortuguesePhone(String(phone))) {
    return res.status(400).json({ error: 'Telemóvel inválido (9 dígitos começado por 91, 92, 93 ou 96).' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const normalizedNif = String(nif).trim();

  const existingEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
  if (existingEmail) {
    return res.status(400).json({ error: 'Já existe um associado registado com este endereço de e-mail.' });
  }

  const existingNif = db.prepare('SELECT id FROM users WHERE nif = ?').get(normalizedNif);
  if (existingNif) {
    return res.status(400).json({ error: 'Já existe um associado registado com este NIF.' });
  }

  let finalMemberNumber = member_number ? String(member_number).trim().toUpperCase() : '';
  if (finalMemberNumber) {
    if (!/^LPCS-[A-Z0-9]{4,10}$/.test(finalMemberNumber)) {
      return res.status(400).json({ error: 'O nº de sócio deve seguir o formato LPCS-XXXXX.' });
    }
    const existingMemberNumber = db
      .prepare('SELECT id FROM users WHERE member_number = ?')
      .get(finalMemberNumber);
    if (existingMemberNumber) {
      return res.status(400).json({ error: 'Este número de sócio já se encontra atribuído.' });
    }
  } else {
    finalMemberNumber = generateMemberNumber();
  }

  const { hash, salt } = hashPassword(String(password));
  const suspendedFlag = is_suspended ? 1 : 0;

  try {
    const insertResult = db.prepare(`
      INSERT INTO users (
        name, email, password_hash, salt, birth_date, address, postal_code,
        city, nif, phone, member_number, is_admin, is_suspended
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
    `).run(
      String(name).trim(),
      normalizedEmail,
      hash,
      salt,
      String(birth_date),
      String(address).trim(),
      String(postal_code).trim(),
      String(city).trim(),
      normalizedNif,
      String(phone).trim(),
      finalMemberNumber,
      suspendedFlag
    );

    const newUserId = Number(insertResult.lastInsertRowid);

    let quotaNote = '';
    if (initial_quota === 'semestral' || initial_quota === 'anual') {
      const monthsToAdd = initial_quota === 'semestral' ? 6 : 12;
      const amountCents = initial_quota === 'semestral' ? 1750 : 3500;
      const startDate = new Date();
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + monthsToAdd);
      const validFromStr = startDate.toISOString().split('T')[0];
      const validUntilStr = endDate.toISOString().split('T')[0];
      const ref = `ADM-LPCS-${Date.now().toString().slice(-6)}`;
      const method = ['manual', 'transferencia', 'mbway', 'multibanco'].includes(initial_quota_method)
        ? initial_quota_method
        : 'manual';

      db.prepare(`
        INSERT INTO quotas (
          user_id, plan_type, amount_cents, payment_method, reference, status, valid_from, valid_until
        ) VALUES (?, ?, ?, ?, ?, 'pago', ?, ?)
      `).run(newUserId, initial_quota, amountCents, method, ref, validFromStr, validUntilStr);

      quotaNote = ` com quota ${initial_quota} ativa até ${validUntilStr}`;
    }

    logAudit(
      admin.id,
      'admin_admissao_socio',
      `Admitido associado ${String(name).trim()} (${finalMemberNumber}, ${normalizedEmail})${quotaNote}${
        initial_quota_notes ? `. Nota: ${initial_quota_notes}` : ''
      }`,
      req.ip,
      req.headers['user-agent']
    );

    notifyNewMemberRegistration({
      id: newUserId,
      name: String(name).trim(),
      email: normalizedEmail,
      member_number: finalMemberNumber,
      nif: normalizedNif,
      phone: String(phone).trim(),
      birth_date: String(birth_date),
      address: String(address).trim(),
      postal_code: String(postal_code).trim(),
      city: String(city).trim(),
      origin: 'Admissão Administrativa (/admin)',
    }).catch((mailErr) => console.error('Failed to send admin admission email:', mailErr));

    return res.json({
      success: true,
      userId: newUserId,
      member_number: finalMemberNumber,
      message: `Associado ${String(name).trim()} admitido com o nº ${finalMemberNumber}${quotaNote}. Notificação enviada para ${INSTITUTIONAL_NOTIFICATION_EMAIL}.`,
    });
  } catch (err) {
    console.error('Admin admit user error:', err);
    return res.status(500).json({ error: 'Erro ao admitir associado.' });
  }
});

// Get complete individual details for managing a single member
router.get('/admin/users/:id', requireAdmin, (req: Request, res: Response) => {
  const targetId = Number(req.params.id);
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId) as any;
  if (!u) {
    return res.status(404).json({ error: 'Associado não encontrado.' });
  }

  const quotas = db
    .prepare('SELECT * FROM quotas WHERE user_id = ? ORDER BY created_at DESC')
    .all(targetId);

  const receipts = db
    .prepare(
      'SELECT id, quota_id, original_name, mime_type, file_size, notes, created_at FROM receipts WHERE user_id = ? ORDER BY created_at DESC'
    )
    .all(targetId);

  const redemptions = db
    .prepare(`
      SELECT r.id, r.partner_id, p.name as partner_name, r.reference_code, r.status,
             r.issued_at, r.expires_at, r.used_at, r.used_by_merchant
      FROM redemptions r
      JOIN partners p ON p.id = r.partner_id
      WHERE r.user_id = ?
      ORDER BY r.issued_at DESC
      LIMIT 30
    `)
    .all(targetId);

  const auditLogs = db
    .prepare('SELECT * FROM audit_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 20')
    .all(targetId);

  return res.json({
    member: {
      id: u.id,
      name: u.name,
      email: u.email,
      member_number: u.member_number,
      birth_date: u.birth_date,
      address: u.address,
      postal_code: u.postal_code,
      city: u.city,
      nif: u.nif,
      phone: u.phone,
      is_admin: u.is_admin,
      is_suspended: u.is_suspended,
      created_at: u.created_at,
      updated_at: u.updated_at,
      quota_status: getQuotaStatus(u.id),
    },
    quotas,
    receipts,
    redemptions,
    auditLogs,
  });
});

// Update individual member details
router.put('/admin/users/:id', requireAdmin, (req: Request, res: Response) => {
  const admin = getSessionUser(req)!;
  const targetId = Number(req.params.id);
  const existingUser = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId) as any;
  if (!existingUser) {
    return res.status(404).json({ error: 'Associado não encontrado.' });
  }

  const {
    name,
    email,
    birth_date,
    address,
    postal_code,
    city,
    nif,
    phone,
    member_number,
    is_suspended,
  } = req.body;

  if (!name || String(name).trim().split(/\s+/).length < 2) {
    return res.status(400).json({ error: 'O nome completo deve conter pelo menos dois termos.' });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
    return res.status(400).json({ error: 'Endereço de e-mail inválido.' });
  }
  if (!birth_date || !validateAge(String(birth_date))) {
    return res.status(400).json({ error: 'A idade mínima para associado é de 16 anos.' });
  }
  if (!address || String(address).trim().length < 5) {
    return res.status(400).json({ error: 'Indique a morada completa.' });
  }
  if (!postal_code || !validatePostalCode(String(postal_code))) {
    return res.status(400).json({ error: 'Código postal inválido (use 0000-000).' });
  }
  if (!city || String(city).trim().length < 2) {
    return res.status(400).json({ error: 'Indique a localidade.' });
  }
  if (!nif || !validateNif(String(nif))) {
    return res.status(400).json({ error: 'NIF inválido (falhou verificação Módulo 11).' });
  }
  if (!phone || !validatePortuguesePhone(String(phone))) {
    return res.status(400).json({ error: 'Telemóvel português inválido (91/92/93/96).' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const normalizedNif = String(nif).trim();
  const normalizedMemberNo = member_number
    ? String(member_number).trim().toUpperCase()
    : existingUser.member_number;

  if (!/^LPCS-[A-Z0-9]{4,10}$/.test(normalizedMemberNo)) {
    return res.status(400).json({ error: 'O nº de sócio deve seguir o formato LPCS-XXXXX.' });
  }

  if (db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(normalizedEmail, targetId)) {
    return res.status(400).json({ error: 'Já existe outro associado com este e-mail.' });
  }
  if (db.prepare('SELECT id FROM users WHERE nif = ? AND id != ?').get(normalizedNif, targetId)) {
    return res.status(400).json({ error: 'Já existe outro associado com este NIF.' });
  }
  if (
    db
      .prepare('SELECT id FROM users WHERE member_number = ? AND id != ?')
      .get(normalizedMemberNo, targetId)
  ) {
    return res.status(400).json({ error: 'Este nº de sócio já pertence a outro associado.' });
  }

  const newSuspended =
    typeof is_suspended === 'boolean'
      ? is_suspended
        ? 1
        : 0
      : typeof is_suspended === 'number'
      ? is_suspended
        ? 1
        : 0
      : existingUser.is_suspended;

  if (targetId === admin.id && newSuspended === 1) {
    return res.status(400).json({ error: 'O administrador não pode suspender a própria conta.' });
  }

  db.prepare(`
    UPDATE users
    SET name = ?, email = ?, birth_date = ?, address = ?, postal_code = ?,
        city = ?, nif = ?, phone = ?, member_number = ?, is_suspended = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(
    String(name).trim(),
    normalizedEmail,
    String(birth_date),
    String(address).trim(),
    String(postal_code).trim(),
    String(city).trim(),
    normalizedNif,
    String(phone).trim(),
    normalizedMemberNo,
    newSuspended,
    targetId
  );

  if (newSuspended === 1) {
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(targetId);
  }

  logAudit(
    admin.id,
    'admin_edicao_socio',
    `Ficha do associado ${String(name).trim()} (${normalizedMemberNo}) atualizada pela administração`,
    req.ip,
    req.headers['user-agent']
  );

  return res.json({
    success: true,
    message: `Ficha de ${String(name).trim()} atualizada com sucesso.`,
  });
});

// Reset member password from Administration
router.post('/admin/users/:id/password', requireAdmin, (req: Request, res: Response) => {
  const admin = getSessionUser(req)!;
  const targetId = Number(req.params.id);
  const { password } = req.body;

  if (!password || String(password).length < 6) {
    return res.status(400).json({ error: 'A nova palavra-passe deve ter pelo menos 6 carateres.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId) as any;
  if (!user) {
    return res.status(404).json({ error: 'Associado não encontrado.' });
  }

  const { hash, salt } = hashPassword(String(password));
  db.prepare("UPDATE users SET password_hash = ?, salt = ?, updated_at = datetime('now') WHERE id = ?").run(
    hash,
    salt,
    targetId
  );

  logAudit(
    admin.id,
    'admin_redefinicao_password',
    `Palavra-passe redefinida pela administração para ${user.name} (${user.member_number})`,
    req.ip,
    req.headers['user-agent']
  );

  return res.json({
    success: true,
    message: `Palavra-passe de ${user.name} redefinida com sucesso.`,
  });
});

router.post('/admin/users/:id/suspend', requireAdmin, (req: Request, res: Response) => {
  const admin = getSessionUser(req)!;
  const targetId = Number(req.params.id);

  if (targetId === admin.id) {
    return res.status(400).json({ error: 'O administrador não pode suspender a sua própria conta.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId) as any;
  if (!user) {
    return res.status(404).json({ error: 'Associado não encontrado.' });
  }

  const newStatus = user.is_suspended ? 0 : 1;
  db.prepare('UPDATE users SET is_suspended = ? WHERE id = ?').run(newStatus, targetId);

  // If suspending, destroy all their active sessions
  if (newStatus === 1) {
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(targetId);
  }

  logAudit(
    admin.id,
    newStatus === 1 ? 'admin_suspensao_socio' : 'admin_reativacao_socio',
    `Associado ${user.name} (${user.member_number}) ${newStatus === 1 ? 'suspenso' : 'reativado'}`,
    req.ip,
    req.headers['user-agent']
  );

  return res.json({
    success: true,
    message: newStatus === 1 ? 'Associado suspenso com sucesso.' : 'Associado reativado com sucesso.',
    is_suspended: newStatus,
  });
});

router.post('/admin/users/:id/quota', requireAdmin, (req: Request, res: Response) => {
  const admin = getSessionUser(req)!;
  const targetId = Number(req.params.id);
  const { plan_type, notes } = req.body;

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId) as any;
  if (!user) {
    return res.status(404).json({ error: 'Associado não encontrado.' });
  }

  const monthsToAdd = plan_type === 'semestral' ? 6 : 12;
  const amountCents = plan_type === 'semestral' ? 1750 : 3500;

  const currentStatus = getQuotaStatus(targetId);
  let startDate: Date;
  if (currentStatus.has_active_quota && currentStatus.valid_until) {
    startDate = new Date(currentStatus.valid_until + 'T00:00:00');
  } else {
    startDate = new Date();
  }

  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + monthsToAdd);

  const validFromStr = startDate.toISOString().split('T')[0];
  const validUntilStr = endDate.toISOString().split('T')[0];
  const ref = `MANUAL-ADMIN-${Date.now().toString().slice(-6)}`;

  db.prepare(`
    INSERT INTO quotas (
      user_id, plan_type, amount_cents, payment_method, reference, status, valid_from, valid_until
    ) VALUES (?, ?, ?, 'manual', ?, 'pago', ?, ?)
  `).run(targetId, plan_type, amountCents, ref, validFromStr, validUntilStr);

  logAudit(
    admin.id,
    'admin_lancamento_quota',
    `Quota ${plan_type} lançada manualmente para ${user.name} (${user.member_number}) até ${validUntilStr}. Nota: ${notes || 'Sem nota'}`,
    req.ip,
    req.headers['user-agent']
  );

  return res.json({
    success: true,
    message: `Quota atribuída com sucesso até ${validUntilStr}.`,
  });
});

// Remove/annul an individual quota entry
router.delete('/admin/quotas/:quotaId', requireAdmin, (req: Request, res: Response) => {
  const admin = getSessionUser(req)!;
  const quotaId = Number(req.params.quotaId);

  const quota = db
    .prepare(`
      SELECT q.*, u.name as user_name, u.member_number
      FROM quotas q
      JOIN users u ON u.id = q.user_id
      WHERE q.id = ?
    `)
    .get(quotaId) as any;

  if (!quota) {
    return res.status(404).json({ error: 'Registo de quota não encontrado.' });
  }

  db.prepare('DELETE FROM quotas WHERE id = ?').run(quotaId);

  logAudit(
    admin.id,
    'admin_remocao_quota',
    `Quota ${quota.reference} (${quota.plan_type}) removida da ficha de ${quota.user_name} (${quota.member_number})`,
    req.ip,
    req.headers['user-agent']
  );

  return res.json({ success: true, message: 'Registo de quota anulado e removido com sucesso.' });
});

router.delete('/admin/users/:id', requireAdmin, (req: Request, res: Response) => {
  const admin = getSessionUser(req)!;
  const targetId = Number(req.params.id);

  if (targetId === admin.id) {
    return res.status(400).json({ error: 'O administrador não se pode remover a si próprio.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId) as any;
  if (!user) {
    return res.status(404).json({ error: 'Associado não encontrado.' });
  }

  // Explicitly clean dependent tables + delete user
  const deleteMemberTx = db.transaction((uid: number) => {
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(uid);
    db.prepare('DELETE FROM redemptions WHERE user_id = ?').run(uid);
    db.prepare('DELETE FROM receipts WHERE user_id = ?').run(uid);
    db.prepare('DELETE FROM quotas WHERE user_id = ?').run(uid);
    db.prepare('UPDATE audit_logs SET user_id = NULL WHERE user_id = ?').run(uid);
    db.prepare('DELETE FROM users WHERE id = ?').run(uid);
  });

  deleteMemberTx(targetId);

  logAudit(
    admin.id,
    'admin_remocao_socio',
    `Conta do associado ${user.name} (${user.member_number}, ${user.email}) e dados associados eliminados`,
    req.ip,
    req.headers['user-agent']
  );

  return res.json({ success: true, message: `Associado ${user.name} (${user.member_number}) removido com sucesso.` });
});

// Partner CRUD for Admin (including Partner login credentials, mandatory logo & service images)
router.get('/admin/partners', requireAdmin, (_req: Request, res: Response) => {
  const rows = db
    .prepare(`
      SELECT p.id, p.name, p.category, p.description, p.area, p.district, p.city,
             p.benefit_type, p.benefit_value, p.discount_highlight, p.usage_limit,
             p.max_uses, p.code_mode,
             p.estimated_annual_savings, p.valid_until, p.terms, p.website,
             p.is_active, p.secret_code, p.created_at,
             p.nif, p.address, p.contact_role,
             p.protocol_in_force,
             p.signed_protocol_name, p.signed_protocol_uploaded_at,
             length(p.signed_protocol_base64) as signed_len,
             p.counter_signed_protocol_name, p.counter_signed_protocol_uploaded_at,
             length(p.counter_signed_protocol_base64) as counter_signed_len,
             length(p.logo_base64) as logo_len,
             pa.email as partner_email, pa.is_active as account_active, pa.contact_name
      FROM partners p
      LEFT JOIN partner_accounts pa ON pa.partner_id = p.id
      ORDER BY p.name ASC
    `)
    .all() as any[];

  const imagesMap = getPartnerServiceImagesMap(rows.map((p) => p.id));
  const partners = rows.map((p) => ({
    ...p,
    protocol_in_force: Boolean(p.protocol_in_force === 1 || p.counter_signed_len > 0),
    has_signed_protocol: Boolean(p.signed_len > 0 || p.protocol_in_force === 1),
    signed_protocol_url: `/api/admin/partners/${p.id}/signed-protocol`,
    has_counter_signed_protocol: Boolean(p.counter_signed_len > 0 || p.protocol_in_force === 1),
    counter_signed_protocol_url: `/api/admin/partners/${p.id}/counter-signed-protocol`,
    logo_url: p.logo_len ? `/api/partners/${p.id}/logo?v=${p.logo_len}` : null,
    service_images: imagesMap[p.id] || [],
  }));
  return res.json({ partners });
});

router.post('/admin/partners', requireAdmin, withPartnerMedia, (req: Request, res: Response) => {
  const admin = getSessionUser(req)!;
  const files = (req.files || {}) as Record<string, Express.Multer.File[]>;
  const logoFile = files.logo?.[0];
  const serviceFiles = files.service_images || [];
  const counterSignedFile = files.counter_signed_protocol?.[0];
  const signedFile = files.signed_protocol?.[0];

  const {
    name,
    category,
    description,
    area,
    district,
    city,
    benefit_type,
    benefit_value,
    discount_highlight,
    usage_limit,
    max_uses,
    code_mode,
    estimated_annual_savings,
    valid_until,
    terms,
    website,
    is_active,
    secret_code,
    partner_email,
    partner_password,
    from_inquiry_id,
  } = req.body;

  if (!name || !area || !benefit_type || !discount_highlight || !secret_code || !valid_until) {
    return res.status(400).json({ error: 'Preencha todos os campos obrigatórios do parceiro (incluindo a data de validade).' });
  }

  let logoMime: string | null = logoFile ? logoFile.mimetype : null;
  let logoBase64: string | null = logoFile ? logoFile.buffer.toString('base64') : null;
  let inqNif: string | null = null;
  let inqAddress: string | null = null;
  let inqContactName: string | null = null;
  let inqContactRole: string | null = null;
  let signedProtoName: string | null = signedFile ? signedFile.originalname : null;
  let signedProtoMime: string | null = signedFile ? signedFile.mimetype : null;
  let signedProtoBase64: string | null = signedFile ? signedFile.buffer.toString('base64') : null;
  let signedProtoUploadedAt: string | null = signedFile ? new Date().toISOString() : null;
  let counterProtoName: string | null = counterSignedFile ? counterSignedFile.originalname : null;
  let counterProtoMime: string | null = counterSignedFile ? counterSignedFile.mimetype : null;
  let counterProtoBase64: string | null = counterSignedFile ? counterSignedFile.buffer.toString('base64') : null;
  let counterProtoUploadedAt: string | null = counterSignedFile ? new Date().toISOString() : null;

  let inquiryImages: Array<{
    original_name: string;
    mime_type: string;
    file_size: number;
    file_base64: string;
  }> = [];

  if (from_inquiry_id) {
    const inq = db
      .prepare('SELECT * FROM partner_inquiries WHERE id = ?')
      .get(Number(from_inquiry_id)) as any;
    if (inq) {
      if (!logoBase64 && inq.logo_base64 && inq.logo_mime) {
        logoMime = inq.logo_mime;
        logoBase64 = inq.logo_base64;
      }
      inqNif = inq.nif || null;
      inqAddress = inq.address || null;
      inqContactName = inq.contact_name || null;
      inqContactRole = inq.contact_role || null;
      if (!signedProtoBase64 && inq.signed_protocol_base64) {
        signedProtoName = inq.signed_protocol_name;
        signedProtoMime = inq.signed_protocol_mime;
        signedProtoBase64 = inq.signed_protocol_base64;
        signedProtoUploadedAt = inq.signed_protocol_uploaded_at;
      }
      if (!counterProtoBase64 && inq.counter_signed_protocol_base64) {
        counterProtoName = inq.counter_signed_protocol_name;
        counterProtoMime = inq.counter_signed_protocol_mime;
        counterProtoBase64 = inq.counter_signed_protocol_base64;
        counterProtoUploadedAt = inq.counter_signed_protocol_uploaded_at;
      }
    }
    inquiryImages = db
      .prepare(
        'SELECT original_name, mime_type, file_size, file_base64 FROM partner_inquiry_images WHERE inquiry_id = ? ORDER BY id ASC'
      )
      .all(Number(from_inquiry_id)) as any[];
  }

  if (!logoMime || !logoBase64) {
    return res.status(400).json({
      error: 'O logótipo da entidade parceira é obrigatório ao registar um novo parceiro.',
    });
  }

  // Partnership enters into force when signed by LPCS and counter-signed protocol is placed in the partner's private area
  const hasCounterSigned = Boolean(counterProtoBase64);
  const protocolInForce = from_inquiry_id ? (hasCounterSigned ? 1 : 0) : 1;

  const requestedActive =
    typeof is_active === 'boolean'
      ? is_active
      : String(is_active).toLowerCase() !== 'false' && String(is_active) !== '0';

  const activeFlag = requestedActive && protocolInForce === 1;

  const loginEmail =
    partner_email && String(partner_email).trim()
      ? String(partner_email).trim().toLowerCase()
      : slugifyPartnerEmail(name.trim());

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginEmail)) {
    return res.status(400).json({ error: 'O e-mail de acesso do parceiro não é válido.' });
  }

  if (db.prepare('SELECT id FROM partner_accounts WHERE email = ?').get(loginEmail)) {
    return res.status(400).json({ error: 'Já existe uma conta de parceiro com este e-mail.' });
  }

  const rawPassword =
    partner_password && String(partner_password).trim().length > 0
      ? String(partner_password)
      : 'Parceiro!2026';

  if (rawPassword.length < 6) {
    return res.status(400).json({ error: 'A palavra-passe do parceiro deve ter pelo menos 6 carateres.' });
  }

  const parsedMaxUses =
    max_uses !== undefined && max_uses !== null && String(max_uses).trim() !== '' && Number(max_uses) > 0
      ? Math.floor(Number(max_uses))
      : null;
  const finalCodeMode = code_mode === 'codigo_unico' ? 'codigo_unico' : 'rotativo';

  const result = db.prepare(`
    INSERT INTO partners (
      name, category, description, area, district, city, benefit_type,
      benefit_value, discount_highlight, usage_limit, max_uses, code_mode, estimated_annual_savings,
      valid_until, terms, website, is_active, secret_code, logo_mime, logo_base64,
      nif, address, contact_name, contact_role,
      signed_protocol_name, signed_protocol_mime, signed_protocol_base64, signed_protocol_uploaded_at,
      counter_signed_protocol_name, counter_signed_protocol_mime, counter_signed_protocol_base64, counter_signed_protocol_uploaded_at,
      protocol_in_force
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    name.trim(),
    category || 'Geral',
    description || '',
    area,
    district || 'Nacional',
    city || 'Nacional',
    benefit_type,
    benefit_value || discount_highlight,
    discount_highlight,
    usage_limit || (parsedMaxUses ? `Até ${parsedMaxUses} utilizações por sócio` : 'Utilização contínua'),
    parsedMaxUses,
    finalCodeMode,
    parseFloat(estimated_annual_savings) || 40.0,
    valid_until || '2027-12-31',
    terms || 'Condições gerais LPCS',
    website || '',
    activeFlag ? 1 : 0,
    secret_code.trim().toUpperCase(),
    logoMime,
    logoBase64,
    inqNif,
    inqAddress,
    inqContactName,
    inqContactRole,
    signedProtoName,
    signedProtoMime,
    signedProtoBase64,
    signedProtoUploadedAt,
    counterProtoName,
    counterProtoMime,
    counterProtoBase64,
    counterProtoUploadedAt,
    protocolInForce
  );

  const partnerId = Number(result.lastInsertRowid);

  // Store illustrative service images (new uploads or carried from inquiry)
  const insertImgStmt = db.prepare(`
    INSERT INTO partner_images (
      partner_id, original_name, mime_type, file_size, file_base64, caption, sort_order
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  let sortIdx = 0;
  for (const img of inquiryImages) {
    if (sortIdx >= 4) break;
    insertImgStmt.run(
      partnerId,
      img.original_name,
      img.mime_type,
      img.file_size,
      img.file_base64,
      `${name.trim()} — Serviço`,
      sortIdx++
    );
  }
  for (const f of serviceFiles) {
    if (sortIdx >= 4) break;
    insertImgStmt.run(
      partnerId,
      f.originalname,
      f.mimetype,
      f.size,
      f.buffer.toString('base64'),
      `${name.trim()} — Serviço`,
      sortIdx++
    );
  }

  if (from_inquiry_id) {
    db.prepare("UPDATE partner_inquiries SET status = 'aprovada' WHERE id = ?").run(
      Number(from_inquiry_id)
    );
  }

  const { hash, salt } = hashPassword(rawPassword);
  db.prepare(`
    INSERT INTO partner_accounts (partner_id, email, password_hash, salt, contact_name, is_active)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(partnerId, loginEmail, hash, salt, inqContactName || `Equipa ${name.trim()}`, 1);

  logAudit(
    admin.id,
    'admin_criacao_parceiro',
    `Novo parceiro criado: ${name} (${loginEmail}) — Protocolo em vigor: ${protocolInForce === 1 ? 'Sim' : 'Aguarda protocolo assinado LPCS'}`,
    req.ip,
    req.headers['user-agent']
  );

  return res.json({
    success: true,
    partnerId,
    partner_email: loginEmail,
    protocol_in_force: protocolInForce === 1,
  });
});

router.put('/admin/partners/:id', requireAdmin, withPartnerMedia, (req: Request, res: Response) => {
  const admin = getSessionUser(req)!;
  const partnerId = Number(req.params.id);
  const existingPartner = db.prepare('SELECT * FROM partners WHERE id = ?').get(partnerId) as any;
  if (!existingPartner) {
    return res.status(404).json({ error: 'Parceiro não encontrado.' });
  }

  const files = (req.files || {}) as Record<string, Express.Multer.File[]>;
  const logoFile = files.logo?.[0];
  const serviceFiles = files.service_images || [];
  const counterSignedFile = files.counter_signed_protocol?.[0];
  const signedFile = files.signed_protocol?.[0];

  const {
    name,
    category,
    description,
    area,
    district,
    city,
    benefit_type,
    benefit_value,
    discount_highlight,
    usage_limit,
    max_uses,
    code_mode,
    estimated_annual_savings,
    valid_until,
    terms,
    website,
    is_active,
    secret_code,
    partner_email,
    partner_password,
    remove_image_ids,
  } = req.body;

  if (partner_email && String(partner_email).trim()) {
    const normalizedEmail = String(partner_email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({ error: 'E-mail de acesso do parceiro inválido.' });
    }
    const conflict = db
      .prepare('SELECT id FROM partner_accounts WHERE email = ? AND partner_id != ?')
      .get(normalizedEmail, partnerId);
    if (conflict) {
      return res.status(400).json({ error: 'Este e-mail já está atribuído a outro parceiro.' });
    }
  }

  if (partner_password && String(partner_password).length > 0 && String(partner_password).length < 6) {
    return res.status(400).json({ error: 'A palavra-passe do parceiro deve ter pelo menos 6 carateres.' });
  }

  const finalCounterName = counterSignedFile
    ? counterSignedFile.originalname
    : existingPartner.counter_signed_protocol_name;
  const finalCounterMime = counterSignedFile
    ? counterSignedFile.mimetype
    : existingPartner.counter_signed_protocol_mime;
  const finalCounterBase64 = counterSignedFile
    ? counterSignedFile.buffer.toString('base64')
    : existingPartner.counter_signed_protocol_base64;
  const finalCounterUploadedAt = counterSignedFile
    ? new Date().toISOString()
    : existingPartner.counter_signed_protocol_uploaded_at;

  const finalSignedName = signedFile
    ? signedFile.originalname
    : existingPartner.signed_protocol_name;
  const finalSignedMime = signedFile
    ? signedFile.mimetype
    : existingPartner.signed_protocol_mime;
  const finalSignedBase64 = signedFile
    ? signedFile.buffer.toString('base64')
    : existingPartner.signed_protocol_base64;
  const finalSignedUploadedAt = signedFile
    ? new Date().toISOString()
    : existingPartner.signed_protocol_uploaded_at;

  const protocolInForce = counterSignedFile
    ? 1
    : existingPartner.protocol_in_force === 1 || Boolean(finalCounterBase64)
    ? 1
    : 0;

  const requestedActive =
    typeof is_active === 'boolean'
      ? is_active
      : String(is_active).toLowerCase() !== 'false' && String(is_active) !== '0';

  const activeFlag = requestedActive && protocolInForce === 1;

  const finalLogoMime = logoFile ? logoFile.mimetype : existingPartner.logo_mime;
  const finalLogoBase64 = logoFile
    ? logoFile.buffer.toString('base64')
    : existingPartner.logo_base64;

  if (!finalLogoMime || !finalLogoBase64) {
    return res.status(400).json({ error: 'O logótipo da entidade parceira é obrigatório.' });
  }

  const parsedMaxUses =
    max_uses !== undefined && max_uses !== null && String(max_uses).trim() !== '' && Number(max_uses) > 0
      ? Math.floor(Number(max_uses))
      : null;
  const finalCodeMode = code_mode === 'codigo_unico' ? 'codigo_unico' : 'rotativo';

  db.prepare(`
    UPDATE partners SET
      name = ?, category = ?, description = ?, area = ?, district = ?, city = ?,
      benefit_type = ?, benefit_value = ?, discount_highlight = ?, usage_limit = ?,
      max_uses = ?, code_mode = ?,
      estimated_annual_savings = ?, valid_until = ?, terms = ?, website = ?,
      is_active = ?, secret_code = ?, logo_mime = ?, logo_base64 = ?,
      signed_protocol_name = ?, signed_protocol_mime = ?, signed_protocol_base64 = ?, signed_protocol_uploaded_at = ?,
      counter_signed_protocol_name = ?, counter_signed_protocol_mime = ?, counter_signed_protocol_base64 = ?, counter_signed_protocol_uploaded_at = ?,
      protocol_in_force = ?
    WHERE id = ?
  `).run(
    name.trim(),
    category,
    description,
    area,
    district,
    city,
    benefit_type,
    benefit_value,
    discount_highlight,
    usage_limit,
    parsedMaxUses,
    finalCodeMode,
    parseFloat(estimated_annual_savings) || 40.0,
    valid_until,
    terms,
    website,
    activeFlag ? 1 : 0,
    secret_code.trim().toUpperCase(),
    finalLogoMime,
    finalLogoBase64,
    finalSignedName,
    finalSignedMime,
    finalSignedBase64,
    finalSignedUploadedAt,
    finalCounterName,
    finalCounterMime,
    finalCounterBase64,
    finalCounterUploadedAt,
    protocolInForce,
    partnerId
  );

  // Remove selected service images if requested
  if (remove_image_ids) {
    let idsToRemove: number[] = [];
    if (Array.isArray(remove_image_ids)) {
      idsToRemove = remove_image_ids.map(Number).filter((n) => !isNaN(n));
    } else if (typeof remove_image_ids === 'string') {
      try {
        const parsed = JSON.parse(remove_image_ids);
        if (Array.isArray(parsed)) {
          idsToRemove = parsed.map(Number).filter((n) => !isNaN(n));
        }
      } catch {
        idsToRemove = remove_image_ids
          .split(',')
          .map((s) => Number(s.trim()))
          .filter((n) => !isNaN(n));
      }
    }
    const delImgStmt = db.prepare('DELETE FROM partner_images WHERE id = ? AND partner_id = ?');
    for (const imgId of idsToRemove) {
      delImgStmt.run(imgId, partnerId);
    }
  }

  // Append newly uploaded service images (cap at 4 total)
  if (serviceFiles.length > 0) {
    const currentCount = (
      db
        .prepare('SELECT count(*) as count FROM partner_images WHERE partner_id = ?')
        .get(partnerId) as { count: number }
    ).count;
    let slot = currentCount;
    const insertImgStmt = db.prepare(`
      INSERT INTO partner_images (
        partner_id, original_name, mime_type, file_size, file_base64, caption, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const f of serviceFiles) {
      if (slot >= 4) break;
      insertImgStmt.run(
        partnerId,
        f.originalname,
        f.mimetype,
        f.size,
        f.buffer.toString('base64'),
        `${name.trim()} — Serviço`,
        slot++
      );
    }
  }

  // Sync or create partner_accounts record
  const existingAcc = db
    .prepare('SELECT * FROM partner_accounts WHERE partner_id = ?')
    .get(partnerId) as any;

  if (existingAcc) {
    const updatedEmail =
      partner_email && String(partner_email).trim()
        ? String(partner_email).trim().toLowerCase()
        : existingAcc.email;

    if (partner_password && String(partner_password).length >= 6) {
      const { hash, salt } = hashPassword(String(partner_password));
      db.prepare(`
        UPDATE partner_accounts
        SET email = ?, password_hash = ?, salt = ?, is_active = 1, updated_at = datetime('now')
        WHERE partner_id = ?
      `).run(updatedEmail, hash, salt, partnerId);
    } else {
      db.prepare(`
        UPDATE partner_accounts
        SET email = ?, is_active = 1, updated_at = datetime('now')
        WHERE partner_id = ?
      `).run(updatedEmail, partnerId);
    }
  } else {
    const newEmail =
      partner_email && String(partner_email).trim()
        ? String(partner_email).trim().toLowerCase()
        : slugifyPartnerEmail(name.trim());
    const { hash, salt } = hashPassword(
      partner_password && String(partner_password).length >= 6
        ? String(partner_password)
        : 'Parceiro!2026'
    );
    db.prepare(`
      INSERT INTO partner_accounts (partner_id, email, password_hash, salt, contact_name, is_active)
      VALUES (?, ?, ?, ?, ?, 1)
    `).run(partnerId, newEmail, hash, salt, `Equipa ${name.trim()}`);
  }

  logAudit(admin.id, 'admin_edicao_parceiro', `Parceiro editado: ${name} (ID: ${partnerId})`, req.ip, req.headers['user-agent']);

  return res.json({ success: true, message: 'Parceiro atualizado com sucesso.' });
});

// LPCS Admin uploads the counter-signed protocol (signed by BOTH LPCS and Partner) to the Partner's Private Area
router.post(
  '/admin/partners/:id/counter-signed-protocol',
  requireAdmin,
  upload.single('counter_signed_protocol'),
  (req: Request, res: Response) => {
    const admin = getSessionUser(req)!;
    const partnerId = Number(req.params.id);
    const partner = db.prepare('SELECT * FROM partners WHERE id = ?').get(partnerId) as any;
    if (!partner) {
      return res.status(404).json({ error: 'Parceiro não encontrado.' });
    }
    if (!req.file) {
      return res.status(400).json({
        error: 'Selecione o ficheiro do protocolo assinado por ambas as partes (PDF, PNG ou JPG).',
      });
    }

    const now = new Date().toISOString();
    const base64Data = req.file.buffer.toString('base64');
    db.prepare(`
      UPDATE partners
      SET counter_signed_protocol_name = ?,
          counter_signed_protocol_mime = ?,
          counter_signed_protocol_base64 = ?,
          counter_signed_protocol_uploaded_at = ?,
          protocol_in_force = 1,
          is_active = 1
      WHERE id = ?
    `).run(
      req.file.originalname,
      req.file.mimetype,
      base64Data,
      now,
      partnerId
    );

    db.prepare(`
      UPDATE partner_inquiries
      SET counter_signed_protocol_name = ?,
          counter_signed_protocol_mime = ?,
          counter_signed_protocol_base64 = ?,
          counter_signed_protocol_uploaded_at = ?,
          status = 'aprovada'
      WHERE LOWER(company_name) = LOWER(?)
    `).run(req.file.originalname, req.file.mimetype, base64Data, now, partner.name);

    logAudit(
      admin.id,
      'admin_upload_protocolo_ambas_partes',
      `LPCS colocou o protocolo assinado por ambas as partes (${req.file.originalname}) na área privada do parceiro ${partner.name} — Parceria em vigor`,
      req.ip,
      req.headers['user-agent']
    );

    return res.json({
      success: true,
      message: `Protocolo assinado por ambas as partes disponibilizado na área privada de "${partner.name}". A parceria entrou oficialmente em vigor!`,
    });
  }
);

router.get('/admin/partners/:id/signed-protocol', requireAdmin, (req: Request, res: Response) => {
  const row = db.prepare('SELECT * FROM partners WHERE id = ?').get(Number(req.params.id)) as any;

  if (!row) {
    return res.status(404).send('Parceiro não encontrado.');
  }

  if (row.signed_protocol_base64 && row.signed_protocol_mime) {
    res.setHeader('Content-Type', row.signed_protocol_mime);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${row.signed_protocol_name || 'protocolo_assinado_parceiro.pdf'}"`
    );
    return res.send(Buffer.from(row.signed_protocol_base64, 'base64'));
  }

  // Render the partner's signed protocol sheet for inspection/printing by Admin
  const companyName = (row.name || 'Entidade Parceira').trim();
  const companyAddress = (row.address || `${row.city || 'Lisboa'}, ${row.district || 'Lisboa'}`).trim();
  const companyNif = (row.nif || '509123456').trim();
  const repRole = (row.contact_role || 'Gerente / Representante Legal').trim();
  const repName = (row.contact_name || `Representante Legal de ${companyName}`).trim();
  const benefitConditions = `${row.discount_highlight || row.benefit_value}${row.terms ? ` (${row.terms})` : ''}`;
  const protocolDuration = (row.protocol_duration || 'um ano').trim() || 'um ano';
  const signedDate = formatPortugueseDate(row.signed_protocol_uploaded_at || row.created_at);

  const html = `<!doctype html>
<html lang="pt-PT">
<head>
  <meta charset="UTF-8" />
  <title>Protocolo Colocado pela Empresa — ${companyName}</title>
  <style>
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #141619; background: #f5f5f4; margin: 0; padding: 32px 16px; line-height: 1.65; }
    .toolbar { max-width: 780px; margin: 0 auto 20px; display: flex; justify-content: space-between; align-items: center; background: #141619; color: #fff; padding: 14px 20px; border-radius: 10px; }
    .toolbar button { background: #C81E2B; color: #fff; border: none; padding: 9px 18px; border-radius: 6px; font-weight: bold; font-size: 13px; cursor: pointer; }
    .sheet { max-width: 780px; margin: 0 auto; background: #fff; padding: 56px 64px; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); font-size: 14.5px; text-align: justify; }
    .seal { background: #FFFBEB; border: 1px solid #FDE68A; color: #92400E; padding: 10px 16px; border-radius: 8px; font-size: 12px; font-weight: bold; text-align: center; margin-bottom: 24px; }
    .header-logo { text-align: center; margin-bottom: 24px; }
    .header-logo img { height: 76px; width: auto; }
    h1 { text-align: center; font-size: 20px; letter-spacing: 2px; margin: 0 0 28px; }
    .clause-title { text-align: center; font-weight: bold; margin: 24px 0 8px; line-height: 1.35; }
    .highlight-box { margin: 12px 0; padding: 12px 16px; background: #FAF8F5; border-left: 3px solid #C81E2B; font-weight: bold; }
    .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 48px; text-align: center; }
    .sig-line { margin-top: 42px; margin-bottom: 6px; }
    .sig-script { font-family: Georgia, serif; font-style: italic; font-size: 18px; color: #1e293b; margin-top: 24px; padding-bottom: 4px; border-bottom: 1px solid #141619; }
    @media print { body { background: #fff; padding: 0; } .toolbar { display: none; } .sheet { box-shadow: none; padding: 24px 32px; max-width: 100%; } }
  </style>
</head>
<body>
  <div class="toolbar">
    <div>
      <strong>Protocolo Colocado pela Empresa (Segundo Outorgante)</strong>
      <div style="font-size: 12px; color: #d6d3d1;">Submetido por ${companyName} na Área Privada</div>
    </div>
    <button onclick="window.print()">Imprimir / Guardar PDF</button>
  </div>
  <div class="sheet">
    <div class="seal">
      EXEMPLAR ASSINADO PELA ENTIDADE PARCEIRA (SEGUNDO OUTORGANTE)
    </div>
    <div class="header-logo">
      <img src="/assets/aistudio/logo_LPCS_f0a028f9.jpg" alt="Liga Portuguesa Contra a SIDA" />
    </div>
    <h1>PROTOCOLO</h1>
    <p>Entre <strong>Liga Portuguesa Contra a SIDA</strong>, Instituição Particular de Solidariedade Social, com sede na Praça Carlos Fabião, Loja 3A 1600-316 Lisboa, pessoa coletiva nº <strong>502665548</strong>, representada pela Presidente da Direção, <strong>Maria Eugénia Saraiva</strong>, na qualidade de Primeira Outorgante</p>
    <p style="text-align: center; margin: 10px 0;">e</p>
    <p><strong>${companyName}</strong> adiante designada por Segundo Outorgante, com sede em <strong>${companyAddress}</strong>, pessoa coletiva nº <strong>${companyNif}</strong>, representada pelo(a) <strong>${repRole}</strong>, <strong>${repName}</strong>, na qualidade de segundo outorgante</p>
    <p>é celebrado o presente protocolo de cooperação, o qual se irá reger nos termos e de acordo com as cláusulas seguintes:</p>
    <div class="clause-title">Cláusula 1.ª<br/>(Objeto)</div>
    <p>O presente Protocolo enquadra-se dentro do programa “A LIGA EM REDE” e tem por objeto conceder condições preferenciais na utilização dos bens e serviços do Segundo Outorgante aos associados da Primeira Outorgante, podendo o Segundo Outorgante beneficiar de um aumento de clientes/utilizadores destes bens e serviços através dos associados da Primeira Outorgante.</p>
    <div class="clause-title">Cláusula 2.ª<br/>(Objeto)</div>
    <p>1. A Primeira Outorgante obriga-se a divulgar e promover o protocolo junto dos seus associados através dos meios de comunicação disponíveis e designadamente através da internet.<br/>2. O Segundo Outorgante concede os benefícios de acesso aos serviços/bens protocolados, mediante a apresentação de comprovativo em como é associado da Primeira Outorgante.</p>
    <div class="clause-title">Cláusula 3.ª<br/>(Condições preferenciais)</div>
    <p>O Segundo Outorgante disponibiliza aos associados da Primeira Outorgante as seguintes condições preferenciais:</p>
    <div class="highlight-box">${benefitConditions}</div>
    <div class="clause-title">Cláusula 4.ª<br/>(Vigência)</div>
    <p>1. O presente protocolo entra em vigor na data da sua assinatura abaixo mencionada e terá a duração de <strong>${protocolDuration}</strong>, automaticamente renovável por iguais e sucessivos períodos.<br/>2. Qualquer alteração ao presente protocolo apenas será válida se se observar também a forma escrita e ser assinado por ambas as partes.</p>
    <div class="clause-title">Cláusula 5.ª<br/>(Denúncia)</div>
    <p>A denúncia do presente protocolo por qualquer das partes deverá ser efetuada mediante comunicação escrita à outra parte, com uma antecedência de trinta dias seguidos, relativa ao termo da sua vigência.</p>
    <p>O presente documento é feito em duplicado e assinado pelos outorgantes, destinando-se um exemplar a cada uma das partes.</p>
    <p style="margin-top: 28px;">Lisboa, ${signedDate}</p>
    <div class="signatures">
      <div>
        <strong>Responsável do Primeiro Outorgante</strong>
        <div class="sig-line">________________________</div>
        <div>(Maria Eugénia Saraiva)</div>
        <div>Presidente da Direção</div>
      </div>
      <div>
        <strong>Responsável do Segundo Outorgante</strong>
        <div class="sig-script">${repName}</div>
        <div>(${repName})</div>
        <div>(${repRole})</div>
      </div>
    </div>
  </div>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.send(html);
});

router.get('/admin/partners/:id/counter-signed-protocol', requireAdmin, (req: Request, res: Response) => {
  const row = db.prepare('SELECT * FROM partners WHERE id = ?').get(Number(req.params.id)) as any;

  if (!row) {
    return res.status(404).send('Parceiro não encontrado.');
  }

  if (row.counter_signed_protocol_base64 && row.counter_signed_protocol_mime) {
    res.setHeader('Content-Type', row.counter_signed_protocol_mime);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${row.counter_signed_protocol_name || 'protocolo_assinado_ambas_partes.pdf'}"`
    );
    return res.send(Buffer.from(row.counter_signed_protocol_base64, 'base64'));
  }

  if (!row.protocol_in_force) {
    return res
      .status(404)
      .send('O protocolo assinado por ambas as partes ainda não foi colocado pela LPCS.');
  }

  const companyName = (row.name || 'Entidade Parceira').trim();
  const companyAddress = (row.address || `${row.city || 'Lisboa'}, ${row.district || 'Lisboa'}`).trim();
  const companyNif = (row.nif || '509123456').trim();
  const repRole = (row.contact_role || 'Gerente / Representante Legal').trim();
  const repName = (row.contact_name || `Representante Legal de ${companyName}`).trim();
  const benefitConditions = `${row.discount_highlight || row.benefit_value}${row.terms ? ` (${row.terms})` : ''}`;
  const protocolDuration = (row.protocol_duration || 'um ano').trim() || 'um ano';
  const signedDate = formatPortugueseDate(row.counter_signed_protocol_uploaded_at || row.created_at);

  const html = `<!doctype html>
<html lang="pt-PT">
<head>
  <meta charset="UTF-8" />
  <title>Protocolo Assinado por Ambas as Partes (LPCS) — ${companyName}</title>
  <style>
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #141619; background: #f5f5f4; margin: 0; padding: 32px 16px; line-height: 1.65; }
    .toolbar { max-width: 780px; margin: 0 auto 20px; display: flex; justify-content: space-between; align-items: center; background: #064E3B; color: #fff; padding: 14px 20px; border-radius: 10px; }
    .toolbar button { background: #fff; color: #064E3B; border: none; padding: 9px 18px; border-radius: 6px; font-weight: bold; font-size: 13px; cursor: pointer; }
    .sheet { max-width: 780px; margin: 0 auto; background: #fff; padding: 56px 64px; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); font-size: 14.5px; text-align: justify; }
    .seal { background: #ECFDF5; border: 1px solid #A7F3D0; color: #065F46; padding: 10px 16px; border-radius: 8px; font-size: 12px; font-weight: bold; text-align: center; margin-bottom: 24px; }
    .header-logo { text-align: center; margin-bottom: 24px; }
    .header-logo img { height: 76px; width: auto; }
    h1 { text-align: center; font-size: 20px; letter-spacing: 2px; margin: 0 0 28px; }
    .clause-title { text-align: center; font-weight: bold; margin: 24px 0 8px; line-height: 1.35; }
    .highlight-box { margin: 12px 0; padding: 12px 16px; background: #FAF8F5; border-left: 3px solid #C81E2B; font-weight: bold; }
    .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 48px; text-align: center; }
    .sig-script { font-family: Georgia, serif; font-style: italic; font-size: 18px; color: #1e293b; margin-top: 24px; padding-bottom: 4px; border-bottom: 1px solid #141619; }
    @media print { body { background: #fff; padding: 0; } .toolbar { display: none; } .sheet { box-shadow: none; padding: 24px 32px; max-width: 100%; } }
  </style>
</head>
<body>
  <div class="toolbar">
    <div>
      <strong>Protocolo Assinado e Colocado pela LPCS (Ambas as Partes)</strong>
      <div style="font-size: 12px; color: #A7F3D0;">Disponibilizado na Área Privada de ${companyName}</div>
    </div>
    <button onclick="window.print()">Imprimir / Guardar PDF</button>
  </div>
  <div class="sheet">
    <div class="seal">
      PARCERIA EM VIGOR · PROTOCOLO ASSINADO POR AMBAS AS PARTES (LPCS & ENTIDADE PARCEIRA)
    </div>
    <div class="header-logo">
      <img src="/assets/aistudio/logo_LPCS_f0a028f9.jpg" alt="Liga Portuguesa Contra a SIDA" />
    </div>
    <h1>PROTOCOLO</h1>
    <p>Entre <strong>Liga Portuguesa Contra a SIDA</strong>, Instituição Particular de Solidariedade Social, com sede na Praça Carlos Fabião, Loja 3A 1600-316 Lisboa, pessoa coletiva nº <strong>502665548</strong>, representada pela Presidente da Direção, <strong>Maria Eugénia Saraiva</strong>, na qualidade de Primeira Outorgante</p>
    <p style="text-align: center; margin: 10px 0;">e</p>
    <p><strong>${companyName}</strong> adiante designada por Segundo Outorgante, com sede em <strong>${companyAddress}</strong>, pessoa coletiva nº <strong>${companyNif}</strong>, representada pelo(a) <strong>${repRole}</strong>, <strong>${repName}</strong>, na qualidade de segundo outorgante</p>
    <p>é celebrado o presente protocolo de cooperação, o qual se irá reger nos termos e de acordo com as cláusulas seguintes:</p>
    <div class="clause-title">Cláusula 1.ª<br/>(Objeto)</div>
    <p>O presente Protocolo enquadra-se dentro do programa “A LIGA EM REDE” e tem por objeto conceder condições preferenciais na utilização dos bens e serviços do Segundo Outorgante aos associados da Primeira Outorgante, podendo o Segundo Outorgante beneficiar de um aumento de clientes/utilizadores destes bens e serviços através dos associados da Primeira Outorgante.</p>
    <div class="clause-title">Cláusula 2.ª<br/>(Objeto)</div>
    <p>1. A Primeira Outorgante obriga-se a divulgar e promover o protocolo junto dos seus associados através dos meios de comunicação disponíveis e designadamente através da internet.<br/>2. O Segundo Outorgante concede os benefícios de acesso aos serviços/bens protocolados, mediante a apresentação de comprovativo em como é associado da Primeira Outorgante.</p>
    <div class="clause-title">Cláusula 3.ª<br/>(Condições preferenciais)</div>
    <p>O Segundo Outorgante disponibiliza aos associados da Primeira Outorgante as seguintes condições preferenciais:</p>
    <div class="highlight-box">${benefitConditions}</div>
    <div class="clause-title">Cláusula 4.ª<br/>(Vigência)</div>
    <p>1. O presente protocolo entra em vigor na data da sua assinatura abaixo mencionada e terá a duração de <strong>${protocolDuration}</strong>, automaticamente renovável por iguais e sucessivos períodos.<br/>2. Qualquer alteração ao presente protocolo apenas será válida se se observar também a forma escrita e ser assinado por ambas as partes.</p>
    <div class="clause-title">Cláusula 5.ª<br/>(Denúncia)</div>
    <p>A denúncia do presente protocolo por qualquer das partes deverá ser efetuada mediante comunicação escrita à outra parte, com uma antecedência de trinta dias seguidos, relativa ao termo da sua vigência.</p>
    <p>O presente documento é feito em duplicado e assinado pelos outorgantes, destinando-se um exemplar a cada uma das partes.</p>
    <p style="margin-top: 28px;">Lisboa, ${signedDate}</p>
    <div class="signatures">
      <div>
        <strong>Responsável do Primeiro Outorgante</strong>
        <div class="sig-script">Maria Eugénia Saraiva</div>
        <div>(Maria Eugénia Saraiva)</div>
        <div>Presidente da Direção · LPCS</div>
      </div>
      <div>
        <strong>Responsável do Segundo Outorgante</strong>
        <div class="sig-script">${repName}</div>
        <div>(${repName})</div>
        <div>(${repRole})</div>
      </div>
    </div>
  </div>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.send(html);
});

router.post('/admin/partners/:id/toggle', requireAdmin, (req: Request, res: Response) => {
  const admin = getSessionUser(req)!;
  const partnerId = Number(req.params.id);

  const partner = db.prepare('SELECT * FROM partners WHERE id = ?').get(partnerId) as any;
  if (!partner) {
    return res.status(404).json({ error: 'Parceiro não encontrado.' });
  }

  const newStatus = partner.is_active ? 0 : 1;
  db.prepare('UPDATE partners SET is_active = ? WHERE id = ?').run(newStatus, partnerId);

  logAudit(
    admin.id,
    'admin_toggle_parceiro',
    `Parceiro ${partner.name} ${newStatus === 1 ? 'ativado' : 'desativado'}`,
    req.ip,
    req.headers['user-agent']
  );

  return res.json({ success: true, is_active: newStatus });
});

router.delete('/admin/partners/:id', requireAdmin, (req: Request, res: Response) => {
  const admin = getSessionUser(req)!;
  const partnerId = Number(req.params.id);

  const partner = db.prepare('SELECT * FROM partners WHERE id = ?').get(partnerId) as any;
  if (!partner) {
    return res.status(404).json({ error: 'Parceiro não encontrado.' });
  }

  db.prepare('DELETE FROM partners WHERE id = ?').run(partnerId);

  logAudit(admin.id, 'admin_remocao_parceiro', `Parceiro ${partner.name} removido`, req.ip, req.headers['user-agent']);

  return res.json({ success: true, message: 'Parceiro removido com sucesso.' });
});

// ==========================================
// 8. CORPORATE PARTNERSHIP INQUIRIES ("Quero fazer parceria")
// ==========================================

router.post('/partners/inquiry', withPartnerMedia, (req: Request, res: Response) => {
  const files = (req.files || {}) as Record<string, Express.Multer.File[]>;
  const logoFile = files.logo?.[0];
  const serviceFiles = files.service_images || [];
  const signedProtocolFile = files.signed_protocol?.[0];

  const {
    company_name,
    nif,
    address,
    contact_name,
    contact_role,
    email,
    phone,
    area,
    district,
    city,
    benefit_type,
    proposed_benefit,
    protocol_duration,
    valid_until,
    max_uses,
    code_mode,
    proposed_code,
    website,
    notes,
    partner_password,
  } = req.body;

  if (!company_name || company_name.trim().length < 2) {
    return res.status(400).json({ error: 'Indique o nome da empresa ou instituição.' });
  }
  if (!nif || nif.trim().length < 9) {
    return res.status(400).json({ error: 'Indique o número de pessoa coletiva / NIPC da entidade parceira.' });
  }
  if (!validateNif(nif.trim())) {
    return res.status(400).json({ error: 'O NIPC/NIF indicado não passou a verificação (Módulo 11).' });
  }
  if (!address || address.trim().length < 5) {
    return res.status(400).json({ error: 'Indique a morada da sede da entidade parceira (para preenchimento do protocolo).' });
  }
  if (!contact_name || contact_name.trim().length < 2) {
    return res.status(400).json({ error: 'Indique o nome do representante / pessoa de contacto.' });
  }
  if (!contact_role || contact_role.trim().length < 2) {
    return res.status(400).json({ error: 'Indique o cargo do representante (para preenchimento do protocolo).' });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return res.status(400).json({ error: 'Indique um endereço de e-mail empresarial válido.' });
  }
  if (!phone || phone.trim().length < 9) {
    return res.status(400).json({ error: 'Indique um número de telefone ou telemóvel de contacto.' });
  }
  if (!proposed_benefit || proposed_benefit.trim().length < 5) {
    return res.status(400).json({ error: 'Descreva brevemente o desconto ou benefício proposto para os sócios.' });
  }
  if (!protocol_duration || String(protocol_duration).trim().length < 2) {
    return res.status(400).json({ error: 'Indique a duração do protocolo (ex: um ano, 6 meses, dois anos).' });
  }
  if (!valid_until || !/^\d{4}-\d{2}-\d{2}$/.test(String(valid_until).trim())) {
    return res.status(400).json({
      error: 'É obrigatório indicar a data de validade da parceria.',
    });
  }
  const todayStr = new Date().toISOString().split('T')[0];
  if (String(valid_until).trim() < todayStr) {
    return res.status(400).json({
      error: 'A data de validade da parceria deve ser igual ou posterior à data atual.',
    });
  }
  if (!logoFile) {
    return res.status(400).json({
      error: 'É obrigatório submeter o logótipo da entidade parceira (PNG, JPG, WEBP ou SVG).',
    });
  }

  const parsedMaxUses =
    max_uses !== undefined && max_uses !== null && String(max_uses).trim() !== '' && Number(max_uses) > 0
      ? Math.floor(Number(max_uses))
      : null;
  const finalCodeMode = code_mode === 'codigo_unico' ? 'codigo_unico' : 'rotativo';
  const cleanProposedCode =
    proposed_code && String(proposed_code).trim()
      ? String(proposed_code).trim().toUpperCase()
      : null;
  const cleanValidUntil = String(valid_until).trim();
  const cleanAddress = String(address).trim();
  const cleanContactRole = String(contact_role).trim();
  const cleanProtocolDuration = String(protocol_duration).trim();
  const normalizedEmail = email.trim().toLowerCase();
  const nowIso = new Date().toISOString();

  const result = db.prepare(`
    INSERT INTO partner_inquiries (
      company_name, nif, address, contact_name, contact_role, email, phone, area, district, city,
      benefit_type, proposed_benefit, protocol_duration, valid_until, max_uses, code_mode, proposed_code,
      website, notes, logo_name, logo_mime, logo_base64,
      signed_protocol_name, signed_protocol_mime, signed_protocol_base64, signed_protocol_uploaded_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    company_name.trim(),
    nif.trim(),
    cleanAddress,
    contact_name.trim(),
    cleanContactRole,
    normalizedEmail,
    phone.trim(),
    area || 'Serviços',
    district || 'Nacional',
    city ? city.trim() : 'Nacional',
    benefit_type || 'codigo',
    proposed_benefit.trim(),
    cleanProtocolDuration,
    cleanValidUntil,
    parsedMaxUses,
    finalCodeMode,
    cleanProposedCode,
    website ? website.trim() : null,
    notes ? notes.trim() : null,
    logoFile.originalname,
    logoFile.mimetype,
    logoFile.buffer.toString('base64'),
    signedProtocolFile ? signedProtocolFile.originalname : null,
    signedProtocolFile ? signedProtocolFile.mimetype : null,
    signedProtocolFile ? signedProtocolFile.buffer.toString('base64') : null,
    signedProtocolFile ? nowIso : null
  );

  const inquiryId = Number(result.lastInsertRowid);
  const insertInqImg = db.prepare(`
    INSERT INTO partner_inquiry_images (
      inquiry_id, original_name, mime_type, file_size, file_base64
    ) VALUES (?, ?, ?, ?, ?)
  `);
  for (const f of serviceFiles.slice(0, 4)) {
    insertInqImg.run(
      inquiryId,
      f.originalname,
      f.mimetype,
      f.size,
      f.buffer.toString('base64')
    );
  }

  // Create or update the Partner Private Area account (is_active = 0, protocol_in_force = 0 until LPCS signs and places the counter-signed protocol)
  const rawPwd =
    partner_password && String(partner_password).trim().length >= 6
      ? String(partner_password).trim()
      : 'Parceiro!2026';
  const { hash, salt } = hashPassword(rawPwd);
  const existingAcc = db
    .prepare('SELECT id, partner_id FROM partner_accounts WHERE email = ?')
    .get(normalizedEmail) as { id: number; partner_id: number } | undefined;

  let partnerAccountId: number;
  if (existingAcc) {
    partnerAccountId = existingAcc.id;
    db.prepare(`
      UPDATE partners
      SET name = ?, nif = ?, address = ?, contact_name = ?, contact_role = ?,
          area = ?, district = ?, city = ?, benefit_type = ?, benefit_value = ?,
          discount_highlight = ?, max_uses = ?, code_mode = ?, valid_until = ?,
          protocol_duration = ?, website = ?, logo_mime = ?, logo_base64 = ?
      WHERE id = ?
    `).run(
      company_name.trim(),
      nif.trim(),
      cleanAddress,
      contact_name.trim(),
      cleanContactRole,
      area || 'Serviços',
      district || 'Nacional',
      city ? city.trim() : 'Nacional',
      benefit_type || 'codigo',
      proposed_benefit.trim(),
      proposed_benefit.trim(),
      parsedMaxUses,
      finalCodeMode,
      cleanValidUntil,
      cleanProtocolDuration,
      website ? website.trim() : '',
      logoFile.mimetype,
      logoFile.buffer.toString('base64'),
      existingAcc.partner_id
    );
    if (partner_password && String(partner_password).trim().length >= 6) {
      db.prepare('UPDATE partner_accounts SET password_hash = ?, salt = ?, contact_name = ? WHERE id = ?').run(
        hash,
        salt,
        contact_name.trim(),
        existingAcc.id
      );
    }
  } else {
    const generatedSecret =
      cleanProposedCode ||
      `LPCS-${company_name.trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6) || 'PARC'}-${Math.floor(10 + Math.random() * 90)}`;
    const pRes = db.prepare(`
      INSERT INTO partners (
        name, category, description, area, district, city, benefit_type,
        benefit_value, discount_highlight, usage_limit, max_uses, code_mode, estimated_annual_savings,
        valid_until, terms, website, is_active, secret_code, logo_mime, logo_base64,
        nif, address, contact_name, contact_role, protocol_duration,
        signed_protocol_name, signed_protocol_mime, signed_protocol_base64, signed_protocol_uploaded_at,
        protocol_in_force
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `).run(
      company_name.trim(),
      area || 'Serviços',
      notes ? notes.trim() : proposed_benefit.trim(),
      area || 'Serviços',
      district || 'Nacional',
      city ? city.trim() : 'Nacional',
      benefit_type || 'codigo',
      proposed_benefit.trim(),
      proposed_benefit.trim(),
      parsedMaxUses ? `Até ${parsedMaxUses} utilizações por sócio` : 'Utilização contínua',
      parsedMaxUses,
      finalCodeMode,
      50.0,
      cleanValidUntil,
      notes ? notes.trim() : 'Válido mediante comprovativo de associado LPCS.',
      website ? website.trim() : '',
      generatedSecret,
      logoFile.mimetype,
      logoFile.buffer.toString('base64'),
      nif.trim(),
      cleanAddress,
      contact_name.trim(),
      cleanContactRole,
      cleanProtocolDuration,
      signedProtocolFile ? signedProtocolFile.originalname : null,
      signedProtocolFile ? signedProtocolFile.mimetype : null,
      signedProtocolFile ? signedProtocolFile.buffer.toString('base64') : null,
      signedProtocolFile ? nowIso : null
    );
    const newPartnerId = Number(pRes.lastInsertRowid);
    const accRes = db.prepare(`
      INSERT INTO partner_accounts (partner_id, email, password_hash, salt, contact_name, is_active)
      VALUES (?, ?, ?, ?, ?, 1)
    `).run(newPartnerId, normalizedEmail, hash, salt, contact_name.trim());
    partnerAccountId = Number(accRes.lastInsertRowid);
  }

  // Automatically authenticate the partner into their Private Area (/validar) so they immediately access their auto-filled Protocol
  createPartnerSession(partnerAccountId, req, res);

  const protocolPayload = {
    id: inquiryId,
    company_name: company_name.trim(),
    nif: nif.trim(),
    address: cleanAddress,
    contact_name: contact_name.trim(),
    contact_role: cleanContactRole,
    email: normalizedEmail,
    phone: phone.trim(),
    area: area || 'Serviços',
    district: district || 'Nacional',
    city: city ? city.trim() : 'Nacional',
    benefit_type: benefit_type || 'codigo',
    proposed_benefit: proposed_benefit.trim(),
    protocol_duration: cleanProtocolDuration,
    valid_until: cleanValidUntil,
    max_uses: parsedMaxUses,
    code_mode: finalCodeMode,
    proposed_code: cleanProposedCode,
    website: website ? website.trim() : null,
    notes: notes ? notes.trim() : null,
    signed_protocol_name: signedProtocolFile ? signedProtocolFile.originalname : null,
    created_at: nowIso,
  };

  logAudit(
    null,
    'proposta_parceria_empresa',
    `Nova inscrição de parceria submetida por ${company_name.trim()} (${normalizedEmail}) — acesso à Área Privada criado e notificação enviada para ${INSTITUTIONAL_NOTIFICATION_EMAIL}`,
    req.ip,
    req.headers['user-agent']
  );

  notifyNewPartnerInquiry(protocolPayload).catch((mailErr) =>
    console.error('Failed to send partner inquiry email:', mailErr)
  );

  return res.json({
    success: true,
    inquiryId,
    notificationEmail: INSTITUTIONAL_NOTIFICATION_EMAIL,
    partner_email: normalizedEmail,
    redirect: '/validar',
    message: `Registo concluído com sucesso! O seu Protocolo de Cooperação "A LIGA EM REDE" foi automaticamente preenchido e encontra-se disponível na sua Área Privada de Entidade Parceira.`,
  });
});

// Printable A4 preview of the Protocol — RESTRICTED to Partner Private Area or LPCS Admin
router.get('/partners/protocol-preview', (req: Request, res: Response) => {
  const partnerSession = getSessionPartner(req);
  const adminUser = getSessionUser(req);
  if (!partnerSession && (!adminUser || !isUserAdmin(adminUser))) {
    return res
      .status(401)
      .send('Acesso restrito: O protocolo encontra-se disponível exclusivamente na Área Privada da Entidade Parceira.');
  }
  const companyName = String(req.query.company_name || '(nome da empresa)').trim() || '(nome da empresa)';
  const companyAddress = String(req.query.address || '(morada)').trim() || '(morada)';
  const companyNif = String(req.query.nif || '(NIPC)').trim() || '(NIPC)';
  const repRole = String(req.query.contact_role || '(cargo)').trim() || '(cargo)';
  const repName = String(req.query.contact_name || '(nome)').trim() || '(nome)';
  const benefitConditions =
    String(req.query.proposed_benefit || '(condições da oferta)').trim() ||
    '(condições da oferta)';
  const protocolDuration = String(req.query.protocol_duration || 'um ano').trim() || 'um ano';
  const signedDate = formatPortugueseDate(new Date());

  const html = `<!doctype html>
<html lang="pt-PT">
<head>
  <meta charset="UTF-8" />
  <title>Protocolo A LIGA EM REDE — ${companyName}</title>
  <style>
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #141619; background: #f5f5f4; margin: 0; padding: 32px 16px; line-height: 1.65; }
    .toolbar { max-width: 780px; margin: 0 auto 20px; display: flex; justify-content: space-between; align-items: center; background: #141619; color: #fff; padding: 12px 20px; border-radius: 10px; }
    .toolbar button { background: #C81E2B; color: #fff; border: none; padding: 9px 18px; border-radius: 6px; font-weight: bold; font-size: 13px; cursor: pointer; }
    .sheet { max-width: 780px; margin: 0 auto; background: #fff; padding: 56px 64px; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); font-size: 14.5px; text-align: justify; }
    .header-logo { text-align: center; margin-bottom: 28px; }
    .header-logo img { height: 76px; width: auto; }
    h1 { text-align: center; font-size: 20px; letter-spacing: 2px; margin: 0 0 28px; }
    .clause-title { text-align: center; font-weight: bold; margin: 24px 0 8px; line-height: 1.35; }
    .highlight-box { margin: 12px 0; padding: 12px 16px; background: #FAF8F5; border-left: 3px solid #C81E2B; font-weight: bold; }
    .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 48px; text-align: center; }
    .sig-line { margin-top: 42px; margin-bottom: 6px; }
    @media print { body { background: #fff; padding: 0; } .toolbar { display: none; } .sheet { box-shadow: none; padding: 24px 32px; max-width: 100%; } }
  </style>
</head>
<body>
  <div class="toolbar">
    <div>
      <strong>Protocolo de Cooperação — A LIGA EM REDE (Para Assinatura)</strong>
      <div style="font-size: 12px; color: #d6d3d1;">Imprima ou guarde em PDF, assine como Segundo Outorgante e faça o upload no registo</div>
    </div>
    <button onclick="window.print()">Imprimir / Guardar em PDF</button>
  </div>
  <div class="sheet">
    <div class="header-logo">
      <img src="/assets/aistudio/logo_LPCS_f0a028f9.jpg" alt="Liga Portuguesa Contra a SIDA" />
    </div>
    <h1>PROTOCOLO</h1>
    <p>Entre <strong>Liga Portuguesa Contra a SIDA</strong>, Instituição Particular de Solidariedade Social, com sede na Praça Carlos Fabião, Loja 3A 1600-316 Lisboa, pessoa coletiva nº <strong>502665548</strong>, representada pela Presidente da Direção, <strong>Maria Eugénia Saraiva</strong>, na qualidade de Primeira Outorgante</p>
    <p style="text-align: center; margin: 10px 0;">e</p>
    <p><strong>${companyName}</strong> adiante designada por Segundo Outorgante, com sede em <strong>${companyAddress}</strong>, pessoa coletiva nº <strong>${companyNif}</strong>, representada pelo(a) <strong>${repRole}</strong>, <strong>${repName}</strong>, na qualidade de segundo outorgante</p>
    <p>é celebrado o presente protocolo de cooperação, o qual se irá reger nos termos e de acordo com as cláusulas seguintes:</p>
    <div class="clause-title">Cláusula 1.ª<br/>(Objeto)</div>
    <p>O presente Protocolo enquadra-se dentro do programa “A LIGA EM REDE” e tem por objeto conceder condições preferenciais na utilização dos bens e serviços do Segundo Outorgante aos associados da Primeira Outorgante, podendo o Segundo Outorgante beneficiar de um aumento de clientes/utilizadores destes bens e serviços através dos associados da Primeira Outorgante.</p>
    <div class="clause-title">Cláusula 2.ª<br/>(Objeto)</div>
    <p>1. A Primeira Outorgante obriga-se a divulgar e promover o protocolo junto dos seus associados através dos meios de comunicação disponíveis e designadamente através da internet.<br/>2. O Segundo Outorgante concede os benefícios de acesso aos serviços/bens protocolados, mediante a apresentação de comprovativo em como é associado da Primeira Outorgante.</p>
    <div class="clause-title">Cláusula 3.ª<br/>(Condições preferenciais)</div>
    <p>O Segundo Outorgante disponibiliza aos associados da Primeira Outorgante as seguintes condições preferenciais:</p>
    <div class="highlight-box">${benefitConditions}</div>
    <div class="clause-title">Cláusula 4.ª<br/>(Vigência)</div>
    <p>1. O presente protocolo entra em vigor na data da sua assinatura abaixo mencionada e terá a duração de <strong>${protocolDuration}</strong>, automaticamente renovável por iguais e sucessivos períodos.<br/>2. Qualquer alteração ao presente protocolo apenas será válida se se observar também a forma escrita e ser assinado por ambas as partes.</p>
    <div class="clause-title">Cláusula 5.ª<br/>(Denúncia)</div>
    <p>A denúncia do presente protocolo por qualquer das partes deverá ser efetuada mediante comunicação escrita à outra parte, com uma antecedência de trinta dias seguidos, relativa ao termo da sua vigência.</p>
    <p>O presente documento é feito em duplicado e assinado pelos outorgantes, destinando-se um exemplar a cada uma das partes.</p>
    <p style="margin-top: 28px;">Lisboa, ${signedDate}</p>
    <div class="signatures">
      <div>
        <strong>Responsável do Primeiro Outorgante</strong>
        <div class="sig-line">________________________</div>
        <div>(Maria Eugénia Saraiva)</div>
        <div>Presidente da Direção</div>
      </div>
      <div>
        <strong>Responsável do Segundo Outorgante</strong>
        <div class="sig-line">_________________________</div>
        <div>(${repName === '(nome)' ? 'Nome' : repName})</div>
        <div>(${repRole === '(cargo)' ? 'Cargo' : repRole})</div>
      </div>
    </div>
  </div>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.send(html);
});

router.get('/partners/inquiry/:id/signed-protocol', (req: Request, res: Response) => {
  const partnerSession = getSessionPartner(req);
  const adminUser = getSessionUser(req);
  if (!partnerSession && (!adminUser || !isUserAdmin(adminUser))) {
    return res
      .status(401)
      .send('Acesso restrito: O protocolo encontra-se disponível exclusivamente na Área Privada da Entidade Parceira.');
  }

  const row = db
    .prepare(
      'SELECT signed_protocol_name, signed_protocol_mime, signed_protocol_base64 FROM partner_inquiries WHERE id = ?'
    )
    .get(Number(req.params.id)) as any;

  if (!row || !row.signed_protocol_base64 || !row.signed_protocol_mime) {
    return res.status(404).send('Protocolo assinado pela entidade parceira não encontrado.');
  }

  res.setHeader('Content-Type', row.signed_protocol_mime);
  res.setHeader(
    'Content-Disposition',
    `inline; filename="${row.signed_protocol_name || 'protocolo_assinado_empresa.pdf'}"`
  );
  return res.send(Buffer.from(row.signed_protocol_base64, 'base64'));
});

router.get('/partners/inquiry/:id/protocol', (req: Request, res: Response) => {
  const partnerSession = getSessionPartner(req);
  const adminUser = getSessionUser(req);
  if (!partnerSession && (!adminUser || !isUserAdmin(adminUser))) {
    return res
      .status(401)
      .send('Acesso restrito: O protocolo encontra-se disponível exclusivamente na Área Privada da Entidade Parceira.');
  }

  const row = db
    .prepare('SELECT * FROM partner_inquiries WHERE id = ?')
    .get(Number(req.params.id)) as any;

  if (!row) {
    return res.status(404).send('Protocolo não encontrado.');
  }

  const companyName = (row.company_name || '(nome da empresa)').trim();
  const companyAddress = (
    row.address?.trim() ||
    `${row.city || ''}${row.district && row.district !== row.city ? `, ${row.district}` : ''}` ||
    '(morada)'
  );
  const companyNif = (row.nif || '(NIPC)').trim();
  const repRole = (row.contact_role || '(cargo)').trim();
  const repName = (row.contact_name || '(nome)').trim();
  const benefitConditions = (row.proposed_benefit || '(condições da oferta)').trim();
  const protocolDuration = (row.protocol_duration || 'um ano').trim() || 'um ano';
  const signedDate = formatPortugueseDate(row.created_at);

  const html = `<!doctype html>
<html lang="pt-PT">
<head>
  <meta charset="UTF-8" />
  <title>Protocolo A LIGA EM REDE — ${companyName}</title>
  <style>
    body {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      color: #141619;
      background: #f5f5f4;
      margin: 0;
      padding: 32px 16px;
      line-height: 1.65;
    }
    .toolbar {
      max-width: 780px;
      margin: 0 auto 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #141619;
      color: #fff;
      padding: 12px 20px;
      border-radius: 10px;
    }
    .toolbar button {
      background: #C81E2B;
      color: #fff;
      border: none;
      padding: 9px 18px;
      border-radius: 6px;
      font-weight: bold;
      font-size: 13px;
      cursor: pointer;
    }
    .sheet {
      max-width: 780px;
      margin: 0 auto;
      background: #fff;
      padding: 56px 64px;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.06);
      font-size: 14.5px;
      text-align: justify;
    }
    .header-logo {
      text-align: center;
      margin-bottom: 28px;
    }
    .header-logo img {
      height: 76px;
      width: auto;
    }
    h1 {
      text-align: center;
      font-size: 20px;
      letter-spacing: 2px;
      margin: 0 0 28px;
    }
    .clause-title {
      text-align: center;
      font-weight: bold;
      margin: 24px 0 8px;
      line-height: 1.35;
    }
    .highlight-box {
      margin: 12px 0;
      padding: 12px 16px;
      background: #FAF8F5;
      border-left: 3px solid #C81E2B;
      font-weight: bold;
    }
    .signatures {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
      margin-top: 48px;
      text-align: center;
    }
    .sig-line {
      margin-top: 42px;
      margin-bottom: 6px;
    }
    @media print {
      body { background: #fff; padding: 0; }
      .toolbar { display: none; }
      .sheet { box-shadow: none; padding: 24px 32px; max-width: 100%; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <div>
      <strong>Protocolo de Cooperação — A LIGA EM REDE</strong>
      <div style="font-size: 12px; color: #d6d3d1;">Preenchido automaticamente para ${companyName}</div>
    </div>
    <button onclick="window.print()">Imprimir / Guardar em PDF</button>
  </div>
  <div class="sheet">
    <div class="header-logo">
      <img src="/assets/aistudio/logo_LPCS_f0a028f9.jpg" alt="Liga Portuguesa Contra a SIDA" />
    </div>
    <h1>PROTOCOLO</h1>
    <p>
      Entre <strong>Liga Portuguesa Contra a SIDA</strong>, Instituição Particular de Solidariedade Social, com sede na Praça Carlos Fabião, Loja 3A 1600-316 Lisboa, pessoa coletiva nº <strong>502665548</strong>, representada pela Presidente da Direção, <strong>Maria Eugénia Saraiva</strong>, na qualidade de Primeira Outorgante
    </p>
    <p style="text-align: center; margin: 10px 0;">e</p>
    <p>
      <strong>${companyName}</strong> adiante designada por Segundo Outorgante, com sede em <strong>${companyAddress}</strong>, pessoa coletiva nº <strong>${companyNif}</strong>, representada pelo(a) <strong>${repRole}</strong>, <strong>${repName}</strong>, na qualidade de segundo outorgante
    </p>
    <p>
      é celebrado o presente protocolo de cooperação, o qual se irá reger nos termos e de acordo com as cláusulas seguintes:
    </p>

    <div class="clause-title">Cláusula 1.ª<br/>(Objeto)</div>
    <p>
      O presente Protocolo enquadra-se dentro do programa “A LIGA EM REDE” e tem por objeto conceder condições preferenciais na utilização dos bens e serviços do Segundo Outorgante aos associados da Primeira Outorgante, podendo o Segundo Outorgante beneficiar de um aumento de clientes/utilizadores destes bens e serviços através dos associados da Primeira Outorgante.
    </p>

    <div class="clause-title">Cláusula 2.ª<br/>(Objeto)</div>
    <p>
      1. A Primeira Outorgante obriga-se a divulgar e promover o protocolo junto dos seus associados através dos meios de comunicação disponíveis e designadamente através da internet.<br/>
      2. O Segundo Outorgante concede os benefícios de acesso aos serviços/bens protocolados, mediante a apresentação de comprovativo em como é associado da Primeira Outorgante.
    </p>

    <div class="clause-title">Cláusula 3.ª<br/>(Condições preferenciais)</div>
    <p>
      O Segundo Outorgante disponibiliza aos associados da Primeira Outorgante as seguintes condições preferenciais:
    </p>
    <div class="highlight-box">${benefitConditions}</div>

    <div class="clause-title">Cláusula 4.ª<br/>(Vigência)</div>
    <p>
      1. O presente protocolo entra em vigor na data da sua assinatura abaixo mencionada e terá a duração de <strong>${protocolDuration}</strong>, automaticamente renovável por iguais e sucessivos períodos.<br/>
      2. Qualquer alteração ao presente protocolo apenas será válida se se observar também a forma escrita e ser assinado por ambas as partes.
    </p>

    <div class="clause-title">Cláusula 5.ª<br/>(Denúncia)</div>
    <p>
      A denúncia do presente protocolo por qualquer das partes deverá ser efetuada mediante comunicação escrita à outra parte, com uma antecedência de trinta dias seguidos, relativa ao termo da sua vigência.
    </p>
    <p>
      O presente documento é feito em duplicado e assinado pelos outorgantes, destinando-se um exemplar a cada uma das partes.
    </p>

    <p style="margin-top: 28px;">Lisboa, ${signedDate}</p>

    <div class="signatures">
      <div>
        <strong>Responsável do Primeiro Outorgante</strong>
        <div class="sig-line">________________________</div>
        <div>(Maria Eugénia Saraiva)</div>
        <div>Presidente da Direção</div>
      </div>
      <div>
        <strong>Responsável do Segundo Outorgante</strong>
        <div class="sig-line">_________________________</div>
        <div>(${repName})</div>
        <div>(${repRole})</div>
      </div>
    </div>
  </div>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.send(html);
});

router.get('/admin/email-notifications', requireAdmin, (_req: Request, res: Response) => {
  const notifications = db
    .prepare(
      `SELECT id, recipient, event_type, subject, body_text, status, error_message, created_at
       FROM email_notifications
       ORDER BY created_at DESC
       LIMIT 50`
    )
    .all();

  return res.json({
    config: getEmailConfigStatus(),
    notifications,
  });
});

router.get('/admin/inquiries', requireAdmin, (_req: Request, res: Response) => {
  const rows = db.prepare(`
    SELECT id, company_name, nif, address, contact_name, contact_role, email, phone, area, district, city,
           benefit_type, proposed_benefit, protocol_duration, valid_until, max_uses, code_mode, proposed_code,
           website, notes, status, created_at,
           signed_protocol_name, signed_protocol_uploaded_at,
           length(signed_protocol_base64) as signed_len,
           counter_signed_protocol_name, counter_signed_protocol_uploaded_at,
           length(counter_signed_protocol_base64) as counter_signed_len,
           length(logo_base64) as logo_len
    FROM partner_inquiries
    ORDER BY created_at DESC
  `).all() as any[];

  const inqImgs = db
    .prepare('SELECT id, inquiry_id, original_name FROM partner_inquiry_images ORDER BY id ASC')
    .all() as Array<{ id: number; inquiry_id: number; original_name: string }>;

  const imgMap: Record<number, Array<{ id: number; url: string; original_name: string }>> = {};
  for (const img of inqImgs) {
    if (!imgMap[img.inquiry_id]) imgMap[img.inquiry_id] = [];
    imgMap[img.inquiry_id].push({
      id: img.id,
      url: `/api/admin/inquiries/images/${img.id}`,
      original_name: img.original_name,
    });
  }

  const inquiries = rows.map((inq) => ({
    ...inq,
    logo_url: inq.logo_len ? `/api/admin/inquiries/${inq.id}/logo?v=${inq.logo_len}` : null,
    protocol_url: `/api/partners/inquiry/${inq.id}/protocol`,
    has_signed_protocol: Boolean(inq.signed_len > 0),
    signed_protocol_url: inq.signed_len ? `/api/partners/inquiry/${inq.id}/signed-protocol` : null,
    has_counter_signed_protocol: Boolean(inq.counter_signed_len > 0),
    counter_signed_protocol_url: inq.counter_signed_len
      ? `/api/admin/inquiries/${inq.id}/counter-signed-protocol`
      : null,
    service_images: imgMap[inq.id] || [],
  }));

  return res.json({ inquiries });
});

router.post(
  '/admin/inquiries/:id/counter-signed-protocol',
  requireAdmin,
  upload.single('counter_signed_protocol'),
  (req: Request, res: Response) => {
    const admin = getSessionUser(req)!;
    const inquiryId = Number(req.params.id);
    const inq = db.prepare('SELECT * FROM partner_inquiries WHERE id = ?').get(inquiryId) as any;
    if (!inq) {
      return res.status(404).json({ error: 'Proposta não encontrada.' });
    }
    if (!req.file) {
      return res.status(400).json({
        error: 'Selecione o ficheiro do protocolo assinado por ambas as partes (PDF, PNG ou JPG).',
      });
    }

    const now = new Date().toISOString();
    const base64 = req.file.buffer.toString('base64');

    db.prepare(`
      UPDATE partner_inquiries
      SET counter_signed_protocol_name = ?,
          counter_signed_protocol_mime = ?,
          counter_signed_protocol_base64 = ?,
          counter_signed_protocol_uploaded_at = ?,
          status = 'aprovada'
      WHERE id = ?
    `).run(req.file.originalname, req.file.mimetype, base64, now, inquiryId);

    // Also update any matching partner record so it immediately appears in the partner's private area and activates the partnership
    db.prepare(`
      UPDATE partners
      SET counter_signed_protocol_name = ?,
          counter_signed_protocol_mime = ?,
          counter_signed_protocol_base64 = ?,
          counter_signed_protocol_uploaded_at = ?,
          protocol_in_force = 1,
          is_active = 1
      WHERE LOWER(name) = LOWER(?) OR (nif IS NOT NULL AND nif = ?)
    `).run(
      req.file.originalname,
      req.file.mimetype,
      base64,
      now,
      inq.company_name.trim(),
      inq.nif || ''
    );

    logAudit(
      admin.id,
      'admin_upload_protocolo_ambas_partes_proposta',
      `LPCS anexou o protocolo assinado por ambas as partes (${req.file.originalname}) à proposta de ${inq.company_name}`,
      req.ip,
      req.headers['user-agent']
    );

    return res.json({
      success: true,
      message: `Protocolo assinado por ambas as partes carregado com sucesso para "${inq.company_name}" e disponibilizado na área privada da entidade parceira.`,
    });
  }
);

router.get('/admin/inquiries/:id/counter-signed-protocol', requireAdmin, (req: Request, res: Response) => {
  const row = db
    .prepare(
      'SELECT counter_signed_protocol_name, counter_signed_protocol_mime, counter_signed_protocol_base64 FROM partner_inquiries WHERE id = ?'
    )
    .get(Number(req.params.id)) as any;

  if (!row || !row.counter_signed_protocol_base64 || !row.counter_signed_protocol_mime) {
    return res.status(404).send('Protocolo assinado por ambas as partes não encontrado.');
  }

  res.setHeader('Content-Type', row.counter_signed_protocol_mime);
  res.setHeader(
    'Content-Disposition',
    `inline; filename="${row.counter_signed_protocol_name || 'protocolo_assinado_ambas_partes.pdf'}"`
  );
  return res.send(Buffer.from(row.counter_signed_protocol_base64, 'base64'));
});

router.get('/admin/inquiries/:id/logo', requireAdmin, (req: Request, res: Response) => {
  const row = db
    .prepare('SELECT logo_mime, logo_base64 FROM partner_inquiries WHERE id = ?')
    .get(Number(req.params.id)) as { logo_mime?: string; logo_base64?: string } | undefined;

  if (!row || !row.logo_base64 || !row.logo_mime) {
    return res.status(404).send('Logótipo não encontrado.');
  }

  res.setHeader('Content-Type', row.logo_mime);
  return res.send(Buffer.from(row.logo_base64, 'base64'));
});

router.get('/admin/inquiries/images/:imageId', requireAdmin, (req: Request, res: Response) => {
  const row = db
    .prepare('SELECT mime_type, file_base64 FROM partner_inquiry_images WHERE id = ?')
    .get(Number(req.params.imageId)) as { mime_type?: string; file_base64?: string } | undefined;

  if (!row || !row.file_base64 || !row.mime_type) {
    return res.status(404).send('Imagem não encontrada.');
  }

  res.setHeader('Content-Type', row.mime_type);
  return res.send(Buffer.from(row.file_base64, 'base64'));
});

router.post('/admin/inquiries/:id/status', requireAdmin, (req: Request, res: Response) => {
  const admin = getSessionUser(req)!;
  const inquiryId = Number(req.params.id);
  const { status } = req.body;

  if (!['pendente', 'em_analise', 'aprovada', 'recusada'].includes(status)) {
    return res.status(400).json({ error: 'Estado inválido.' });
  }

  const inquiry = db.prepare('SELECT * FROM partner_inquiries WHERE id = ?').get(inquiryId) as any;
  if (!inquiry) {
    return res.status(404).json({ error: 'Proposta não encontrada.' });
  }

  db.prepare('UPDATE partner_inquiries SET status = ? WHERE id = ?').run(status, inquiryId);

  logAudit(
    admin.id,
    'admin_estado_parceria',
    `Proposta da empresa ${inquiry.company_name} atualizada para "${status}"`,
    req.ip,
    req.headers['user-agent']
  );

  return res.json({ success: true, status });
});

router.get('/admin/supabase-status', requireAdmin, (_req: Request, res: Response) => {
  const cfg = getSupabaseConfig();
  return res.json({
    configured: cfg.configured,
    url: cfg.url,
    hasServiceRoleKey: cfg.hasServiceRoleKey,
    hasAnonKey: cfg.hasAnonKey,
  });
});

router.post('/admin/supabase-config', requireAdmin, (req: Request, res: Response) => {
  const admin = getSessionUser(req)!;
  const { url, anonKey, serviceRoleKey } = req.body;
  if (!url || !String(url).trim().startsWith('https://')) {
    return res.status(400).json({
      error: 'Indique um Project URL válido do Supabase (ex.: https://xyz.supabase.co).',
    });
  }
  saveSupabaseConfig({
    url: String(url),
    anonKey: anonKey ? String(anonKey) : undefined,
    serviceRoleKey: serviceRoleKey ? String(serviceRoleKey) : undefined,
  });

  logAudit(
    admin.id,
    'admin_config_supabase',
    `Credenciais de ligação ao Supabase atualizadas (${String(url).trim()})`,
    req.ip,
    req.headers['user-agent']
  );

  const cfg = getSupabaseConfig();
  return res.json({
    success: true,
    configured: cfg.configured,
    url: cfg.url,
    hasServiceRoleKey: cfg.hasServiceRoleKey,
    hasAnonKey: cfg.hasAnonKey,
    message: 'Chaves de acesso do Supabase guardadas com sucesso!',
  });
});

router.post('/admin/supabase-sync', requireAdmin, async (req: Request, res: Response) => {
  const admin = getSessionUser(req)!;
  try {
    const result = await syncAllDataToSupabase();
    if (!result.ok) {
      return res.status(400).json(result);
    }
    logAudit(
      admin.id,
      'admin_sincronizacao_supabase',
      `Sincronização completa com Supabase concluída (${JSON.stringify(result.counts)})`,
      req.ip,
      req.headers['user-agent']
    );
    return res.json({
      success: true,
      message: 'Todos os dados de sócios, parceiros, quotas e protocolos foram sincronizados com o Supabase!',
      counts: result.counts,
    });
  } catch (err: any) {
    return res.status(500).json({
      ok: false,
      error: err?.message || 'Erro ao sincronizar com o Supabase.',
    });
  }
});

export default router;

