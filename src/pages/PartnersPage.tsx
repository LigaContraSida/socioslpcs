import React, { useState, useEffect } from 'react';
import { Partner, PartnerServiceImage, User } from '../types.ts';
import { CodeModal } from '../components/CodeModal.tsx';
import {
  Search,
  MapPin,
  Lock,
  X,
  AlertCircle,
  Layers,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Maximize2,
} from 'lucide-react';

interface PartnersPageProps {
  user: User | null;
  initialQuery?: Record<string, string>;
  onNavigate: (path: string) => void;
}

export const PartnersPage: React.FC<PartnersPageProps> = ({ user, initialQuery, onNavigate }) => {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedArea, setSelectedArea] = useState<string>(initialQuery?.area || 'all');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('all');
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [selectedBenefitType, setSelectedBenefitType] = useState<string>('all');
  const [search, setSearch] = useState<string>(initialQuery?.search || '');

  const [filterMeta, setFilterMeta] = useState<{
    areaCounts: Record<string, number>;
    districts: string[];
    citiesByDistrict: Record<string, string[]>;
  }>({
    areaCounts: {},
    districts: [],
    citiesByDistrict: {},
  });

  const [redemptionData, setRedemptionData] = useState<any | null>(null);
  const [redeemLoadingId, setRedeemLoadingId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Per-card active service image index & broken image fallbacks
  const [activeImageIdx, setActiveImageIdx] = useState<Record<number, number>>({});
  const [failedLogos, setFailedLogos] = useState<Record<number, boolean>>({});
  const [failedServiceImgs, setFailedServiceImgs] = useState<Record<number, boolean>>({});
  const [lightboxData, setLightboxData] = useState<{
    partner: Partner;
    images: PartnerServiceImage[];
    index: number;
  } | null>(null);

  const fetchPartners = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (selectedArea !== 'all') params.set('area', selectedArea);
    if (selectedDistrict !== 'all') params.set('district', selectedDistrict);
    if (selectedCity !== 'all') params.set('city', selectedCity);
    if (selectedBenefitType !== 'all') params.set('benefit_type', selectedBenefitType);
    if (search.trim()) params.set('search', search.trim());

    fetch(`/api/partners?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        setPartners(data.partners || []);
        if (data.filterMeta) {
          setFilterMeta(data.filterMeta);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load partners:', err);
        setError('Não foi possível carregar os parceiros. Tente recarregar a página.');
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchPartners();
  }, [selectedArea, selectedDistrict, selectedCity, selectedBenefitType]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPartners();
  };

  const handleClearFilters = () => {
    setSelectedArea('all');
    setSelectedDistrict('all');
    setSelectedCity('all');
    setSelectedBenefitType('all');
    setSearch('');
  };

  const hasActiveFilters =
    selectedArea !== 'all' ||
    selectedDistrict !== 'all' ||
    selectedCity !== 'all' ||
    selectedBenefitType !== 'all' ||
    search.trim() !== '';

  const handleRedeem = async (partnerId: number) => {
    setActionError(null);
    if (!user) {
      onNavigate('/entrar');
      return;
    }
    if (!user.quota_status.has_active_quota) {
      onNavigate('/pagamentos');
      return;
    }

    setRedeemLoadingId(partnerId);

    try {
      const res = await fetch('/api/benefits/redeem', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partner_id: partnerId }),
      });
      const data = await res.json();

      if (!res.ok) {
        setActionError(data.error || 'Erro ao gerar código');
        setRedeemLoadingId(null);
        fetchPartners();
        return;
      }

      setRedemptionData(data);
      setRedeemLoadingId(null);
      fetchPartners();
    } catch (err) {
      console.error('Error redeeming benefit:', err);
      setActionError('Ocorreu uma falha de rede ao gerar o código.');
      setRedeemLoadingId(null);
    }
  };

  const areaList = [
    'Saúde e Bem-estar',
    'Desporto',
    'Lazer e Cultura',
    'Restauração e Alimentação',
    'Formação e Educação',
    'Serviços',
  ];

  const hasQuota = user?.quota_status?.has_active_quota || false;
  const totalCount = Object.values(filterMeta.areaCounts).reduce((a, b) => a + b, 0) || 28;

  const getBenefitLabel = (type: string) => {
    if (type === 'cupao') return 'Cupão Promocional';
    if (type === 'voucher') return 'Voucher Nominal';
    return 'Código %';
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-stone-200 pb-6">
        <div className="space-y-2">
          <div className="font-condensed text-xs font-bold uppercase tracking-[0.16em] text-[#C81E2B]">
            Liga em Rede · Catálogo Oficial de Parcerias
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#141619] tracking-tight">
            Parceiros e Descontos Exclusivos
          </h1>
          <p className="text-sm font-light text-stone-600 max-w-2xl leading-relaxed">
            A lista de parceiros e descontos é pública. Os códigos rotativos de acesso são gerados exclusivamente para associados com a quota regularizada.
          </p>
        </div>

        {!hasQuota && (
          <div className="shrink-0">
            <button
              type="button"
              onClick={() => onNavigate(user ? '/pagamentos' : '/registar')}
              className="px-5 py-2.5 rounded-lg bg-[#C81E2B] hover:bg-[#A11622] text-white font-semibold text-sm transition-colors whitespace-nowrap"
            >
              {user ? 'Regularizar Quota (35 €)' : 'Fazer-se Sócio · 35 €/ano'}
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-sm text-red-800">
          <AlertCircle className="w-5 h-5 text-[#C81E2B] shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {actionError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-sm text-red-800">
          <AlertCircle className="w-5 h-5 text-[#C81E2B] shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Filter Controls */}
      <div className="bg-white rounded-xl p-5 sm:p-6 border border-stone-200 space-y-5">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Pesquisar por nome de parceiro, serviço, desconto ou localidade..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-stone-300 bg-[#FAF8F5]/60 text-sm text-[#141619] focus:outline-hidden focus:bg-white focus:border-[#C81E2B] focus:ring-1 focus:ring-[#C81E2B]"
            />
          </div>
          <button
            type="submit"
            className="px-5 py-2.5 rounded-lg bg-[#141619] hover:bg-stone-800 text-white text-sm font-semibold transition-colors whitespace-nowrap"
          >
            Filtrar
          </button>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="px-4 py-2.5 rounded-lg border border-stone-300 text-sm font-medium text-stone-700 hover:bg-stone-50 flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <X className="w-4 h-4" />
              <span>Limpar</span>
            </button>
          )}
        </form>

        {/* Segmented Area Filter Buttons */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-stone-500">Área de atividade</div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedArea('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap tabular-nums ${
                selectedArea === 'all'
                  ? 'bg-[#141619] text-white'
                  : 'bg-[#FAF8F5] border border-stone-200 text-stone-700 hover:border-stone-400'
              }`}
            >
              Todas ({totalCount})
            </button>
            {areaList.map((area) => {
              const count = filterMeta.areaCounts[area] || 0;
              const active = selectedArea === area;
              return (
                <button
                  type="button"
                  key={area}
                  onClick={() => setSelectedArea(active ? 'all' : area)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap tabular-nums ${
                    active
                      ? 'bg-[#C81E2B] text-white'
                      : 'bg-[#FAF8F5] border border-stone-200 text-stone-700 hover:border-stone-400'
                  }`}
                >
                  {area} · {count}
                </button>
              );
            })}
          </div>
        </div>

        {/* Location & Type Dropdowns */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-stone-100">
          <div>
            <label className="text-xs font-semibold text-stone-600 block mb-1.5">Distrito</label>
            <select
              value={selectedDistrict}
              onChange={(e) => {
                setSelectedDistrict(e.target.value);
                setSelectedCity('all');
              }}
              className="w-full py-2 px-3 rounded-lg border border-stone-300 bg-white text-sm text-[#141619] focus:outline-hidden focus:border-[#C81E2B]"
            >
              <option value="all">Todos os Distritos</option>
              {filterMeta.districts.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-stone-600 block mb-1.5">Localidade</label>
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              disabled={selectedDistrict === 'all'}
              className="w-full py-2 px-3 rounded-lg border border-stone-300 bg-white text-sm text-[#141619] disabled:opacity-50 focus:outline-hidden focus:border-[#C81E2B]"
            >
              <option value="all">
                {selectedDistrict === 'all' ? 'Escolha primeiro um distrito' : 'Todas as localidades'}
              </option>
              {selectedDistrict !== 'all' &&
                filterMeta.citiesByDistrict[selectedDistrict]?.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-stone-600 block mb-1.5">Tipo de Benefício</label>
            <select
              value={selectedBenefitType}
              onChange={(e) => setSelectedBenefitType(e.target.value)}
              className="w-full py-2 px-3 rounded-lg border border-stone-300 bg-white text-sm text-[#141619] focus:outline-hidden focus:border-[#C81E2B]"
            >
              <option value="all">Todos os Tipos</option>
              <option value="cupao">Cupão Promocional (valor fixo €)</option>
              <option value="codigo">Código de Desconto (% contínuo)</option>
              <option value="voucher">Voucher Nominal (uso único)</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-stone-500 pt-1 tabular-nums">
          <span>
            A apresentar <strong className="text-[#141619]">{partners.length}</strong> de {totalCount} parceiros
          </span>
          {hasActiveFilters && <span className="text-[#C81E2B] font-semibold">Filtros ativos</span>}
        </div>
      </div>

      {/* Partners Grid */}
      {loading ? (
        <div className="py-20 text-center text-stone-500 space-y-3">
          <div className="w-8 h-8 border-2 border-[#C81E2B] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm">A carregar catálogo de parceiros...</p>
        </div>
      ) : partners.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center border border-stone-200 space-y-4">
          <Layers className="w-10 h-10 text-stone-400 mx-auto" />
          <h3 className="font-display text-lg font-semibold text-[#141619]">Nenhum parceiro encontrado</h3>
          <p className="text-sm text-stone-500 max-w-sm mx-auto">
            Não existem parceiros com a combinação de filtros selecionada.
          </p>
          <button
            type="button"
            onClick={handleClearFilters}
            className="px-4 py-2 rounded-lg border border-stone-300 hover:bg-stone-50 text-xs font-semibold text-[#141619]"
          >
            Limpar Filtros
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {partners.map((partner) => {
            const isRedeeming = redeemLoadingId === partner.id;
            const visibleImages = (partner.service_images || []).filter(
              (img) => !failedServiceImgs[img.id]
            );
            const currentImgIdx = Math.min(
              activeImageIdx[partner.id] || 0,
              Math.max(0, visibleImages.length - 1)
            );
            const currentImage = visibleImages[currentImgIdx];
            const showLogoImg = Boolean(partner.logo_url && !failedLogos[partner.id]);
            const partnerInitials = partner.name
              .split(/\s+/)
              .filter(Boolean)
              .slice(0, 2)
              .map((w) => w[0]?.toUpperCase())
              .join('');

            return (
              <div
                key={partner.id}
                className="bg-white rounded-xl border border-stone-200 hover:border-stone-400 transition-colors flex flex-col justify-between overflow-hidden"
              >
                <div>
                  {/* Optional Illustrative Service Image(s) */}
                  {currentImage && (
                    <div className="relative aspect-[16/10] bg-stone-100 border-b border-stone-200/80 overflow-hidden group">
                      <img
                        src={currentImage.url}
                        alt={`Serviços de ${partner.name}`}
                        referrerPolicy="no-referrer"
                        onError={() =>
                          setFailedServiceImgs((prev) => ({ ...prev, [currentImage.id]: true }))
                        }
                        onClick={() =>
                          setLightboxData({
                            partner,
                            images: visibleImages,
                            index: currentImgIdx,
                          })
                        }
                        className="w-full h-full object-cover cursor-pointer transition-transform duration-300 group-hover:scale-[1.02]"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setLightboxData({
                            partner,
                            images: visibleImages,
                            index: currentImgIdx,
                          })
                        }
                        title="Ampliar imagem ilustrativa"
                        className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-[#141619]/70 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[#141619]"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                      </button>

                      {visibleImages.length > 1 && (
                        <>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveImageIdx((prev) => ({
                                ...prev,
                                [partner.id]:
                                  (currentImgIdx - 1 + visibleImages.length) % visibleImages.length,
                              }));
                            }}
                            aria-label="Imagem anterior"
                            className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-[#141619]/70 text-white hover:bg-[#141619] transition-colors"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveImageIdx((prev) => ({
                                ...prev,
                                [partner.id]: (currentImgIdx + 1) % visibleImages.length,
                              }));
                            }}
                            aria-label="Imagem seguinte"
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-[#141619]/70 text-white hover:bg-[#141619] transition-colors"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                          <div className="absolute bottom-2 right-2.5 px-2 py-0.5 rounded bg-[#141619]/75 text-white font-mono text-[11px] tabular-nums">
                            {currentImgIdx + 1} / {visibleImages.length}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  <div className="p-6 space-y-3.5">
                    {/* Partner Logo + Name + Unboxed Metadata */}
                    <div className="flex items-start gap-3.5">
                      <div className="w-13 h-13 rounded-xl border border-stone-200 bg-white p-1.5 flex items-center justify-center shrink-0 overflow-hidden">
                        {showLogoImg ? (
                          <img
                            src={partner.logo_url!}
                            alt={`Logótipo ${partner.name}`}
                            referrerPolicy="no-referrer"
                            onError={() =>
                              setFailedLogos((prev) => ({ ...prev, [partner.id]: true }))
                            }
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <span className="font-display text-sm font-bold text-stone-700 tracking-tight">
                            {partnerInitials || 'LP'}
                          </span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center justify-between gap-2 text-xs text-stone-500">
                          <span className="truncate">
                            {partner.category} · {getBenefitLabel(partner.benefit_type)}
                          </span>
                        </div>
                        <h3 className="font-display text-lg sm:text-xl font-bold text-[#141619] tracking-tight leading-snug">
                          {partner.name}
                        </h3>
                        <div className="flex items-center gap-1 text-xs text-stone-500">
                          <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                          <span className="truncate">
                            {partner.city}
                            {partner.district && partner.district !== partner.city
                              ? ` · ${partner.district}`
                              : ''}
                          </span>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs sm:text-sm text-stone-600 leading-relaxed line-clamp-3">
                      {partner.description}
                    </p>
                  </div>

                  {/* Clean Discount Strip */}
                  <div className="px-6 py-3.5 bg-[#FAF8F5] border-y border-stone-200/80 flex items-center justify-between gap-3">
                    <div>
                      <span className="text-xs text-stone-500 block">Vantagem de Sócio</span>
                      <span className="text-base font-bold text-[#C81E2B]">
                        {partner.discount_highlight}
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs text-stone-500 block">Poupança est.</span>
                      <span className="text-sm font-mono font-bold text-[#141619] tabular-nums">
                        {partner.estimated_annual_savings} €/ano
                      </span>
                    </div>
                  </div>

                  {/* Conditions, Usage Counter & Terms */}
                  <div className="px-6 py-4 space-y-2 text-xs text-stone-600">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-stone-800">{partner.usage_limit}</span>
                      <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded bg-stone-100 text-stone-700 shrink-0 tabular-nums">
                        {partner.max_uses
                          ? `Máx. ${partner.max_uses} ${partner.max_uses === 1 ? 'uso' : 'usos'}`
                          : 'Ilimitado'}
                      </span>
                    </div>

                    {user && (
                      <div
                        className={`px-3 py-1.5 rounded-lg border flex items-center justify-between text-[11px] font-semibold tabular-nums ${
                          partner.is_limit_reached
                            ? 'bg-red-50 border-red-200 text-[#C81E2B]'
                            : (partner.used_count || 0) > 0
                            ? 'bg-amber-50/70 border-amber-200 text-amber-900'
                            : 'bg-stone-50 border-stone-200 text-stone-600'
                        }`}
                      >
                        <span>
                          {partner.is_limit_reached
                            ? 'Bloqueado (limite atingido)'
                            : `Utilizações realizadas: ${partner.used_count || 0}`}
                        </span>
                        <span className="font-mono font-bold">
                          {partner.max_uses
                            ? `${partner.used_count || 0} / ${partner.max_uses}`
                            : `${partner.used_count || 0}×`}
                        </span>
                      </div>
                    )}

                    <div className="text-stone-500 leading-snug">
                      Termos: {partner.terms} · Válido até{' '}
                      <span className="font-mono tabular-nums">{partner.valid_until}</span>
                    </div>
                  </div>
                </div>

                {/* Action Footer */}
                <div className="px-6 py-4 bg-[#FAF8F5]/60 border-t border-stone-200/80">
                  {hasQuota ? (
                    partner.is_limit_reached ? (
                      <button
                        type="button"
                        onClick={() =>
                          setActionError(
                            `Desconto bloqueado em "${partner.name}": já utilizou este desconto ${partner.used_count} de ${partner.max_uses} ${
                              partner.max_uses === 1 ? 'vez possível' : 'vezes possíveis'
                            }.`
                          )
                        }
                        className="w-full py-2.5 px-4 rounded-lg bg-red-50 border border-red-200 text-[#C81E2B] text-xs font-bold flex items-center justify-center gap-2 cursor-not-allowed"
                      >
                        <Lock className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          Bloqueado · {partner.used_count}/{partner.max_uses} utilizações usadas
                        </span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleRedeem(partner.id)}
                        disabled={isRedeeming}
                        className="w-full py-2.5 px-4 rounded-lg bg-[#141619] hover:bg-stone-800 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-2"
                      >
                        {isRedeeming ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>A gerar código seguro...</span>
                          </>
                        ) : (
                          <>
                            <span>Obter Código Seguro</span>
                            {partner.max_uses && (
                              <span className="text-[11px] font-mono text-stone-300 tabular-nums">
                                ({partner.used_count || 0}/{partner.max_uses})
                              </span>
                            )}
                            <ArrowRight className="w-3.5 h-3.5" />
                          </>
                        )}
                      </button>
                    )
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-xs text-stone-600">
                        <Lock className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                        <span>Código reservado a sócios</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onNavigate(user ? '/pagamentos' : '/registar')}
                        className="text-xs font-semibold text-[#C81E2B] hover:text-[#A11622] whitespace-nowrap shrink-0"
                      >
                        {user ? 'Ativar quota →' : 'Fazer-se sócio →'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {redemptionData && (
        <CodeModal redemptionData={redemptionData} onClose={() => setRedemptionData(null)} />
      )}

      {/* Service Image Lightbox */}
      {lightboxData && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#141619]/85 backdrop-blur-xs"
          onClick={() => setLightboxData(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-3xl w-full overflow-hidden border border-stone-200 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3.5 border-b border-stone-200 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                {lightboxData.partner.logo_url && (
                  <img
                    src={lightboxData.partner.logo_url}
                    alt={lightboxData.partner.name}
                    referrerPolicy="no-referrer"
                    className="w-8 h-8 rounded-lg border border-stone-200 object-contain bg-white p-0.5 shrink-0"
                  />
                )}
                <div className="min-w-0">
                  <strong className="text-sm font-bold text-[#141619] block truncate">
                    {lightboxData.partner.name}
                  </strong>
                  <span className="text-xs text-stone-500 block truncate">
                    {lightboxData.partner.discount_highlight}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLightboxData(null)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-[#141619] hover:bg-stone-100"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative bg-stone-100 aspect-[16/10]">
              <img
                src={lightboxData.images[lightboxData.index]?.url}
                alt={`Serviços de ${lightboxData.partner.name}`}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
              {lightboxData.images.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setLightboxData({
                        ...lightboxData,
                        index:
                          (lightboxData.index - 1 + lightboxData.images.length) %
                          lightboxData.images.length,
                      })
                    }
                    className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-[#141619]/75 text-white hover:bg-[#141619]"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setLightboxData({
                        ...lightboxData,
                        index: (lightboxData.index + 1) % lightboxData.images.length,
                      })
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-[#141619]/75 text-white hover:bg-[#141619]"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
