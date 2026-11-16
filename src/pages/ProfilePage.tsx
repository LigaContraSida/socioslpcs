import React, { useState } from 'react';
import { User } from '../types.ts';
import {
  User as UserIcon,
  Mail,
  MapPin,
  Phone,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Save,
} from 'lucide-react';

interface ProfilePageProps {
  user: User;
  onRefreshUser: () => void;
}

function checkNifClient(nif: string): boolean {
  const clean = nif.trim();
  if (!/^[0-9]{9}$/.test(clean)) return false;
  if (!['1', '2', '3', '5', '6', '8', '9'].includes(clean[0])) return false;
  let sum = 0;
  for (let i = 0; i < 8; i++) {
    sum += parseInt(clean[i], 10) * (9 - i);
  }
  const rem = sum % 11;
  const check = rem < 2 ? 0 : 11 - rem;
  return check === parseInt(clean[8], 10);
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ user, onRefreshUser }) => {
  const [formData, setFormData] = useState({
    name: user.name || '',
    birth_date: user.birth_date || '',
    address: user.address || '',
    postal_code: user.postal_code || '',
    city: user.city || '',
    nif: user.nif || '',
    phone: user.phone || '',
  });

  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isNifValid = checkNifClient(formData.nif);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || 'Erro ao atualizar dados do perfil.');
        setSaving(false);
        return;
      }

      setSuccessMessage('Dados de associado atualizados com sucesso.');
      setSaving(false);
      onRefreshUser();
    } catch (err) {
      console.error('Profile update error:', err);
      setErrorMessage('Falha ao comunicar com o servidor.');
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-stone-200 pb-6">
        <div>
          <div className="font-condensed text-xs font-bold uppercase tracking-[0.16em] text-[#C81E2B]">
            Ficha de Associado
          </div>
          <h1 className="font-display text-3xl font-bold text-[#141619] tracking-tight mt-1">
            Perfil do Associado
          </h1>
          <p className="text-sm font-light text-stone-600 mt-1">
            Mantenha os seus dados pessoais e fiscais atualizados para emissão de recibos.
          </p>
        </div>

        <div className="bg-[#141619] text-white px-4 py-2.5 rounded-xl shrink-0">
          <span className="font-condensed text-[10px] text-stone-400 block uppercase tracking-wider font-bold">
            Nº de Associado
          </span>
          <span className="font-mono font-bold text-sm text-white tabular-nums">
            {user.member_number}
          </span>
        </div>
      </div>

      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 text-sm text-emerald-900">
          <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-sm text-red-800">
          <AlertCircle className="w-5 h-5 text-[#C81E2B] shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-stone-200">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                Nome Completo (mínimo dois termos) *
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nome e Apelido"
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-stone-300 bg-[#FAF8F5]/50 text-sm focus:outline-hidden focus:bg-white focus:border-[#C81E2B] focus:ring-1 focus:ring-[#C81E2B]"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                Endereço de E-mail
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={user.email}
                  disabled
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-stone-200 bg-stone-100 text-stone-500 text-sm cursor-not-allowed"
                />
              </div>
              <span className="text-[11px] text-stone-400 mt-1 block">
                Identificador único da conta de associado.
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                Data de Nascimento (mín. 16 anos) *
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="date"
                  value={formData.birth_date}
                  onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-stone-300 bg-[#FAF8F5]/50 text-sm tabular-nums focus:outline-hidden focus:bg-white focus:border-[#C81E2B]"
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-stone-700">NIF (9 dígitos) *</label>
                {formData.nif.length === 9 && (
                  <span
                    className={`text-xs font-semibold flex items-center gap-1 ${
                      isNifValid ? 'text-emerald-700' : 'text-[#C81E2B]'
                    }`}
                  >
                    {isNifValid ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Válido (Módulo 11)</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>Inválido</span>
                      </>
                    )}
                  </span>
                )}
              </div>
              <input
                type="text"
                maxLength={9}
                value={formData.nif}
                onChange={(e) => setFormData({ ...formData, nif: e.target.value.replace(/\D/g, '') })}
                placeholder="123456789"
                className={`w-full px-3.5 py-2.5 rounded-lg border font-mono text-sm tabular-nums focus:outline-hidden ${
                  formData.nif.length === 9 && !isNifValid
                    ? 'border-red-400 bg-red-50/30'
                    : 'border-stone-300 bg-[#FAF8F5]/50 focus:bg-white focus:border-[#C81E2B]'
                }`}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                Telemóvel (91 / 92 / 93 / 96) *
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  maxLength={9}
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '') })}
                  placeholder="912345678"
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-stone-300 bg-[#FAF8F5]/50 font-mono text-sm tabular-nums focus:outline-hidden focus:bg-white focus:border-[#C81E2B]"
                  required
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                Morada Completa *
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Avenida da Liberdade, 120, 3º Dto"
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-stone-300 bg-[#FAF8F5]/50 text-sm focus:outline-hidden focus:bg-white focus:border-[#C81E2B]"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                Código Postal (0000-000) *
              </label>
              <input
                type="text"
                maxLength={8}
                value={formData.postal_code}
                onChange={(e) => {
                  let val = e.target.value.replace(/[^\d-]/g, '');
                  if (val.length === 4 && !val.includes('-')) {
                    val = val + '-';
                  }
                  setFormData({ ...formData, postal_code: val });
                }}
                placeholder="1250-142"
                className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 bg-[#FAF8F5]/50 font-mono text-sm tabular-nums focus:outline-hidden focus:bg-white focus:border-[#C81E2B]"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                Localidade *
              </label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="Lisboa"
                className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 bg-[#FAF8F5]/50 text-sm focus:outline-hidden focus:bg-white focus:border-[#C81E2B]"
                required
              />
            </div>
          </div>

          <div className="pt-4 border-t border-stone-100 flex items-center justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-7 py-3 rounded-lg bg-[#C81E2B] hover:bg-[#A11622] text-white font-semibold text-sm transition-colors flex items-center gap-2"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>A guardar...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Guardar Alterações</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
