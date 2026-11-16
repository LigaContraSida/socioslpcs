import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  CheckCircle2,
  XCircle,
  Mail,
  Lock,
  LogIn,
  LogOut,
  AlertCircle,
  Store,
  QrCode,
  Camera,
  Keyboard,
  Upload,
  FileCheck,
  FileText,
  ShieldCheck,
  Printer,
  Download,
  Copy,
  Check,
  Save,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import jsQR from 'jsqr';
import { LpcsLogo } from '../components/LpcsLogo.tsx';

interface PartnerSessionData {
  id: number;
  partner_id: number;
  email: string;
  contact_name: string | null;
  contact_role?: string | null;
  partner_name: string;
  partner_category: string;
  discount_highlight: string;
  nif?: string | null;
  address?: string | null;
  city?: string | null;
  district?: string | null;
  protocol_duration?: string;
  valid_until?: string;
  protocol_in_force?: boolean;
  has_partner_signed_protocol?: boolean;
  partner_signed_protocol_name?: string | null;
  partner_signed_protocol_uploaded_at?: string | null;
  has_counter_signed_protocol?: boolean;
  counter_signed_protocol_name?: string | null;
  counter_signed_protocol_uploaded_at?: string | null;
}

interface DemoPartnerAccount {
  partner_id: number;
  email: string;
  partner_name: string;
  category: string;
}

function parseScannedQrPayload(raw: string): { ref: string; code: string } | null {
  const text = raw.trim();
  if (!text) return null;

  // 1. URL format: https://.../validar?ref=LPCS-XXX-123456&code=654321
  try {
    const parsedUrl = new URL(text, window.location.origin);
    const ref = parsedUrl.searchParams.get('ref');
    const code = parsedUrl.searchParams.get('code');
    if (ref && code && /^\d{6}$/.test(code.trim())) {
      return { ref: ref.trim().toUpperCase(), code: code.trim() };
    }
  } catch {
    // Fall through to structured string parsing
  }

  // 2. JSON format: {"ref":"...","code":"..."} or {"reference_code":"...","code":"..."}
  if (text.startsWith('{')) {
    try {
      const obj = JSON.parse(text);
      const ref = obj.ref || obj.reference_code;
      const code = String(obj.code || '').trim();
      if (ref && /^\d{6}$/.test(code)) {
        return { ref: String(ref).trim().toUpperCase(), code };
      }
    } catch {
      // Ignore malformed JSON
    }
  }

  // 3. Pipe format: LPCS-XXX-123456|654321
  const parts = text.split('|');
  if (parts.length === 2 && /^\d{6}$/.test(parts[1].trim())) {
    return { ref: parts[0].trim().toUpperCase(), code: parts[1].trim() };
  }

  return null;
}

