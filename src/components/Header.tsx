import React, { useState } from 'react';
import { User } from '../types.ts';
import { LpcsLogo } from './LpcsLogo.tsx';
import { LogOut, Menu, X } from 'lucide-react';

interface HeaderProps {
  user: User | null;
  isAdmin: boolean;
  currentPath: string;
  onNavigate: (path: string) => void;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  isAdmin,
  currentPath,
  onNavigate,
  onLogout,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const getStatusText = () => {
    if (!user) return null;
    const status = user.quota_status.status;
    if (status === 'valida') {
      return {
        label: `Quota ativa · ${user.quota_status.days_remaining}d`,
        tone: 'text-emerald-700',
      };
    }
    if (status === 'expirar') {
      return {
        label: `A expirar · ${user.quota_status.days_remaining}d`,
        tone: 'text-amber-700',
      };
    }
    if (status === 'expirada') {
      return {
        label: `Expirada · ${user.quota_status.days_expired}d`,
        tone: 'text-[#C81E2B]',
      };
    }
    return {
      label: 'Sem quota ativa',
      tone: 'text-stone-500',
    };
  };

  const navLinks = [
    { name: 'Início', path: '/' },
    { name: 'Parceiros & Descontos', path: '/parceiros' },
    { name: 'Fazer-se Sócio', path: '/registar' },
    { name: 'Ser Parceiro', path: '/parceria' },
    ...(user
      ? [
          { name: 'Área Pessoal', path: '/dashboard' },
          { name: 'Pagamentos', path: '/pagamentos' },
          { name: 'Perfil', path: '/perfil' },
          ...(isAdmin ? [{ name: 'Administração', path: '/admin' }] : []),
        ]
      : []),
  ];

  const statusInfo = getStatusText();

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-stone-200/90">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4 h-[72px]">
          {/* Zone 1: Official LPCS Logo + Liga em Rede Brand */}
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="flex items-center gap-2.5 text-left whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#C81E2B] rounded-md"
            aria-label="Liga em Rede — Liga Portuguesa Contra a SIDA — Página Inicial"
          >
            <LpcsLogo variant="dark" className="h-12 sm:h-14 w-auto" />
            <div className="border-l border-stone-200 pl-2.5 leading-tight">
              <span className="font-display text-sm sm:text-base font-bold text-[#141619] tracking-tight block">
                Liga em Rede
              </span>
              <span className="font-condensed text-[9px] font-bold uppercase tracking-[0.14em] text-[#C81E2B] block">
                Associados &amp; Parceiros
              </span>
            </div>
          </button>

          {/* Zone 2: Clean Helvetica Navigation Links */}
          <nav className="hidden lg:flex items-center gap-3.5 xl:gap-5" aria-label="Navegação principal">
            {navLinks.map((link) => {
              const active = currentPath === link.path;
              return (
                <button
                  key={link.path}
                  type="button"
                  onClick={() => onNavigate(link.path)}
                  className={`relative py-2 text-sm tracking-tight whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#C81E2B] rounded-sm ${
                    active
                      ? 'text-[#141619] font-bold'
                      : 'text-stone-600 font-medium hover:text-[#141619]'
                  }`}
                >
                  {link.name}
                  <span
                    aria-hidden="true"
                    className={`absolute left-0 right-0 -bottom-0.5 h-[2px] bg-[#C81E2B] transition-opacity duration-150 ${
                      active ? 'opacity-100' : 'opacity-0'
                    }`}
                  />
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Single Primary Action / Member Status */}
          <div className="hidden lg:flex items-center gap-4 shrink-0">
            {user ? (
              <div className="flex items-center gap-4">
                <div className="text-right leading-tight">
                  <div className="text-sm font-bold text-[#141619] whitespace-nowrap tracking-tight">
                    {user.name.split(' ')[0]}
                    <span className="text-stone-400 mx-1.5 font-normal">·</span>
                    <span className="text-xs font-medium text-stone-600 tabular-nums">
                      {user.member_number}
                    </span>
                  </div>
                  {statusInfo && (
                    <div className={`text-xs font-medium tabular-nums ${statusInfo.tone}`}>
                      {statusInfo.label}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={onLogout}
                  title="Terminar Sessão"
                  className="px-3.5 py-2 rounded-lg border border-stone-300 bg-white text-xs font-bold text-stone-700 hover:text-[#C81E2B] hover:border-stone-400 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sair</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => onNavigate('/entrar')}
                  className="px-4 py-2 rounded-lg bg-[#C81E2B] hover:bg-[#A11622] text-white text-sm font-bold transition-colors whitespace-nowrap shrink-0"
                >
                  Entrar
                </button>
              </div>
            )}
          </div>

          {/* Mobile menu toggle */}
          <div className="flex lg:hidden items-center gap-3 shrink-0">
            {user && statusInfo && (
              <span className={`text-xs font-bold tabular-nums ${statusInfo.tone}`}>
                {statusInfo.label}
              </span>
            )}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2.5 rounded-lg text-stone-700 hover:bg-stone-100 transition-colors"
              aria-label="Abrir menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-stone-200 bg-white px-4 pt-3 pb-5 space-y-1.5">
          {user && (
            <div className="px-3 py-2.5 mb-2 border-b border-stone-200 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-[#141619]">{user.name}</p>
                <p className="text-xs text-stone-500 tabular-nums">{user.member_number}</p>
              </div>
              {statusInfo && (
                <span className={`text-xs font-bold tabular-nums ${statusInfo.tone}`}>
                  {statusInfo.label}
                </span>
              )}
            </div>
          )}

          {navLinks.map((link) => {
            const active = currentPath === link.path;
            return (
              <button
                key={link.path}
                type="button"
                onClick={() => {
                  onNavigate(link.path);
                  setMobileMenuOpen(false);
                }}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  active
                    ? 'bg-stone-100 text-[#141619] font-bold'
                    : 'text-stone-700 font-medium hover:bg-stone-50'
                }`}
              >
                {link.name}
              </button>
            );
          })}

          <div className="pt-3 mt-2 border-t border-stone-200">
            {user ? (
              <button
                type="button"
                onClick={() => {
                  onLogout();
                  setMobileMenuOpen(false);
                }}
                className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-bold text-[#C81E2B] hover:bg-red-50 flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                <span>Terminar Sessão</span>
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    onNavigate('/entrar');
                    setMobileMenuOpen(false);
                  }}
                  className="w-full text-center py-2.5 px-3 rounded-lg border border-stone-300 bg-white text-sm font-bold text-stone-800"
                >
                  Entrar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onNavigate('/registar');
                    setMobileMenuOpen(false);
                  }}
                  className="w-full text-center py-2.5 px-3 rounded-lg bg-[#C81E2B] text-white text-sm font-bold"
                >
                  Fazer-se Sócio
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
