import React, { useState, useEffect } from 'react';
import {
  User as UserIcon,
  Mail,
  Lock,
  MapPin,
  Phone,
  Calendar,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { User } from '../types.ts';
import { LpcsLogo } from '../components/LpcsLogo.tsx';

interface RegisterPageProps {
  onNavigate: (path: string) => void;
  onRefreshUser: () => Promise<User | null> | void;
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

export const RegisterPage: React.FC<RegisterPageProps> = ({ onNavigate, onRefreshUser }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    birth_date: '',
    address: '',
    postal_code: '',
    city: '',
    nif: '',
    phone: '',
  });

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get('error');
    if (err) {
      setErrorMessage(decodeURIComponent(err));
    }
  }, []);

  const isNifValid = checkNifClient(formData.nif);

  const handleFetchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);

    if (!checkNifClient(formData.nif)) {
      setErrorMessage(
        'O NIF inserido não é válido segundo o algoritmo oficial português (Módulo 11).'
      );
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || 'Erro ao processar registo.');
        setSubmitting(false);
        return;
      }

      const loggedUser = await onRefreshUser();
      setSubmitting(false);
      if (!loggedUser) {
        setErrorMessage(
          'Conta criada, mas o browser bloqueou o cookie de sessão nesta janela de pré-visualização. Abra o portal num novo separador para entrar.'
        );
        return;
      }

      onNavigate('/dashboard');
    } catch (err) {
      console.error('Register submit error:', err);
      const form = document.getElementById('native-register-form') as HTMLFormElement;
      form?.submit();
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-12 space-y-8">
      <div className="text-center space-y-3">
        <div className="flex justify-center">
          <LpcsLogo variant="dark" className="h-24 w-auto rounded-xl" />
        </div>
        <div className="font-condensed text-xs font-bold uppercase tracking-[0.16em] text-[#C81E2B]">
          Liga em Rede · Inscrição Oficial de Sócio LPCS · NIPC 502 665 548
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#141619] tracking-tight">
          Torne-se Associado da Liga
        </h1>
        <p className="text-sm font-light text-stone-600 max-w-md mx-auto">
          Preencha os seus dados. O seu número oficial <span className="font-bold text-[#141619] tabular-nums">LPCS-XXXXX</span> é atribuído de imediato e a inscrição é comunicada automaticamente para <span className="font-medium text-[#141619]">info@ligacontrasida.org</span>.
        </p>
      </div>

      <div className="bg-white rounded-2xl p-6 sm:p-10 border border-stone-200 space-y-6">
        {errorMessage && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-xs sm:text-sm text-red-800">
            <AlertCircle className="w-5 h-5 text-[#C81E2B] shrink-0 mt-0.5" />
            <div>
              <strong className="block font-semibold">Erro de Validação</strong>
              <span>{errorMessage}</span>
            </div>
          </div>
        )}

        <form
          id="native-register-form"
          method="post"
          action="/api/auth/register"
          onSubmit={handleFetchSubmit}
          className="space-y-5"
        >
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5">
              Nome Completo (pelo menos dois termos) *
            </label>
            <div className="relative">
              <UserIcon className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Maria João Silva Santos"
                required
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-stone-300 bg-[#FAF8F5]/50 text-sm focus:outline-hidden focus:bg-white focus:border-[#C81E2B] focus:ring-1 focus:ring-[#C81E2B]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                E-mail (para login e recibos) *
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="exemplo@dominio.pt"
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-stone-300 bg-[#FAF8F5]/50 text-sm focus:outline-hidden focus:bg-white focus:border-[#C81E2B]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                Palavra-passe (mínimo 6 carateres) *
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  name="password"
                  minLength={6}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="••••••••"
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-stone-300 bg-[#FAF8F5]/50 text-sm focus:outline-hidden focus:bg-white focus:border-[#C81E2B]"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                Data de Nascimento (mín. 16 anos) *
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="date"
                  name="birth_date"
                  value={formData.birth_date}
                  onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-stone-300 bg-[#FAF8F5]/50 text-sm tabular-nums focus:outline-hidden focus:bg-white focus:border-[#C81E2B]"
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
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5" />
                    )}
                    <span>{isNifValid ? 'Módulo 11 OK' : 'Inválido'}</span>
                  </span>
                )}
              </div>
              <input
                type="text"
                name="nif"
                maxLength={9}
                value={formData.nif}
                onChange={(e) => setFormData({ ...formData, nif: e.target.value.replace(/\D/g, '') })}
                placeholder="234567890"
                required
                className={`w-full px-3.5 py-2.5 rounded-lg border font-mono text-sm tabular-nums focus:outline-hidden ${
                  formData.nif.length === 9 && !isNifValid
                    ? 'border-red-400 bg-red-50/20'
                    : 'border-stone-300 bg-[#FAF8F5]/50 focus:bg-white focus:border-[#C81E2B]'
                }`}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5">
              Telemóvel (9 dígitos, 91 / 92 / 93 / 96) *
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                name="phone"
                maxLength={9}
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '') })}
                placeholder="912345678"
                required
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-stone-300 bg-[#FAF8F5]/50 font-mono text-sm tabular-nums focus:outline-hidden focus:bg-white focus:border-[#C81E2B]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5">
              Morada Completa (Rua, Número, Andar) *
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Rua Garrett, 10, 2º Esq"
                required
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-stone-300 bg-[#FAF8F5]/50 text-sm focus:outline-hidden focus:bg-white focus:border-[#C81E2B]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                Código Postal (0000-000) *
              </label>
              <input
                type="text"
                name="postal_code"
                maxLength={8}
                value={formData.postal_code}
                onChange={(e) => {
                  let val = e.target.value.replace(/[^\d-]/g, '');
                  if (val.length === 4 && !val.includes('-')) {
                    val = val + '-';
                  }
                  setFormData({ ...formData, postal_code: val });
                }}
                placeholder="1200-203"
                required
                className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 bg-[#FAF8F5]/50 font-mono text-sm tabular-nums focus:outline-hidden focus:bg-white focus:border-[#C81E2B]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                Localidade *
              </label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="Lisboa"
                required
                className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 bg-[#FAF8F5]/50 text-sm focus:outline-hidden focus:bg-white focus:border-[#C81E2B]"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-lg bg-[#C81E2B] hover:bg-[#A11622] text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>A criar conta de associado...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Concluir Inscrição e Aceder</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>

        <div className="pt-4 border-t border-stone-100 text-center text-xs text-stone-600">
          Já tem conta de associado?{' '}
          <button
            type="button"
            onClick={() => onNavigate('/entrar')}
            className="font-semibold text-[#C81E2B] hover:text-[#A11622]"
          >
            Iniciar Sessão
          </button>
        </div>
      </div>
    </div>
  );
};
