import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Clock,
  AlertTriangle,
  EyeOff,
  X,
  Copy,
  Check,
  QrCode,
  Tag,
  CheckCircle2,
} from 'lucide-react';
import QRCode from 'qrcode';

interface CodeModalProps {
  redemptionData: {
    redemption_id: number;
    reference_code: string;
    totp_code: string;
    seconds_remaining: number;
    expires_at: string;
    partner_name: string;
    benefit_type: string;
    code_mode?: 'rotativo' | 'codigo_unico';
    discount_highlight: string;
    benefit_value: string;
    secret_code?: string | null;
    used_count?: number;
    prior_uses?: number;
    max_uses?: number | null;
    remaining_uses?: number | null;
    is_limit_reached?: boolean;
    member_number: string;
    member_name: string;
    timestamp: string;
  };
  onClose: () => void;
}

export const CodeModal: React.FC<CodeModalProps> = ({ redemptionData, onClose }) => {
  const isUniqueCodeMode = redemptionData.code_mode === 'codigo_unico';

  const [currentCode, setCurrentCode] = useState(redemptionData.totp_code);
  const [secondsRemaining, setSecondsRemaining] = useState(redemptionData.seconds_remaining);
  const [isWindowBlurred, setIsWindowBlurred] = useState(false);
  const [copied, setCopied] = useState(false);
  const [autoCloseRemaining, setAutoCloseRemaining] = useState(180); // 3 minutes availability
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  // Tick down both the 30s TOTP window and the 3-minute modal countdown
  useEffect(() => {
    const timer = setInterval(() => {
      if (!isUniqueCodeMode) {
        setSecondsRemaining((prev) => (prev <= 1 ? 0 : prev - 1));
      }
      setAutoCloseRemaining((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [isUniqueCodeMode]);

  // Generate rotating QR code synchronized with the current 6-digit TOTP code (only in rotativo mode)
  useEffect(() => {
    if (isUniqueCodeMode) return;
    let active = true;
    const validationUrl = `${window.location.origin}/validar?ref=${encodeURIComponent(
      redemptionData.reference_code
    )}&code=${encodeURIComponent(currentCode)}`;

    QRCode.toDataURL(validationUrl, {
      width: 220,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#141619',
        light: '#FFFFFF',
      },
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch((err) => {
        console.error('QR generation error:', err);
      });

    return () => {
      active = false;
    };
  }, [currentCode, redemptionData.reference_code, isUniqueCodeMode]);

  // Refresh the rotating 6-digit code whenever the 30s window reaches 0 (only in rotativo mode)
  useEffect(() => {
    if (isUniqueCodeMode || secondsRemaining > 0) return;

    let cancelled = false;
    fetch(`/api/benefits/code-refresh/${redemptionData.redemption_id}`, {
      credentials: 'same-origin',
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.totp_code) {
          setCurrentCode(data.totp_code);
          setSecondsRemaining(data.seconds_remaining || 30);
        } else {
          setSecondsRemaining(30);
        }
      })
      .catch((err) => {
        console.error('Error refreshing code:', err);
        if (!cancelled) setSecondsRemaining(30);
      });

    return () => {
      cancelled = true;
    };
  }, [secondsRemaining, redemptionData.redemption_id, isUniqueCodeMode]);

  // Auto-close modal once the 3-minute availability window expires
  useEffect(() => {
    if (autoCloseRemaining <= 0) {
      onClose();
    }
  }, [autoCloseRemaining, onClose]);

  // Anti-screenshot detection: blur on window blur or tab switch
  useEffect(() => {
    const handleBlur = () => setIsWindowBlurred(true);
    const handleFocus = () => setIsWindowBlurred(false);
    const handleVisibility = () => {
      setIsWindowBlurred(document.hidden);
    };

    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const benefitLabel =
    redemptionData.benefit_type === 'cupao'
      ? 'Cupão Promocional'
      : redemptionData.benefit_type === 'voucher'
      ? 'Voucher Nominal'
      : 'Código de Desconto';

  const usedCount = redemptionData.used_count ?? 1;
  const maxUses = redemptionData.max_uses ?? null;
  const remainingUses = redemptionData.remaining_uses ?? null;
  const watermarkText = `${redemptionData.member_number} · ${new Date().toLocaleTimeString('pt-PT')}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#141619]/80 backdrop-blur-sm select-none"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="relative w-full max-w-xl max-h-[92vh] flex flex-col bg-white rounded-2xl border border-stone-200 shadow-2xl overflow-hidden">
        {/* Top Header */}
        <div className="px-6 py-4 bg-[#141619] text-white flex items-center justify-between border-b border-stone-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#C81E2B] flex items-center justify-center text-white">
              {isUniqueCodeMode ? <Tag className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="text-sm font-semibold tracking-tight">
                {isUniqueCodeMode
                  ? 'Código Único para Associados LPCS'
                  : 'Código Seguro de Utilização'}
              </h3>
              <p className="text-xs text-stone-400">
                {isUniqueCodeMode
                  ? 'Código promocional direto para todos os associados'
                  : 'QR Code e código rotativo de uso único'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Window Blurred Privacy Overlay */}
        {isWindowBlurred && (
          <div className="absolute inset-0 z-30 bg-[#141619]/95 flex flex-col items-center justify-center text-center p-6 text-white backdrop-blur-md">
            <EyeOff className="w-10 h-10 text-[#C81E2B] mb-3" />
            <h4 className="text-lg font-display font-semibold">Conteúdo Oculto por Segurança</h4>
            <p className="text-xs text-stone-300 max-w-xs mt-1.5 leading-relaxed">
              O código foi temporariamente ocultado porque a janela perdeu o foco. Clique na janela para voltar a visualizar.
            </p>
          </div>
        )}

        {/* Modal Body */}
        <div className="relative p-5 sm:p-7 bg-[#FAF8F5] overflow-y-auto overflow-x-hidden space-y-4">
          {/* Dynamic Repeating Watermark */}
          <div className="absolute inset-0 opacity-[0.035] pointer-events-none flex flex-wrap gap-8 p-4 font-mono text-xs rotate-[-15deg] select-none text-[#141619]">
            {Array.from({ length: 24 }).map((_, i) => (
              <span key={i}>{watermarkText}</span>
            ))}
          </div>

          {/* Partner & Benefit Info */}
          <div className="relative text-center space-y-1">
            <div className="text-xs font-medium text-stone-500">
              {benefitLabel} · {redemptionData.benefit_value}
            </div>
            <h2 className="font-display text-2xl font-bold text-[#141619] tracking-tight">
              {redemptionData.partner_name}
            </h2>
            <p className="text-sm font-semibold text-[#C81E2B]">{redemptionData.discount_highlight}</p>
          </div>

          {/* Usage Counter Banner */}
          <div
            className={`relative px-4 py-3 rounded-xl border flex items-center justify-between gap-3 text-xs ${
              maxUses && usedCount >= maxUses
                ? 'bg-amber-50 border-amber-300 text-amber-950'
                : 'bg-emerald-50/90 border-emerald-200 text-emerald-950'
            }`}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2
                className={`w-4 h-4 shrink-0 ${
                  maxUses && usedCount >= maxUses ? 'text-amber-700' : 'text-emerald-700'
                }`}
              />
              <div>
                <strong className="font-bold">
                  {maxUses
                    ? `Utilização ${usedCount} de ${maxUses} possíveis`
                    : `Utilizado ${usedCount} ${usedCount === 1 ? 'vez' : 'vezes'}`}
                </strong>
                <span className="block text-[11px] opacity-85">
                  {maxUses
                    ? remainingUses && remainingUses > 0
                      ? `Já utilizou este desconto ${usedCount} ${
                          usedCount === 1 ? 'vez' : 'vezes'
                        } · Restam ${remainingUses} ${
                          remainingUses === 1 ? 'utilização' : 'utilizações'
                        }`
                      : `Atingiu a última utilização disponível (${usedCount}/${maxUses}). Próximas tentativas ficarão bloqueadas.`
                    : 'Desconto de utilização contínua para associados com quota ativa'}
                </span>
              </div>
            </div>
            {maxUses && (
              <span className="font-mono font-bold text-sm tabular-nums shrink-0 px-2.5 py-1 rounded-lg bg-white border border-stone-200 text-[#141619]">
                {usedCount} / {maxUses}
              </span>
            )}
          </div>

          {isUniqueCodeMode ? (
            /* OPTION 3: Direct Unique Partner Code for all Associates */
            <div className="relative bg-white rounded-xl p-6 sm:p-8 border border-stone-200 text-center space-y-4">
              <div className="text-xs font-bold uppercase tracking-[0.14em] text-stone-500">
                Código Único do Parceiro
              </div>

              <div className="py-4 px-6 rounded-xl bg-[#FAF8F5] border-2 border-dashed border-[#C81E2B]/40 inline-block mx-auto">
                <div className="font-mono text-3xl sm:text-4xl font-bold tracking-[0.16em] text-[#141619] tabular-nums">
                  {redemptionData.secret_code || 'LPCS2026'}
                </div>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => handleCopy(redemptionData.secret_code || 'LPCS2026')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#C81E2B] hover:bg-[#A11622] text-white text-xs font-bold transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Código Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copiar Código ({redemptionData.secret_code || 'LPCS2026'})</span>
                    </>
                  )}
                </button>
              </div>

              <p className="text-xs text-stone-600 max-w-md mx-auto leading-relaxed pt-2 border-t border-stone-100">
                Este parceiro disponibiliza um <strong>código único para todos os associados LPCS</strong>. Basta apresentar ou inserir o código acima diretamente no parceiro, juntamente com o seu nº de sócio (<strong className="font-mono">{redemptionData.member_number}</strong>).
              </p>
            </div>
          ) : (
            /* OPTIONS 1 & 2: Parallel Rotating QR Code + 6-Digit Code Display */
            <>
              <div className="relative bg-white rounded-xl p-5 sm:p-6 border border-stone-200 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
                  {/* Rotating QR Code */}
                  <div className="flex flex-col items-center text-center sm:border-r sm:border-stone-100 sm:pr-6">
                    <div className="text-xs font-medium text-stone-500 mb-2 flex items-center gap-1.5">
                      <QrCode className="w-3.5 h-3.5 text-[#C81E2B]" />
                      <span>Código QR (leitura direta)</span>
                    </div>
                    <div className="w-40 h-40 rounded-xl border border-stone-200 bg-white p-2 flex items-center justify-center">
                      {qrDataUrl ? (
                        <img
                          src={qrDataUrl}
                          alt={`Código QR dinâmico para validar ${redemptionData.reference_code}`}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-stone-50 rounded-lg text-xs text-stone-400">
                          A gerar QR...
                        </div>
                      )}
                    </div>
                    <p className="text-[11px] text-stone-500 mt-2">
                      Sem necessidade de digitar códigos
                    </p>
                  </div>

                  {/* Rotating 6-Digit Code */}
                  <div className="text-center flex flex-col items-center justify-center">
                    <div className="text-xs font-medium text-stone-500 mb-1">
                      Código rotativo (6 dígitos)
                    </div>

                    <div className="text-4xl font-mono font-bold tracking-[0.18em] text-[#141619] my-3 tabular-nums">
                      {currentCode.slice(0, 3)} {currentCode.slice(3)}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCopy(currentCode)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 hover:border-stone-300 text-xs text-stone-700 hover:text-[#141619] font-semibold transition-colors"
                    >
                      {copied ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copied ? 'Copiado' : 'Copiar código'}</span>
                    </button>
                  </div>
                </div>

                {/* Shared 30s Synchronization Bar */}
                <div className="pt-2 border-t border-stone-100">
                  <div className="w-full bg-stone-100 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-[#C81E2B] h-full transition-all duration-1000 ease-linear"
                      style={{ width: `${(secondsRemaining / 30) * 100}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs text-stone-600 mt-2.5 font-medium">
                    <span className="flex items-center gap-1.5 tabular-nums">
                      <Clock className="w-3.5 h-3.5 text-[#C81E2B]" />
                      <span>
                        QR e código atualizam em{' '}
                        <strong className="text-[#141619] font-mono">{secondsRemaining}s</strong>
                      </span>
                    </span>
                    <span className="text-[11px] text-stone-400">Rotação 30s</span>
                  </div>
                </div>
              </div>

              {/* Reference for Merchant */}
              <div className="relative px-4 py-3.5 bg-white rounded-xl border border-stone-200 flex items-center justify-between gap-4">
                <div>
                  <span className="text-xs text-stone-500 block">Referência para validação</span>
                  <span className="text-sm font-mono font-bold text-[#141619] tracking-wide tabular-nums">
                    {redemptionData.reference_code}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-stone-500 block">Sócio Titular</span>
                  <span className="text-xs font-mono font-semibold text-stone-800 tabular-nums">
                    {redemptionData.member_number}
                  </span>
                </div>
              </div>

              {/* 3-Minute Availability Notice */}
              <div className="relative flex items-start gap-2.5 text-xs text-amber-900 bg-amber-50/90 p-3.5 rounded-xl border border-amber-200/80 leading-relaxed">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <p>
                  Mostre o Código QR ao parceiro para leitura direta ou faculte a referência e os 6 dígitos. A proteção fica disponível durante 3 minutos e esta janela fecha automaticamente em{' '}
                  <strong className="font-mono tabular-nums">
                    {Math.floor(autoCloseRemaining / 60)}m{' '}
                    {(autoCloseRemaining % 60).toString().padStart(2, '0')}s
                  </strong>
                  .
                </p>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-white border-t border-stone-200 flex items-center justify-between shrink-0">
          <div className="text-xs text-stone-500 font-mono tabular-nums">
            {isUniqueCodeMode
              ? `Associado: ${redemptionData.member_number}`
              : `Resgate válido até ${new Date(redemptionData.expires_at).toLocaleTimeString('pt-PT')}`}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-[#141619] hover:bg-stone-800 text-white text-xs font-semibold transition-colors"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
};
