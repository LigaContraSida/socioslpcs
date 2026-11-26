import React, { useState, useEffect } from 'react';
import {
  X,
  CreditCard,
  Smartphone,
  Building,
  CheckCircle2,
  Clock,
  Copy,
  Check,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  FileText,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface QuotaPaymentModalProps {
  open: boolean;
  quotaData: {
    quota_id: number;
    status: string;
    plan_type: 'semestral' | 'anual';
    amount_cents: number;
    payment_method: string;
    reference: string;
    payment_details?: any;
    valid_until_expected?: string;
  } | null;
  onClose: () => void;
  onSuccess: (updatedQuota: any) => void;
}

export const QuotaPaymentModal: React.FC<QuotaPaymentModalProps> = ({
  open,
  quotaData,
  onClose,
  onSuccess,
}) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [successInfo, setSuccessInfo] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number>(300); // 5 min para MB WAY

  useEffect(() => {
    if (!open) {
      setPaymentSuccess(false);
      setSuccessInfo(null);
      setErrorMessage(null);
      setProcessing(false);
    } else {
      setCountdown(300);
    }
  }, [open]);

  useEffect(() => {
    if (open && quotaData?.payment_method === 'mbway' && !paymentSuccess) {
      const timer = setInterval(() => {
        setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [open, quotaData, paymentSuccess]);

  if (!open || !quotaData) return null;

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleConfirmSimulation = async () => {
    setProcessing(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/quotas/${quotaData.quota_id}/confirm-simulation`, {
        method: 'POST',
        credentials: 'same-origin',
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || 'Falha ao confirmar o pagamento.');
        setProcessing(false);
        return;
      }

      setProcessing(false);
      setPaymentSuccess(true);
      setSuccessInfo(data);
      onSuccess(data.quota);

      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch (err) {
      console.error('Confirmation simulation error:', err);
      setErrorMessage('Erro de comunicação ao processar confirmação bancária.');
      setProcessing(false);
    }
  };

  const details = quotaData.payment_details || {};
  const amountEuros = (quotaData.amount_cents / 100).toFixed(2).replace('.', ',') + ' €';
  const planLabel = quotaData.plan_type === 'semestral' ? 'Semestral (6 Meses)' : 'Anual (12 Meses)';

  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remaining = secs % 60;
    return `${mins}:${remaining < 10 ? '0' : ''}${remaining}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div
        className="bg-white rounded-2xl max-w-lg w-full overflow-hidden border border-stone-200 shadow-2xl animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-200 bg-[#FAF8F5] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#C81E2B] text-white flex items-center justify-center font-bold text-xs">
              LPCS
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-[#141619]">
                Plataforma de Pagamento de Quotas
              </h3>
              <p className="text-[11px] text-stone-500">
                Liga Portuguesa Contra a SIDA · NIPC 502 665 548
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-[#141619] hover:bg-stone-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {paymentSuccess ? (
            /* Sucesso de Pagamento */
            <div className="text-center py-4 space-y-4">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h4 className="font-display text-xl font-bold text-[#141619]">
                  Pagamento Confirmado e Processado!
                </h4>
                <p className="text-sm text-stone-600 mt-1">
                  Os seus benefícios e descontos de associado da LPCS foram renovados com sucesso.
                </p>
              </div>

              <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 text-left text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-stone-500">Plano de Quota:</span>
                  <span className="font-bold text-[#141619]">{planLabel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Valor Liquidado:</span>
                  <span className="font-mono font-bold text-[#141619]">{amountEuros}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Nova Validade da Quota:</span>
                  <span className="font-mono font-bold text-emerald-700">
                    {successInfo?.valid_until || quotaData.valid_until_expected}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-stone-200/80">
                  <span className="text-stone-500">Recibo Oficial:</span>
                  <span className="font-bold text-[#C81E2B] flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5" />
                    <span>Emitido no arquivo digital</span>
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 rounded-lg bg-[#C81E2B] hover:bg-[#A11622] text-white font-bold text-sm transition-colors"
              >
                Continuar para a Área Pessoal
              </button>
            </div>
          ) : (
            /* Informações do Pagamento Pendente */
            <>
              {/* Aviso de renovação condicionada */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-semibold">Renovação condicionada ao pagamento:</strong>
                  <span>
                    Os benefícios de associado (códigos de desconto e parcerias) apenas serão ativados após o pagamento ser efetivamente processado pelo gateway ou validado pela administração.
                  </span>
                </div>
              </div>

              {/* Resumo do Pedido */}
              <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 flex items-center justify-between text-xs">
                <div>
                  <span className="text-stone-500 block">Quota Selecionada</span>
                  <strong className="font-display text-sm font-bold text-[#141619]">
                    {planLabel}
                  </strong>
                </div>
                <div className="text-right">
                  <span className="text-stone-500 block">Montante a Pagar</span>
                  <strong className="font-mono text-base font-bold text-[#141619]">
                    {amountEuros}
                  </strong>
                </div>
              </div>

              {/* DETALHES POR MÉTODO */}
              {quotaData.payment_method === 'multibanco' && (
                <div className="space-y-3">
                  <div className="bg-[#FAF8F5] border-2 border-stone-300 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-stone-200 pb-2">
                      <span className="font-bold text-xs text-stone-700 flex items-center gap-1.5">
                        <CreditCard className="w-4 h-4 text-[#C81E2B]" />
                        <span>Referência de Pagamento Multibanco</span>
                      </span>
                      <span className="text-[10px] text-stone-400 font-mono">Válido 48h</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-stone-500 text-[11px] block">Entidade:</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <strong className="font-mono text-sm tracking-wider text-[#141619]">
                            {details.entity || '21876'}
                          </strong>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(details.entity || '21876', 'entity')}
                            className="text-stone-400 hover:text-stone-700"
                            title="Copiar Entidade"
                          >
                            {copiedField === 'entity' ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div>
                        <span className="text-stone-500 text-[11px] block">Montante:</span>
                        <strong className="font-mono text-sm text-[#141619] block mt-0.5">
                          {amountEuros}
                        </strong>
                      </div>
                    </div>

                    <div>
                      <span className="text-stone-500 text-[11px] block">Referência:</span>
                      <div className="flex items-center justify-between bg-white border border-stone-300 p-2 rounded-lg mt-1">
                        <strong className="font-mono text-base tracking-widest text-[#141619]">
                          {details.reference || quotaData.reference.replace(/.*Ref:\s*/, '')}
                        </strong>
                        <button
                          type="button"
                          onClick={() =>
                            copyToClipboard(
                              details.reference || quotaData.reference.replace(/.*Ref:\s*/, ''),
                              'ref'
                            )
                          }
                          className="px-2.5 py-1 rounded bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold flex items-center gap-1 transition-colors"
                        >
                          {copiedField === 'ref' ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span className="text-emerald-700">Copiado</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copiar</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-stone-500 leading-relaxed">
                    Dirija-se a qualquer terminal Multibanco ou aceda ao seu Homebanking na opção <strong>"Pagamento de Compras / Serviços"</strong>.
                  </p>
                </div>
              )}

              {quotaData.payment_method === 'mbway' && (
                <div className="space-y-3">
                  <div className="bg-[#FAF8F5] border border-stone-200 rounded-xl p-4 text-center space-y-3">
                    <div className="w-10 h-10 bg-[#C81E2B]/10 text-[#C81E2B] rounded-full flex items-center justify-center mx-auto">
                      <Smartphone className="w-5 h-5" />
                    </div>

                    <div>
                      <strong className="text-sm text-[#141619] block">
                        Notificação enviada para {details.phone || 'o telemóvel'}
                      </strong>
                      <p className="text-xs text-stone-500 mt-1">
                        Abra a aplicação MB WAY no seu telemóvel e confirme a transação de{' '}
                        <strong className="text-[#141619]">{amountEuros}</strong>.
                      </p>
                    </div>

                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-stone-200 text-xs font-mono text-stone-700">
                      <Clock className="w-3.5 h-3.5 text-stone-400" />
                      <span>Tempo restante: {formatTimer(countdown)}</span>
                    </div>
                  </div>
                </div>
              )}

              {quotaData.payment_method === 'card' && (
                <div className="space-y-3">
                  <div className="bg-[#FAF8F5] border border-stone-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-stone-200 pb-2">
                      <span className="font-bold text-xs text-stone-700 flex items-center gap-1.5">
                        <CreditCard className="w-4 h-4 text-[#C81E2B]" />
                        <span>Pagamento Seguro com Cartão</span>
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-semibold">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>3D Secure Ativo</span>
                      </span>
                    </div>

                    <div className="text-xs text-stone-600 space-y-1">
                      <div className="flex justify-between">
                        <span>Gateway Oficial:</span>
                        <strong className="text-[#141619]">Stripe / Reduniq Multibanco</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Referência de Sessão:</span>
                        <span className="font-mono text-stone-500">{quotaData.reference}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {quotaData.payment_method === 'transferencia' && (
                <div className="space-y-3">
                  <div className="bg-[#FAF8F5] border border-stone-200 rounded-xl p-4 space-y-3 text-xs">
                    <div className="flex items-center justify-between border-b border-stone-200 pb-2">
                      <span className="font-bold text-stone-700 flex items-center gap-1.5">
                        <Building className="w-4 h-4 text-[#C81E2B]" />
                        <span>Dados de Transferência Bancária</span>
                      </span>
                    </div>

                    <div>
                      <span className="text-stone-500 block text-[11px]">Beneficiário:</span>
                      <strong className="text-[#141619] block mt-0.5">
                        Liga Portuguesa Contra a SIDA (LPCS)
                      </strong>
                    </div>

                    <div>
                      <span className="text-stone-500 block text-[11px]">IBAN:</span>
                      <div className="flex items-center justify-between bg-white border border-stone-300 p-2 rounded-lg mt-1">
                        <strong className="font-mono text-xs text-[#141619]">
                          PT50 0033 0000 4567 8901 2345 6
                        </strong>
                        <button
                          type="button"
                          onClick={() =>
                            copyToClipboard('PT50003300004567890123456', 'iban')
                          }
                          className="text-stone-400 hover:text-stone-700 p-1"
                          title="Copiar IBAN"
                        >
                          {copiedField === 'iban' ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div>
                      <span className="text-stone-500 block text-[11px]">
                        Descritivo a colocar na transferência:
                      </span>
                      <span className="font-mono font-bold text-[#C81E2B] block mt-0.5">
                        {quotaData.reference}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {errorMessage && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                  {errorMessage}
                </div>
              )}

              {/* Botão de Simulação / Confirmação pelo Gateway Bancário */}
              <div className="pt-2 space-y-2">
                <button
                  type="button"
                  onClick={handleConfirmSimulation}
                  disabled={processing}
                  className="w-full py-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 shadow-xs"
                >
                  {processing ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>A verificar e processar transação no gateway...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>
                        Simular Confirmação Bancária do Pagamento ({amountEuros})
                      </span>
                    </>
                  )}
                </button>

                <p className="text-[11px] text-stone-400 text-center">
                  Também pode ser validado pela administração na área de gestão LPCS.
                </p>

                <div className="flex items-center justify-center pt-1">
                  <button
                    type="button"
                    onClick={onClose}
                    className="text-xs text-stone-500 hover:text-[#141619] underline"
                  >
                    Guardar dados e pagar mais tarde
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
