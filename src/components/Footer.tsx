import React from 'react';
import { Phone, Mail, MapPin, ShieldCheck, Globe } from 'lucide-react';
import { LpcsLogo } from './LpcsLogo.tsx';

export const Footer: React.FC<{ onNavigate: (path: string) => void }> = ({ onNavigate }) => {
  return (
    <footer className="bg-[#141619] text-stone-300 border-t border-stone-800 mt-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 lg:gap-12">
          {/* Column 1: Official Institutional Identification */}
          <div className="md:col-span-5 space-y-5">
            <div className="flex items-center gap-3.5">
              <LpcsLogo variant="light" className="h-16 w-auto rounded-lg bg-white" />
              <div className="border-l border-stone-800 pl-3.5">
                <span className="font-display text-lg font-bold text-white tracking-tight block">
                  Liga em Rede
                </span>
                <span className="font-condensed text-[11px] font-bold uppercase tracking-[0.14em] text-rose-400 block">
                  Plataforma LPCS
                </span>
              </div>
            </div>

            <p className="text-sm font-light text-stone-300 leading-relaxed max-w-md">
              <strong className="font-bold text-white">Liga em Rede</strong> é a plataforma oficial de associados e parceiros da <strong className="font-bold text-white">Liga Portuguesa Contra a SIDA (LPCS)</strong> — Instituição Particular de Solidariedade Social (IPSS) e Pessoa Coletiva de Utilidade Pública constituída em outubro de 1990.
            </p>

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-stone-800 text-xs">
              <div>
                <dt className="font-condensed uppercase tracking-wider text-stone-500 font-bold">
                  Denominação
                </dt>
                <dd className="text-stone-200 font-medium mt-0.5">
                  Liga Portuguesa Contra a SIDA
                </dd>
              </div>
              <div>
                <dt className="font-condensed uppercase tracking-wider text-stone-500 font-bold">
                  NIPC / NIF
                </dt>
                <dd className="text-white font-bold tabular-nums mt-0.5">502 665 548</dd>
              </div>
              <div>
                <dt className="font-condensed uppercase tracking-wider text-stone-500 font-bold">
                  Natureza Jurídica
                </dt>
                <dd className="text-stone-300 mt-0.5">IPSS · Utilidade Pública</dd>
              </div>
              <div>
                <dt className="font-condensed uppercase tracking-wider text-stone-500 font-bold">
                  Constituição
                </dt>
                <dd className="text-stone-300 tabular-nums mt-0.5">Outubro de 1990</dd>
              </div>
            </dl>
          </div>

          {/* Column 2: Portal Links */}
          <div className="md:col-span-3">
            <h4 className="font-condensed text-xs font-bold text-stone-400 uppercase tracking-wider mb-4">
              Liga em Rede
            </h4>
            <ul className="space-y-2.5 text-sm text-stone-300">
              <li>
                <button onClick={() => onNavigate('/')} className="hover:text-white transition-colors">
                  Início e Benefícios
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('/parceiros')} className="hover:text-white transition-colors">
                  Catálogo de Parceiros
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('/dashboard')} className="hover:text-white transition-colors">
                  Área Pessoal do Sócio
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('/pagamentos')} className="hover:text-white transition-colors">
                  Quotas e Recibos
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('/validar')} className="hover:text-white transition-colors">
                  Área de Parceiros (Validar)
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('/parceria')}
                  className="hover:text-white text-rose-400 font-bold transition-colors"
                >
                  Quero Fazer Parceria
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('/admin')}
                  className="hover:text-white text-stone-400 transition-colors"
                >
                  Gestão Administrativa
                </button>
              </li>
            </ul>
          </div>

          {/* Column 3: Official Contacts & Headquarters */}
          <div className="md:col-span-4">
            <h4 className="font-condensed text-xs font-bold text-stone-400 uppercase tracking-wider mb-4">
              Sede e Contactos Oficiais
            </h4>
            <ul className="space-y-3 text-sm text-stone-300">
              <li className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <span className="block font-bold text-white text-xs">Sede e Serviços Centrais</span>
                  <span>Praça Carlos Fabião, Loja 3A, 1600-316 Lisboa</span>
                </div>
              </li>
              <li className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-rose-400 shrink-0" />
                <span className="tabular-nums">
                  Telefone: +351 213 479 376 · Linha SOS SIDA: 800 20 10 40
                </span>
              </li>
              <li className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-rose-400 shrink-0" />
                <span>info@ligacontrasida.org</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Globe className="w-4 h-4 text-stone-400 shrink-0" />
                <span>www.ligacontrasida.org</span>
              </li>
              <li className="flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-xs text-stone-400">
                  Isento de IVA ao abrigo do art. 9.º do CIVA · RGPD
                </span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-stone-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-stone-500">
          <p>
            © {new Date().getFullYear()} Liga Portuguesa Contra a SIDA (NIPC 502 665 548). Todos os direitos reservados.
          </p>
          <div className="flex items-center gap-3 text-stone-400">
            <span>Lisboa · Portugal</span>
            <span aria-hidden="true">·</span>
            <span>IPSS · Utilidade Pública</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