export const MerchantValidatePage: React.FC = () => {
  const [partner, setPartner] = useState<PartnerSessionData | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  // Login form state
  const [demoAccounts, setDemoAccounts] = useState<DemoPartnerAccount[]>([]);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [cookieBlocked, setCookieBlocked] = useState(false);
  const [loginSubmitting, setLoginSubmitting] = useState(false);

  // Validation state
  const [inputMode, setInputMode] = useState<'qr' | 'manual'>('manual');
  const [referenceCode, setReferenceCode] = useState('');
  const [sixDigitCode, setSixDigitCode] = useState('');
  const [validating, setValidating] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  // QR auto-validation from native camera URL (?ref=...&code=...)
  const [pendingQrScan, setPendingQrScan] = useState<{ ref: string; code: string } | null>(null);

  // Camera QR scanner state
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);

  const refInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const scanLockedRef = useRef(false);

  const stopScanner = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  const executeVerification = useCallback(
    async (refVal: string, codeVal: string, method: 'qr' | 'manual') => {
      setError(null);
      setResult(null);

      if (!refVal.trim() || !codeVal.trim()) {
        setError('Introduza a referência e o código de 6 dígitos.');
        return;
      }

      setValidating(true);

      try {
        const res = await fetch('/api/benefits/verify-code', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reference_code: refVal.trim(),
            code: codeVal.trim(),
            validation_method: method,
          }),
        });

        const data = await res.json();

        if (res.status === 401) {
          setPartner(null);
          setLoginError(data.error || 'Sessão expirada. Inicie sessão novamente.');
          setValidating(false);
          return;
        }

        if (!res.ok) {
          setError(data.error || 'Código inválido.');
          setValidating(false);
          scanLockedRef.current = false;
          return;
        }

        setResult(data);
        setValidating(false);
        stopScanner();
        confetti({
          particleCount: 70,
          spread: 55,
          origin: { y: 0.6 },
        });
      } catch (err) {
        console.error('Validation error:', err);
        setError('Erro de ligação ao servidor.');
        setValidating(false);
        scanLockedRef.current = false;
      }
    },
    [stopScanner]
  );

  const fetchPartnerSession = async (): Promise<PartnerSessionData | null> => {
    try {
      const res = await fetch('/api/partner-auth/me', { credentials: 'same-origin' });
      const data = await res.json();
      setPartner(data.partner || null);
      return data.partner || null;
    } catch (err) {
      console.error('Partner session check error:', err);
      setPartner(null);
      return null;
    } finally {
      setCheckingSession(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const errParam = params.get('error');
    if (errParam) {
      setLoginError(decodeURIComponent(errParam));
    }

    const qrRef = params.get('ref');
    const qrCode = params.get('code');
    if (qrRef && qrCode) {
      const cleanRef = qrRef.trim().toUpperCase();
      const cleanCode = qrCode.trim();
      setReferenceCode(cleanRef);
      setSixDigitCode(cleanCode);
      setPendingQrScan({ ref: cleanRef, code: cleanCode });
      // Clean URL parameters immediately to avoid duplicate submissions on refresh
      window.history.replaceState({}, '', '/validar');
    }

    fetchPartnerSession();

    fetch('/api/partner-auth/demo-accounts')
      .then((r) => r.json())
      .then((data) => setDemoAccounts(data.accounts || []))
      .catch(() => {});

    return () => {
      stopScanner();
    };
  }, [stopScanner]);

  // Automatically validate when partner session is active and a scanned QR URL was opened
  useEffect(() => {
    if (partner && pendingQrScan) {
      const payload = pendingQrScan;
      setPendingQrScan(null);
      executeVerification(payload.ref, payload.code, 'qr');
    }
  }, [partner, pendingQrScan, executeVerification]);

  // Start / stop webcam scanner when switching to QR mode
  useEffect(() => {
    if (!partner || result || inputMode !== 'qr') {
      stopScanner();
      return;
    }

    let cancelled = false;
    setCameraError(null);
    scanLockedRef.current = false;

    const startCamera = async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError(
          'Este navegador não disponibiliza acesso à câmara aqui. Pode carregar uma fotografia do QR Code abaixo ou usar o modo manual.'
        );
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true');
          await videoRef.current.play();
          setCameraActive(true);
        }

        const tick = () => {
          if (cancelled) return;
          const video = videoRef.current;
          const canvas = canvasRef.current;

          if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA && !scanLockedRef.current) {
            const width = video.videoWidth;
            const height = video.videoHeight;
            if (width > 0 && height > 0) {
              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d', { willReadFrequently: true });
              if (ctx) {
                ctx.drawImage(video, 0, 0, width, height);
                const imageData = ctx.getImageData(0, 0, width, height);
                const qr = jsQR(imageData.data, width, height, {
                  inversionAttempts: 'dontInvert',
                });

                if (qr && qr.data) {
                  const parsed = parseScannedQrPayload(qr.data);
                  if (parsed) {
                    scanLockedRef.current = true;
                    setReferenceCode(parsed.ref);
                    setSixDigitCode(parsed.code);
                    stopScanner();
                    executeVerification(parsed.ref, parsed.code, 'qr');
                    return;
                  } else {
                    setError('O QR Code lido não corresponde a um desconto LPCS válido.');
                  }
                }
              }
            }
          }

          rafRef.current = requestAnimationFrame(tick);
        };

        rafRef.current = requestAnimationFrame(tick);
      } catch (err) {
        console.error('Camera start error:', err);
        if (!cancelled) {
          setCameraError(
            'Não foi possível ativar a câmara (permissão negada ou dispositivo sem câmara). Pode carregar uma imagem do QR Code ou introduzir os dígitos manualmente.'
          );
        }
      }
    };

    startCamera();

    return () => {
      cancelled = true;
      stopScanner();
    };
  }, [partner, result, inputMode, stopScanner, executeVerification]);

  const handleQrImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const qr = jsQR(imageData.data, canvas.width, canvas.height);
        URL.revokeObjectURL(objectUrl);

        if (!qr || !qr.data) {
          setError('Não foi detetado nenhum Código QR legível na imagem selecionada.');
          return;
        }
        const parsed = parseScannedQrPayload(qr.data);
        if (!parsed) {
          setError('O Código QR da imagem não pertence a um desconto LPCS.');
          return;
        }
        setReferenceCode(parsed.ref);
        setSixDigitCode(parsed.code);
        executeVerification(parsed.ref, parsed.code, 'qr');
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setError('Não foi possível processar a imagem selecionada.');
    };
    img.src = objectUrl;
    e.target.value = '';
  };

  const handlePartnerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginSubmitting(true);
    setLoginError(null);
    setCookieBlocked(false);

    try {
      const res = await fetch('/api/partner-auth/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error || 'Credenciais de parceiro inválidas.');
        setLoginSubmitting(false);
        return;
      }

      const activePartner = await fetchPartnerSession();
      setLoginSubmitting(false);
      if (!activePartner) {
        setCookieBlocked(true);
        setLoginError(
          'O browser bloqueou o cookie de sessão na pré-visualização. Abra o portal num novo separador para entrar.'
        );
      }
    } catch (err) {
      console.error('Partner login error:', err);
      const form = document.getElementById('partner-native-login-form') as HTMLFormElement;
      form?.submit();
    }
  };

  const handlePartnerLogout = async () => {
    stopScanner();
    try {
      await fetch('/api/partner-auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
      });
    } catch (err) {
      console.error('Partner logout error:', err);
    }
    setPartner(null);
    setReferenceCode('');
    setSixDigitCode('');
    setResult(null);
    setError(null);
  };

  const handleValidateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await executeVerification(referenceCode, sixDigitCode, 'manual');
  };

  const [uploadingProtocol, setUploadingProtocol] = useState(false);
  const [savingProtocolDetails, setSavingProtocolDetails] = useState(false);
  const [protocolMessage, setProtocolMessage] = useState<string | null>(null);
  const [copiedProtocol, setCopiedProtocol] = useState(false);
  const [protocolForm, setProtocolForm] = useState({
    company_name: '',
    address: '',
    nif: '',
    contact_role: '',
    contact_name: '',
    proposed_benefit: '',
    protocol_duration: 'um ano',
  });

  const todayPortuguese = new Date().toLocaleDateString('pt-PT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  useEffect(() => {
    if (partner) {
      setProtocolForm({
        company_name: partner.partner_name || '',
        address:
          partner.address ||
          [partner.city, partner.district].filter(Boolean).join(', ') ||
          '',
        nif: partner.nif || '',
        contact_role: partner.contact_role || '',
        contact_name: partner.contact_name || '',
        proposed_benefit: partner.discount_highlight || '',
        protocol_duration: partner.protocol_duration || 'um ano',
      });
    }
  }, [partner]);

  const handleSaveProtocolDetails = async () => {
    setSavingProtocolDetails(true);
    setProtocolMessage(null);
    setError(null);
    try {
      const res = await fetch('/api/partner-auth/protocol-details', {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partner_name: protocolForm.company_name,
          address: protocolForm.address,
          nif: protocolForm.nif,
          contact_role: protocolForm.contact_role,
          contact_name: protocolForm.contact_name,
          discount_highlight: protocolForm.proposed_benefit,
          protocol_duration: protocolForm.protocol_duration,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Erro ao guardar alterações ao protocolo.');
      } else {
        setProtocolMessage(data.message);
        await fetchPartnerSession();
      }
    } catch {
      setError('Falha de ligação ao guardar os dados do protocolo.');
    } finally {
      setSavingProtocolDetails(false);
    }
  };

  const protoCompanyName = protocolForm.company_name.trim() || '(nome da empresa)';
  const protoAddress = protocolForm.address.trim() || '(morada)';
  const protoNif = protocolForm.nif.trim() || '(NIPC)';
  const protoRole = protocolForm.contact_role.trim() || '(cargo)';
  const protoName = protocolForm.contact_name.trim() || '(nome)';
  const protoBenefit = protocolForm.proposed_benefit.trim() || '(condições da oferta)';
  const protoDuration = protocolForm.protocol_duration.trim() || 'um ano';

  const fullProtocolText = [
    'PROTOCOLO',
    '',
    'Entre Liga Portuguesa Contra a SIDA, Instituição Particular de Solidariedade Social, com sede na Praça Carlos Fabião, Loja 3A 1600-316 Lisboa, pessoa coletiva nº 502665548, representada pela Presidente da Direção, Maria Eugénia Saraiva, na qualidade de Primeira Outorgante',
    'e',
    `${protoCompanyName} adiante designada por Segundo Outorgante, com sede em ${protoAddress}, pessoa coletiva nº ${protoNif}, representada pelo(a) ${protoRole}, ${protoName}, na qualidade de segundo outorgante`,
    'é celebrado o presente protocolo de cooperação, o qual se irá reger nos termos e de acordo com as cláusulas seguintes:',
    '',
    'Cláusula 1.ª',
    '(Objeto)',
    'O presente Protocolo enquadra-se dentro do programa “A LIGA EM REDE” e tem por objeto conceder condições preferenciais na utilização dos bens e serviços do Segundo Outorgante aos associados da Primeira Outorgante, podendo o Segundo Outorgante beneficiar de um aumento de clientes/utilizadores destes bens e serviços através dos associados da Primeira Outorgante.',
    '',
    'Cláusula 2.ª',
    '(Objeto)',
    '1. A Primeira Outorgante obriga-se a divulgar e promover o protocolo junto dos seus associados através dos meios de comunicação disponíveis e designadamente através da internet.',
    '2. O Segundo Outorgante concede os benefícios de acesso aos serviços/bens protocolados, mediante a apresentação de comprovativo em como é associado da Primeira Outorgante.',
    '',
    'Cláusula 3.ª',
    '(Condições preferenciais)',
    'O Segundo Outorgante disponibiliza aos associados da Primeira Outorgante as seguintes condições preferenciais:',
    protoBenefit,
    '',
    'Cláusula 4.ª',
    '(Vigência)',
    `1. O presente protocolo entra em vigor na data da sua assinatura abaixo mencionada e terá a duração de ${protoDuration}, automaticamente renovável por iguais e sucessivos períodos.`,
    '2. Qualquer alteração ao presente protocolo apenas será válida se se observar também a forma escrita e ser assinado por ambas as partes.',
    '',
    'Cláusula 5.ª',
    '(Denúncia)',
    'A denúncia do presente protocolo por qualquer das partes deverá ser efetuada mediante comunicação escrita à outra parte, com uma antecedência de trinta dias seguidos, relativa ao termo da sua vigência.',
    'O presente documento é feito em duplicado e assinado pelos outorgantes, destinando-se um exemplar a cada uma das partes.',
    '',
    `Lisboa, ${todayPortuguese}`,
    '',
    'Responsável do Primeiro Outorgante',
    '________________________',
    '(Maria Eugénia Saraiva)',
    'Presidente da Direção',
    '',
    'Responsável do Segundo Outorgante',
    '_________________________',
    `(${protoName})`,
    `(${protoRole})`,
  ].join('\n');

  const handleCopyProtocol = async () => {
    try {
      await navigator.clipboard.writeText(fullProtocolText);
      setCopiedProtocol(true);
      setTimeout(() => setCopiedProtocol(false), 2500);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleDownloadProtocol = () => {
    const blob = new Blob([fullProtocolText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeCompany = protoCompanyName.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40) || 'Empresa';
    a.href = url;
    a.download = `PROTOCOLO_Liga_em_Rede_${safeCompany}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePrintProtocol = () => {
    const qs = new URLSearchParams({
      company_name: protocolForm.company_name || '',
      nif: protocolForm.nif || '',
      address: protocolForm.address || '',
      contact_name: protocolForm.contact_name || '',
      contact_role: protocolForm.contact_role || '',
      proposed_benefit: protocolForm.proposed_benefit || '',
      protocol_duration: protocolForm.protocol_duration || 'um ano',
    });
    window.open(`/api/partners/protocol-preview?${qs.toString()}`, '_blank', 'noopener,noreferrer');
  };

  const handlePartnerSignedUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingProtocol(true);
    setProtocolMessage(null);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('signed_protocol', file);
      const res = await fetch('/api/partner-auth/protocol/partner-signed', {
        method: 'POST',
        credentials: 'same-origin',
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Erro ao carregar o protocolo assinado.');
      } else {
        setProtocolMessage(data.message);
        await fetchPartnerSession();
      }
    } catch {
      setError('Falha de ligação ao servidor ao submeter o protocolo.');
    } finally {
      setUploadingProtocol(false);
      e.target.value = '';
    }
  };

  const handleReset = () => {
    setReferenceCode('');
    setSixDigitCode('');
    setResult(null);
    setError(null);
    scanLockedRef.current = false;
    if (inputMode === 'manual') {
      setTimeout(() => refInputRef.current?.focus(), 20);
    }
  };

  if (checkingSession) {
    return (
      <div className="py-28 flex flex-col items-center justify-center space-y-3">
        <div className="w-7 h-7 border-2 border-[#C81E2B] border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-stone-500 font-medium">A verificar sessão de parceiro...</p>
      </div>
    );
  }

  // ==========================================
  // VIEW 1: PARTNER LOGIN (NOT AUTHENTICATED)
  // ==========================================
  if (!partner) {
    return (
      <div className="max-w-md mx-auto px-4 py-14 space-y-6">
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <LpcsLogo variant="dark" className="h-24 w-auto rounded-xl" />
          </div>
          <div className="font-condensed text-xs font-bold uppercase tracking-[0.16em] text-[#C81E2B]">
            Liga em Rede · Área de Parceiros LPCS
          </div>
          <h1 className="font-display text-3xl font-bold text-[#141619] tracking-tight">
            Entrar como Parceiro
          </h1>
          <p className="text-sm font-light text-stone-600">
            Inicie sessão para validar códigos QR ou códigos de 6 dígitos dos sócios.
          </p>
        </div>

        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-stone-200 space-y-5">
          {pendingQrScan && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
              <QrCode className="w-4 h-4 text-[#C81E2B] shrink-0 mt-0.5" />
              <span>
                Código QR lido (<strong className="font-mono">{pendingQrScan.ref}</strong>). Inicie sessão como parceiro para concluir a validação automaticamente.
              </span>
            </div>
          )}

          {loginError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex flex-col gap-2 text-xs text-red-800">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-[#C81E2B] shrink-0 mt-0.5" />
                <span>{loginError}</span>
              </div>
              {cookieBlocked && (
                <a
                  href={window.location.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="self-start ml-6 px-3 py-1.5 rounded-lg bg-[#C81E2B] text-white text-xs font-bold hover:bg-[#A11622]"
                >
                  Abrir Portal num Novo Separador
                </a>
              )}
            </div>
          )}

          {demoAccounts.length > 0 && (
            <div className="bg-[#FAF8F5] p-3.5 rounded-xl border border-stone-200 space-y-2">
              <label className="block text-xs font-bold text-stone-700">
                Acesso rápido de demonstração (Parceiros)
              </label>
              <select
                value={loginEmail}
                onChange={(e) => {
                  const chosen = e.target.value;
                  if (chosen) {
                    setLoginEmail(chosen);
                    setLoginPassword('Parceiro!2026');
                  }
                }}
                className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-xs font-medium text-[#141619] focus:outline-hidden focus:border-[#C81E2B]"
              >
                <option value="">Selecionar um estabelecimento parceiro...</option>
                {demoAccounts.map((acc) => (
                  <option key={acc.partner_id} value={acc.email}>
                    {acc.partner_name} ({acc.email})
                  </option>
                ))}
              </select>
            </div>
          )}

          <form
            id="partner-native-login-form"
            method="post"
            action="/api/partner-auth/login"
            onSubmit={handlePartnerLogin}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1.5">
                E-mail do Parceiro
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  name="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="parceiro@parceiro.lpcs.pt"
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-stone-300 bg-[#FAF8F5]/50 text-sm focus:outline-hidden focus:bg-white focus:border-[#C81E2B] focus:ring-1 focus:ring-[#C81E2B]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1.5">
                Palavra-passe
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  name="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-stone-300 bg-[#FAF8F5]/50 text-sm focus:outline-hidden focus:bg-white focus:border-[#C81E2B] focus:ring-1 focus:ring-[#C81E2B]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loginSubmitting}
              className="w-full py-3 rounded-lg bg-[#C81E2B] hover:bg-[#A11622] text-white font-bold text-sm transition-colors flex items-center justify-center gap-2"
            >
              {loginSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>A entrar...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Entrar no Validador</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW 2: PARTNER PRIVATE AREA (PROTOCOL STATUS + VALIDATOR + EDITABLE PROTOCOL DOCUMENT)
  // ==========================================
  const isProtocolInForce = partner.protocol_in_force !== false;

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-8">
      {/* Compact Partner Bar */}
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2 min-w-0">
          <Store className="w-4 h-4 text-[#C81E2B] shrink-0" />
          <div className="min-w-0">
            <span className="text-sm font-bold text-[#141619] block truncate">
              {partner.partner_name}
            </span>
            <span className="text-[11px] text-stone-500 block">
              Área Privada da Entidade Parceira · Liga em Rede
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={handlePartnerLogout}
          className="px-3 py-1.5 rounded-lg border border-stone-300 bg-white hover:border-stone-400 text-xs font-bold text-stone-700 hover:text-[#C81E2B] flex items-center gap-1.5 shrink-0 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sair</span>
        </button>
      </div>

      {/* Partner Private Area — Official Protocol Status & Upload Card */}
      <div
        className={`rounded-2xl p-5 sm:p-6 border space-y-4 ${
          isProtocolInForce
            ? 'bg-emerald-50/70 border-emerald-300'
            : 'bg-amber-50 border-amber-300'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider">
              <ShieldCheck
                className={`w-4 h-4 ${isProtocolInForce ? 'text-emerald-700' : 'text-amber-700'}`}
              />
              <span className={isProtocolInForce ? 'text-emerald-800' : 'text-amber-800'}>
                {isProtocolInForce
                  ? 'Parceria em Vigor · Protocolo Assinado por Ambas as Partes'
                  : 'Parceria Pendente de Entrada em Vigor · Aguarda Assinatura LPCS'}
              </span>
            </div>
            <h2 className="text-sm font-bold text-[#141619]">
              Protocolo de Cooperação “A LIGA EM REDE” (Exclusivo da Área Privada)
            </h2>
            <p className="text-xs text-stone-700 leading-relaxed">
              {isProtocolInForce
                ? 'A LPCS assinou e disponibilizou abaixo o protocolo assinado por ambas as partes nesta área privada. A sua parceria encontra-se em pleno vigor.'
                : 'Se preenchido, o protocolo abaixo deve ser submetido devidamente assinado pela empresa. A parceria entra em vigor quando assinado por parte da LPCS e quando a LPCS colocar o protocolo assinado por ambas as partes nesta área privada da entidade parceira.'}
            </p>
          </div>
        </div>

        {protocolMessage && (
          <div className="p-3 rounded-lg bg-white border border-emerald-300 text-xs text-emerald-800 font-medium">
            {protocolMessage}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          {isProtocolInForce && (
            <a
              href="/api/partner-auth/protocol/counter-signed"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
            >
              <FileCheck className="w-4 h-4" />
              <span>Ver / Descarregar Protocolo Assinado por Ambas as Partes (LPCS + Parceiro)</span>
            </a>
          )}

          {partner.has_partner_signed_protocol && (
            <a
              href="/api/partner-auth/protocol/partner-signed"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 rounded-lg bg-white border border-stone-300 hover:bg-stone-50 text-stone-800 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
            >
              <FileText className="w-3.5 h-3.5 text-[#C81E2B]" />
              <span>Ver Exemplar Assinado pela Empresa</span>
            </a>
          )}

          <label className="px-3.5 py-2 rounded-lg bg-[#C81E2B] hover:bg-[#A11622] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors">
            <Upload className="w-3.5 h-3.5" />
            <span>
              {uploadingProtocol
                ? 'A carregar...'
                : partner.has_partner_signed_protocol
                ? 'Atualizar Upload do Protocolo Assinado pela Empresa'
                : 'Fazer Upload do Protocolo Devidamente Assinado pela Empresa'}
            </span>
            <input
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/webp,.doc,.docx"
              onChange={handlePartnerSignedUpload}
              disabled={uploadingProtocol}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Editable Official Protocol Document inside Partner Private Area */}
      <section
        id="protocol-document-section"
        className="rounded-2xl border border-stone-200 bg-white p-6 sm:p-10 space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-stone-200">
          <div className="space-y-1">
            <span className="font-condensed text-xs font-bold uppercase tracking-[0.16em] text-[#C81E2B]">
              Documento Oficial na Área Privada · A LIGA EM REDE
            </span>
            <h2 className="font-display text-2xl font-bold text-[#141619] tracking-tight">
              Protocolo de Cooperação — Preenchimento e Edição
            </h2>
            <p className="text-xs text-stone-600">
              Preenchido automaticamente com os dados do registo. Todos os campos destacados ao longo do documento são editáveis antes de imprimir e assinar.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleSaveProtocolDetails}
              disabled={savingProtocolDetails}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#C81E2B] hover:bg-[#A11622] text-white text-xs font-semibold transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{savingProtocolDetails ? 'A guardar...' : 'Guardar Dados'}</span>
            </button>
            <button
              type="button"
              onClick={handlePrintProtocol}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#141619] hover:bg-stone-800 text-white text-xs font-semibold transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir / PDF para Assinar</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadProtocol}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 text-stone-800 text-xs font-semibold transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-stone-600" />
              <span>Descarregar (.txt)</span>
            </button>
            <button
              type="button"
              onClick={handleCopyProtocol}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 text-stone-800 text-xs font-semibold transition-colors"
            >
              {copiedProtocol ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-stone-600" />
                  <span>Copiar</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="bg-[#FAF8F5] border border-stone-300 rounded-xl p-6 sm:p-10 text-[#141619] font-serif leading-relaxed space-y-6">
          <div className="flex flex-col items-center text-center border-b border-stone-200 pb-6 space-y-3">
            <LpcsLogo className="h-16 w-auto rounded bg-white p-1 border border-stone-200" />
            <h3 className="text-xl sm:text-2xl font-bold tracking-[0.18em] uppercase text-[#141619] pt-1">
              PROTOCOLO
            </h3>
          </div>

          <div className="space-y-4 text-sm sm:text-[15px] text-justify">
            <p>
              Entre <strong>Liga Portuguesa Contra a SIDA</strong>, Instituição Particular de Solidariedade Social, com sede na{' '}
              <strong>Praça Carlos Fabião, Loja 3A 1600-316 Lisboa</strong>, pessoa coletiva nº{' '}
              <strong>502665548</strong>, representada pela Presidente da Direção,{' '}
              <strong>Maria Eugénia Saraiva</strong>, na qualidade de <strong>Primeira Outorgante</strong>
            </p>
            <p className="text-center font-semibold">e</p>
            <p className="leading-8">
              <input
                type="text"
                aria-label="(nome da empresa)"
                value={protocolForm.company_name}
                onChange={(e) => setProtocolForm({ ...protocolForm, company_name: e.target.value })}
                placeholder="(nome da empresa)"
                className="inline-block w-60 sm:w-64 px-2 py-0.5 mx-0.5 rounded bg-amber-100/90 font-bold text-[#141619] placeholder:text-stone-700 border border-amber-400 focus:outline-hidden focus:bg-white focus:border-[#C81E2B]"
              />{' '}
              adiante designada por <strong>Segundo Outorgante</strong>, com sede em{' '}
              <input
                type="text"
                aria-label="(morada)"
                value={protocolForm.address}
                onChange={(e) => setProtocolForm({ ...protocolForm, address: e.target.value })}
                placeholder="(morada)"
                className="inline-block w-64 sm:w-80 px-2 py-0.5 mx-0.5 rounded bg-amber-100/90 font-semibold text-[#141619] placeholder:text-stone-700 border border-amber-400 focus:outline-hidden focus:bg-white focus:border-[#C81E2B]"
              />
              , pessoa coletiva nº{' '}
              <input
                type="text"
                aria-label="NIPC"
                maxLength={9}
                value={protocolForm.nif}
                onChange={(e) =>
                  setProtocolForm({ ...protocolForm, nif: e.target.value.replace(/\D/g, '') })
                }
                placeholder="(NIPC)"
                className="inline-block w-36 px-2 py-0.5 mx-0.5 rounded bg-amber-100/90 font-semibold font-mono text-[#141619] placeholder:text-stone-700 border border-amber-400 focus:outline-hidden focus:bg-white focus:border-[#C81E2B]"
              />
              , representada pelo(a){' '}
              <input
                type="text"
                aria-label="(cargo)"
                value={protocolForm.contact_role}
                onChange={(e) => setProtocolForm({ ...protocolForm, contact_role: e.target.value })}
                placeholder="(cargo)"
                className="inline-block w-44 px-2 py-0.5 mx-0.5 rounded bg-amber-100/90 font-semibold text-[#141619] placeholder:text-stone-700 border border-amber-400 focus:outline-hidden focus:bg-white focus:border-[#C81E2B]"
              />
              ,{' '}
              <input
                type="text"
                aria-label="(nome)"
                value={protocolForm.contact_name}
                onChange={(e) => setProtocolForm({ ...protocolForm, contact_name: e.target.value })}
                placeholder="(nome)"
                className="inline-block w-52 px-2 py-0.5 mx-0.5 rounded bg-amber-100/90 font-semibold text-[#141619] placeholder:text-stone-700 border border-amber-400 focus:outline-hidden focus:bg-white focus:border-[#C81E2B]"
              />
              , na qualidade de segundo outorgante
            </p>
            <p>
              é celebrado o presente protocolo de cooperação, o qual se irá reger nos termos e de acordo com as cláusulas seguintes:
            </p>
          </div>

          <div className="space-y-5 text-sm sm:text-[15px] text-justify pt-2">
            <div className="space-y-1.5">
              <h4 className="text-center font-bold">
                Cláusula 1.ª
                <span className="block font-semibold">(Objeto)</span>
              </h4>
              <p>
                O presente Protocolo enquadra-se dentro do programa <strong>“A LIGA EM REDE”</strong> e tem por objeto conceder condições preferenciais na utilização dos bens e serviços do Segundo Outorgante aos associados da Primeira Outorgante, podendo o Segundo Outorgante beneficiar de um aumento de clientes/utilizadores destes bens e serviços através dos associados da Primeira Outorgante.
              </p>
            </div>

            <div className="space-y-1.5">
              <h4 className="text-center font-bold">
                Cláusula 2.ª
                <span className="block font-semibold">(Objeto)</span>
              </h4>
              <p>
                1. A Primeira Outorgante obriga-se a divulgar e promover o protocolo junto dos seus associados através dos meios de comunicação disponíveis e designadamente através da internet.
              </p>
              <p>
                2. O Segundo Outorgante concede os benefícios de acesso aos serviços/bens protocolados, mediante a apresentação de comprovativo em como é associado da Primeira Outorgante.
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="text-center font-bold">
                Cláusula 3.ª
                <span className="block font-semibold">(Condições preferenciais)</span>
              </h4>
              <p>
                O Segundo Outorgante disponibiliza aos associados da Primeira Outorgante as seguintes condições preferenciais:
              </p>
              <textarea
                rows={2}
                aria-label="Condições da oferta (Cláusula 3.ª)"
                value={protocolForm.proposed_benefit}
                onChange={(e) =>
                  setProtocolForm({ ...protocolForm, proposed_benefit: e.target.value })
                }
                placeholder="(condições da oferta)"
                className="w-full p-3.5 rounded-lg bg-amber-100/90 border border-amber-400 font-semibold text-[#141619] placeholder:text-stone-700 focus:outline-hidden focus:bg-white focus:border-[#C81E2B]"
              />
            </div>

            <div className="space-y-1.5">
              <h4 className="text-center font-bold">
                Cláusula 4.ª
                <span className="block font-semibold">(Vigência)</span>
              </h4>
              <p>
                1. O presente protocolo entra em vigor na data da sua assinatura abaixo mencionada e terá a duração de{' '}
                <input
                  type="text"
                  aria-label="Duração do protocolo (Cláusula 4.ª)"
                  value={protocolForm.protocol_duration}
                  onChange={(e) =>
                    setProtocolForm({ ...protocolForm, protocol_duration: e.target.value })
                  }
                  placeholder="um ano"
                  className="inline-block w-36 px-2 py-0.5 rounded bg-amber-100/90 font-bold text-[#141619] placeholder:text-stone-700 border border-amber-400 text-center focus:outline-hidden focus:bg-white focus:border-[#C81E2B]"
                />
                , automaticamente renovável por iguais e sucessivos períodos.
              </p>
              <p>
                2. Qualquer alteração ao presente protocolo apenas será válida se se observar também a forma escrita e ser assinado por ambas as partes.
              </p>
            </div>

            <div className="space-y-1.5">
              <h4 className="text-center font-bold">
                Cláusula 5.ª
                <span className="block font-semibold">(Denúncia)</span>
              </h4>
              <p>
                A denúncia do presente protocolo por qualquer das partes deverá ser efetuada mediante comunicação escrita à outra parte, com uma antecedência de trinta dias seguidos, relativa ao termo da sua vigência.
              </p>
              <p>
                O presente documento é feito em duplicado e assinado pelos outorgantes, destinando-se um exemplar a cada uma das partes.
              </p>
            </div>
          </div>

          <div className="pt-4 text-sm sm:text-[15px]">
            <p className="font-medium">Lisboa, {todayPortuguese}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-6 text-center text-sm">
            <div className="space-y-1">
              <p className="font-bold">Responsável do Primeiro Outorgante</p>
              <div className="pt-8 border-b border-stone-800 max-w-[240px] mx-auto" />
              <p className="pt-1 font-semibold">(Maria Eugénia Saraiva)</p>
              <p className="text-stone-600 text-xs">Presidente da Direção</p>
            </div>

            <div className="space-y-2">
              <p className="font-bold">Responsável do Segundo Outorgante</p>
              <div className="pt-8 border-b border-stone-800 max-w-[240px] mx-auto" />
              <div className="pt-1 flex flex-col items-center gap-1.5">
                <input
                  type="text"
                  aria-label="Assinatura (nome)"
                  value={protocolForm.contact_name}
                  onChange={(e) =>
                    setProtocolForm({ ...protocolForm, contact_name: e.target.value })
                  }
                  placeholder="(nome)"
                  className="w-48 px-2 py-0.5 rounded bg-amber-100/90 font-semibold text-center text-[#141619] placeholder:text-stone-700 border border-amber-400 text-xs focus:outline-hidden focus:bg-white focus:border-[#C81E2B]"
                />
                <input
                  type="text"
                  aria-label="Assinatura (cargo)"
                  value={protocolForm.contact_role}
                  onChange={(e) =>
                    setProtocolForm({ ...protocolForm, contact_role: e.target.value })
                  }
                  placeholder="(cargo)"
                  className="w-48 px-2 py-0.5 rounded bg-amber-100/90 text-center text-stone-700 placeholder:text-stone-600 border border-amber-400 text-xs focus:outline-hidden focus:bg-white focus:border-[#C81E2B]"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Minimal Validation Card */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-stone-200 space-y-5 max-w-md mx-auto">
        {result ? (
          <div className="space-y-6 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto border border-emerald-200">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <div className="space-y-1.5">
              <div className="font-condensed text-xs font-bold uppercase tracking-wider text-emerald-700">
                Desconto Validado {result.validation_method === 'qr' ? '· Via QR Code' : ''}
              </div>
              <h2 className="font-display text-2xl font-bold text-[#141619]">
                {result.discount_highlight}
              </h2>
              <p className="text-sm text-stone-600">
                {result.member_name}{' '}
                <span className="font-mono text-xs text-stone-500 tabular-nums">
                  · {result.member_number}
                </span>
              </p>
              {result.used_count !== undefined && (
                <p className="text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5 inline-block mt-2 tabular-nums">
                  Utilização {result.used_count}
                  {result.max_uses ? ` de ${result.max_uses} possíveis` : ' registada'}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={handleReset}
              className="w-full py-3.5 rounded-lg bg-[#141619] hover:bg-stone-800 text-white font-bold text-sm transition-colors"
            >
              Validar Novo Desconto
            </button>
          </div>
        ) : (
          <>
            {/* Segmented Mode Switch: QR Scanner vs Manual Code */}
            <div className="grid grid-cols-2 gap-1 p-1 bg-stone-100 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setInputMode('qr');
                }}
                className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                  inputMode === 'qr'
                    ? 'bg-white text-[#141619] shadow-sm'
                    : 'text-stone-600 hover:text-[#141619]'
                }`}
              >
                <Camera className="w-3.5 h-3.5 text-[#C81E2B]" />
                <span>Ler Código QR</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setInputMode('manual');
                }}
                className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                  inputMode === 'manual'
                    ? 'bg-white text-[#141619] shadow-sm'
                    : 'text-stone-600 hover:text-[#141619]'
                }`}
              >
                <Keyboard className="w-3.5 h-3.5 text-[#C81E2B]" />
                <span>Código Manual</span>
              </button>
            </div>

            {error && (
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-800">
                <XCircle className="w-4 h-4 text-[#C81E2B] shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {inputMode === 'qr' ? (
              <div className="space-y-4">
                {!cameraError ? (
                  <div className="relative rounded-xl overflow-hidden bg-[#141619] aspect-square border border-stone-200">
                    <video
                      ref={videoRef}
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                    <canvas ref={canvasRef} className="hidden" />

                    {/* Framing Reticle Overlay */}
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-10">
                      <div className="w-full h-full border-2 border-white/80 rounded-2xl shadow-[0_0_0_9999px_rgba(20,22,25,0.45)]" />
                    </div>

                    <div className="absolute bottom-3 inset-x-3 text-center">
                      <span className="inline-block px-3 py-1 rounded-lg bg-[#141619]/80 text-white text-xs font-medium backdrop-blur-xs">
                        {validating
                          ? 'A validar desconto...'
                          : cameraActive
                          ? 'Aponte a câmara para o QR Code do sócio'
                          : 'A iniciar câmara...'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-2 leading-relaxed">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                      <span>{cameraError}</span>
                    </div>
                  </div>
                )}

                <label className="w-full py-2.5 px-4 rounded-lg border border-stone-300 bg-[#FAF8F5] hover:bg-stone-100 text-xs font-bold text-[#141619] flex items-center justify-center gap-2 cursor-pointer transition-colors">
                  <Upload className="w-4 h-4 text-[#C81E2B]" />
                  <span>Carregar fotografia do Código QR</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleQrImageUpload}
                    className="sr-only"
                  />
                </label>
              </div>
            ) : (
              <form onSubmit={handleValidateSubmit} className="space-y-5">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1.5">
                    Referência
                  </label>
                  <input
                    ref={refInputRef}
                    type="text"
                    autoFocus
                    placeholder="LPCS-XXX-000000"
                    value={referenceCode}
                    onChange={(e) => setReferenceCode(e.target.value.toUpperCase())}
                    className="w-full px-4 py-3 rounded-lg border border-stone-300 bg-[#FAF8F5]/50 font-mono text-base font-bold tracking-wider text-[#141619] focus:outline-hidden focus:bg-white focus:border-[#C81E2B] focus:ring-1 focus:ring-[#C81E2B] uppercase tabular-nums"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1.5">
                    Código (6 dígitos)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="000000"
                    maxLength={6}
                    value={sixDigitCode}
                    onChange={(e) => setSixDigitCode(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-4 py-3.5 rounded-lg border border-stone-300 bg-[#FAF8F5]/50 font-mono text-3xl font-bold tracking-[0.25em] text-center text-[#141619] focus:outline-hidden focus:bg-white focus:border-[#C81E2B] focus:ring-1 focus:ring-[#C81E2B] tabular-nums"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={validating}
                  className="w-full py-3.5 rounded-lg bg-[#C81E2B] hover:bg-[#A11622] text-white font-bold text-sm transition-colors"
                >
                  {validating ? 'A validar...' : 'Validar Código'}
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
};
