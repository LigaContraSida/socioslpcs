import nodemailer from 'nodemailer';
import { db } from './db.ts';
import { logAudit } from './totp.ts';

export const INSTITUTIONAL_NOTIFICATION_EMAIL =
  process.env.NOTIFICATION_EMAIL || 'info@ligacontrasida.org';

export function getEmailConfigStatus() {
  const hasSmtp = Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
  );
  const hasResend = Boolean(process.env.RESEND_API_KEY);
  return {
    recipient: INSTITUTIONAL_NOTIFICATION_EMAIL,
    configured: hasSmtp || hasResend,
    provider: hasResend ? 'Resend API' : hasSmtp ? `SMTP (${process.env.SMTP_HOST})` : 'Registo Local / Queue (configurar SMTP no .env para envio direto)',
  };
}

interface SendEmailParams {
  eventType: 'inscricao_socio' | 'inscricao_parceiro';
  subject: string;
  text: string;
  html: string;
  userId?: number | null;
}

export async function sendInstitutionalEmail({
  eventType,
  subject,
  text,
  html,
  userId = null,
}: SendEmailParams): Promise<{
  notificationId: number;
  status: 'enviado' | 'registado_sem_smtp' | 'erro';
  recipient: string;
}> {
  const recipient = INSTITUTIONAL_NOTIFICATION_EMAIL;
  let status: 'enviado' | 'registado_sem_smtp' | 'erro' = 'registado_sem_smtp';
  let errorMessage: string | null = null;

  const hasResend = Boolean(process.env.RESEND_API_KEY);
  const hasSmtp = Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
  );

  try {
    if (hasResend) {
      const fromAddress =
        process.env.SMTP_FROM || 'Portal Associados LPCS <onboarding@resend.dev>';
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [recipient],
          subject,
          text,
          html,
        }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`Resend API error (${res.status}): ${errBody}`);
      }
      status = 'enviado';
    } else if (hasSmtp) {
      const port = Number(process.env.SMTP_PORT || 587);
      const secure =
        process.env.SMTP_SECURE === 'true' || port === 465;

      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      const fromAddress =
        process.env.SMTP_FROM ||
        `"Portal de Associados LPCS" <${process.env.SMTP_USER}>`;

      await transporter.sendMail({
        from: fromAddress,
        to: recipient,
        subject,
        text,
        html,
      });

      status = 'enviado';
    } else {
      status = 'registado_sem_smtp';
      console.log(
        `\n[NOTIFICAÇÃO E-MAIL -> ${recipient}] (${eventType})\nAssunto: ${subject}\n${text}\n`
      );
    }
  } catch (err: any) {
    status = 'erro';
    errorMessage = err?.message || 'Erro desconhecido no envio de e-mail';
    console.error(`[Mailer Error -> ${recipient}]:`, errorMessage);
  }

  const insert = db
    .prepare(
      `INSERT INTO email_notifications (
        recipient, event_type, subject, body_text, body_html, status, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(recipient, eventType, subject, text, html, status, errorMessage);

  const notificationId = Number(insert.lastInsertRowid);

  logAudit(
    userId,
    'notificacao_email_inscricao',
    `Notificação para ${recipient}: "${subject}" [Estado: ${status}]`,
    '127.0.0.1',
    'LPCS-Mailer'
  );

  return {
    notificationId,
    status,
    recipient,
  };
}

export async function notifyNewMemberRegistration(member: {
  id: number;
  name: string;
  email: string;
  member_number: string;
  nif: string;
  phone: string;
  birth_date: string;
  address: string;
  postal_code: string;
  city: string;
  origin?: string;
}) {
  const nowStr = new Date().toLocaleString('pt-PT', { timeZone: 'Europe/Lisbon' });
  const subject = `[Liga em Rede · LPCS] Nova Inscrição de Sócio — ${member.name} (${member.member_number})`;

  const text = `NOVA INSCRIÇÃO DE ASSOCIADO — LIGA EM REDE (LPCS)
================================================================
Foi concluída uma nova inscrição de associado na plataforma Liga em Rede.

DADOS DO ASSOCIADO:
- Nome Completo: ${member.name}
- Nº de Sócio: ${member.member_number}
- E-mail: ${member.email}
- Telemóvel: ${member.phone}
- NIF: ${member.nif}
- Data de Nascimento: ${member.birth_date}
- Morada: ${member.address}
- Código Postal / Localidade: ${member.postal_code} ${member.city}
- Origem do Registo: ${member.origin || 'Formulário de Inscrição Online (/registar)'}
- Data e Hora: ${nowStr}

----------------------------------------------------------------
Liga Portuguesa Contra a SIDA (NIPC 502 665 548)
Praça Carlos Fabião, Loja 3A, 1600-316 Lisboa
Notificação enviada para: ${INSTITUTIONAL_NOTIFICATION_EMAIL}`;

  const html = `
  <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e7e5e4; border-radius: 12px; overflow: hidden; color: #141619;">
    <div style="background-color: #141619; color: #ffffff; padding: 20px 24px; border-bottom: 3px solid #C81E2B;">
      <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #fca5a5; font-weight: bold;">
        Liga Portuguesa Contra a SIDA · Portal de Associados
      </div>
      <h2 style="margin: 6px 0 0; font-size: 20px;">Nova Inscrição de Sócio Concluída</h2>
    </div>
    <div style="padding: 24px; background-color: #ffffff;">
      <p style="margin-top: 0; font-size: 14px; color: #57534e;">
        Um novo associado acaba de concluir a sua inscrição no Portal da LPCS:
      </p>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin: 16px 0;">
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #f5f5f4; color: #78716c; width: 38%;"><strong>Nº de Sócio</strong></td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #f5f5f4; font-family: monospace; font-weight: bold; color: #C81E2B;">${member.member_number}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #f5f5f4; color: #78716c;"><strong>Nome Completo</strong></td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #f5f5f4; font-weight: bold;">${member.name}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #f5f5f4; color: #78716c;"><strong>E-mail</strong></td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #f5f5f4;"><a href="mailto:${member.email}" style="color: #C81E2B;">${member.email}</a></td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #f5f5f4; color: #78716c;"><strong>Telemóvel</strong></td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #f5f5f4; font-family: monospace;">${member.phone}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #f5f5f4; color: #78716c;"><strong>NIF</strong></td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #f5f5f4; font-family: monospace;">${member.nif}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #f5f5f4; color: #78716c;"><strong>Data de Nascimento</strong></td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #f5f5f4;">${member.birth_date}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #f5f5f4; color: #78716c;"><strong>Morada</strong></td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #f5f5f4;">${member.address}, ${member.postal_code} ${member.city}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #f5f5f4; color: #78716c;"><strong>Origem</strong></td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #f5f5f4;">${member.origin || 'Inscrição Online (/registar)'}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; color: #78716c;"><strong>Data / Hora</strong></td>
          <td style="padding: 8px 12px;">${nowStr}</td>
        </tr>
      </table>
    </div>
    <div style="background-color: #FAF8F5; padding: 14px 24px; font-size: 12px; color: #78716c; border-top: 1px solid #e7e5e4;">
      Liga Portuguesa Contra a SIDA · NIPC 502 665 548 · Praça Carlos Fabião, Loja 3A, 1600-316 Lisboa
    </div>
  </div>`;

  return sendInstitutionalEmail({
    eventType: 'inscricao_socio',
    subject,
    text,
    html,
    userId: member.id,
  });
}

export interface PartnerProtocolData {
  company_name: string;
  nif?: string | null;
  address?: string | null;
  city?: string | null;
  district?: string | null;
  contact_name: string;
  contact_role?: string | null;
  proposed_benefit: string;
  protocol_duration?: string | null;
  valid_until?: string | null;
  max_uses?: number | string | null;
  code_mode?: string | null;
  created_at?: string | null;
}

export function formatPortugueseDate(dateInput?: string | Date | null): string {
  const d = dateInput ? new Date(dateInput) : new Date();
  const validDate = isNaN(d.getTime()) ? new Date() : d;
  return validDate.toLocaleDateString('pt-PT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function buildPartnerProtocolText(data: PartnerProtocolData): string {
  const companyName = (data.company_name || '(nome da empresa)').trim();
  const companyAddress = (
    data.address?.trim() ||
    (data.city ? `${data.city}${data.district && data.district !== data.city ? `, ${data.district}` : ''}` : '(morada)')
  );
  const companyNif = (data.nif || '(NIPC)').trim();
  const repRole = (data.contact_role || '(cargo)').trim();
  const repName = (data.contact_name || '(nome)').trim();
  const benefitConditions = (data.proposed_benefit || '(condições da oferta)').trim();
  const protocolDuration = (data.protocol_duration || 'um ano').trim() || 'um ano';
  const signedDate = formatPortugueseDate(data.created_at);

  return `PROTOCOLO

Entre Liga Portuguesa Contra a SIDA, Instituição Particular de Solidariedade Social, com sede na Praça Carlos Fabião, Loja 3A 1600-316 Lisboa, pessoa coletiva nº 502665548, representada pela Presidente da Direção, Maria Eugénia Saraiva, na qualidade de Primeira Outorgante 
e
${companyName} adiante designada por Segundo Outorgante, com sede em ${companyAddress}, pessoa coletiva nº ${companyNif}, representada pelo(a) ${repRole}, ${repName}, na qualidade de segundo outorgante
é celebrado o presente protocolo de cooperação, o qual se irá reger nos termos e de acordo com as cláusulas seguintes:

Cláusula 1.ª
(Objeto)
O presente Protocolo enquadra-se dentro do programa “A LIGA EM REDE” e tem por objeto conceder condições preferenciais na utilização dos bens e serviços do Segundo Outorgante aos associados da Primeira Outorgante, podendo o Segundo Outorgante beneficiar de um aumento de clientes/utilizadores destes bens e serviços através dos associados da Primeira Outorgante.

Cláusula 2.ª
(Objeto)
1. A Primeira Outorgante obriga-se a divulgar e promover o protocolo junto dos seus associados através dos meios de comunicação disponíveis e designadamente através da internet.
2. O Segundo Outorgante concede os benefícios de acesso aos serviços/bens protocolados, mediante a apresentação de comprovativo em como é associado da Primeira Outorgante.

Cláusula 3.ª
(Condições preferenciais)
O Segundo Outorgante disponibiliza aos associados da Primeira Outorgante as seguintes condições preferenciais:
${benefitConditions}

Cláusula 4.ª
(Vigência)
1. O presente protocolo entra em vigor na data da sua assinatura abaixo mencionada e terá a duração de ${protocolDuration}, automaticamente renovável por iguais e sucessivos períodos.
2. Qualquer alteração ao presente protocolo apenas será válida se se observar também a forma escrita e ser assinado por ambas as partes.

Cláusula 5.ª
(Denúncia)
A denúncia do presente protocolo por qualquer das partes deverá ser efetuada mediante comunicação escrita à outra parte, com uma antecedência de trinta dias seguidos, relativa ao termo da sua vigência.

O presente documento é feito em duplicado e assinado pelos outorgantes, destinando-se um exemplar a cada uma das partes.

Lisboa, ${signedDate}

Responsável do Primeiro Outorgante
________________________
(Maria Eugénia Saraiva)
Presidente da Direção

Responsável do Segundo Outorgante 
_________________________
(${repName}) 
(${repRole})`;
}

export async function notifyNewPartnerInquiry(inquiry: {
  id: number;
  company_name: string;
  nif: string | null;
  address?: string | null;
  contact_name: string;
  contact_role?: string | null;
  email: string;
  phone: string;
  area: string;
  district: string;
  city: string;
  benefit_type: string;
  proposed_benefit: string;
  valid_until: string;
  max_uses: number | null;
  code_mode: string;
  proposed_code: string | null;
  website: string | null;
  notes: string | null;
}) {
  const nowStr = new Date().toLocaleString('pt-PT', { timeZone: 'Europe/Lisbon' });
  const subject = `[Liga em Rede · LPCS] Nova Inscrição de Parceiro — ${inquiry.company_name}`;
  const protocolText = buildPartnerProtocolText(inquiry);

  const text = `NOVA PROPOSTA / INSCRIÇÃO DE PARCEIRO — LIGA EM REDE (LPCS)
================================================================
Uma entidade submeteu uma nova inscrição de parceria na plataforma Liga em Rede.

DADOS DA ENTIDADE PARCEIRA:
- Empresa / Entidade: ${inquiry.company_name}
- NIPC / NIF: ${inquiry.nif || 'Não indicado'}
- Morada da Sede: ${inquiry.address || `${inquiry.city} (${inquiry.district})`}
- Pessoa de Contacto: ${inquiry.contact_name} (${inquiry.contact_role || 'Representante'})
- E-mail: ${inquiry.email}
- Telefone / Telemóvel: ${inquiry.phone}
- Área de Atividade: ${inquiry.area}
- Localização: ${inquiry.city} (${inquiry.district})
- Tipo de Benefício: ${inquiry.benefit_type}
- Desconto Proposto: ${inquiry.proposed_benefit}
- Validade da Parceria: ${inquiry.valid_until}
- Modo de Código: ${inquiry.code_mode === 'codigo_unico' ? `Código Único (${inquiry.proposed_code || 'a definir'})` : 'Código Rotativo 6 dígitos + QR Code'}
- Limite de Utilizações: ${inquiry.max_uses ? `Até ${inquiry.max_uses} utilizações por sócio` : 'Utilização ilimitada'}
- Website: ${inquiry.website || '—'}
- Observações: ${inquiry.notes || '—'}
- Data e Hora: ${nowStr}

================================================================
${protocolText}
================================================================
Liga Portuguesa Contra a SIDA (NIPC 502 665 548)
Praça Carlos Fabião, Loja 3A, 1600-316 Lisboa
Notificação enviada para: ${INSTITUTIONAL_NOTIFICATION_EMAIL}`;

  const html = `
  <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e7e5e4; border-radius: 12px; overflow: hidden; color: #141619;">
    <div style="background-color: #141619; color: #ffffff; padding: 20px 24px; border-bottom: 3px solid #C81E2B;">
      <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #fca5a5; font-weight: bold;">
        Liga Portuguesa Contra a SIDA · Rede de Parceiros
      </div>
      <h2 style="margin: 6px 0 0; font-size: 20px;">Nova Inscrição de Parceiro Submetida</h2>
    </div>
    <div style="padding: 24px; background-color: #ffffff;">
      <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin: 8px 0;">
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #f5f5f4; color: #78716c; width: 38%;"><strong>Empresa / Marca</strong></td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #f5f5f4; font-weight: bold;">${inquiry.company_name}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #f5f5f4; color: #78716c;"><strong>NIPC / NIF</strong></td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #f5f5f4; font-family: monospace;">${inquiry.nif || '—'}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #f5f5f4; color: #78716c;"><strong>Contacto</strong></td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #f5f5f4;">${inquiry.contact_name} · <a href="mailto:${inquiry.email}" style="color: #C81E2B;">${inquiry.email}</a> · ${inquiry.phone}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #f5f5f4; color: #78716c;"><strong>Área / Local</strong></td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #f5f5f4;">${inquiry.area} — ${inquiry.city} (${inquiry.district})</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #f5f5f4; color: #78716c;"><strong>Desconto Proposto</strong></td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #f5f5f4; font-weight: bold; color: #C81E2B;">${inquiry.proposed_benefit}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #f5f5f4; color: #78716c;"><strong>Validade da Parceria</strong></td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #f5f5f4; font-family: monospace; font-weight: bold;">${inquiry.valid_until}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #f5f5f4; color: #78716c;"><strong>Modo / Utilizações</strong></td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #f5f5f4;">${inquiry.code_mode === 'codigo_unico' ? 'Código Único' : 'Código Rotativo 6 dígitos'} · ${inquiry.max_uses ? `Máx. ${inquiry.max_uses} usos` : 'Ilimitado'}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; color: #78716c;"><strong>Data / Hora</strong></td>
          <td style="padding: 8px 12px;">${nowStr}</td>
        </tr>
      </table>
    </div>
    <div style="background-color: #FAF8F5; padding: 14px 24px; font-size: 12px; color: #78716c; border-top: 1px solid #e7e5e4;">
      Liga Portuguesa Contra a SIDA · NIPC 502 665 548 · Praça Carlos Fabião, Loja 3A, 1600-316 Lisboa
    </div>
  </div>`;

  return sendInstitutionalEmail({
    eventType: 'inscricao_parceiro',
    subject,
    text,
    html,
  });
}
