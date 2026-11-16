import React, { useState, useEffect } from 'react';
import { Mail, Lock, LogIn, AlertCircle, Store, ArrowRight } from 'lucide-react';
import { User } from '../types.ts';
import { LpcsLogo } from '../components/LpcsLogo.tsx';

interface LoginPageProps {
  onNavigate: (path: string) => void;
  onRefreshUser: () => Promise<User | null> | void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onNavigate, onRefreshUser }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cookieBlocked, setCookieBlocked] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get('error');
    if (err) {
      setErrorMessage(decodeURIComponent(err));
    }
  }, []);

  const handleFillDemo = (demoType: 'member' | 'admin') => {
    if (demoType === 'member') {
      setEmail('demo@lpcs.pt');
      setPassword('demo1234');
    } else {
      setEmail('admin@lpcs.pt');
      setPassword('Admin!2026');
    }
  };

  const handleFetchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);
    setCookieBlocked(false);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || 'Credenciais inválidas.');
        setSubmitting(false);
        return;
      }

      const loggedUser = await onRefreshUser();
      if (!loggedUser) {
        setCookieBlocked(true);
        setErrorMessage(
          'O seu browser bloqueou os cookies de sessão dentro da janela de pré-visualização. Abra o portal num novo separador para iniciar sessão.'
        );
        setSubmitting(false);
        return;
      }

      setSubmitting(false);
      onNavigate(data.redirect || '/dashboard');
    } catch (err) {
      console.error('Login error:', err);
      const form = document.getElementById('native-login-form') as HTMLFormElement;
      form?.submit();
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-14 space-y-6">
      <div className="text-center space-y-3">
        <div className="flex justify-center">
          <LpcsLogo variant="dark" className="h-24 w-auto rounded-xl" />
        </div>
        <div className="font-condensed text-xs font-bold uppercase tracking-[0.16em] text-[#C81E2B]">
          Liga em Rede · Associados &amp; Parceiros
        </div>
        <h1 className="font-display text-3xl font-bold text-[#141619] tracking-tight">
          Entrar na Liga em Rede
        </h1>
        <p className="text-sm font-light text-stone-600">
          Liga Portuguesa Contra a SIDA · NIPC 502 665 548
        </p>
      </div>

      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-stone-200 space-y-6">
        {errorMessage && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex flex-col gap-2 text-xs sm:text-sm text-red-800">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-[#C81E2B] shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
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

        <div className="bg-[#FAF8F5] p-3.5 rounded-xl border border-stone-200 text-xs space-y-2">
          <div className="font-bold text-stone-700">Acesso rápido de demonstração</div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleFillDemo('member')}
              className="py-2 px-3 rounded-lg bg-white border border-stone-200 hover:border-stone-400 text-left transition-colors"
            >
              <strong className="block text-[#141619]">Sócio Demo</strong>
              <span className="text-[11px] text-stone-500">demo@lpcs.pt</span>
            </button>
            <button
              type="button"
              onClick={() => handleFillDemo('admin')}
              className="py-2 px-3 rounded-lg bg-white border border-stone-200 hover:border-stone-400 text-left transition-colors"
            >
              <strong className="block text-[#141619]">Administrador</strong>
              <span className="text-[11px] text-stone-500">admin@lpcs.pt</span>
            </button>
          </div>
        </div>

        <form
          id="native-login-form"
          method="post"
          action="/api/auth/login"
          onSubmit={handleFetchSubmit}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1.5">
              Endereço de E-mail
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="exemplo@lpcs.pt"
                required
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-stone-300 bg-[#FAF8F5]/50 text-sm focus:outline-hidden focus:bg-white focus:border-[#C81E2B] focus:ring-1 focus:ring-[#C81E2B]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-lg bg-[#C81E2B] hover:bg-[#A11622] text-white font-bold text-sm transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>A entrar...</span>
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>Iniciar Sessão</span>
              </>
            )}
          </button>
        </form>

        <div className="relative my-2">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-stone-200" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-white px-2.5 text-stone-400">ou</span>
          </div>
        </div>

        <div>
          <button
            type="button"
            disabled
            title="A integração com Google OAuth pode ser ativada configurando as credenciais no servidor."
            className="w-full py-2.5 px-4 rounded-lg border border-stone-200 bg-stone-50 text-stone-400 text-xs font-medium flex items-center justify-center gap-2 cursor-not-allowed"
          >
            <svg className="w-4 h-4 opacity-50" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>Continuar com Google (Disponível com Chave OAuth)</span>
          </button>
        </div>

        <div className="pt-4 border-t border-stone-100 text-center space-y-2 text-xs text-stone-600">
          <div>
            Ainda não é associado da LPCS?{' '}
            <button
              type="button"
              onClick={() => onNavigate('/registar')}
              className="font-bold text-[#C81E2B] hover:text-[#A11622]"
            >
              Fazer-se Sócio
            </button>
          </div>
          <div>
            <button
              type="button"
              onClick={() => onNavigate('/admin')}
              className="text-stone-500 hover:text-[#141619] underline decoration-stone-300 underline-offset-4"
            >
              Aceder à Gestão Administrativa (Direção LPCS)
            </button>
          </div>
        </div>
      </div>

      {/* Dedicated Partner Area Login Card */}
      <div className="bg-[#141619] text-white rounded-2xl p-6 sm:p-7 border border-stone-800 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="font-condensed text-xs font-bold uppercase tracking-[0.14em] text-rose-400">
              Empresas &amp; Comerciantes
            </div>
            <h2 className="font-display text-xl font-bold text-white tracking-tight">
              Área de Parceiro
            </h2>
            <p className="text-xs font-light text-stone-300 leading-relaxed">
              Aceda à conta da sua empresa parceira para validar códigos rotativos de 6 dígitos e QR Codes dos associados.
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-stone-800 border border-stone-700 flex items-center justify-center shrink-0">
            <Store className="w-5 h-5 text-rose-400" />
          </div>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('/validar')}
          className="w-full py-3 px-4 rounded-lg bg-white hover:bg-stone-100 text-[#141619] font-bold text-sm transition-colors flex items-center justify-center gap-2"
        >
          <LogIn className="w-4 h-4 text-[#C81E2B]" />
          <span>Login na Área de Parceiro</span>
          <ArrowRight className="w-4 h-4 text-stone-500" />
        </button>
      </div>
    </div>
  );
};
