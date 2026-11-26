import React, { useState, useEffect, useRef } from 'react';
import { User, Quota, Receipt } from '../types.ts';
import {
  Upload,
  FileText,
  Download,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  CreditCard,
} from 'lucide-react';
import { QuotaPaymentModal } from '../components/QuotaPaymentModal.tsx';

interface PaymentsPageProps {
  user: User;
  onRefreshUser: () => void;
}

export const PaymentsPage: React.FC<PaymentsPageProps> = ({ user, onRefreshUser }) => {
  const [quotas, setQuotas] = useState<Quota[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedQuotaId, setSelectedQuotaId] = useState<string>('');
  const [receiptNotes, setReceiptNotes] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedQuotaForPayment, setSelectedQuotaForPayment] = useState<any | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = () => {
    setLoading(true);
    fetch('/api/quotas/history', { credentials: 'same-origin' })
      .then((res) => res.json())
      .then((data) => {
        setQuotas(data.quotas || []);
        setReceipts(data.receipts || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error loading payments:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setUploadError('Por favor selecione um ficheiro para enviar.');
      return;
    }

    setUploading(true);
    setUploadSuccess(null);
    setUploadError(null);

    const formData = new FormData();
    formData.append('receipt_file', selectedFile);
    if (selectedQuotaId) {
      formData.append('quota_id', selectedQuotaId);
    }
    if (receiptNotes.trim()) {
      formData.append('notes', receiptNotes.trim());
    }

    try {
      const res = await fetch('/api/receipts/upload', {
        method: 'POST',
        credentials: 'same-origin',
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        setUploadError(data.error || 'Erro no envio do recibo.');
        setUploading(false);
        return;
      }

      setUploadSuccess('Recibo arquivado com sucesso no portal.');
      setSelectedFile(null);
      setReceiptNotes('');
      setSelectedQuotaId('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      setUploading(false);
      loadData();
      onRefreshUser();
    } catch (err) {
      console.error('Upload error:', err);
      setUploadError('Falha ao comunicar com o servidor.');
      setUploading(false);
    }
  };

  const handleDeleteReceipt = async (receiptId: number) => {
    if (!window.confirm('Tem a certeza que deseja remover este recibo do seu arquivo?')) return;

    try {
      const res = await fetch(`/api/receipts/${receiptId}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      if (res.ok) {
        setReceipts((prev) => prev.filter((r) => r.id !== receiptId));
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const totalPaidEuros = quotas.reduce((acc, q) => acc + q.amount_cents / 100, 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="border-b border-stone-200 pb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="font-condensed text-xs font-bold uppercase tracking-[0.16em] text-[#C81E2B]">
            Gestão Financeira e Arquivo
          </div>
          <h1 className="font-display text-3xl font-bold text-[#141619] tracking-tight mt-1">
            Pagamentos e Recibos de Quotas
          </h1>
          <p className="text-sm font-light text-stone-600 mt-1 max-w-2xl">
            Consulte o histórico completo de regularizações de {user.name} ({user.member_number}) e anexe comprovativos adicionais.
          </p>
        </div>
      </div>

      {/* 3-Column Metric Strip */}
      <div className="bg-white rounded-xl border border-stone-200 grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-stone-200">
        <div className="p-6">
          <div className="text-xs font-semibold uppercase tracking-wider text-stone-500">
            Total de Pagamentos
          </div>
          <div className="text-2xl sm:text-3xl font-mono font-bold text-[#141619] mt-2 tabular-nums">
            {quotas.length} efetuados
          </div>
        </div>

        <div className="p-6">
          <div className="text-xs font-semibold uppercase tracking-wider text-stone-500">
            Total Pago Acumulado
          </div>
          <div className="text-2xl sm:text-3xl font-mono font-bold text-emerald-700 mt-2 tabular-nums">
            {totalPaidEuros.toFixed(2)} €
          </div>
        </div>

        <div className="p-6">
          <div className="text-xs font-semibold uppercase tracking-wider text-stone-500">
            Recibos em Arquivo
          </div>
          <div className="text-2xl sm:text-3xl font-mono font-bold text-[#141619] mt-2 tabular-nums">
            {receipts.length} documentos
          </div>
        </div>
      </div>

      {/* Upload Receipt Form */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-stone-200 space-y-6">
        <div className="border-b border-stone-100 pb-4">
          <div className="font-condensed text-xs font-bold uppercase tracking-[0.16em] text-[#C81E2B]">
            Arquivo Digital Privado
          </div>
          <h2 className="font-display text-xl font-bold text-[#141619] mt-1">
            Anexar Novo Recibo ou Comprovativo
          </h2>
          <p className="text-xs sm:text-sm font-light text-stone-500 mt-0.5">
            Suporta ficheiros PDF, PNG, JPG ou WEBP até 5 MB. Acesso exclusivo por si e pela administração da LPCS.
          </p>
        </div>

        {uploadSuccess && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 text-sm text-emerald-900">
            <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
            <span>{uploadSuccess}</span>
          </div>
        )}

        {uploadError && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-sm text-red-800">
            <XCircle className="w-5 h-5 text-[#C81E2B] shrink-0" />
            <span>{uploadError}</span>
          </div>
        )}

        <form onSubmit={handleUploadSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                Ficheiro (PDF ou Imagem) *
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="w-full text-xs text-stone-600 file:mr-3 file:py-2 file:px-3.5 file:rounded-lg file:border file:border-stone-300 file:text-xs file:font-semibold file:bg-[#FAF8F5] file:text-[#141619] hover:file:bg-stone-100 cursor-pointer"
                required
              />
              {selectedFile && (
                <span className="text-[11px] text-stone-500 mt-1 block tabular-nums">
                  {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                </span>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                Associar a Pagamento (Opcional)
              </label>
              <select
                value={selectedQuotaId}
                onChange={(e) => setSelectedQuotaId(e.target.value)}
                className="w-full py-2.5 px-3 rounded-lg border border-stone-300 bg-white text-xs font-medium text-[#141619] focus:outline-hidden focus:border-[#C81E2B]"
              >
                <option value="">Nenhum pagamento específico</option>
                {quotas.map((q) => (
                  <option key={q.id} value={q.id}>
                    {new Date(q.created_at).toLocaleDateString('pt-PT')} · Quota {q.plan_type} (
                    {(q.amount_cents / 100).toFixed(2)} €)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                Nota / Descrição (Opcional)
              </label>
              <input
                type="text"
                placeholder="Ex: Comprovativo transferência Millennium"
                value={receiptNotes}
                onChange={(e) => setReceiptNotes(e.target.value)}
                className="w-full py-2.5 px-3 rounded-lg border border-stone-300 bg-[#FAF8F5]/50 text-xs font-medium text-[#141619] focus:outline-hidden focus:bg-white focus:border-[#C81E2B]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={uploading || !selectedFile}
            className="px-6 py-2.5 rounded-lg bg-[#141619] hover:bg-stone-800 disabled:opacity-50 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2"
          >
            {uploading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>A enviar ficheiro...</span>
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                <span>Arquivar Comprovativo</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Receipts Archive Table */}
      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-stone-200">
          <h3 className="font-display text-lg font-semibold text-[#141619]">
            Arquivo de Recibos Pessoais
          </h3>
        </div>

        {receipts.length === 0 ? (
          <div className="p-8 text-center text-stone-500 text-sm">
            Nenhum recibo arquivado até ao momento.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-stone-600">
              <thead className="font-condensed bg-[#FAF8F5] text-[11px] uppercase font-bold tracking-wider text-stone-500 border-b border-stone-200">
                <tr>
                  <th className="py-3 px-6">Data</th>
                  <th className="py-3 px-4">Ficheiro</th>
                  <th className="py-3 px-4">Tamanho</th>
                  <th className="py-3 px-4">Notas</th>
                  <th className="py-3 px-6 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {receipts.map((r) => (
                  <tr key={r.id} className="hover:bg-stone-50/70">
                    <td className="py-3.5 px-6 tabular-nums">
                      {new Date(r.created_at).toLocaleDateString('pt-PT')}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-[#141619] flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[#C81E2B] shrink-0" />
                      <span className="truncate max-w-xs">{r.original_name}</span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-stone-500 tabular-nums">
                      {(r.file_size / 1024).toFixed(1)} KB
                    </td>
                    <td className="py-3.5 px-4 text-stone-500 max-w-xs truncate">
                      {r.notes || '—'}
                    </td>
                    <td className="py-3.5 px-6 text-right space-x-2 whitespace-nowrap">
                      <a
                        href={`/api/receipts/${r.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 text-[#141619] text-xs font-semibold transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Descarregar</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => handleDeleteReceipt(r.id)}
                        className="inline-flex items-center p-1.5 rounded-lg text-stone-400 hover:text-[#C81E2B] hover:bg-red-50 transition-colors"
                        title="Remover recibo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Full Quotas History Table */}
      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-stone-200">
          <h3 className="font-display text-lg font-semibold text-[#141619]">
            Histórico Completo de Quotas
          </h3>
        </div>

        {loading ? (
          <p className="text-xs text-stone-500 p-6">A carregar registos...</p>
        ) : quotas.length === 0 ? (
          <p className="text-sm text-stone-500 p-6">Nenhum pagamento registado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-stone-600">
              <thead className="font-condensed bg-[#FAF8F5] text-[11px] uppercase font-bold tracking-wider text-stone-500 border-b border-stone-200">
                <tr>
                  <th className="py-3 px-6">Data</th>
                  <th className="py-3 px-4">Plano</th>
                  <th className="py-3 px-4">Valor</th>
                  <th className="py-3 px-4">Método</th>
                  <th className="py-3 px-4">Referência</th>
                  <th className="py-3 px-4">Período Válido</th>
                  <th className="py-3 px-6 text-right">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {quotas.map((q) => (
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
                    <td className="py-3.5 px-4 font-mono text-[11px] text-stone-600 tabular-nums">
                      {q.reference}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-stone-700 tabular-nums">
                      {q.valid_from} a {q.valid_until}
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
          loadData();
        }}
      />
    </div>
  );
};
