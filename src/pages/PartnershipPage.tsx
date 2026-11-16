import React, { useState } from 'react';
import {
  HeartHandshake,
  ShieldCheck,
  BadgePercent,
  Users,
  CheckCircle2,
  AlertCircle,
  Send,
  QrCode,
  FileCheck,
  Megaphone,
  ArrowLeft,
  Upload,
  ImagePlus,
  X,
  Printer,
  Download,
  Copy,
  Check,
  FileText,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import partnershipStreetImg from '../assets/images/partnership_corporate_alliance_1794510456114.jpg';
import { LpcsLogo } from '../components/LpcsLogo.tsx';

interface PartnershipPageProps {
  onNavigate: (path: string) => void;
}

export const PartnershipPage: React.FC<PartnershipPageProps> = ({ onNavigate }) => {
  const todayIso = new Date().toISOString().split('T')[0];
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [formData, setFormData] = useState({
    company_name: '',
    nif: '',
    address: '',
    contact_name: '',
    contact_role: '',
    email: '',
    phone: '',
    partner_password: '',
    area: 'Saúde e Bem-estar',
    district: 'Lisboa',
    city: '',
    benefit_type: 'codigo',
    code_mode: 'rotativo',
    proposed_code: '',
    max_uses: '4',
    protocol_duration: 'um ano',
    valid_until: '',
    proposed_benefit: '',
    website: '',
    notes: '',
  });

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [serviceImages, setServiceImages] = useState<Array<{ file: File; preview: string }>>([]);

  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const companyAdvantages = [
    {
      num: '01',
      icon: HeartHandshake,
      title: 'Responsabilidade Social e Selo LPCS',
      subtitle: 'Selo Oficial LPCS',
      desc: 'Associe a sua marca a uma Instituição Particular de Solidariedade Social (IPSS) e Pessoa Coletiva de Utilidade Pública com mais de 35 anos de trabalho na prevenção do VIH/SIDA e defesa dos direitos humanos.',
      highlights: [
        'Selo digital e físico "Empresa Parceira Solidária LPCS"',
        'Reforço comprovado nos relatórios de sustentabilidade e ESG',
      ],
    },
    {
      num: '02',
      icon: Megaphone,
      title: 'Visibilidade Direta e Novos Clientes',
      subtitle: 'Alcance Nacional',
      desc: 'A sua empresa entra imediatamente no catálogo público e pesquisável da LPCS, com filtros por distrito, localidade e área de atividade.',
      highlights: [
        'Destaque em campanhas sazonais e newsletters para sócios',
        'Fluxo recorrente de clientes fidelizados pela causa',
      ],
    },
    {
      num: '03',
      icon: FileCheck,
      title: 'Enquadramento Fiscal e Mecenato',
      subtitle: 'Estatuto EBF',
      desc: 'As empresas que complementem a parceria com donativos ou patrocínios a projetos comunitários beneficiam do enquadramento previsto no Estatuto dos Benefícios Fiscais.',
      highlights: [
        'Declarações oficiais para efeitos de dedução em IRC',
        'Apoio direto a rastreios gratuitos e linhas de apoio social',
      ],
    },
    {
      num: '04',
      icon: ShieldCheck,
      title: 'Zero Custos de Adesão e Anti-Abuso',
      subtitle: 'Segurança HMAC-SHA256',
      desc: 'A adesão ao catálogo de benefícios da LPCS não tem qualquer taxa ou comissão. O sistema garante que apenas sócios com quota em dia acedem ao desconto.',
      highlights: [
        'Códigos rotativos de 6 dígitos que mudam a cada 30 segundos',
        'Validador comercial simples (/validar) contra capturas de ecrã',
      ],
    },
    {
      num: '05',
      icon: BadgePercent,
      title: 'Flexibilidade Total no Desconto',
      subtitle: 'À Sua Medida',
      desc: 'A empresa define livremente o benefício que melhor protege a sua margem comercial, o limite de utilizações e os termos aplicáveis.',
      highlights: [
        'Cupão promocional (valor fixo em € com nº máximo de usos)',
        'Código de desconto (% contínua) ou Voucher nominal (uso único)',
      ],
    },
    {
      num: '06',
      icon: Users,
      title: 'Ações de Saúde e Bem-Estar na Empresa',
      subtitle: 'Equipas Saudáveis',
      desc: 'Os parceiros podem solicitar ações de sensibilização, literacia em saúde, prevenção e testes rápidos confidenciais promovidos pelas equipas técnicas da LPCS.',
      highlights: [
        'Workshops de bem-estar e prevenção para colaboradores',
        'Cultura organizacional inclusiva e informada',
      ],
    },
  ];

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('O ficheiro do logótipo excede o limite máximo de 5 MB.');
      return;
    }
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
    setErrorMsg(null);
  };

  const handleServiceImagesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []);
    if (picked.length === 0) return;

    const remainingSlots = 4 - serviceImages.length;
    if (remainingSlots <= 0) {
      setErrorMsg('Pode anexar no máximo 4 imagens ilustrativas dos serviços.');
      return;
    }

    const validToAdd: Array<{ file: File; preview: string }> = [];
    for (const f of picked.slice(0, remainingSlots)) {
      if (f.size > 5 * 1024 * 1024) {
        setErrorMsg(`A imagem "${f.name}" excede o limite de 5 MB.`);
        continue;
      }
      validToAdd.push({ file: f, preview: URL.createObjectURL(f) });
    }
    setServiceImages((prev) => [...prev, ...validToAdd]);
    e.target.value = '';
  };

  const removeServiceImage = (idx: number) => {
    setServiceImages((prev) => {
      const target = prev[idx];
      if (target) URL.revokeObjectURL(target.preview);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!formData.valid_until || formData.valid_until.trim() === '') {
      setErrorMsg('É obrigatório indicar a data de validade da parceria.');
      return;
    }

    if (formData.valid_until < todayIso) {
      setErrorMsg('A data de validade da parceria deve ser igual ou posterior à data atual.');
      return;
    }

    if (!logoFile) {
      setErrorMsg('É obrigatório submeter o logótipo da entidade parceira (PNG, JPG, WEBP ou SVG).');
      return;
    }

    setSubmitting(true);

    try {
      const payload = new FormData();
      Object.entries(formData).forEach(([key, val]) => {
        payload.append(key, val);
      });
      payload.append('logo', logoFile);
      serviceImages.forEach((item) => {
        payload.append('service_images', item.file);
      });

      const res = await fetch('/api/partners/inquiry', {
        method: 'POST',
        credentials: 'same-origin',
        body: payload,
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Erro ao enviar proposta.');
        setSubmitting(false);
        return;
      }

      setSuccessMsg(data.message);
      setSubmitting(false);
      setFormData({
        company_name: '',
        nif: '',
        address: '',
        contact_name: '',
        contact_role: '',
        email: '',
        phone: '',
        partner_password: '',
        area: 'Saúde e Bem-estar',
        district: 'Lisboa',
        city: '',
        benefit_type: 'codigo',
        code_mode: 'rotativo',
        proposed_code: '',
        max_uses: '4',
        protocol_duration: 'um ano',
        valid_until: '',
        proposed_benefit: '',
        website: '',
        notes: '',
      });
      if (logoPreview) URL.revokeObjectURL(logoPreview);
      serviceImages.forEach((item) => URL.revokeObjectURL(item.preview));
      setLogoFile(null);
      setLogoPreview(null);
      setServiceImages([]);
      confetti({
        particleCount: 90,
        spread: 65,
        origin: { y: 0.6 },
      });
      if (data.redirect) {
        onNavigate(data.redirect);
      }
    } catch (err) {
      console.error('Inquiry submit error:', err);
      setErrorMsg('Falha de ligação ao servidor. Tente novamente.');
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-16">
      <div>
        <button
          type="button"
          onClick={() => onNavigate('/')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 hover:text-[#141619] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar à Página Inicial</span>
        </button>
      </div>

      {/* Marquee Hero */}
      <section className="relative rounded-2xl overflow-hidden bg-[#141619] border border-stone-800">
        {!heroImgFailed && (
          <img
            src={partnershipStreetImg}
            alt="Empresas e estabelecimentos parceiros da Liga Portuguesa Contra a SIDA"
            referrerPolicy="no-referrer"
            onError={() => setHeroImgFailed(true)}
            className="w-full h-[360px] sm:h-[420px] object-cover opacity-55"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#141619] via-[#141619]/75 to-[#141619]/35" />
        <div className="absolute inset-0 p-6 sm:p-12 flex flex-col justify-end">
          <div className="max-w-3xl space-y-4">
            <div className="font-condensed text-xs font-bold uppercase tracking-[0.16em] text-rose-300">
              Liga em Rede · Rede de Empresas Parceiras LPCS · Adesão Gratuita
            </div>
            <h1 className="font-display text-3xl sm:text-5xl font-bold text-white tracking-tight leading-tight text-balance">
              Quero fazer parceria com a Liga Portuguesa Contra a SIDA
            </h1>
            <p className="text-sm sm:text-base font-light text-stone-200 leading-relaxed max-w-2xl">
              Junte a sua empresa às organizações portuguesas que promovem vantagens reais para os associados, ganham visibilidade junto de um público fidelizado e reforçam o seu compromisso social e ESG.
            </p>
            <div className="pt-2 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  document.getElementById('partner-form')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="px-6 py-3 rounded-lg bg-[#C81E2B] hover:bg-[#A11622] text-white font-semibold text-sm transition-colors"
              >
                Submeter Proposta de Parceria
              </button>
              <button
                type="button"
                onClick={() => onNavigate('/parceiros')}
                className="px-6 py-3 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold text-sm border border-white/20 transition-colors"
              >
                Ver Parceiros Atuais (28)
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 6 Core Advantages */}
      <section className="space-y-8">
        <div className="max-w-2xl space-y-2">
          <div className="font-condensed text-xs font-bold uppercase tracking-[0.16em] text-[#C81E2B]">
            Benefícios para Empresas Colaboradoras
          </div>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#141619] tracking-tight">
            Todas as vantagens de ser Empresa Parceira LPCS
          </h2>
          <p className="text-sm font-light text-stone-600 leading-relaxed">
            Uma colaboração estruturada para gerar retorno comercial, reputação social e segurança tecnológica total na validação dos descontos.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {companyAdvantages.map((adv) => {
            const Icon = adv.icon;
            return (
              <div
                key={adv.title}
                className="bg-white rounded-xl p-6 sm:p-7 border border-stone-200 flex flex-col justify-between space-y-6"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-stone-500">
                    <span className="font-medium">{adv.num} · {adv.subtitle}</span>
                    <Icon className="w-5 h-5 text-[#C81E2B]" />
                  </div>
                  <h3 className="font-display text-xl font-semibold text-[#141619]">{adv.title}</h3>
                  <p className="text-sm text-stone-600 leading-relaxed">{adv.desc}</p>
                </div>

                <ul className="pt-4 border-t border-stone-100 space-y-2">
                  {adv.highlights.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-xs text-stone-700 font-medium">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3-Step Merchant Workflow */}
      <section className="bg-white rounded-2xl p-8 sm:p-10 border border-stone-200">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-4 space-y-3">
            <div className="font-condensed text-xs font-bold uppercase tracking-[0.16em] text-[#C81E2B]">
              Operação ao Balcão
            </div>
            <h3 className="font-display text-2xl font-bold text-[#141619]">
              Como funciona na sua loja física ou online?
            </h3>
            <p className="text-sm font-light text-stone-600 leading-relaxed">
              Sem terminais dedicados nem integrações complexas. Todo o processo demora menos de 10 segundos no nosso validador web.
            </p>
            <button
              type="button"
              onClick={() => onNavigate('/validar')}
              className="inline-flex items-center gap-2 text-xs font-semibold text-[#C81E2B] hover:text-[#A11622] pt-1"
            >
              <QrCode className="w-4 h-4" />
              <span>Abrir Validador de Comerciantes →</span>
            </button>
          </div>

          <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-5 border-t lg:border-t-0 lg:border-l border-stone-200 pt-6 lg:pt-0 lg:pl-8">
            <div className="space-y-2">
              <div className="font-mono text-xs font-bold text-[#C81E2B]">01</div>
              <h4 className="font-semibold text-sm text-[#141619]">Sócio apresenta o código</h4>
              <p className="text-xs text-stone-600 leading-relaxed">
                O associado com quota ativa gera no telemóvel uma referência e um código de 6 dígitos que roda a cada 30 segundos.
              </p>
            </div>

            <div className="space-y-2">
              <div className="font-mono text-xs font-bold text-[#C81E2B]">02</div>
              <h4 className="font-semibold text-sm text-[#141619]">Equipa valida em /validar</h4>
              <p className="text-xs text-stone-600 leading-relaxed">
                O colaborador confirma a autenticidade e a titularidade em segundos, impedindo reutilização de capturas de ecrã.
              </p>
            </div>

            <div className="space-y-2">
              <div className="font-mono text-xs font-bold text-emerald-700">03</div>
              <h4 className="font-semibold text-sm text-[#141619]">Desconto aplicado</h4>
              <p className="text-xs text-stone-600 leading-relaxed">
                O código fica marcado como consumido na hora e a sua empresa fideliza um novo cliente solidário.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Proposal Form */}
      <section id="partner-form" className="bg-white rounded-2xl p-6 sm:p-10 border border-stone-200 max-w-4xl mx-auto">
        <div className="space-y-2 mb-8 border-b border-stone-100 pb-6">
          <div className="font-condensed text-xs font-bold uppercase tracking-[0.16em] text-[#C81E2B]">
            Adesão Gratuita ao Programa
          </div>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#141619] tracking-tight">
            Proposta de Parceria Empresarial
          </h2>
          <p className="text-sm font-light text-stone-600">
            Preencha os dados da empresa e o benefício proposto. A equipa da LPCS responderá em até 48 horas úteis.
          </p>
        </div>

        {successMsg && (
          <div className="mb-6 p-5 bg-emerald-50 border border-emerald-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-sm text-emerald-900">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-semibold">Registo de Parceria Concluído</strong>
                <span>{successMsg}</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onNavigate('/validar')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#C81E2B] hover:bg-[#A11622] text-white text-xs font-semibold transition-colors"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Aceder à Área Privada (Ver Protocolo)</span>
              </button>
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-sm text-red-800">
            <AlertCircle className="w-5 h-5 text-[#C81E2B] shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                Nome da Empresa / Marca (Segundo Outorgante) *
              </label>
              <input
                type="text"
                required
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                placeholder="Ex: Clínica Saúde Atlântico, Lda."
                className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 bg-[#FAF8F5]/50 text-sm focus:outline-hidden focus:bg-white focus:border-[#C81E2B] focus:ring-1 focus:ring-[#C81E2B]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                Pessoa Coletiva Nº / NIPC da Empresa *
              </label>
              <input
                type="text"
                required
                maxLength={9}
                value={formData.nif}
                onChange={(e) => setFormData({ ...formData, nif: e.target.value.replace(/\D/g, '') })}
                placeholder="500123456"
                className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 bg-[#FAF8F5]/50 font-mono text-sm tabular-nums focus:outline-hidden focus:bg-white focus:border-[#C81E2B]"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                Morada da Sede (Segundo Outorgante) *
              </label>
              <input
                type="text"
                required
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Ex: Av. da Liberdade, nº 120, 1250-146 Lisboa"
                className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 bg-[#FAF8F5]/50 text-sm focus:outline-hidden focus:bg-white focus:border-[#C81E2B]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                Nome do Representante (Segundo Outorgante) *
              </label>
              <input
                type="text"
                required
                value={formData.contact_name}
                onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                placeholder="Nome completo de quem assina o protocolo"
                className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 bg-[#FAF8F5]/50 text-sm focus:outline-hidden focus:bg-white focus:border-[#C81E2B]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                Cargo do Representante *
              </label>
              <input
                type="text"
                required
                value={formData.contact_role}
                onChange={(e) => setFormData({ ...formData, contact_role: e.target.value })}
                placeholder="Ex: Gerente, Administrador(a) ou Diretor(a) Geral"
                className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 bg-[#FAF8F5]/50 text-sm focus:outline-hidden focus:bg-white focus:border-[#C81E2B]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                E-mail Corporativo *
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="parcerias@empresa.pt"
                className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 bg-[#FAF8F5]/50 text-sm focus:outline-hidden focus:bg-white focus:border-[#C81E2B]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                Telefone / Telemóvel *
              </label>
              <input
                type="text"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="912345678 ou 210000000"
                className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 bg-[#FAF8F5]/50 font-mono text-sm tabular-nums focus:outline-hidden focus:bg-white focus:border-[#C81E2B]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                Palavra-passe de Acesso à Área Privada da Empresa *
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={formData.partner_password}
                onChange={(e) => setFormData({ ...formData, partner_password: e.target.value })}
                placeholder="Mínimo de 6 carateres"
                className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 bg-[#FAF8F5]/50 text-sm focus:outline-hidden focus:bg-white focus:border-[#C81E2B]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                Área de Atividade *
              </label>
              <select
                value={formData.area}
                onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 bg-white text-sm focus:outline-hidden focus:border-[#C81E2B]"
              >
                <option value="Saúde e Bem-estar">Saúde e Bem-estar</option>
                <option value="Desporto">Desporto</option>
                <option value="Lazer e Cultura">Lazer e Cultura</option>
                <option value="Restauração e Alimentação">Restauração e Alimentação</option>
                <option value="Formação e Educação">Formação e Educação</option>
                <option value="Serviços">Serviços</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                Distrito / Abrangência *
              </label>
              <input
                type="text"
                required
                value={formData.district}
                onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                placeholder="Lisboa, Porto, Coimbra, Nacional..."
                className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 bg-[#FAF8F5]/50 text-sm focus:outline-hidden focus:bg-white focus:border-[#C81E2B]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                Localidade / Online *
              </label>
              <input
                type="text"
                required
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="Ex: Lisboa ou Online"
                className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 bg-[#FAF8F5]/50 text-sm focus:outline-hidden focus:bg-white focus:border-[#C81E2B]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                Formato de Benefício *
              </label>
              <select
                value={formData.benefit_type}
                onChange={(e) => {
                  const val = e.target.value;
                  setFormData({
                    ...formData,
                    benefit_type: val,
                    max_uses: val === 'voucher' ? '1' : formData.max_uses,
                  });
                }}
                className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 bg-white text-sm focus:outline-hidden focus:border-[#C81E2B]"
              >
                <option value="codigo">Código de Desconto (% contínua)</option>
                <option value="cupao">Cupão Promocional (valor fixo € com limite)</option>
                <option value="voucher">Voucher Nominal (oferta / uso único)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                Data de Validade da Parceria *
              </label>
              <input
                type="date"
                required
                min={todayIso}
                value={formData.valid_until}
                onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 bg-[#FAF8F5]/50 font-mono text-sm tabular-nums focus:outline-hidden focus:bg-white focus:border-[#C81E2B]"
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {[
                  {
                    label: '+6 Meses',
                    getVal: () => {
                      const d = new Date();
                      d.setMonth(d.getMonth() + 6);
                      return d.toISOString().split('T')[0];
                    },
                  },
                  {
                    label: '+1 Ano',
                    getVal: () => {
                      const d = new Date();
                      d.setFullYear(d.getFullYear() + 1);
                      return d.toISOString().split('T')[0];
                    },
                  },
                  {
                    label: '+2 Anos',
                    getVal: () => {
                      const d = new Date();
                      d.setFullYear(d.getFullYear() + 2);
                      return d.toISOString().split('T')[0];
                    },
                  },
                  {
                    label: '31/12/2027',
                    getVal: () => '2027-12-31',
                  },
                ].map((preset) => {
                  const targetDate = preset.getVal();
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setFormData({ ...formData, valid_until: targetDate })}
                      className={`px-2.5 py-1 rounded text-[11px] font-semibold border transition-colors ${
                        formData.valid_until === targetDate
                          ? 'bg-[#141619] text-white border-[#141619]'
                          : 'bg-white text-stone-600 border-stone-300 hover:border-stone-400'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                Duração do Protocolo (Cláusula 4.ª — Vigência) *
              </label>
              <input
                type="text"
                required
                value={formData.protocol_duration}
                onChange={(e) => setFormData({ ...formData, protocol_duration: e.target.value })}
                placeholder="Ex: um ano, 6 meses, dois anos..."
                className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 bg-[#FAF8F5]/50 text-sm focus:outline-hidden focus:bg-white focus:border-[#C81E2B]"
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {['6 meses', 'um ano', 'dois anos', 'três anos'].map((dur) => (
                  <button
                    key={dur}
                    type="button"
                    onClick={() => setFormData({ ...formData, protocol_duration: dur })}
                    className={`px-2.5 py-1 rounded text-[11px] font-semibold border transition-colors ${
                      formData.protocol_duration === dur
                        ? 'bg-[#141619] text-white border-[#141619]'
                        : 'bg-white text-stone-600 border-stone-300 hover:border-stone-400'
                    }`}
                  >
                    {dur}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                Website da Empresa (Opcional)
              </label>
              <input
                type="text"
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                placeholder="https://www.empresa.pt"
                className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 bg-[#FAF8F5]/50 text-sm focus:outline-hidden focus:bg-white focus:border-[#C81E2B]"
              />
            </div>

            {/* Code Mode & Allowed Uses Configuration */}
            <div className="sm:col-span-2 p-4 sm:p-5 rounded-xl bg-[#FAF8F5] border border-stone-200 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#141619] mb-1.5">
                    Modo de Utilização do Código *
                  </label>
                  <select
                    value={formData.code_mode}
                    onChange={(e) => setFormData({ ...formData, code_mode: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 bg-white text-sm focus:outline-hidden focus:border-[#C81E2B]"
                  >
                    <option value="rotativo">
                      Código Rotativo de 6 dígitos + QR Code (validação em /validar)
                    </option>
                    <option value="codigo_unico">
                      Código Único para todos os associados (exibido ao clicar em Obter Código)
                    </option>
                  </select>
                  <p className="text-[11px] text-stone-500 mt-1">
                    {formData.code_mode === 'codigo_unico'
                      ? 'Basta aparecer o código único aos associados quando clicam em "Obter Código Seguro".'
                      : 'Gera um código dinâmico de 6 dígitos e QR Code para validação ao balcão.'}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#141619] mb-1.5">
                    Nº de Utilizações Possíveis (por Associado) *
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={999}
                      value={formData.max_uses}
                      onChange={(e) => setFormData({ ...formData, max_uses: e.target.value })}
                      placeholder="Ex: 4 (0 ou vazio = ilimitado)"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 bg-white font-mono text-sm tabular-nums focus:outline-hidden focus:border-[#C81E2B]"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {[
                      { label: '1 uso', val: '1' },
                      { label: '3 usos', val: '3' },
                      { label: '6 usos', val: '6' },
                      { label: '12 usos', val: '12' },
                      { label: 'Ilimitado', val: '' },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => setFormData({ ...formData, max_uses: preset.val })}
                        className={`px-2.5 py-1 rounded text-[11px] font-semibold border transition-colors ${
                          formData.max_uses === preset.val
                            ? 'bg-[#141619] text-white border-[#141619]'
                            : 'bg-white text-stone-600 border-stone-300 hover:border-stone-400'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {formData.code_mode === 'codigo_unico' && (
                <div className="pt-2 border-t border-stone-200/80">
                  <label className="block text-xs font-bold text-[#141619] mb-1">
                    Código Único a apresentar aos Associados (Opcional)
                  </label>
                  <input
                    type="text"
                    value={formData.proposed_code}
                    onChange={(e) =>
                      setFormData({ ...formData, proposed_code: e.target.value.toUpperCase() })
                    }
                    placeholder="Ex: LPCS2026 ou PARCEIRO20"
                    className="w-full sm:w-72 px-3.5 py-2 rounded-lg border border-stone-300 bg-white font-mono text-sm uppercase focus:outline-hidden focus:border-[#C81E2B]"
                  />
                </div>
              )}
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                Desconto ou Condição Proposta *
              </label>
              <input
                type="text"
                required
                value={formData.proposed_benefit}
                onChange={(e) => setFormData({ ...formData, proposed_benefit: e.target.value })}
                placeholder="Ex: 20% de desconto em todos os serviços ou 1ª consulta gratuita"
                className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 bg-[#FAF8F5]/50 text-sm focus:outline-hidden focus:bg-white focus:border-[#C81E2B]"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                Observações / Interesse em Ações de Sensibilização ou Mecenato
              </label>
              <textarea
                rows={3}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Indique se pretende também organizar ações de prevenção na empresa, receber o selo de Empresa Solidária ou obter informações sobre mecenato fiscal."
                className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 bg-[#FAF8F5]/50 text-sm focus:outline-hidden focus:bg-white focus:border-[#C81E2B]"
              />
            </div>

            {/* Mandatory Logo Upload */}
            <div className="sm:col-span-2 p-4 sm:p-5 rounded-xl bg-[#FAF8F5] border border-stone-200 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <label className="block text-xs font-bold text-[#141619]">
                    Logótipo Oficial da Entidade Parceira *
                  </label>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Obrigatório para exibição no catálogo de parceiros (PNG, JPG, WEBP ou SVG · máx. 5 MB).
                  </p>
                </div>
                {logoFile && (
                  <button
                    type="button"
                    onClick={() => {
                      if (logoPreview) URL.revokeObjectURL(logoPreview);
                      setLogoFile(null);
                      setLogoPreview(null);
                    }}
                    className="text-xs font-semibold text-[#C81E2B] hover:text-[#A11622] self-start sm:self-center"
                  >
                    Remover logótipo
                  </button>
                )}
              </div>

              {logoPreview ? (
                <div className="flex items-center gap-4 bg-white p-3 rounded-lg border border-stone-200">
                  <img
                    src={logoPreview}
                    alt="Pré-visualização do logótipo"
                    className="w-16 h-16 rounded-lg border border-stone-200 object-contain p-1 bg-white shrink-0"
                  />
                  <div className="min-w-0 flex-1 text-xs">
                    <strong className="text-[#141619] block truncate">{logoFile?.name}</strong>
                    <span className="text-stone-500 tabular-nums">
                      {logoFile ? `${(logoFile.size / 1024).toFixed(1)} KB` : ''}
                    </span>
                  </div>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2.5 px-4 py-5 rounded-lg border border-dashed border-stone-300 bg-white hover:border-[#C81E2B] cursor-pointer transition-colors text-xs font-semibold text-stone-700">
                  <Upload className="w-4 h-4 text-[#C81E2B]" />
                  <span>Selecionar ficheiro do logótipo *</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={handleLogoChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {/* Optional Service Images Upload */}
            <div className="sm:col-span-2 p-4 sm:p-5 rounded-xl bg-[#FAF8F5] border border-stone-200 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <label className="block text-xs font-bold text-[#141619]">
                    Imagens Ilustrativas dos Serviços (Opcional)
                  </label>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Até 4 fotografias do espaço, equipa ou serviços para enriquecer o cartão no catálogo (PNG, JPG ou WEBP).
                  </p>
                </div>
                <span className="text-xs font-mono text-stone-500 tabular-nums shrink-0">
                  {serviceImages.length} / 4
                </span>
              </div>

              {serviceImages.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {serviceImages.map((item, idx) => (
                    <div
                      key={`${item.file.name}-${idx}`}
                      className="relative aspect-[4/3] rounded-lg overflow-hidden border border-stone-200 bg-white"
                    >
                      <img
                        src={item.preview}
                        alt={item.file.name}
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeServiceImage(idx)}
                        aria-label="Remover imagem"
                        className="absolute top-1.5 right-1.5 p-1 rounded-full bg-[#141619]/80 text-white hover:bg-[#C81E2B]"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {serviceImages.length < 4 && (
                <label className="flex items-center justify-center gap-2 px-4 py-3.5 rounded-lg border border-dashed border-stone-300 bg-white hover:border-stone-500 cursor-pointer transition-colors text-xs font-medium text-stone-600">
                  <ImagePlus className="w-4 h-4 text-stone-500" />
                  <span>Adicionar imagens ilustrativas dos serviços (opcional)</span>
                  <input
                    type="file"
                    multiple
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleServiceImagesChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {/* Private Area Protocol Notice */}
            <div className="sm:col-span-2 p-4 sm:p-5 rounded-xl bg-[#FAF8F5] border border-stone-200 flex items-start gap-3 text-xs text-stone-700">
              <ShieldCheck className="w-4 h-4 text-[#C81E2B] shrink-0 mt-0.5" />
              <div className="space-y-1 leading-relaxed">
                <strong className="font-semibold text-[#141619] block">
                  Acesso ao Protocolo na Área Privada da Entidade Parceira
                </strong>
                <p>
                  Ao concluir o registo, terá acesso imediato à sua <strong>Área Privada de Entidade Parceira</strong>, onde se encontra disponível o <strong>Protocolo de Cooperação “A LIGA EM REDE”</strong> automaticamente preenchido com as informações fornecidas (e editável), para assinatura e upload.
                </p>
                <p>
                  <strong>Entrada em Vigor:</strong> A parceria entra em vigor quando o protocolo for assinado por parte da LPCS e quando a LPCS colocar o protocolo assinado por ambas as partes na área privada da entidade parceira.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="px-7 py-3 rounded-lg bg-[#C81E2B] hover:bg-[#A11622] text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>A registar parceria...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Concluir Registo e Aceder à Área Privada</span>
                </>
              )}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
};
