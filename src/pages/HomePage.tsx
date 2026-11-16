import React, { useState, useEffect } from 'react';
import { HeroStats, User } from '../types.ts';
import {
  Check,
  ArrowRight,
  ChevronRight,
  LogIn,
  Mail,
  Lock,
  AlertCircle,
  Building2,
  HeartHandshake,
  Megaphone,
  FileCheck,
  ShieldCheck,
  Store,
} from 'lucide-react';
import heroCommunityImg from '../assets/images/hero_lpcs_community_1794510456196.jpg';

interface HomePageProps {
  user: User | null;
  onNavigate: (path: string, query?: Record<string, string>) => void;
  onRefreshUser: () => Promise<User | null> | void;
}

export const HomePage: React.FC<HomePageProps> = ({ user, onNavigate, onRefreshUser }) => {
  const [stats, setStats] = useState<HeroStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [heroImgFailed, setHeroImgFailed] = useState(false);

  // Inline Member Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [cookieBlocked, setCookieBlocked] = useState(false);
  const [loginSubmitting, setLoginSubmitting] = useState(false);

  useEffect(() => {
    fetch('/api/partners/hero-stats')
      .then((res) => res.json())
      .then((data: HeroStats) => {
        setStats(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load hero stats:', err);
        setLoading(false);
      });
  }, []);

  const handleInlineLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginSubmitting(true);
    setLoginError(null);
    setCookieBlocked(false);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setLoginError(data.error || 'E-mail ou palavra-passe incorretos.');
        setLoginSubmitting(false);
        return;
      }

      const loggedUser = await onRefreshUser();
      if (!loggedUser) {
        setCookieBlocked(true);
        setLoginError(
          'O seu browser bloqueou os cookies de sessão dentro da pré-visualização. Abra o portal num novo separador para entrar.'
        );
        setLoginSubmitting(false);
        return;
      }

      setLoginSubmitting(false);
      onNavigate(data.redirect || '/dashboard');
    } catch (err) {
      console.error('Home login error:', err);
      const form = document.getElementById('home-native-login-form') as HTMLFormElement;
      form?.submit();
    }
  };

  const totalSavings = stats ? Math.floor(stats.totalSavings) : 1568;
  const multiplier = stats ? stats.savingsMultiplier : 44.8;
  const partnersCount = stats ? stats.partnersCount : 28;

  return (
    <div className="space-y-14 pb-10">
      {/* 1. HERO + LOGIN SPLIT */}
      <section className="pt-8 sm:pt-12 pb-10 border-b border-stone-200/80 bg-[#FAF8F5]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
            {/* Left 7 columns */}
            <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="font-condensed text-xs font-bold uppercase tracking-[0.16em] text-stone-500">
                  <span className="text-[#C81E2B]">Liga em Rede</span> <span aria-hidden="true" className="mx-1.5 text-stone-300">·</span> Liga Portuguesa Contra a SIDA <span aria-hidden="true" className="mx-1.5 text-stone-300">·</span> IPSS · NIPC 502 665 548
                </div>

                <h1 className="font-display text-3xl sm:text-5xl font-bold text-[#141619] tracking-[-0.02em] leading-[1.08] text-balance">
                  Uma quota de <span className="text-[#C81E2B]">35 € por ano</span> que apoia a saúde comunitária e poupa{' '}
                  <span className="tabular-nums underline decoration-stone-300 underline-offset-6">
                    {loading ? '...' : `+${totalSavings} €`}
                  </span>
                  .
                </h1>

                <p className="text-sm sm:text-base font-light text-stone-600 leading-relaxed max-w-2xl">
                  Ao tornar-se associado da LPCS financia rastreios anónimos, apoio psicossocial e ações de prevenção em Portugal — e recupera o valor da quota logo na 1.ª utilização nos {partnersCount} parceiros certificados.
                </p>

                <div className="pt-1 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => onNavigate(user ? '/parceiros' : '/registar')}
                    className="px-5 py-2.5 rounded-lg bg-[#C81E2B] hover:bg-[#A11622] text-white font-semibold text-sm transition-colors flex items-center gap-2 whitespace-nowrap"
                  >
                    <span>{user ? 'Explorar Parceiros' : 'Fazer-se Sócio · 35 €/ano'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => onNavigate('/parceiros')}
                    className="px-4 py-2.5 rounded-lg bg-white border border-stone-300 text-[#141619] font-semibold text-sm hover:bg-stone-100/70 transition-colors whitespace-nowrap"
                  >
                    Parceiros &amp; Descontos
                  </button>

                  <button
                    type="button"
                    onClick={() => onNavigate('/parceria')}
                    className="px-4 py-2.5 rounded-lg border border-stone-300 bg-[#F3EFE8] hover:bg-stone-200/70 text-[#141619] font-semibold text-sm transition-colors flex items-center gap-2 whitespace-nowrap"
                  >
                    <Building2 className="w-4 h-4 text-[#C81E2B]" />
                    <span>Ser Parceiro</span>
                  </button>
                </div>
              </div>

              {/* Compact Documentary Image + KPI Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-stretch pt-2">
                <figure className="sm:col-span-6 overflow-hidden rounded-xl border border-stone-200 bg-stone-100">
                  {!heroImgFailed ? (
                    <img
                      src={heroCommunityImg}
                      alt="Apoio comunitário na Liga Portuguesa Contra a SIDA"
                      referrerPolicy="no-referrer"
                      onError={() => setHeroImgFailed(true)}
                      className="w-full h-40 object-cover"
                    />
                  ) : (
                    <div className="w-full h-40 bg-stone-200 flex items-center justify-center p-4 text-stone-600 text-xs">
                      Centro de Apoio e Prevenção LPCS
                    </div>
                  )}
                </figure>

                <div className="sm:col-span-6 bg-white rounded-xl border border-stone-200 p-4 flex flex-col justify-between">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                        Poupança Anual
                      </div>
                      <div className="font-mono text-2xl font-bold text-[#141619] tabular-nums mt-0.5">
                        {loading ? '...' : `+${totalSavings} €`}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                        Retorno Quota
                      </div>
                      <div className="font-mono text-2xl font-bold text-[#C81E2B] tabular-nums mt-0.5">
                        {loading ? '...' : `${multiplier}×`}
                      </div>
                    </div>
                  </div>
                  <div className="pt-3 border-t border-stone-100 text-xs text-stone-500 flex items-center justify-between">
                    <span>{partnersCount} parceiros ativos</span>
                    <span className="font-semibold text-[#141619]">2,92 € / mês</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right 5 columns: Member Login Card */}
            <div className="lg:col-span-5 flex flex-col justify-between bg-white rounded-2xl border border-stone-200 p-6 sm:p-7">
              {user ? (
                <div className="flex flex-col justify-between h-full space-y-5">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                      <span className="font-condensed text-xs font-bold uppercase tracking-wider text-stone-500">
                        Sessão de Associado
                      </span>
                      <span className="font-mono text-xs font-bold text-[#141619] tabular-nums">
                        {user.member_number}
                      </span>
                    </div>

                    <div>
                      <h2 className="font-display text-2xl font-bold text-[#141619] tracking-tight">
                        Bem-vindo, {user.name.split(' ')[0]}
                      </h2>
                      <p className="text-sm text-stone-600 mt-1.5 leading-relaxed">
                        {user.quota_status.has_active_quota
                          ? `Quota regularizada com ${user.quota_status.days_remaining} dias de validade restantes.`
                          : 'Regularize a sua quota para emitir códigos de desconto nos parceiros.'}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-stone-100 grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-stone-400 block">Estado da Quota</span>
                        <span
                          className={`font-semibold mt-0.5 block ${
                            user.quota_status.has_active_quota ? 'text-emerald-700' : 'text-[#C81E2B]'
                          }`}
                        >
                          {user.quota_status.has_active_quota ? 'Ativa e Válida' : 'Inativa / Expirada'}
                        </span>
                      </div>
                      <div>
                        <span className="text-stone-400 block">Validade</span>
                        <span className="font-mono font-semibold text-[#141619] mt-0.5 block tabular-nums">
                          {user.quota_status.valid_until || '—'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-4 border-t border-stone-100">
                    <button
                      type="button"
                      onClick={() => onNavigate('/dashboard')}
                      className="py-2.5 px-4 rounded-lg bg-[#C81E2B] hover:bg-[#A11622] text-white font-semibold text-sm transition-colors"
                    >
                      Área Pessoal
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigate('/pagamentos')}
                      className="py-2.5 px-4 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 text-[#141619] font-semibold text-sm transition-colors"
                    >
                      Quotas e Recibos
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col justify-between h-full space-y-5">
                  <div className="space-y-4">
                    <div className="flex items-start justify-between pb-3 border-b border-stone-100">
                      <div>
                        <div className="font-condensed text-xs font-bold uppercase tracking-wider text-[#C81E2B]">
                          Área Reservada
                        </div>
                        <h2 className="font-display text-2xl font-bold text-[#141619] tracking-tight mt-0.5">
                          Login para Sócios
                        </h2>
                      </div>
                      <LogIn className="w-5 h-5 text-stone-400 mt-1" />
                    </div>

                    {loginError && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex flex-col gap-2 text-xs text-red-800">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-[#C81E2B] shrink-0 mt-0.5" />
                          <span>{loginError}</span>
                        </div>
                        {cookieBlocked && (
                          <a
                            href={window.location.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="self-start ml-6 px-3 py-1.5 rounded-md bg-[#C81E2B] text-white text-xs font-semibold hover:bg-[#A11622]"
                          >
                            Abrir Portal num Novo Separador
                          </a>
                        )}
                      </div>
                    )}

                    <form
                      id="home-native-login-form"
                      method="post"
                      action="/api/auth/login"
                      onSubmit={handleInlineLogin}
                      className="space-y-3.5"
                    >
                      <div>
                        <label className="block text-xs font-semibold text-stone-700 mb-1">
                          E-mail de Associado
                        </label>
                        <div className="relative">
                          <Mail className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="email"
                            name="email"
                            required
                            value={loginEmail}
                            onChange={(e) => setLoginEmail(e.target.value)}
                            placeholder="socio@exemplo.pt"
                            className="w-full pl-10 pr-3.5 py-2 rounded-lg border border-stone-300 bg-[#FAF8F5]/60 text-sm text-[#141619] focus:outline-hidden focus:bg-white focus:border-[#C81E2B] focus:ring-1 focus:ring-[#C81E2B] transition-colors"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-stone-700 mb-1">
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
                            className="w-full pl-10 pr-3.5 py-2 rounded-lg border border-stone-300 bg-[#FAF8F5]/60 text-sm text-[#141619] focus:outline-hidden focus:bg-white focus:border-[#C81E2B] focus:ring-1 focus:ring-[#C81E2B] transition-colors"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={loginSubmitting}
                        className="w-full py-2.5 rounded-lg bg-[#141619] hover:bg-stone-800 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
                      >
                        {loginSubmitting ? (
                          <span>A entrar...</span>
                        ) : (
                          <>
                            <LogIn className="w-4 h-4" />
                            <span>Entrar na Área de Sócio</span>
                          </>
                        )}
                      </button>
                    </form>
                  </div>

                  <div className="pt-3 border-t border-stone-100 flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setLoginEmail('demo@lpcs.pt');
                        setLoginPassword('demo1234');
                      }}
                      className="text-stone-500 hover:text-[#141619] font-medium underline decoration-stone-300 underline-offset-4"
                    >
                      Conta demo (demo@lpcs.pt)
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigate('/entrar')}
                      className="font-semibold text-stone-700 hover:text-[#C81E2B] flex items-center gap-1"
                    >
                      <Store className="w-3.5 h-3.5 text-[#C81E2B]" />
                      <span>Área Parceiro →</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 2. TOP BENEFITS PREVIEW */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-stone-200 pb-4">
          <div>
            <div className="font-condensed text-xs font-bold uppercase tracking-[0.16em] text-[#C81E2B]">
              Parceiros &amp; Descontos
            </div>
            <h2 className="font-display text-2xl font-bold text-[#141619] tracking-tight mt-0.5">
              Benefícios que pagam a quota logo na primeira utilização
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('/parceiros')}
            className="text-sm font-semibold text-[#C81E2B] hover:text-[#A11622] flex items-center gap-1 group whitespace-nowrap"
          >
            <span>Ver catálogo completo ({partnersCount} parceiros)</span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats?.topBenefits?.map((item) => (
            <button
              type="button"
              key={item.id}
              onClick={() => onNavigate('/parceiros', { search: item.name })}
              className="text-left bg-white rounded-xl p-5 border border-stone-200 hover:border-stone-400 transition-colors flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-start gap-3">
                  <img
                    src={`/api/partners/${item.id}/logo`}
                    alt={`Logótipo ${item.name}`}
                    referrerPolicy="no-referrer"
                    className="w-11 h-11 rounded-xl border border-stone-200 bg-white p-1 object-contain shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-stone-500 truncate">
                      <span>{item.area}</span>
                      {item.pays_quota && (
                        <>
                          <span aria-hidden="true" className="mx-1 text-stone-300">·</span>
                          <span className="text-emerald-700 font-semibold">Paga a quota</span>
                        </>
                      )}
                    </div>
                    <h3 className="font-display text-base font-bold text-[#141619] group-hover:text-[#C81E2B] transition-colors mt-0.5 truncate">
                      {item.name}
                    </h3>
                  </div>
                </div>
                <p className="text-sm font-semibold text-[#C81E2B] mt-3">
                  {item.discount_highlight}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-[#141619] tabular-nums">
                  Poupança ~{item.estimated_annual_savings} €/ano
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-stone-400 group-hover:text-[#C81E2B] transition-colors" />
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* 3. CONCISE DUAL SECTION: FAZER-SE SÓCIO & QUERO FAZER PARCERIA */}
      <section id="quero-fazer-parceria" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Fazer-se Sócio Card (5 cols) */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-stone-200 p-6 sm:p-8 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="font-condensed text-xs font-bold uppercase tracking-[0.16em] text-[#C81E2B]">
                Para Cidadãos · Fazer-se Sócio
              </div>
              <h2 className="font-display text-2xl font-bold text-[#141619] tracking-tight">
                Modalidades de Quota LPCS
              </h2>
              <p className="text-sm font-light text-stone-600 leading-relaxed">
                Acesso imediato aos descontos através de código rotativo de 6 dígitos (válido por 3 minutos) e arquivo digital de recibos.
              </p>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-stone-200">
                  <div className="text-xs font-bold text-stone-500 uppercase">Semestral</div>
                  <div className="font-mono text-2xl font-bold text-[#141619] tabular-nums mt-1">
                    17,50 €
                  </div>
                  <div className="text-[11px] text-stone-500">Válida por 6 meses</div>
                </div>
                <div className="p-3.5 rounded-xl bg-red-50/50 border border-[#C81E2B]/40">
                  <div className="text-xs font-bold text-[#C81E2B] uppercase">Anual (2,92 €/mês)</div>
                  <div className="font-mono text-2xl font-bold text-[#141619] tabular-nums mt-1">
                    35,00 €
                  </div>
                  <div className="text-[11px] text-stone-600">Válida por 12 meses</div>
                </div>
              </div>

              <ul className="space-y-2 text-xs sm:text-sm text-stone-700 pt-2">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Cartão digital `LPCS-XXXXX` e renovação acumulável</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Apoio direto aos programas sociais e clínicos da LPCS</span>
                </li>
              </ul>
            </div>

            <button
              type="button"
              onClick={() => onNavigate(user ? '/pagamentos' : '/registar')}
              className="w-full py-3 px-4 rounded-lg bg-[#C81E2B] hover:bg-[#A11622] text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
            >
              <span>{user ? 'Renovar Quota' : 'Fazer-se Sócio Agora'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Quero Fazer Parceria Card (7 cols) */}
          <div className="lg:col-span-7 bg-[#141619] text-white rounded-2xl border border-stone-800 p-6 sm:p-8 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="font-condensed text-xs font-bold uppercase tracking-[0.16em] text-rose-400">
                Para Empresas · Adesão Gratuita
              </div>
              <h2 className="font-display text-2xl font-bold text-white tracking-tight">
                Quero fazer parceria com a Liga Portuguesa Contra a SIDA
              </h2>
              <p className="text-sm font-light text-stone-300 leading-relaxed">
                Promova descontos para os associados da LPCS e destaque a sua empresa com impacto social certificado:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                <div className="p-3.5 rounded-xl bg-stone-900/90 border border-stone-800 space-y-1">
                  <div className="flex items-center gap-2 text-rose-400 font-bold text-xs">
                    <HeartHandshake className="w-4 h-4 shrink-0" />
                    <span>Selo Oficial &amp; Impacto ESG</span>
                  </div>
                  <p className="text-xs text-stone-300 leading-relaxed">
                    Distinção "Empresa Parceira Solidária LPCS" junto de uma IPSS de Utilidade Pública.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-stone-900/90 border border-stone-800 space-y-1">
                  <div className="flex items-center gap-2 text-rose-400 font-bold text-xs">
                    <Megaphone className="w-4 h-4 shrink-0" />
                    <span>Visibilidade e Novos Clientes</span>
                  </div>
                  <p className="text-xs text-stone-300 leading-relaxed">
                    Presença no catálogo nacional pesquisável por distrito, localidade e setor.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-stone-900/90 border border-stone-800 space-y-1">
                  <div className="flex items-center gap-2 text-rose-400 font-bold text-xs">
                    <FileCheck className="w-4 h-4 shrink-0" />
                    <span>Mecenato Social (EBF)</span>
                  </div>
                  <p className="text-xs text-stone-300 leading-relaxed">
                    Benefícios fiscais em sede de IRC para donativos e apoio a rastreios comunitários.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-stone-900/90 border border-stone-800 space-y-1">
                  <div className="flex items-center gap-2 text-rose-400 font-bold text-xs">
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <span>Zero Custos &amp; Validador Seguro</span>
                  </div>
                  <p className="text-xs text-stone-300 leading-relaxed">
                    Sem taxas de adesão e com validação instantânea de códigos rotativos ao balcão.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-between gap-4 border-t border-stone-800">
              <span className="text-xs text-stone-400">
                Cupão fixo (€), Código percentual (%) ou Voucher nominal.
              </span>
              <button
                type="button"
                onClick={() => onNavigate('/parceria')}
                className="px-5 py-3 rounded-lg bg-white hover:bg-stone-100 text-[#141619] font-bold text-sm transition-colors flex items-center gap-2 whitespace-nowrap"
              >
                <span>Ser Parceiro LPCS</span>
                <ArrowRight className="w-4 h-4 text-[#C81E2B]" />
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
