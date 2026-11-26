import React, { useState, useEffect } from 'react';
import { User, Quota } from '../types.ts';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  CreditCard,
  Tag,
  AlertCircle,
  ChevronRight,
  Clock,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { LpcsLogo } from '../components/LpcsLogo.tsx';
import { QuotaPaymentModal } from '../components/QuotaPaymentModal.tsx';

interface DashboardPageProps {
  user: User;
  onNavigate: (path: string) => void;
  onRefreshUser: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  user,
  onNavigate,
  onRefreshUser,
}) => {
  const [quotas, setQuotas] = useState<Quota[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const [selectedPlan, setSelectedPlan] = useState<'semestral' | 'anual'>('anual');
  const [paymentMethod, setPaymentMethod] = useState<'mbway' | 'multibanco' | 'card'>('mbway');
  const [phoneMbway, setPhoneMbway] = useState(user.phone || '');
  const [paying, setPaying] = useState(false);
  const [paySuccessMessage, setPaySuccessMessage] = useState<string | null>(null);
  const [payErrorMessage, setPayErrorMessage] = useState<string | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedQuotaForPayment, setSelectedQuotaForPayment] = useState<any | null>(null);

  useEffect(() => {
    fetch('/api/quotas/history', { credentials: 'same-origin' })
      .then((res) => res.json())
      .then((data) => {
        setQuotas(data.quotas || []);
        setLoadingHistory(false);
      })
      .catch((err) => {
        console.error('Failed to load quota history:', err);
        setLoadingHistory(false);
      });
  }, []);

  const loadQuotaHistory = () => {
    fetch('/api/quotas/history', { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((d) => setQuotas(d.quotas || []));
  };

  const handlePayQuota = async (e: React.FormEvent) => {
    e.preventDefault();
    setPaying(true);
    setPaySuccessMessage(null);
    setPayErrorMessage(null);

    try {
      const res = await fetch('/api/quotas/pay', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_type: selectedPlan,
          payment_method: paymentMethod,
          phone_mbway: paymentMethod === 'mbway' ? phoneMbway : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setPayErrorMessage(data.error || 'Erro no processamento do pagamento.');
        setPaying(false);
        return;
      }

      setPaying(false);
      // Abre a plataforma de pagamento com os dados gerados
      setSelectedQuotaForPayment({
        quota_id: data.quota_id,
        status: data.status,
        plan_type: selectedPlan,
        amount_cents: data.amount_cents,
        payment_method: paymentMethod,
        reference: data.reference,
        payment_details: data.payment_details,
        valid_until_expected: data.valid_until_expected,
      });
      setPaymentModalOpen(true);
      loadQuotaHistory();
    } catch (err) {
      console.error('Pay error:', err);
      setPayErrorMessage('Falha de rede ao processar o pagamento.');
      setPaying(false);
    }
  };

  const status = user.quota_status;
  const isProfileIncomplete = !user.nif || !user.birth_date || !user.address;

  const statusMeta =
    status.status === 'valida'
      ? {
          icon: CheckCircle2,
          label: 'Quota Válida',
          textTone: 'text-emerald-700',
          barTone: 'bg-emerald-600',
          borderTone: 'border-emerald-200',
          headline: `${status.days_remaining} dias restantes de acesso`,
        }
      : status.status === 'expirar'
      ? {
          icon: AlertTriangle,
          label: 'A Expirar (≤ 30 dias)',
          textTone: 'text-amber-700',
          barTone: 'bg-amber-500',
          borderTone: 'border-amber-200',
          headline: `Apenas ${status.days_remaining} dias restantes`,
        }
      : status.status === 'expirada'
      ? {
          icon: XCircle,
          label: 'Quota Expirada',
          textTone: 'text-[#C81E2B]',
          barTone: 'bg-[#C81E2B]',
          borderTone: 'border-red-200',
          headline: `Expirada há ${status.days_expired} dias`,
        }
      : {
          icon: AlertCircle,
          label: 'Sem Quota Ativa',
          textTone: 'text-stone-600',
          barTone: 'bg-stone-400',
          borderTone: 'border-stone-200',
          headline: 'Ainda não ativou a sua quota de sócio',
        };

  const StatusIcon = statusMeta.icon;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Greeting & Member Card */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-stone-200 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <div className="font-condensed text-xs font-bold uppercase tracking-[0.16em] text-[#C81E2B]">
            Liga em Rede · Área Pessoal do Associado
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#141619] tracking-tight">
            Olá, {user.name}
          </h1>
          <p className="text-xs sm:text-sm font-light text-stone-500">
            {user.email} <span aria-hidden="true" className="mx-1.5 text-stone-300">·</span> Liga Portuguesa Contra a SIDA (NIPC 502 665 548)
          </p>
        </div>

        <div className="bg-[#141619] text-white px-5 py-4 rounded-xl flex items-center gap-5 shrink-0 border border-stone-800">
          <LpcsLogo variant="light" className="h-12 w-auto shrink-0 rounded-md bg-white" />
          <div className="border-l border-stone-700 pl-4">
            <div className="font-condensed text-[11px] uppercase tracking-wider text-stone-400 font-bold">
              Cartão de Sócio
            </div>
            <div className="text-lg font-bold tracking-wider text-white tabular-nums">
              {user.member_number}
            </div>
          </div>
        </div>
      </div>

      {/* Incomplete Profile Alert */}
      {isProfileIncomplete && (
        <div className="p-4 sm:p-5 bg-amber-50 border border-amber-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs sm:text-sm text-amber-950">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <strong className="block font-semibold">Perfil Incompleto</strong>
              <span>
                Preencha os seus dados fiscais (NIF, morada e telemóvel) para emissão correta dos recibos.
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('/perfil')}
            className="px-4 py-2 rounded-lg bg-amber-700 hover:bg-amber-800 text-white font-semibold text-xs shrink-0 transition-colors"
          >
            Completar Perfil
          </button>
        </div>
      )}

      {/* Quota Validity Panel */}
      <div className={`bg-white rounded-2xl p-6 sm:p-8 border ${statusMeta.borderTone}`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="space-y-4 max-w-2xl">
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className={`inline-flex items-center gap-1.5 font-semibold ${statusMeta.textTone}`}>
                <StatusIcon className="w-4 h-4" />
                <span>{statusMeta.label}</span>
              </span>
              <span aria-hidden="true" className="text-stone-300">·</span>
              <span className="text-stone-600 tabular-nums">
                {status.valid_until
                  ? `Válida até ${new Date(status.valid_until).toLocaleDateString('pt-PT')}`
                  : 'Ative hoje para aceder aos descontos'}
              </span>
            </div>

            <div>
              <h2 className="font-display text-2xl sm:text-3xl font-semibold text-[#141619] tracking-tight tabular-nums">
                {statusMeta.headline}
              </h2>
              <p className="text-sm text-stone-600 mt-1.5 leading-relaxed">
                {status.has_active_quota
                  ? 'Tem acesso completo a todos os códigos, cupões e vouchers em 28 parceiros certificados de norte a sul do país.'
                  : 'Os descontos encontram-se bloqueados até à regularização da quota anual de 35,00 € ou semestral de 17,50 €.'}
              </p>
            </div>

            {status.has_active_quota && (
              <div className="space-y-2 pt-1">
                <div className="w-full bg-stone-100 h-2.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${statusMeta.barTone}`}
                    style={{ width: `${status.progress_percentage}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-stone-500 tabular-nums">
                  <span>Progresso do ciclo</span>
                  <span className="font-mono font-medium text-stone-700">
                    Validade: {status.valid_until}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="shrink-0 flex flex-col gap-3 min-w-[240px]">
            {status.has_active_quota && (
              <button
                type="button"
                onClick={() => onNavigate('/parceiros')}
                className="px-5 py-3 rounded-lg bg-[#141619] hover:bg-stone-800 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
              >
                <Tag className="w-4 h-4 text-[#C81E2B]" />
                <span>Usufruir dos Descontos</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                const el = document.getElementById('payment-section');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="px-5 py-3 rounded-lg bg-[#C81E2B] hover:bg-[#A11622] text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
            >
              <CreditCard className="w-4 h-4" />
              <span>{status.has_active_quota ? 'Acumular Renovação' : 'Pagar Quota Agora'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Quota Renewal Form */}
      <div id="payment-section" className="bg-white rounded-2xl p-6 sm:p-8 border border-stone-200 space-y-6">
        <div className="border-b border-stone-100 pb-5">
          <div className="font-condensed text-xs font-bold uppercase tracking-[0.16em] text-[#C81E2B]">
            Pagamento de Quotas
          </div>
          <h2 className="font-display text-2xl font-bold text-[#141619] tracking-tight mt-1">
            Renove ou Acumule a sua Quota
          </h2>
          <p className="text-sm font-light text-stone-600 mt-1">
            Se já possui quota ativa, o novo período acumula automaticamente sobre a data de validade existente.
          </p>
        </div>

        {paySuccessMessage && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3 text-sm text-emerald-900">
            <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <strong className="block font-semibold">Pagamento Efetuado</strong>
              <span>{paySuccessMessage}</span>
            </div>
          </div>
        )}

        {payErrorMessage && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-sm text-red-800">
            <XCircle className="w-5 h-5 text-[#C81E2B] shrink-0 mt-0.5" />
            <span>{payErrorMessage}</span>
          </div>
        )}

        <form onSubmit={handlePayQuota} className="space-y-6">
          {/* Plan Selector */}
          <div>
            <label className="text-xs font-semibold text-stone-700 block mb-2.5">
              Escolha o plano de quota
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label
                onClick={() => setSelectedPlan('semestral')}
                className={`p-4 rounded-xl border cursor-pointer flex items-center justify-between transition-colors ${
                  selectedPlan === 'semestral'
                    ? 'border-[#C81E2B] bg-red-50/40'
                    : 'border-stone-200 hover:border-stone-400 bg-[#FAF8F5]/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="plan"
                    checked={selectedPlan === 'semestral'}
                    onChange={() => setSelectedPlan('semestral')}
                    className="accent-[#C81E2B]"
                  />
                  <div>
                    <span className="font-semibold text-sm text-[#141619] block">
                      Semestral (6 Meses)
                    </span>
                    <span className="text-xs text-stone-500">Renovação semestral flexível</span>
                  </div>
                </div>
                <span className="font-mono font-bold text-lg text-[#141619] tabular-nums">
                  17,50 €
                </span>
              </label>

              <label
                onClick={() => setSelectedPlan('anual')}
                className={`p-4 rounded-xl border cursor-pointer flex items-center justify-between transition-colors ${
                  selectedPlan === 'anual'
                    ? 'border-[#C81E2B] bg-red-50/40'
                    : 'border-stone-200 hover:border-stone-400 bg-[#FAF8F5]/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="plan"
                    checked={selectedPlan === 'anual'}
                    onChange={() => setSelectedPlan('anual')}
                    className="accent-[#C81E2B]"
                  />
                  <div>
                    <span className="font-semibold text-sm text-[#141619] block">
                      Anual (12 Meses) · Recomendado
                    </span>
                    <span className="text-xs text-stone-500 tabular-nums">2,92 € / mês</span>
                  </div>
                </div>
                <span className="font-mono font-bold text-lg text-[#141619] tabular-nums">
                  35,00 €
                </span>
              </label>
            </div>
          </div>

          {/* Payment Method */}
          <div>
            <label className="text-xs font-semibold text-stone-700 block mb-2.5">
              Método de pagamento
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { id: 'mbway', name: 'MB WAY', desc: 'Notificação instantânea' },
                { id: 'multibanco', name: 'Multibanco', desc: 'Entidade e Referência' },
                { id: 'card', name: 'Cartão de Crédito', desc: 'Visa / Mastercard' },
              ].map((m) => (
                <button
                  type="button"
                  key={m.id}
                  onClick={() => setPaymentMethod(m.id as any)}
                  className={`p-3.5 rounded-xl border text-left transition-colors ${
                    paymentMethod === m.id
                      ? 'border-[#141619] bg-[#FAF8F5] text-[#141619]'
                      : 'border-stone-200 hover:border-stone-400 text-stone-700'
                  }`}
                >
                  <span className="font-semibold text-xs block">{m.name}</span>
                  <span className="text-xs text-stone-500">{m.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {paymentMethod === 'mbway' && (
            <div className="max-w-xs">
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                Número de Telemóvel MB WAY
              </label>
              <input
                type="text"
                value={phoneMbway}
                onChange={(e) => setPhoneMbway(e.target.value)}
                placeholder="912345678"
                className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 font-mono text-sm tabular-nums focus:outline-hidden focus:border-[#C81E2B]"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={paying}
            className="px-7 py-3 rounded-lg bg-[#C81E2B] hover:bg-[#A11622] text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 tabular-nums"
          >
            {paying ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>A processar quota...</span>
              </>
            ) : (
              <>
                <CreditCard className="w-4 h-4" />
                <span>
                  Confirmar Pagamento de {selectedPlan === 'semestral' ? '17,50 €' : '35,00 €'}
                </span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Recent Payments Table */}
      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-stone-200 flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold text-[#141619]">
            Histórico de Quotas Recentes
          </h3>
          <button
            type="button"
            onClick={() => onNavigate('/pagamentos')}
            className="text-xs font-semibold text-[#C81E2B] hover:text-[#A11622] flex items-center gap-1"
          >
            <span>Ver todos e recibos</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {loadingHistory ? (
          <p className="text-xs text-stone-500 p-6">A carregar registos...</p>
        ) : quotas.length === 0 ? (
          <p className="text-sm text-stone-500 p-6">Ainda não efetuou pagamentos de quota.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-stone-600">
              <thead className="font-condensed bg-[#FAF8F5] text-[11px] uppercase font-bold tracking-wider text-stone-500 border-b border-stone-200">
                <tr>
                  <th className="py-3 px-6">Data</th>
                  <th className="py-3 px-4">Plano</th>
                  <th className="py-3 px-4">Valor</th>
                  <th className="py-3 px-4">Método</th>
                  <th className="py-3 px-4">Validade Acumulada</th>
                  <th className="py-3 px-6 text-right">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {quotas.slice(0, 4).map((q) => (
                  <tr key={q.id} className="hover:bg-stone-50/70">
                    <td className="py-3.5 px-6 tabular-nums">
                      {new Date(q.created_at).toLocaleDateString('pt-PT')}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-[#141619] capitalize">
                      {q.plan_type}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-semibold text-[#141619] tabular-nums">
                      {(q.amount_cents / 100).toFixed(2)} €
                    </td>
                    <td className="py-3.5 px-4 uppercase text-stone-500">{q.payment_method}</td>
                    <td className="py-3.5 px-4 font-mono text-stone-700 tabular-nums">
                      {q.valid_until}
                    </td>
                    <td className="py-3.5 px-6 text-right whitespace-nowrap">
                      {q.status === 'pendente' ? (
                        <div className="inline-flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px] uppercase">
                            <Clock className="w-3 h-3 text-amber-600 animate-pulse" />
                            <span>Pendente</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedQuotaForPayment({
                                quota_id: q.id,
                                status: q.status,
                                plan_type: q.plan_type,
                                amount_cents: q.amount_cents,
                                payment_method: q.payment_method,
                                reference: q.reference,
                                payment_details: q.payment_details,
                                valid_until_expected: q.valid_until,
                              });
                              setPaymentModalOpen(true);
                            }}
                            className="px-2.5 py-1 rounded-md bg-[#C81E2B] hover:bg-[#A11622] text-white text-[11px] font-bold transition-colors shadow-xs"
                          >
                            Pagar
                          </button>
                        </div>
                      ) : q.status === 'pago' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] uppercase">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Pago</span>
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full bg-stone-100 text-stone-600 font-bold text-[10px] uppercase">
                          {q.status}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Plataforma de Pagamento de Quotas Modal */}
      <QuotaPaymentModal
        open={paymentModalOpen}
        quotaData={selectedQuotaForPayment}
        onClose={() => setPaymentModalOpen(false)}
        onSuccess={() => {
          onRefreshUser();
          loadQuotaHistory();
        }}
      />
    </div>
  );
};
