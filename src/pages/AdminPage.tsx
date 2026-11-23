import React, { useState, useEffect } from 'react';
import { User, AuditLog } from '../types.ts';
import { LpcsLogo } from '../components/LpcsLogo.tsx';
import {
  ShieldAlert,
  Users,
  Store,
  TrendingUp,
  Plus,
  Trash2,
  Edit,
  Power,
  Search,
  CheckCircle2,
  RefreshCw,
  Lock,
  X,
  Building2,
  UserPlus,
  UserCog,
  Mail,
  AlertCircle,
  LogIn,
  KeyRound,
  CreditCard,
  FileText,
  Download,
  Tag,
  Calendar,
  MapPin,
  Phone,
  LogOut,
  Upload,
  Image as ImageIcon,
} from 'lucide-react';

interface AdminPageProps {
  user: User | null;
  isAdmin: boolean;
  onNavigate: (path: string) => void;
  onRefreshUser: () => Promise<User | null> | void;
  onLogout: () => Promise<void> | void;
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

export const AdminPage: React.FC<AdminPageProps> = ({
  user,
  isAdmin,
  onNavigate,
  onRefreshUser,
  onLogout,
}) => {
  // Admin Login Form state (when unauthenticated)
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [cookieBlocked, setCookieBlocked] = useState(false);
  const [loginSubmitting, setLoginSubmitting] = useState(false);

  // Admin Console state
  const [activeTab, setActiveTab] = useState<'summary' | 'users' | 'partners' | 'inquiries' | 'notifications' | 'audit'>('users');
  const [summaryData, setSummaryData] = useState<any | null>(null);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [partnersList, setPartnersList] = useState<any[]>([]);
  const [inquiriesList, setInquiriesList] = useState<any[]>([]);
  const [emailNotifications, setEmailNotifications] = useState<any[]>([]);
  const [emailConfig, setEmailConfig] = useState<{ recipient: string; configured: boolean; provider: string } | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  const [userFilter, setUserFilter] = useState<'todos' | 'ativos' | 'expirar' | 'inativos' | 'suspensos'>('todos');
  const [userSearch, setUserSearch] = useState('');

  // Quick manual quota modal
  const [manualQuotaModalUser, setManualQuotaModalUser] = useState<any | null>(null);
  const [manualQuotaPlan, setManualQuotaPlan] = useState<'semestral' | 'anual'>('anual');
  const [manualQuotaNotes, setManualQuotaNotes] = useState('Pagamento por transferência bancária');

  // Admit new member modal
  const [admitModalOpen, setAdmitModalOpen] = useState(false);
  const [admitSubmitting, setAdmitSubmitting] = useState(false);
  const [admitError, setAdmitError] = useState<string | null>(null);
  const [admitForm, setAdmitForm] = useState({
    name: '',
    email: '',
    password: '',
    birth_date: '',
    nif: '',
    phone: '',
    address: '',
    postal_code: '',
    city: '',
    member_number: '',
    initial_quota: 'anual' as 'nenhum' | 'semestral' | 'anual',
    initial_quota_method: 'manual' as 'manual' | 'transferencia' | 'mbway' | 'multibanco',
    initial_quota_notes: 'Admissão presencial / administrativa',
    is_suspended: false,
  });

  // Individual member management modal
  const [managingUserId, setManagingUserId] = useState<number | null>(null);
  const [memberDetail, setMemberDetail] = useState<any | null>(null);
  const [memberDetailLoading, setMemberDetailLoading] = useState(false);
  const [memberDetailTab, setMemberDetailTab] = useState<'dados' | 'quotas' | 'atividade'>('dados');
  const [memberEditForm, setMemberEditForm] = useState({
    name: '',
    email: '',
    member_number: '',
    birth_date: '',
    nif: '',
    phone: '',
    address: '',
    postal_code: '',
    city: '',
    is_suspended: false,
  });
  const [memberSaveLoading, setMemberSaveLoading] = useState(false);
  const [memberSaveError, setMemberSaveError] = useState<string | null>(null);
  const [newMemberPassword, setNewMemberPassword] = useState('');
  const [passwordResetLoading, setPasswordResetLoading] = useState(false);
  const [detailQuotaPlan, setDetailQuotaPlan] = useState<'semestral' | 'anual'>('anual');
  const [detailQuotaNotes, setDetailQuotaNotes] = useState('Renovação administrativa');
  const [detailQuotaSubmitting, setDetailQuotaSubmitting] = useState(false);
  const [confirmRemoveQuotaId, setConfirmRemoveQuotaId] = useState<number | null>(null);

  // In-app delete confirmation modal (for Members & Partners)
  const [deleteTarget, setDeleteTarget] = useState<
    | { type: 'user'; id: number; name: string; subtitle: string }
    | { type: 'partner'; id: number; name: string; subtitle: string }
    | null
  >(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  // Partner CRUD modal
  const [partnerModalOpen, setPartnerModalOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<any | null>(null);
  const [fromInquiryId, setFromInquiryId] = useState<number | null>(null);
  const [partnerFormError, setPartnerFormError] = useState<string | null>(null);
  const [partnerSubmitting, setPartnerSubmitting] = useState(false);
  const [partnerLogoFile, setPartnerLogoFile] = useState<File | null>(null);
  const [partnerLogoPreview, setPartnerLogoPreview] = useState<string | null>(null);
  const [partnerExistingLogoUrl, setPartnerExistingLogoUrl] = useState<string | null>(null);
  const [partnerServiceFiles, setPartnerServiceFiles] = useState<Array<{ file: File; preview: string }>>([]);
  const [existingServiceImages, setExistingServiceImages] = useState<
    Array<{ id: number; url: string; original_name: string }>
  >([]);
  const [removeServiceImageIds, setRemoveServiceImageIds] = useState<number[]>([]);
  const [partnerFormData, setPartnerFormData] = useState({
    name: '',
    category: '',
    description: '',
    area: 'Saúde e Bem-estar',
    district: 'Lisboa',
    city: 'Lisboa',
    benefit_type: 'codigo',
    benefit_value: '',
    discount_highlight: '',
    usage_limit: 'Utilização contínua',
    max_uses: '4',
    code_mode: 'rotativo',
    estimated_annual_savings: '50.0',
    valid_until: '2027-12-31',
    terms: 'Válido mediante apresentação do cartão ou código de sócio.',
    website: '',
    is_active: true,
    secret_code: '',
    partner_email: '',
    partner_password: '',
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const loadSummary = () => {
    fetch('/api/admin/summary', { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((data) => {
        setSummaryData(data);
        if (data.recentLogs) setAuditLogs(data.recentLogs);
      })
      .catch((err) => console.error('Summary error:', err));
  };

  const loadUsers = () => {
    const params = new URLSearchParams();
    if (userFilter !== 'todos') params.set('filter', userFilter);
    if (userSearch.trim()) params.set('search', userSearch.trim());

    fetch(`/api/admin/users?${params.toString()}`, { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((data) => setUsersList(data.users || []))
      .catch((err) => console.error('Users load error:', err));
  };

  const loadPartners = () => {
    fetch('/api/admin/partners', { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((data) => setPartnersList(data.partners || []))
      .catch((err) => console.error('Partners load error:', err));
  };

  const loadInquiries = () => {
    fetch('/api/admin/inquiries', { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((data) => setInquiriesList(data.inquiries || []))
      .catch((err) => console.error('Inquiries load error:', err));
  };

  const loadEmailNotifications = () => {
    fetch('/api/admin/email-notifications', { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((data) => {
        setEmailNotifications(data.notifications || []);
        if (data.config) setEmailConfig(data.config);
      })
      .catch((err) => console.error('Email notifications load error:', err));
  };

  const openManageMember = async (memberId: number, initialSubTab: 'dados' | 'quotas' | 'atividade' = 'dados') => {
    setManagingUserId(memberId);
    setMemberDetailTab(initialSubTab);
    setMemberDetailLoading(true);
    setMemberSaveError(null);
    setNewMemberPassword('');
    setConfirmRemoveQuotaId(null);

    try {
      const res = await fetch(`/api/admin/users/${memberId}`, { credentials: 'same-origin' });
      const data = await res.json();
      if (res.ok && data.member) {
        setMemberDetail(data);
        setMemberEditForm({
          name: data.member.name || '',
          email: data.member.email || '',
          member_number: data.member.member_number || '',
          birth_date: data.member.birth_date || '',
          nif: data.member.nif || '',
          phone: data.member.phone || '',
          address: data.member.address || '',
          postal_code: data.member.postal_code || '',
          city: data.member.city || '',
          is_suspended: data.member.is_suspended === 1,
        });
      } else {
        showToast(data.error || 'Erro ao carregar ficha do associado.');
        setManagingUserId(null);
      }
    } catch (err) {
      console.error('Load member detail error:', err);
      showToast('Falha de rede ao carregar ficha do associado.');
      setManagingUserId(null);
    } finally {
      setMemberDetailLoading(false);
    }
  };

  useEffect(() => {
    if (!user || !isAdmin) {
      setLoading(false);
      return;
    }

    setLoading(true);
    Promise.all([
      fetch('/api/admin/summary', { credentials: 'same-origin' }).then((r) => r.json()),
      fetch('/api/admin/users', { credentials: 'same-origin' }).then((r) => r.json()),
      fetch('/api/admin/partners', { credentials: 'same-origin' }).then((r) => r.json()),
      fetch('/api/admin/inquiries', { credentials: 'same-origin' }).then((r) => r.json()),
      fetch('/api/admin/email-notifications', { credentials: 'same-origin' }).then((r) => r.json()),
    ])
      .then(([summary, users, partners, inquiries, emailNotifs]) => {
        setSummaryData(summary);
        if (summary.recentLogs) setAuditLogs(summary.recentLogs);
        setUsersList(users.users || []);
        setPartnersList(partners.partners || []);
        setInquiriesList(inquiries.inquiries || []);
        setEmailNotifications(emailNotifs.notifications || []);
        if (emailNotifs.config) setEmailConfig(emailNotifs.config);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error fetching admin data:', err);
        setLoading(false);
      });
  }, [user?.id, isAdmin]);

  useEffect(() => {
    if (user && isAdmin && activeTab === 'users') {
      loadUsers();
    }
  }, [userFilter, userSearch, activeTab, user?.id, isAdmin]);

  const handleAdminLogin = async (e: React.FormEvent) => {
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
        setLoginError(data.error || 'Credenciais administrativas inválidas.');
        setLoginSubmitting(false);
        return;
      }

      const loggedUser = await onRefreshUser();
      setLoginSubmitting(false);
      if (!loggedUser) {
        setCookieBlocked(true);
        setLoginError(
          'O navegador bloqueou o cookie de sessão nesta pré-visualização. Abra o portal num novo separador para entrar.'
        );
      }
    } catch (err) {
      console.error('Admin login error:', err);
      const form = document.getElementById('admin-native-login-form') as HTMLFormElement;
      form?.submit();
    }
  };

  // ==========================================
  // GATE 1: NOT AUTHENTICATED -> ADMIN LOGIN
  // ==========================================
  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-14 space-y-6">
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <LpcsLogo variant="dark" className="h-12 w-auto" />
          </div>
          <div className="font-condensed text-xs font-bold uppercase tracking-[0.16em] text-[#C81E2B]">
            Acesso Reservado à Direção · NIPC 502 665 548
          </div>
          <h1 className="font-display text-3xl font-bold text-[#141619] tracking-tight">
            Gestão Administrativa LPCS
          </h1>
          <p className="text-sm font-light text-stone-600">
            Inicie sessão com conta de administrador para admitir, gerir ou remover associados.
          </p>
        </div>

        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-stone-200 space-y-5">
          {loginError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex flex-col gap-2 text-xs sm:text-sm text-red-800">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-[#C81E2B] shrink-0 mt-0.5" />
                <span>{loginError}</span>
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

          <div className="bg-[#FAF8F5] p-3.5 rounded-xl border border-stone-200 text-xs flex items-center justify-between gap-3">
            <div>
              <strong className="block text-[#141619]">Conta de Demonstração Admin</strong>
              <span className="text-[11px] text-stone-500">admin@lpcs.pt</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setLoginEmail('admin@lpcs.pt');
                setLoginPassword('Admin!2026');
              }}
              className="px-3 py-1.5 rounded-lg bg-white border border-stone-300 hover:border-stone-500 text-xs font-bold text-[#141619] whitespace-nowrap"
            >
              Preencher
            </button>
          </div>

          <form
            id="admin-native-login-form"
            method="post"
            action="/api/auth/login"
            onSubmit={handleAdminLogin}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1.5">
                E-mail de Administrador
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  name="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="admin@lpcs.pt"
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
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-stone-300 bg-[#FAF8F5]/50 text-sm focus:outline-hidden focus:bg-white focus:border-[#C81E2B] focus:ring-1 focus:ring-[#C81E2B]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loginSubmitting}
              className="w-full py-3 rounded-lg bg-[#141619] hover:bg-stone-800 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2"
            >
              {loginSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>A autenticar...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Entrar na Gestão Administrativa</span>
                </>
              )}
            </button>
          </form>

          <div className="pt-3 border-t border-stone-100 text-center">
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="text-xs font-medium text-stone-500 hover:text-[#141619]"
            >
              ← Voltar à Página Inicial
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // GATE 2: LOGGED IN AS MEMBER (NOT ADMIN)
  // ==========================================
  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-5">
        <div className="w-12 h-12 rounded-xl bg-red-50 text-[#C81E2B] border border-red-200 flex items-center justify-center mx-auto">
          <Lock className="w-6 h-6" />
        </div>
        <div className="space-y-2">
          <div className="font-condensed text-xs font-bold uppercase tracking-[0.16em] text-[#C81E2B]">
            Acesso Restrito à Administração
          </div>
          <h2 className="font-display text-2xl font-bold text-[#141619]">
            Sessão Atual Sem Permissões de Direção
          </h2>
          <p className="text-sm font-light text-stone-600 leading-relaxed">
            Iniciou sessão como associado (<strong className="font-semibold text-[#141619]">{user.email}</strong>). A admissão, gestão e remoção de associados está reservada à conta administrativa da LPCS.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <button
            type="button"
            onClick={async () => {
              await onLogout();
              onNavigate('/admin');
            }}
            className="px-5 py-2.5 rounded-lg bg-[#C81E2B] hover:bg-[#A11622] text-white text-xs font-bold flex items-center justify-center gap-2"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Trocar para Conta Admin</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('/dashboard')}
            className="px-5 py-2.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 text-[#141619] text-xs font-bold"
          >
            Ir para Área Pessoal
          </button>
        </div>
      </div>
    );
  }

  // ==========================================
  // HANDLERS (ADMIN AUTHENTICATED)
  // ==========================================

  const handleToggleSuspend = async (userId: number) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/suspend`, {
        method: 'POST',
        credentials: 'same-origin',
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message);
        loadUsers();
        loadSummary();
        if (managingUserId === userId) {
          openManageMember(userId, memberDetailTab);
        }
      } else {
        showToast(data.error || 'Erro ao alterar estado da conta.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAdmitMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdmitSubmitting(true);
    setAdmitError(null);

    if (!checkNifClient(admitForm.nif)) {
      setAdmitError('O NIF inserido não é válido segundo o algoritmo oficial (Módulo 11).');
      setAdmitSubmitting(false);
      return;
    }

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(admitForm),
      });
      const data = await res.json();

      if (!res.ok) {
        setAdmitError(data.error || 'Erro ao admitir associado.');
        setAdmitSubmitting(false);
        return;
      }

      setAdmitSubmitting(false);
      setAdmitModalOpen(false);
      setAdmitForm({
        name: '',
        email: '',
        password: '',
        birth_date: '',
        nif: '',
        phone: '',
        address: '',
        postal_code: '',
        city: '',
        member_number: '',
        initial_quota: 'anual',
        initial_quota_method: 'manual',
        initial_quota_notes: 'Admissão presencial / administrativa',
        is_suspended: false,
      });
      showToast(data.message);
      setActiveTab('users');
      loadUsers();
      loadSummary();
    } catch (err) {
      console.error('Admit error:', err);
      setAdmitError('Falha de comunicação com o servidor.');
      setAdmitSubmitting(false);
    }
  };

  const handleSaveMemberDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!managingUserId) return;
    setMemberSaveLoading(true);
    setMemberSaveError(null);

    if (!checkNifClient(memberEditForm.nif)) {
      setMemberSaveError('NIF inválido segundo o algoritmo oficial português (Módulo 11).');
      setMemberSaveLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/admin/users/${managingUserId}`, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(memberEditForm),
      });
      const data = await res.json();

      if (!res.ok) {
        setMemberSaveError(data.error || 'Erro ao atualizar dados do associado.');
        setMemberSaveLoading(false);
        return;
      }

      setMemberSaveLoading(false);
      showToast(data.message);
      loadUsers();
      loadSummary();
      openManageMember(managingUserId, 'dados');
    } catch (err) {
      console.error('Update member error:', err);
      setMemberSaveError('Falha de rede ao guardar alterações.');
      setMemberSaveLoading(false);
    }
  };

  const handleResetMemberPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!managingUserId) return;
    if (newMemberPassword.length < 6) {
      setMemberSaveError('A nova palavra-passe deve ter pelo menos 6 carateres.');
      return;
    }

    setPasswordResetLoading(true);
    setMemberSaveError(null);

    try {
      const res = await fetch(`/api/admin/users/${managingUserId}/password`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newMemberPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMemberSaveError(data.error || 'Erro ao redefinir palavra-passe.');
      } else {
        setNewMemberPassword('');
        showToast(data.message);
        openManageMember(managingUserId, 'dados');
      }
    } catch (err) {
      console.error(err);
      setMemberSaveError('Falha ao redefinir palavra-passe.');
    } finally {
      setPasswordResetLoading(false);
    }
  };

  const handleGrantManualQuota = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualQuotaModalUser) return;

    try {
      const res = await fetch(`/api/admin/users/${manualQuotaModalUser.id}/quota`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_type: manualQuotaPlan,
          notes: manualQuotaNotes,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        showToast(data.message);
        setManualQuotaModalUser(null);
        loadUsers();
        loadSummary();
      } else {
        showToast(data.error || 'Erro ao lançar quota.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleGrantDetailQuota = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!managingUserId) return;
    setDetailQuotaSubmitting(true);

    try {
      const res = await fetch(`/api/admin/users/${managingUserId}/quota`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_type: detailQuotaPlan,
          notes: detailQuotaNotes,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message);
        loadUsers();
        loadSummary();
        openManageMember(managingUserId, 'quotas');
      } else {
        showToast(data.error || 'Erro ao lançar quota.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDetailQuotaSubmitting(false);
    }
  };

  const handleDeleteQuota = async (quotaId: number) => {
    if (!managingUserId) return;
    try {
      const res = await fetch(`/api/admin/quotas/${quotaId}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message);
        setConfirmRemoveQuotaId(null);
        loadUsers();
        loadSummary();
        openManageMember(managingUserId, 'quotas');
      } else {
        showToast(data.error || 'Erro ao remover quota.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteSubmitting(true);

    try {
      const url =
        deleteTarget.type === 'user'
          ? `/api/admin/users/${deleteTarget.id}`
          : `/api/admin/partners/${deleteTarget.id}`;

      const res = await fetch(url, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      const data = await res.json();

      if (res.ok) {
        showToast(data.message || 'Registo removido com sucesso.');
        if (deleteTarget.type === 'user') {
          if (managingUserId === deleteTarget.id) {
            setManagingUserId(null);
            setMemberDetail(null);
          }
          loadUsers();
        } else {
          loadPartners();
        }
        loadSummary();
        setDeleteTarget(null);
      } else {
        showToast(data.error || 'Erro ao remover registo.');
      }
    } catch (err) {
      console.error(err);
      showToast('Falha de rede ao remover registo.');
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const handlePartnerLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setPartnerFormError('O logótipo não pode exceder 5 MB.');
      return;
    }
    setPartnerFormError(null);
    setPartnerLogoFile(file);
    setPartnerLogoPreview(URL.createObjectURL(file));
  };

  const handlePartnerServiceImagesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const activeExistingCount = fromInquiryId
      ? existingServiceImages.length
      : existingServiceImages.filter((img) => !removeServiceImageIds.includes(img.id)).length;
    const remainingSlots = Math.max(0, 4 - activeExistingCount - partnerServiceFiles.length);

    if (remainingSlots <= 0) {
      setPartnerFormError('Cada parceiro pode ter no máximo 4 imagens ilustrativas.');
      return;
    }

    const validItems: Array<{ file: File; preview: string }> = [];
    for (const file of files.slice(0, remainingSlots)) {
      if (file.size > 5 * 1024 * 1024) {
        setPartnerFormError(`A imagem "${file.name}" excede o limite de 5 MB.`);
        continue;
      }
      validItems.push({ file, preview: URL.createObjectURL(file) });
    }

    if (validItems.length > 0) {
      setPartnerServiceFiles((prev) => [...prev, ...validItems]);
    }
    e.target.value = '';
  };

  const handleSavePartner = async (e: React.FormEvent) => {
    e.preventDefault();
    setPartnerFormError(null);
    const isEdit = !!editingPartner;

    if (!isEdit && !fromInquiryId && !partnerLogoFile) {
      setPartnerFormError('O logótipo da entidade parceira é obrigatório.');
      return;
    }

    const url = isEdit ? `/api/admin/partners/${editingPartner.id}` : '/api/admin/partners';
    const method = isEdit ? 'PUT' : 'POST';

    const fd = new FormData();
    Object.entries(partnerFormData).forEach(([key, val]) => {
      fd.append(key, String(val));
    });

    if (fromInquiryId) {
      fd.append('from_inquiry_id', String(fromInquiryId));
    }
    if (partnerLogoFile) {
      fd.append('logo', partnerLogoFile);
    }
    for (const item of partnerServiceFiles) {
      fd.append('service_images', item.file);
    }
    if (isEdit && removeServiceImageIds.length > 0) {
      fd.append('remove_image_ids', JSON.stringify(removeServiceImageIds));
    }

    setPartnerSubmitting(true);
    try {
      const res = await fetch(url, {
        method,
        credentials: 'same-origin',
        body: fd,
      });

      const data = await res.json();
      if (res.ok) {
        showToast(
          isEdit
            ? 'Parceiro atualizado com sucesso.'
            : fromInquiryId
            ? 'Proposta publicada no catálogo de parceiros.'
            : 'Novo parceiro adicionado.'
        );
        setPartnerModalOpen(false);
        setEditingPartner(null);
        setFromInquiryId(null);
        loadPartners();
        if (fromInquiryId) loadInquiries();
        loadSummary();
      } else {
        setPartnerFormError(data.error || 'Erro ao guardar parceiro.');
        showToast(data.error || 'Erro ao guardar parceiro.');
      }
    } catch (err) {
      console.error(err);
      setPartnerFormError('Falha de rede ao guardar parceiro.');
    } finally {
      setPartnerSubmitting(false);
    }
  };

  const handleTogglePartner = async (partnerId: number) => {
    try {
      const res = await fetch(`/api/admin/partners/${partnerId}/toggle`, {
        method: 'POST',
        credentials: 'same-origin',
      });
      if (res.ok) {
        showToast('Estado do parceiro alterado.');
        loadPartners();
        loadSummary();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const openNewPartnerModal = () => {
    setEditingPartner(null);
    setFromInquiryId(null);
    setPartnerFormError(null);
    setPartnerLogoFile(null);
    setPartnerLogoPreview(null);
    setPartnerExistingLogoUrl(null);
    setPartnerServiceFiles([]);
    setExistingServiceImages([]);
    setRemoveServiceImageIds([]);
    setPartnerFormData({
      name: '',
      category: 'Geral',
      description: '',
      area: 'Saúde e Bem-estar',
      district: 'Lisboa',
      city: 'Lisboa',
      benefit_type: 'codigo',
      benefit_value: '20% de desconto',
      discount_highlight: '20% em serviços',
      usage_limit: 'Até 4 utilizações por sócio',
      max_uses: '4',
      code_mode: 'rotativo',
      estimated_annual_savings: '50.0',
      valid_until: '2027-12-31',
      terms: 'Válido mediante apresentação do cartão ou código de sócio.',
      website: '',
      is_active: true,
      secret_code: 'PARCEIRO20',
      partner_email: '',
      partner_password: '',
    });
    setPartnerModalOpen(true);
  };

  const openEditPartnerModal = (p: any) => {
    setEditingPartner(p);
    setFromInquiryId(null);
    setPartnerFormError(null);
    setPartnerLogoFile(null);
    setPartnerLogoPreview(null);
    setPartnerExistingLogoUrl(p.logo_url || null);
    setPartnerServiceFiles([]);
    setExistingServiceImages(Array.isArray(p.service_images) ? p.service_images : []);
    setRemoveServiceImageIds([]);
    setPartnerFormData({
      name: p.name,
      category: p.category,
      description: p.description,
      area: p.area,
      district: p.district,
      city: p.city,
      benefit_type: p.benefit_type,
      benefit_value: p.benefit_value,
      discount_highlight: p.discount_highlight,
      usage_limit: p.usage_limit,
      max_uses: p.max_uses ? String(p.max_uses) : '',
      code_mode: p.code_mode || 'rotativo',
      estimated_annual_savings: String(p.estimated_annual_savings),
      valid_until: p.valid_until,
      terms: p.terms,
      website: p.website || '',
      is_active: p.is_active !== 0,
      secret_code: p.secret_code || 'CODE10',
      partner_email: p.partner_email || '',
      partner_password: '',
    });
    setPartnerModalOpen(true);
  };

  const openPublishFromInquiryModal = (inq: any) => {
    setEditingPartner(null);
    setFromInquiryId(inq.id);
    setPartnerFormError(null);
    setPartnerLogoFile(null);
    setPartnerLogoPreview(null);
    setPartnerExistingLogoUrl(inq.logo_url || null);
    setPartnerServiceFiles([]);
    setExistingServiceImages(Array.isArray(inq.service_images) ? inq.service_images : []);
    setRemoveServiceImageIds([]);
    const codeSeed = (inq.company_name || 'LPCS')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase()
      .slice(0, 6);
    setPartnerFormData({
      name: inq.company_name || '',
      category: inq.area || 'Serviços',
      description: inq.notes || `Parceiro LPCS na área de ${inq.area || 'Serviços'}.`,
      area: inq.area || 'Serviços',
      district: inq.district || 'Nacional',
      city: inq.city || 'Nacional',
      benefit_type: inq.benefit_type || 'codigo',
      benefit_value: inq.proposed_benefit || '15% de desconto',
      discount_highlight: inq.proposed_benefit || '15% de desconto',
      usage_limit: inq.max_uses
        ? `Até ${inq.max_uses} ${Number(inq.max_uses) === 1 ? 'utilização' : 'utilizações'} por sócio`
        : inq.benefit_type === 'voucher'
        ? 'Uso único'
        : 'Utilização contínua',
      max_uses: inq.max_uses ? String(inq.max_uses) : inq.benefit_type === 'voucher' ? '1' : '4',
      code_mode: inq.code_mode || 'rotativo',
      estimated_annual_savings: '45.0',
      valid_until: inq.valid_until || '2027-12-31',
      terms: 'Válido mediante validação de código de sócio LPCS.',
      website: inq.website || '',
      is_active: true,
      secret_code: inq.proposed_code || `${codeSeed || 'LPCS'}${inq.id}`,
      partner_email: inq.email || '',
      partner_password: '',
    });
    setPartnerModalOpen(true);
  };

  const metrics = summaryData?.metrics || {
    totalAssociados: 0,
    associadosQuotaAtiva: 0,
    associadosInativos: 0,
    associadosSuspensos: 0,
    parceirosAtivos: 0,
    parceirosInativos: 0,
    receitaTotalEuros: 0,
    descontosResgatados: 0,
    descontosEmitidosTotal: 0,
  };

  const admitNifValid = checkNifClient(admitForm.nif);
  const editNifValid = checkNifClient(memberEditForm.nif);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 bg-[#141619] text-white rounded-xl border border-stone-700 shadow-lg flex items-center gap-2.5 text-xs font-medium">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Admin Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-stone-200 pb-6">
        <div>
          <div className="font-condensed text-xs font-bold uppercase tracking-[0.16em] text-[#C81E2B]">
            Liga em Rede · Administração Institucional · NIPC 502 665 548
          </div>
          <h1 className="font-display text-3xl font-bold text-[#141619] tracking-tight mt-1">
            Gestão Administrativa — Liga em Rede
          </h1>
          <p className="text-sm font-light text-stone-600 mt-1">
            Admissão, edição, controlo de quotas, suspensão e remoção de sócios, parceiros e auditoria.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => {
              setAdmitError(null);
              setAdmitModalOpen(true);
            }}
            className="px-4 py-2 rounded-lg bg-[#C81E2B] hover:bg-[#A11622] text-white text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            <span>Admitir Associado</span>
          </button>

          <button
            type="button"
            onClick={() => {
              loadSummary();
              loadUsers();
              loadPartners();
              loadInquiries();
              loadEmailNotifications();
              showToast('Dados sincronizados.');
            }}
            className="px-3.5 py-2 rounded-lg border border-stone-300 bg-white text-stone-700 hover:bg-stone-50 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Sincronizar</span>
          </button>

          <div className="text-right text-xs hidden sm:block pl-2 border-l border-stone-200">
            <span className="text-stone-400 block">Sessão Admin</span>
            <span className="font-mono font-semibold text-[#141619]">{user.email}</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-stone-200 gap-6 overflow-x-auto">
        {[
          { id: 'users', name: 'Gestão de Associados', icon: Users, count: metrics.totalAssociados },
          { id: 'summary', name: 'Resumo Geral', icon: TrendingUp },
          { id: 'partners', name: 'Parceiros', icon: Store, count: metrics.parceirosAtivos },
          { id: 'inquiries', name: 'Propostas de Parceria', icon: Building2, count: inquiriesList.length },
          { id: 'notifications', name: 'Notificações E-mail', icon: Mail, count: emailNotifications.length },
          { id: 'audit', name: 'Auditoria', icon: ShieldAlert },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              type="button"
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 tabular-nums ${
                active
                  ? 'border-[#C81E2B] text-[#141619]'
                  : 'border-transparent text-stone-500 hover:text-[#141619]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.name}</span>
              {tab.count !== undefined && (
                <span className="font-mono text-stone-400 font-normal">({tab.count})</span>
              )}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-stone-500">A carregar dados de gestão...</div>
      ) : (
        <>
          {/* TAB: ASSOCIADOS (ADMISSION, MANAGEMENT, REMOVAL) */}
          {activeTab === 'users' && (
            <div className="space-y-5">
              {/* Toolbar */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-stone-200">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Pesquisar por nome, email, NIF, localidade ou nº sócio..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 rounded-lg border border-stone-300 bg-[#FAF8F5]/50 text-xs focus:outline-hidden focus:bg-white focus:border-[#C81E2B]"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    { id: 'todos', label: 'Todos' },
                    { id: 'ativos', label: 'Quota Ativa' },
                    { id: 'expirar', label: 'A Expirar' },
                    { id: 'inativos', label: 'Sem Quota' },
                    { id: 'suspensos', label: 'Suspensos' },
                  ].map((f) => (
                    <button
                      type="button"
                      key={f.id}
                      onClick={() => setUserFilter(f.id as any)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                        userFilter === f.id
                          ? 'bg-[#141619] text-white'
                          : 'bg-[#FAF8F5] border border-stone-200 text-stone-700 hover:border-stone-400'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={() => {
                      setAdmitError(null);
                      setAdmitModalOpen(true);
                    }}
                    className="ml-1 px-3.5 py-1.5 rounded-lg bg-[#C81E2B] hover:bg-[#A11622] text-white text-xs font-bold flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Admitir Sócio</span>
                  </button>
                </div>
              </div>

              {/* Members Table */}
              <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
                {usersList.length === 0 ? (
                  <div className="p-12 text-center space-y-3">
                    <Users className="w-8 h-8 text-stone-300 mx-auto" />
                    <p className="text-sm font-medium text-stone-600">
                      Nenhum associado encontrado com os filtros atuais.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setUserFilter('todos');
                        setUserSearch('');
                      }}
                      className="text-xs font-bold text-[#C81E2B] hover:text-[#A11622]"
                    >
                      Limpar filtros
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-stone-600">
                      <thead className="font-condensed bg-[#FAF8F5] text-[11px] uppercase font-bold tracking-wider text-stone-500 border-b border-stone-200">
                        <tr>
                          <th className="py-3 px-4">Associado</th>
                          <th className="py-3 px-4">Nº Sócio / NIF</th>
                          <th className="py-3 px-4">Localidade &amp; Contacto</th>
                          <th className="py-3 px-4">Estado Quota</th>
                          <th className="py-3 px-4">Conta</th>
                          <th className="py-3 px-4 text-right">Gestão Individual</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {usersList.map((u) => {
                          const isSelf = u.id === user.id;
                          const qs = u.quota_status;
                          const hasActiveQuota = qs?.has_active_quota;

                          return (
                            <tr key={u.id} className="hover:bg-stone-50/70">
                              <td className="py-3.5 px-4">
                                <button
                                  type="button"
                                  onClick={() => openManageMember(u.id, 'dados')}
                                  className="text-left group"
                                >
                                  <strong className="text-[#141619] group-hover:text-[#C81E2B] transition-colors block">
                                    {u.name}
                                  </strong>
                                  <span className="text-[11px] text-stone-500">{u.email}</span>
                                </button>
                              </td>
                              <td className="py-3.5 px-4 font-mono tabular-nums">
                                <span className="font-bold text-[#141619] block">{u.member_number}</span>
                                <span className="text-[11px] text-stone-500">NIF {u.nif}</span>
                              </td>
                              <td className="py-3.5 px-4">
                                <span className="text-stone-800 block">{u.city}</span>
                                <span className="text-[11px] text-stone-500 tabular-nums">{u.phone}</span>
                              </td>
                              <td className="py-3.5 px-4 tabular-nums">
                                {qs?.status === 'valida' ? (
                                  <div>
                                    <span className="font-bold text-emerald-700 block">
                                      Válida até {qs.valid_until}
                                    </span>
                                    <span className="text-[11px] text-stone-400">
                                      {qs.days_remaining} dias restantes
                                    </span>
                                  </div>
                                ) : qs?.status === 'expirar' ? (
                                  <div>
                                    <span className="font-bold text-amber-700 block">
                                      A expirar ({qs.days_remaining}d)
                                    </span>
                                    <span className="text-[11px] text-stone-400">Até {qs.valid_until}</span>
                                  </div>
                                ) : qs?.status === 'expirada' ? (
                                  <div>
                                    <span className="font-bold text-[#C81E2B] block">
                                      Expirada há {qs.days_expired}d
                                    </span>
                                    <span className="text-[11px] text-stone-400">{qs.valid_until}</span>
                                  </div>
                                ) : (
                                  <span className="font-medium text-stone-500">Sem quota ativa</span>
                                )}
                              </td>
                              <td className="py-3.5 px-4">
                                {u.is_admin === 1 ? (
                                  <span className="font-bold text-[#141619]">Administrador</span>
                                ) : u.is_suspended === 1 ? (
                                  <span className="font-bold text-[#C81E2B]">Suspensa</span>
                                ) : (
                                  <span className="font-medium text-emerald-700">Ativa</span>
                                )}
                              </td>
                              <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => openManageMember(u.id, 'dados')}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-[#141619] hover:bg-stone-800 text-white font-bold text-[11px]"
                                >
                                  <UserCog className="w-3.5 h-3.5" />
                                  <span>Gerir</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setManualQuotaModalUser(u)}
                                  className="px-2.5 py-1.5 rounded-md border border-stone-300 bg-white hover:bg-stone-50 text-[#141619] font-semibold text-[11px]"
                                  title="Lançar ou acumular quota"
                                >
                                  + Quota
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleToggleSuspend(u.id)}
                                  disabled={isSelf}
                                  className={`p-1.5 rounded-md ${
                                    isSelf
                                      ? 'text-stone-300 cursor-not-allowed'
                                      : u.is_suspended === 1
                                      ? 'text-emerald-700 hover:bg-emerald-50'
                                      : 'text-amber-700 hover:bg-amber-50'
                                  }`}
                                  title={u.is_suspended === 1 ? 'Reativar conta' : 'Suspender conta'}
                                >
                                  <Power className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDeleteTarget({
                                      type: 'user',
                                      id: u.id,
                                      name: u.name,
                                      subtitle: `${u.member_number} · ${u.email} · NIF ${u.nif}`,
                                    })
                                  }
                                  disabled={isSelf}
                                  className={`p-1.5 rounded-md ${
                                    isSelf
                                      ? 'text-stone-300 cursor-not-allowed'
                                      : 'text-stone-400 hover:text-[#C81E2B] hover:bg-red-50'
                                  }`}
                                  title="Remover associado"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: SUMMARY */}
          {activeTab === 'summary' && (
            <div className="space-y-8">
              <div className="bg-white rounded-xl border border-stone-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-stone-200">
                <div className="p-6">
                  <span className="font-condensed text-xs font-bold uppercase tracking-wider text-stone-500">
                    Associados Registados
                  </span>
                  <div className="text-3xl font-mono font-bold text-[#141619] mt-2 tabular-nums">
                    {metrics.totalAssociados}
                  </div>
                  <span className="text-xs text-emerald-700 font-medium mt-1 block tabular-nums">
                    {metrics.associadosQuotaAtiva} com quota ativa
                  </span>
                </div>

                <div className="p-6">
                  <span className="font-condensed text-xs font-bold uppercase tracking-wider text-stone-500">
                    Receita de Quotas
                  </span>
                  <div className="text-3xl font-mono font-bold text-emerald-700 mt-2 tabular-nums">
                    {metrics.receitaTotalEuros.toFixed(2)} €
                  </div>
                  <span className="text-xs text-stone-500 mt-1 block">Fundos para missão LPCS</span>
                </div>

                <div className="p-6">
                  <span className="font-condensed text-xs font-bold uppercase tracking-wider text-stone-500">
                    Parceiros Ativos
                  </span>
                  <div className="text-3xl font-mono font-bold text-[#141619] mt-2 tabular-nums">
                    {metrics.parceirosAtivos}
                  </div>
                  <span className="text-xs text-stone-500 mt-1 block tabular-nums">
                    {metrics.parceirosInativos} desativados
                  </span>
                </div>

                <div className="p-6">
                  <span className="font-condensed text-xs font-bold uppercase tracking-wider text-stone-500">
                    Descontos Validados
                  </span>
                  <div className="text-3xl font-mono font-bold text-[#C81E2B] mt-2 tabular-nums">
                    {metrics.descontosResgatados}
                  </div>
                  <span className="text-xs text-stone-500 mt-1 block tabular-nums">
                    De {metrics.descontosEmitidosTotal} códigos emitidos
                  </span>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between">
                  <h3 className="font-display text-lg font-bold text-[#141619]">
                    Atividade Recente no Sistema
                  </h3>
                  <button
                    type="button"
                    onClick={() => setActiveTab('users')}
                    className="text-xs font-bold text-[#C81E2B] hover:text-[#A11622]"
                  >
                    Gerir Associados →
                  </button>
                </div>
                <div className="divide-y divide-stone-100 text-xs">
                  {auditLogs.slice(0, 8).map((log) => (
                    <div key={log.id} className="px-6 py-3.5 flex items-start justify-between gap-4">
                      <div>
                        <span className="font-bold text-[#141619] block">{log.action}</span>
                        <span className="text-stone-600">{log.details}</span>
                        {log.user_name && (
                          <span className="text-stone-400 block mt-0.5 font-mono text-[11px]">
                            {log.user_name} · {log.member_number}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-mono text-stone-400 shrink-0 tabular-nums">
                        {new Date(log.created_at).toLocaleTimeString('pt-PT')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB: PARTNERS */}
          {activeTab === 'partners' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <p className="text-xs text-stone-500 tabular-nums">
                  {partnersList.length} parceiros registados no catálogo
                </p>
                <button
                  type="button"
                  onClick={openNewPartnerModal}
                  className="px-4 py-2 rounded-lg bg-[#C81E2B] hover:bg-[#A11622] text-white font-bold text-xs flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Adicionar Parceiro</span>
                </button>
              </div>

              <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-stone-600">
                    <thead className="font-condensed bg-[#FAF8F5] text-[11px] uppercase font-bold tracking-wider text-stone-500 border-b border-stone-200">
                      <tr>
                        <th className="py-3 px-4">Parceiro</th>
                        <th className="py-3 px-4">Área / Local</th>
                        <th className="py-3 px-4">Desconto</th>
                        <th className="py-3 px-4">Protocolos (Empresa & LPCS)</th>
                        <th className="py-3 px-4">Estado</th>
                        <th className="py-3 px-4 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {partnersList.map((p) => (
                        <tr key={p.id} className="hover:bg-stone-50/70">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              {p.logo_url ? (
                                <img
                                  src={p.logo_url}
                                  alt={`Logótipo ${p.name}`}
                                  className="w-14 h-14 rounded-xl border border-stone-200 bg-white object-contain p-1.5 shrink-0"
                                />
                              ) : (
                                <div className="w-14 h-14 rounded-xl border border-stone-200 bg-stone-50 flex items-center justify-center text-xs font-bold text-stone-400 shrink-0">
                                  S/L
                                </div>
                              )}
                              <div>
                                <strong className="text-[#141619] block">{p.name}</strong>
                                <span className="text-[11px] text-stone-500 block">
                                  {p.category}
                                  {Array.isArray(p.service_images) && p.service_images.length > 0 && (
                                    <span className="text-stone-400">
                                      {' '}
                                      · {p.service_images.length}{' '}
                                      {p.service_images.length === 1 ? 'foto' : 'fotos'}
                                    </span>
                                  )}
                                </span>
                                {p.partner_email && (
                                  <span className="text-[11px] font-mono text-stone-400 block">
                                    {p.partner_email}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-stone-800 block">{p.area}</span>
                            <span className="text-[11px] text-stone-500">
                              {p.city} ({p.district})
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-bold text-[#C81E2B] block">{p.discount_highlight}</span>
                            <span className="text-[11px] uppercase text-stone-400">
                              {p.benefit_type} · Válido até {p.valid_until}
                            </span>
                            {p.secret_code && (
                              <span className="text-[10px] font-mono text-stone-500 block mt-0.5">
                                Código: {p.secret_code}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-col items-start gap-1.5">
                              {p.signed_protocol_url ? (
                                <a
                                  href={p.signed_protocol_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-stone-300 bg-white hover:bg-stone-50 text-[11px] font-semibold text-stone-800 transition-colors"
                                >
                                  <FileText className="w-3 h-3 text-[#C81E2B]" />
                                  <span>Ver Protocolo da Empresa</span>
                                </a>
                              ) : (
                                <span className="text-[11px] text-stone-400">
                                  Sem protocolo da empresa
                                </span>
                              )}

                              <div className="flex flex-wrap items-center gap-1.5">
                                {p.has_counter_signed_protocol && p.counter_signed_protocol_url && (
                                  <a
                                    href={p.counter_signed_protocol_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-[11px] font-semibold text-emerald-900 transition-colors"
                                  >
                                    <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                                    <span>Ver Protocolo Assinado LPCS</span>
                                  </a>
                                )}

                                <label
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-stone-300 bg-[#FAF8F5] hover:border-[#C81E2B] text-[11px] font-semibold text-stone-700 hover:text-[#C81E2B] cursor-pointer transition-colors"
                                  title="Carregar ou substituir o protocolo assinado por ambas as partes (LPCS + Parceiro)"
                                >
                                  <Upload className="w-3 h-3 text-[#C81E2B]" />
                                  <span>Colocar Protocolo LPCS</span>
                                  <input
                                    type="file"
                                    accept="application/pdf,image/png,image/jpeg,image/webp,.doc,.docx"
                                    className="hidden"
                                    onChange={async (e) => {
                                      const file = e.target.files?.[0];
                                      if (!file) return;
                                      const fd = new FormData();
                                      fd.append('counter_signed_protocol', file);
                                      const res = await fetch(
                                        `/api/admin/partners/${p.id}/counter-signed-protocol`,
                                        {
                                          method: 'POST',
                                          credentials: 'same-origin',
                                          body: fd,
                                        }
                                      );
                                      const data = await res.json();
                                      if (res.ok) {
                                        showToast(
                                          data.message ||
                                            'Protocolo assinado por ambas as partes colocado na área privada!'
                                        );
                                        loadPartners();
                                      } else {
                                        showToast(data.error || 'Erro ao carregar protocolo.');
                                      }
                                      e.target.value = '';
                                    }}
                                  />
                                </label>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {p.is_active !== 0 && p.protocol_in_force !== false ? (
                              <div>
                                <span className="font-bold text-emerald-700 block">Em Vigor</span>
                                <span className="text-[10px] text-emerald-600 block">
                                  Protocolo na Área Privada
                                </span>
                              </div>
                            ) : (
                              <div>
                                <span className="font-semibold text-amber-700 block">
                                  Aguarda Protocolo LPCS
                                </span>
                                <span className="text-[10px] text-stone-500 block">
                                  Colocar protocolo assinado
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => openEditPartnerModal(p)}
                              className="p-1.5 rounded-md text-stone-600 hover:text-[#141619] hover:bg-stone-100"
                              title="Editar parceiro"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleTogglePartner(p.id)}
                              className="p-1.5 rounded-md text-stone-600 hover:text-amber-700 hover:bg-amber-50"
                              title="Ativar/Desativar"
                            >
                              <Power className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setDeleteTarget({
                                  type: 'partner',
                                  id: p.id,
                                  name: p.name,
                                  subtitle: `${p.area} · ${p.city} (${p.district})`,
                                })
                              }
                              className="p-1.5 rounded-md text-stone-400 hover:text-[#C81E2B] hover:bg-red-50"
                              title="Remover parceiro"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB: PARTNER INQUIRIES */}
          {activeTab === 'inquiries' && (
            <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
              <div className="px-6 py-5 border-b border-stone-200 flex items-center justify-between">
                <div>
                  <h3 className="font-display text-lg font-bold text-[#141619]">
                    Propostas de Parceria Empresarial
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Empresas interessadas em colaborar através do formulário de parceria.
                  </p>
                </div>
                <span className="text-xs font-mono text-stone-500 tabular-nums">
                  Total: {inquiriesList.length}
                </span>
              </div>

              {inquiriesList.length === 0 ? (
                <p className="text-sm text-stone-500 p-8 text-center">
                  Ainda não foram submetidas propostas de parceria.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-stone-600">
                    <thead className="font-condensed bg-[#FAF8F5] text-[11px] uppercase font-bold tracking-wider text-stone-500 border-b border-stone-200">
                      <tr>
                        <th className="py-3 px-4">Empresa / Logótipo</th>
                        <th className="py-3 px-4">Área / Local</th>
                        <th className="py-3 px-4">Desconto & Imagens</th>
                        <th className="py-3 px-4 text-right">Estado / Publicação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {inquiriesList.map((inq) => (
                        <tr key={inq.id} className="hover:bg-stone-50/70">
                          <td className="py-3.5 px-4">
                            <div className="flex items-start gap-3">
                              {inq.logo_url ? (
                                <img
                                  src={inq.logo_url}
                                  alt={`Logótipo ${inq.company_name}`}
                                  className="w-14 h-14 rounded-xl border border-stone-200 bg-white object-contain p-1.5 shrink-0"
                                />
                              ) : (
                                <div className="w-14 h-14 rounded-xl border border-stone-200 bg-stone-50 flex items-center justify-center text-xs font-bold text-stone-400 shrink-0">
                                  S/L
                                </div>
                              )}
                              <div>
                                <strong className="text-[#141619] block">{inq.company_name}</strong>
                                <span className="text-[11px] text-stone-500 block">
                                  {inq.contact_name}
                                  {inq.contact_role ? ` (${inq.contact_role})` : ''} · {inq.email} · {inq.phone}
                                </span>
                                {inq.address && (
                                  <span className="text-[11px] text-stone-400 block">Sede: {inq.address}</span>
                                )}
                                {inq.nif && (
                                  <span className="text-[11px] font-mono text-stone-400">NIPC: {inq.nif}</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="text-stone-800 block">{inq.area}</span>
                            <span className="text-[11px] text-stone-500">
                              {inq.city} ({inq.district})
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-bold text-[#C81E2B] block">{inq.proposed_benefit}</span>
                            <span className="text-[11px] uppercase text-stone-400">
                              {inq.benefit_type} ·{' '}
                              {inq.code_mode === 'codigo_unico' ? 'Código Único' : 'Rotativo/QR'} ·{' '}
                              {inq.max_uses ? `Máx. ${inq.max_uses} usos` : 'Ilimitado'} ·{' '}
                              Validade: {inq.valid_until || '2027-12-31'}
                            </span>
                            {inq.notes && (
                              <p className="text-[11px] text-stone-500 mt-1 max-w-xs">{inq.notes}</p>
                            )}
                            {Array.isArray(inq.service_images) && inq.service_images.length > 0 && (
                              <div className="flex items-center gap-1.5 mt-2">
                                {inq.service_images.map((img: any) => (
                                  <img
                                    key={img.id}
                                    src={img.url}
                                    alt={img.original_name}
                                    className="w-10 h-8 rounded object-cover border border-stone-200"
                                  />
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="inline-flex flex-col items-end gap-2">
                              <div className="flex flex-wrap justify-end items-center gap-1.5">
                                <a
                                  href={inq.protocol_url || `/api/partners/inquiry/${inq.id}/protocol`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-2.5 py-1.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 text-stone-800 text-[11px] font-semibold whitespace-nowrap inline-flex items-center gap-1 transition-colors"
                                >
                                  <FileText className="w-3.5 h-3.5 text-[#C81E2B]" />
                                  <span>Ver Protocolo Gerado</span>
                                </a>

                                {inq.signed_protocol_url && (
                                  <a
                                    href={inq.signed_protocol_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-2.5 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-[11px] font-semibold whitespace-nowrap inline-flex items-center gap-1 transition-colors"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                                    <span>Assinado pela Empresa</span>
                                  </a>
                                )}

                                {inq.counter_signed_protocol_url && (
                                  <a
                                    href={inq.counter_signed_protocol_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-2.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-semibold whitespace-nowrap inline-flex items-center gap-1 transition-colors"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>Assinado por Ambas as Partes</span>
                                  </a>
                                )}

                                <label className="px-2.5 py-1.5 rounded-lg border border-stone-300 bg-[#FAF8F5] hover:border-[#C81E2B] text-stone-800 text-[11px] font-semibold whitespace-nowrap inline-flex items-center gap-1 cursor-pointer transition-colors">
                                  <Upload className="w-3.5 h-3.5 text-[#C81E2B]" />
                                  <span>Colocar Protocolo LPCS (Ambas as Partes)</span>
                                  <input
                                    type="file"
                                    accept="application/pdf,image/png,image/jpeg,image/webp,.doc,.docx"
                                    className="hidden"
                                    onChange={async (e) => {
                                      const file = e.target.files?.[0];
                                      if (!file) return;
                                      const fd = new FormData();
                                      fd.append('counter_signed_protocol', file);
                                      const res = await fetch(
                                        `/api/admin/inquiries/${inq.id}/counter-signed-protocol`,
                                        {
                                          method: 'POST',
                                          credentials: 'same-origin',
                                          body: fd,
                                        }
                                      );
                                      const data = await res.json();
                                      if (res.ok) {
                                        showToast(
                                          data.message ||
                                            'Protocolo assinado por ambas as partes carregado!'
                                        );
                                        loadInquiries();
                                        loadPartners();
                                      } else {
                                        showToast(data.error || 'Erro ao carregar protocolo.');
                                      }
                                      e.target.value = '';
                                    }}
                                  />
                                </label>
                              </div>

                              <div className="flex items-center gap-2">
                                <select
                                  value={inq.status}
                                  onChange={async (e) => {
                                    const status = e.target.value;
                                    const res = await fetch(`/api/admin/inquiries/${inq.id}/status`, {
                                      method: 'POST',
                                      credentials: 'same-origin',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ status }),
                                    });
                                    if (res.ok) {
                                      showToast('Estado da proposta atualizado.');
                                      loadInquiries();
                                    }
                                  }}
                                  className="py-1.5 px-2.5 rounded-lg border border-stone-300 text-xs font-medium bg-white"
                                >
                                  <option value="pendente">Pendente</option>
                                  <option value="em_analise">Em Análise</option>
                                  <option value="aprovada">Aprovada</option>
                                  <option value="recusada">Recusada</option>
                                </select>
                                <button
                                  type="button"
                                  onClick={() => openPublishFromInquiryModal(inq)}
                                  className="px-3 py-1.5 rounded-lg bg-[#141619] hover:bg-stone-800 text-white text-[11px] font-bold whitespace-nowrap transition-colors"
                                >
                                  Publicar no Catálogo
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB: EMAIL NOTIFICATIONS (info@ligacontrasida.org) */}
          {activeTab === 'notifications' && (
            <div className="space-y-5">
              <div className="bg-white rounded-2xl p-6 border border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="font-condensed text-xs font-bold uppercase tracking-[0.14em] text-[#C81E2B]">
                    Notificações Automáticas de Inscrição
                  </div>
                  <h3 className="font-display text-lg font-bold text-[#141619]">
                    Destinatário Oficial: {emailConfig?.recipient || 'info@ligacontrasida.org'}
                  </h3>
                  <p className="text-xs text-stone-600">
                    Sempre que um associado conclui a inscrição (<span className="font-mono">/registar</span>) ou uma empresa submete parceria (<span className="font-mono">/parceria</span>), é emitido um e-mail automático para <strong className="text-[#141619]">info@ligacontrasida.org</strong>.
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border ${
                      emailConfig?.configured
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-amber-50 border-amber-200 text-amber-800'
                    }`}
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>{emailConfig?.provider || 'SMTP / Registo Ativo'}</span>
                  </span>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between">
                  <h4 className="font-display text-base font-bold text-[#141619]">
                    Histórico de E-mails Emitidos para info@ligacontrasida.org
                  </h4>
                  <span className="text-xs font-mono text-stone-500 tabular-nums">
                    {emailNotifications.length} notificações
                  </span>
                </div>

                {emailNotifications.length === 0 ? (
                  <p className="p-8 text-center text-sm text-stone-500">
                    Ainda não foram registadas novas inscrições desde a ativação das notificações.
                  </p>
                ) : (
                  <div className="divide-y divide-stone-100">
                    {emailNotifications.map((notif) => (
                      <div key={notif.id} className="p-5 space-y-2.5 hover:bg-stone-50/60">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded bg-stone-100 text-[#141619] font-mono text-[11px] font-bold uppercase">
                                {notif.event_type === 'inscricao_socio'
                                  ? 'Inscrição de Sócio'
                                  : 'Inscrição de Parceiro'}
                              </span>
                              <span className="text-xs font-mono text-stone-500">
                                Para: <strong className="text-[#141619]">{notif.recipient}</strong>
                              </span>
                            </div>
                            <h5 className="font-bold text-sm text-[#141619]">{notif.subject}</h5>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[11px] font-mono text-stone-400 tabular-nums">
                              {new Date(notif.created_at).toLocaleString('pt-PT')}
                            </span>
                            <a
                              href={`mailto:${notif.recipient}?subject=${encodeURIComponent(
                                notif.subject
                              )}&body=${encodeURIComponent(notif.body_text)}`}
                              className="px-3 py-1.5 rounded-lg bg-[#141619] hover:bg-stone-800 text-white text-[11px] font-bold"
                            >
                              Abrir no E-mail
                            </a>
                          </div>
                        </div>
                        <pre className="p-3.5 rounded-xl bg-[#FAF8F5] border border-stone-200 font-mono text-[11px] text-stone-700 whitespace-pre-wrap leading-relaxed overflow-x-auto">
                          {notif.body_text}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: AUDIT LOGS */}
          {activeTab === 'audit' && (
            <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
              <div className="px-6 py-5 border-b border-stone-200 flex items-center justify-between">
                <h3 className="font-display text-lg font-bold text-[#141619]">
                  Registo Completo de Auditoria
                </h3>
                <span className="text-xs font-mono text-stone-500 tabular-nums">
                  {auditLogs.length} eventos
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-stone-600">
                  <thead className="font-condensed bg-[#FAF8F5] text-[11px] uppercase font-bold tracking-wider text-stone-500 border-b border-stone-200">
                    <tr>
                      <th className="py-3 px-4">Data / Hora</th>
                      <th className="py-3 px-4">Ação</th>
                      <th className="py-3 px-4">Detalhes</th>
                      <th className="py-3 px-4">Sócio</th>
                      <th className="py-3 px-4">Origem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-stone-50/70">
                        <td className="py-3 px-4 font-mono text-[11px] text-stone-500 whitespace-nowrap tabular-nums">
                          {new Date(log.created_at).toLocaleString('pt-PT')}
                        </td>
                        <td className="py-3 px-4 font-bold text-[#141619]">{log.action}</td>
                        <td className="py-3 px-4 text-stone-700 max-w-sm truncate">{log.details}</td>
                        <td className="py-3 px-4 text-stone-600">
                          {log.user_name ? `${log.user_name} (${log.member_number})` : '—'}
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-stone-400 whitespace-nowrap tabular-nums">
                          {log.ip_address || '127.0.0.1'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ========================================== */}
      {/* MODAL: ADMIT NEW MEMBER                    */}
      {/* ========================================== */}
      {admitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#141619]/75 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 sm:p-8 max-w-2xl w-full border border-stone-200 shadow-2xl space-y-5 my-8">
            <div className="flex items-start justify-between border-b border-stone-200 pb-4">
              <div>
                <div className="font-condensed text-xs font-bold uppercase tracking-[0.14em] text-[#C81E2B]">
                  Admissão Administrativa
                </div>
                <h3 className="font-display text-xl font-bold text-[#141619] mt-0.5">
                  Admitir Novo Associado LPCS
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setAdmitModalOpen(false)}
                className="text-stone-400 hover:text-[#141619]"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {admitError && (
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-800">
                <AlertCircle className="w-4 h-4 text-[#C81E2B] shrink-0 mt-0.5" />
                <span>{admitError}</span>
              </div>
            )}

            <form onSubmit={handleAdmitMember} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-stone-700 block mb-1">
                    Nome Completo (mín. 2 termos) *
                  </label>
                  <input
                    type="text"
                    required
                    value={admitForm.name}
                    onChange={(e) => setAdmitForm({ ...admitForm, name: e.target.value })}
                    placeholder="Ex: António Manuel Ferreira"
                    className="w-full p-2.5 rounded-lg border border-stone-300 text-xs focus:outline-hidden focus:border-[#C81E2B]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">E-mail *</label>
                  <input
                    type="email"
                    required
                    value={admitForm.email}
                    onChange={(e) => setAdmitForm({ ...admitForm, email: e.target.value })}
                    placeholder="socio@exemplo.pt"
                    className="w-full p-2.5 rounded-lg border border-stone-300 text-xs focus:outline-hidden focus:border-[#C81E2B]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">
                    Palavra-passe Inicial (mín. 6 car.) *
                  </label>
                  <input
                    type="password"
                    minLength={6}
                    required
                    value={admitForm.password}
                    onChange={(e) => setAdmitForm({ ...admitForm, password: e.target.value })}
                    placeholder="••••••••"
                    className="w-full p-2.5 rounded-lg border border-stone-300 text-xs focus:outline-hidden focus:border-[#C81E2B]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">
                    Data de Nascimento (mín. 16 anos) *
                  </label>
                  <input
                    type="date"
                    required
                    value={admitForm.birth_date}
                    onChange={(e) => setAdmitForm({ ...admitForm, birth_date: e.target.value })}
                    className="w-full p-2.5 rounded-lg border border-stone-300 text-xs tabular-nums focus:outline-hidden focus:border-[#C81E2B]"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-stone-700">NIF (9 dígitos) *</label>
                    {admitForm.nif.length === 9 && (
                      <span
                        className={`text-[11px] font-bold ${
                          admitNifValid ? 'text-emerald-700' : 'text-[#C81E2B]'
                        }`}
                      >
                        {admitNifValid ? 'Módulo 11 OK' : 'NIF Inválido'}
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    maxLength={9}
                    required
                    value={admitForm.nif}
                    onChange={(e) =>
                      setAdmitForm({ ...admitForm, nif: e.target.value.replace(/\D/g, '') })
                    }
                    placeholder="234567890"
                    className="w-full p-2.5 rounded-lg border border-stone-300 text-xs font-mono tabular-nums focus:outline-hidden focus:border-[#C81E2B]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">
                    Telemóvel (91/92/93/96) *
                  </label>
                  <input
                    type="text"
                    maxLength={9}
                    required
                    value={admitForm.phone}
                    onChange={(e) =>
                      setAdmitForm({ ...admitForm, phone: e.target.value.replace(/\D/g, '') })
                    }
                    placeholder="912345678"
                    className="w-full p-2.5 rounded-lg border border-stone-300 text-xs font-mono tabular-nums focus:outline-hidden focus:border-[#C81E2B]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">
                    Nº de Sócio (Opcional — automático se vazio)
                  </label>
                  <input
                    type="text"
                    value={admitForm.member_number}
                    onChange={(e) =>
                      setAdmitForm({ ...admitForm, member_number: e.target.value.toUpperCase() })
                    }
                    placeholder="Ex: LPCS-00105 (vazio = auto)"
                    className="w-full p-2.5 rounded-lg border border-stone-300 text-xs font-mono uppercase focus:outline-hidden focus:border-[#C81E2B]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-stone-700 block mb-1">Morada Completa *</label>
                  <input
                    type="text"
                    required
                    value={admitForm.address}
                    onChange={(e) => setAdmitForm({ ...admitForm, address: e.target.value })}
                    placeholder="Rua, Número, Andar"
                    className="w-full p-2.5 rounded-lg border border-stone-300 text-xs focus:outline-hidden focus:border-[#C81E2B]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">
                    Código Postal (0000-000) *
                  </label>
                  <input
                    type="text"
                    maxLength={8}
                    required
                    value={admitForm.postal_code}
                    onChange={(e) => {
                      let val = e.target.value.replace(/[^\d-]/g, '');
                      if (val.length === 4 && !val.includes('-')) val += '-';
                      setAdmitForm({ ...admitForm, postal_code: val });
                    }}
                    placeholder="1600-316"
                    className="w-full p-2.5 rounded-lg border border-stone-300 text-xs font-mono tabular-nums focus:outline-hidden focus:border-[#C81E2B]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">Localidade *</label>
                  <input
                    type="text"
                    required
                    value={admitForm.city}
                    onChange={(e) => setAdmitForm({ ...admitForm, city: e.target.value })}
                    placeholder="Lisboa"
                    className="w-full p-2.5 rounded-lg border border-stone-300 text-xs focus:outline-hidden focus:border-[#C81E2B]"
                  />
                </div>
              </div>

              {/* Initial Quota Section */}
              <div className="p-4 rounded-xl bg-[#FAF8F5] border border-stone-200 space-y-3">
                <div className="font-condensed text-xs font-bold uppercase tracking-wider text-stone-600">
                  Enquadramento Inicial de Quota na Admissão
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-stone-700 block mb-1">
                      Quota Inicial
                    </label>
                    <select
                      value={admitForm.initial_quota}
                      onChange={(e) =>
                        setAdmitForm({ ...admitForm, initial_quota: e.target.value as any })
                      }
                      className="w-full p-2 rounded-lg border border-stone-300 text-xs bg-white"
                    >
                      <option value="anual">Anual — 35,00 € (12 meses ativos)</option>
                      <option value="semestral">Semestral — 17,50 € (6 meses ativos)</option>
                      <option value="nenhum">Sem quota inicial (pendente pagamento)</option>
                    </select>
                  </div>

                  {admitForm.initial_quota !== 'nenhum' && (
                    <div>
                      <label className="text-[11px] font-bold text-stone-700 block mb-1">
                        Meio de Pagamento
                      </label>
                      <select
                        value={admitForm.initial_quota_method}
                        onChange={(e) =>
                          setAdmitForm({ ...admitForm, initial_quota_method: e.target.value as any })
                        }
                        className="w-full p-2 rounded-lg border border-stone-300 text-xs bg-white"
                      >
                        <option value="manual">Registo Direto / Numerário</option>
                        <option value="transferencia">Transferência Bancária</option>
                        <option value="mbway">MB WAY</option>
                        <option value="multibanco">Multibanco</option>
                      </select>
                    </div>
                  )}
                </div>

                {admitForm.initial_quota !== 'nenhum' && (
                  <div>
                    <label className="text-[11px] font-bold text-stone-700 block mb-1">
                      Observação / Referência do Pagamento
                    </label>
                    <input
                      type="text"
                      value={admitForm.initial_quota_notes}
                      onChange={(e) =>
                        setAdmitForm({ ...admitForm, initial_quota_notes: e.target.value })
                      }
                      className="w-full p-2 rounded-lg border border-stone-300 text-xs bg-white"
                    />
                  </div>
                )}
              </div>

              <div className="flex gap-2.5 pt-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setAdmitModalOpen(false)}
                  className="flex-1 py-2.5 rounded-lg border border-stone-300 text-xs font-bold text-stone-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={admitSubmitting}
                  className="flex-1 py-2.5 rounded-lg bg-[#C81E2B] hover:bg-[#A11622] text-white text-xs font-bold flex items-center justify-center gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>{admitSubmitting ? 'A admitir...' : 'Confirmar Admissão de Sócio'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL: INDIVIDUAL MEMBER MANAGEMENT        */}
      {/* ========================================== */}
      {managingUserId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#141619]/75 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full border border-stone-200 shadow-2xl overflow-hidden my-8">
            {memberDetailLoading || !memberDetail ? (
              <div className="p-16 text-center space-y-3">
                <div className="w-7 h-7 border-2 border-[#C81E2B] border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs text-stone-500">A carregar ficha completa do associado...</p>
              </div>
            ) : (
              <>
                {/* Member File Header */}
                <div className="px-6 py-5 bg-[#141619] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-mono font-bold text-rose-400 tabular-nums">
                        {memberDetail.member.member_number}
                      </span>
                      <span className="text-stone-500">·</span>
                      <span
                        className={`font-bold ${
                          memberDetail.member.is_suspended === 1 ? 'text-rose-400' : 'text-emerald-400'
                        }`}
                      >
                        {memberDetail.member.is_suspended === 1 ? 'Conta Suspensa' : 'Conta Ativa'}
                      </span>
                      <span className="text-stone-500">·</span>
                      <span className="text-stone-300 tabular-nums">
                        {memberDetail.member.quota_status.has_active_quota
                          ? `Quota válida até ${memberDetail.member.quota_status.valid_until} (${memberDetail.member.quota_status.days_remaining}d)`
                          : 'Sem quota ativa'}
                      </span>
                    </div>
                    <h3 className="font-display text-xl sm:text-2xl font-bold text-white">
                      {memberDetail.member.name}
                    </h3>
                    <p className="text-xs text-stone-400">
                      {memberDetail.member.email} · Inscrito em{' '}
                      {new Date(memberDetail.member.created_at).toLocaleDateString('pt-PT')}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setManagingUserId(null);
                      setMemberDetail(null);
                    }}
                    className="self-start sm:self-center p-2 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800"
                    aria-label="Fechar"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Member Sub-tabs */}
                <div className="px-6 bg-[#FAF8F5] border-b border-stone-200 flex items-center gap-6 overflow-x-auto">
                  {[
                    { id: 'dados', label: 'Dados Pessoais e Acesso' },
                    { id: 'quotas', label: `Quotas (${memberDetail.quotas.length})` },
                    {
                      id: 'atividade',
                      label: `Recibos (${memberDetail.receipts.length}) & Descontos (${memberDetail.redemptions.length})`,
                    },
                  ].map((t) => (
                    <button
                      type="button"
                      key={t.id}
                      onClick={() => setMemberDetailTab(t.id as any)}
                      className={`py-3 text-xs font-bold border-b-2 transition-colors whitespace-nowrap ${
                        memberDetailTab === t.id
                          ? 'border-[#C81E2B] text-[#141619]'
                          : 'border-transparent text-stone-500 hover:text-[#141619]'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Member Sub-tab Content */}
                <div className="p-6 sm:p-8 max-h-[70vh] overflow-y-auto space-y-6">
                  {memberSaveError && (
                    <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-800">
                      <AlertCircle className="w-4 h-4 text-[#C81E2B] shrink-0 mt-0.5" />
                      <span>{memberSaveError}</span>
                    </div>
                  )}

                  {/* SUB-TAB 1: EDIT DATA & ACCESS */}
                  {memberDetailTab === 'dados' && (
                    <div className="space-y-8">
                      <form onSubmit={handleSaveMemberDetails} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="sm:col-span-2">
                            <label className="text-xs font-bold text-stone-700 block mb-1">
                              Nome Completo *
                            </label>
                            <input
                              type="text"
                              required
                              value={memberEditForm.name}
                              onChange={(e) =>
                                setMemberEditForm({ ...memberEditForm, name: e.target.value })
                              }
                              className="w-full p-2.5 rounded-lg border border-stone-300 text-xs focus:outline-hidden focus:border-[#C81E2B]"
                            />
                          </div>

                          <div>
                            <label className="text-xs font-bold text-stone-700 block mb-1">
                              E-mail *
                            </label>
                            <input
                              type="email"
                              required
                              value={memberEditForm.email}
                              onChange={(e) =>
                                setMemberEditForm({ ...memberEditForm, email: e.target.value })
                              }
                              className="w-full p-2.5 rounded-lg border border-stone-300 text-xs focus:outline-hidden focus:border-[#C81E2B]"
                            />
                          </div>

                          <div>
                            <label className="text-xs font-bold text-stone-700 block mb-1">
                              Nº de Sócio *
                            </label>
                            <input
                              type="text"
                              required
                              value={memberEditForm.member_number}
                              onChange={(e) =>
                                setMemberEditForm({
                                  ...memberEditForm,
                                  member_number: e.target.value.toUpperCase(),
                                })
                              }
                              className="w-full p-2.5 rounded-lg border border-stone-300 text-xs font-mono uppercase focus:outline-hidden focus:border-[#C81E2B]"
                            />
                          </div>

                          <div>
                            <label className="text-xs font-bold text-stone-700 block mb-1">
                              Data de Nascimento *
                            </label>
                            <div className="relative">
                              <Calendar className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                              <input
                                type="date"
                                required
                                value={memberEditForm.birth_date}
                                onChange={(e) =>
                                  setMemberEditForm({
                                    ...memberEditForm,
                                    birth_date: e.target.value,
                                  })
                                }
                                className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-stone-300 text-xs tabular-nums focus:outline-hidden focus:border-[#C81E2B]"
                              />
                            </div>
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-xs font-bold text-stone-700">NIF *</label>
                              {memberEditForm.nif.length === 9 && (
                                <span
                                  className={`text-[11px] font-bold ${
                                    editNifValid ? 'text-emerald-700' : 'text-[#C81E2B]'
                                  }`}
                                >
                                  {editNifValid ? 'Módulo 11 OK' : 'NIF Inválido'}
                                </span>
                              )}
                            </div>
                            <input
                              type="text"
                              maxLength={9}
                              required
                              value={memberEditForm.nif}
                              onChange={(e) =>
                                setMemberEditForm({
                                  ...memberEditForm,
                                  nif: e.target.value.replace(/\D/g, ''),
                                })
                              }
                              className="w-full p-2.5 rounded-lg border border-stone-300 text-xs font-mono tabular-nums focus:outline-hidden focus:border-[#C81E2B]"
                            />
                          </div>

                          <div>
                            <label className="text-xs font-bold text-stone-700 block mb-1">
                              Telemóvel *
                            </label>
                            <div className="relative">
                              <Phone className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                              <input
                                type="text"
                                maxLength={9}
                                required
                                value={memberEditForm.phone}
                                onChange={(e) =>
                                  setMemberEditForm({
                                    ...memberEditForm,
                                    phone: e.target.value.replace(/\D/g, ''),
                                  })
                                }
                                className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-stone-300 text-xs font-mono tabular-nums focus:outline-hidden focus:border-[#C81E2B]"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-xs font-bold text-stone-700 block mb-1">
                              Estado da Conta
                            </label>
                            <select
                              value={memberEditForm.is_suspended ? 'suspensa' : 'ativa'}
                              disabled={memberDetail.member.id === user.id}
                              onChange={(e) =>
                                setMemberEditForm({
                                  ...memberEditForm,
                                  is_suspended: e.target.value === 'suspensa',
                                })
                              }
                              className="w-full p-2.5 rounded-lg border border-stone-300 text-xs bg-white disabled:opacity-50"
                            >
                              <option value="ativa">Ativa (acesso normal ao portal)</option>
                              <option value="suspensa">Suspensa (login bloqueado)</option>
                            </select>
                          </div>

                          <div className="sm:col-span-2">
                            <label className="text-xs font-bold text-stone-700 block mb-1">
                              Morada Completa *
                            </label>
                            <div className="relative">
                              <MapPin className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                              <input
                                type="text"
                                required
                                value={memberEditForm.address}
                                onChange={(e) =>
                                  setMemberEditForm({ ...memberEditForm, address: e.target.value })
                                }
                                className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-stone-300 text-xs focus:outline-hidden focus:border-[#C81E2B]"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-xs font-bold text-stone-700 block mb-1">
                              Código Postal *
                            </label>
                            <input
                              type="text"
                              maxLength={8}
                              required
                              value={memberEditForm.postal_code}
                              onChange={(e) => {
                                let val = e.target.value.replace(/[^\d-]/g, '');
                                if (val.length === 4 && !val.includes('-')) val += '-';
                                setMemberEditForm({ ...memberEditForm, postal_code: val });
                              }}
                              className="w-full p-2.5 rounded-lg border border-stone-300 text-xs font-mono tabular-nums focus:outline-hidden focus:border-[#C81E2B]"
                            />
                          </div>

                          <div>
                            <label className="text-xs font-bold text-stone-700 block mb-1">
                              Localidade *
                            </label>
                            <input
                              type="text"
                              required
                              value={memberEditForm.city}
                              onChange={(e) =>
                                setMemberEditForm({ ...memberEditForm, city: e.target.value })
                              }
                              className="w-full p-2.5 rounded-lg border border-stone-300 text-xs focus:outline-hidden focus:border-[#C81E2B]"
                            />
                          </div>
                        </div>

                        <div className="flex justify-end pt-2">
                          <button
                            type="submit"
                            disabled={memberSaveLoading}
                            className="px-5 py-2.5 rounded-lg bg-[#141619] hover:bg-stone-800 text-white text-xs font-bold transition-colors"
                          >
                            {memberSaveLoading ? 'A guardar...' : 'Guardar Dados do Associado'}
                          </button>
                        </div>
                      </form>

                      {/* Password Reset Box */}
                      <form
                        onSubmit={handleResetMemberPassword}
                        className="p-4 rounded-xl bg-[#FAF8F5] border border-stone-200 flex flex-col sm:flex-row sm:items-end justify-between gap-4"
                      >
                        <div className="flex-1 space-y-1.5">
                          <label className="text-xs font-bold text-[#141619] flex items-center gap-1.5">
                            <KeyRound className="w-3.5 h-3.5 text-[#C81E2B]" />
                            <span>Redefinir Palavra-passe do Associado</span>
                          </label>
                          <input
                            type="password"
                            minLength={6}
                            value={newMemberPassword}
                            onChange={(e) => setNewMemberPassword(e.target.value)}
                            placeholder="Nova palavra-passe (mínimo 6 carateres)"
                            className="w-full p-2.5 rounded-lg border border-stone-300 bg-white text-xs focus:outline-hidden focus:border-[#C81E2B]"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={passwordResetLoading || newMemberPassword.length < 6}
                          className="px-4 py-2.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 disabled:opacity-50 text-xs font-bold text-[#141619] whitespace-nowrap"
                        >
                          {passwordResetLoading ? 'A atualizar...' : 'Atualizar Palavra-passe'}
                        </button>
                      </form>

                      {/* Removal Zone */}
                      {memberDetail.member.id !== user.id && (
                        <div className="pt-4 border-t border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="text-xs text-stone-600">
                            <strong className="text-[#141619] block">Remoção Definitiva de Associado</strong>
                            <span>
                              Elimina a ficha, sessões, histórico de quotas, recibos e resgates deste sócio.
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setDeleteTarget({
                                type: 'user',
                                id: memberDetail.member.id,
                                name: memberDetail.member.name,
                                subtitle: `${memberDetail.member.member_number} · ${memberDetail.member.email} · NIF ${memberDetail.member.nif}`,
                              })
                            }
                            className="px-4 py-2 rounded-lg border border-red-300 bg-red-50 hover:bg-red-100 text-[#C81E2B] text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Remover Associado</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* SUB-TAB 2: QUOTAS */}
                  {memberDetailTab === 'quotas' && (
                    <div className="space-y-6">
                      {/* Quick stats + Inline Grant */}
                      <form
                        onSubmit={handleGrantDetailQuota}
                        className="p-4 sm:p-5 rounded-xl bg-[#FAF8F5] border border-stone-200 space-y-4"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <h4 className="text-sm font-bold text-[#141619]">
                              Lançar ou Acumular Nova Quota
                            </h4>
                            <p className="text-xs text-stone-500">
                              Total acumulado pago: {memberDetail.member.quota_status.total_paid_euros.toFixed(2)} € em{' '}
                              {memberDetail.member.quota_status.total_paid_count} pagamentos.
                            </p>
                          </div>
                          <span className="text-xs font-mono font-bold text-[#141619] tabular-nums">
                            {memberDetail.member.quota_status.valid_until
                              ? `Validade atual: ${memberDetail.member.quota_status.valid_until}`
                              : 'Sem validade ativa'}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <select
                            value={detailQuotaPlan}
                            onChange={(e) => setDetailQuotaPlan(e.target.value as any)}
                            className="p-2.5 rounded-lg border border-stone-300 bg-white text-xs font-medium"
                          >
                            <option value="anual">Anual · 35,00 € (+12 meses)</option>
                            <option value="semestral">Semestral · 17,50 € (+6 meses)</option>
                          </select>
                          <input
                            type="text"
                            value={detailQuotaNotes}
                            onChange={(e) => setDetailQuotaNotes(e.target.value)}
                            placeholder="Nota interna / comprovativo"
                            className="p-2.5 rounded-lg border border-stone-300 bg-white text-xs"
                          />
                          <button
                            type="submit"
                            disabled={detailQuotaSubmitting}
                            className="px-4 py-2.5 rounded-lg bg-[#C81E2B] hover:bg-[#A11622] text-white text-xs font-bold flex items-center justify-center gap-1.5"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>{detailQuotaSubmitting ? 'A lançar...' : 'Lançar Quota'}</span>
                          </button>
                        </div>
                      </form>

                      {/* Quotas List */}
                      {memberDetail.quotas.length === 0 ? (
                        <p className="text-xs text-stone-500 text-center py-6">
                          Este associado ainda não tem pagamentos de quota registados.
                        </p>
                      ) : (
                        <div className="border border-stone-200 rounded-xl overflow-hidden">
                          <table className="w-full text-left text-xs text-stone-600">
                            <thead className="font-condensed bg-[#FAF8F5] text-[11px] uppercase font-bold tracking-wider text-stone-500 border-b border-stone-200">
                              <tr>
                                <th className="py-2.5 px-4">Data</th>
                                <th className="py-2.5 px-3">Plano</th>
                                <th className="py-2.5 px-3">Valor</th>
                                <th className="py-2.5 px-3">Referência</th>
                                <th className="py-2.5 px-3">Validade</th>
                                <th className="py-2.5 px-4 text-right">Ação</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100">
                              {memberDetail.quotas.map((q: any) => (
                                <tr key={q.id}>
                                  <td className="py-3 px-4 tabular-nums">
                                    {new Date(q.created_at).toLocaleDateString('pt-PT')}
                                  </td>
                                  <td className="py-3 px-3 font-bold text-[#141619] capitalize">
                                    {q.plan_type} ({q.payment_method})
                                  </td>
                                  <td className="py-3 px-3 font-mono font-bold text-[#141619] tabular-nums">
                                    {(q.amount_cents / 100).toFixed(2)} €
                                  </td>
                                  <td className="py-3 px-3 font-mono text-[11px]">{q.reference}</td>
                                  <td className="py-3 px-3 font-mono tabular-nums">
                                    {q.valid_from} → {q.valid_until}
                                  </td>
                                  <td className="py-3 px-4 text-right whitespace-nowrap">
                                    {confirmRemoveQuotaId === q.id ? (
                                      <span className="inline-flex items-center gap-1.5">
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteQuota(q.id)}
                                          className="px-2 py-1 rounded bg-[#C81E2B] text-white text-[11px] font-bold"
                                        >
                                          Confirmar
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setConfirmRemoveQuotaId(null)}
                                          className="px-2 py-1 rounded border border-stone-300 text-[11px]"
                                        >
                                          Não
                                        </button>
                                      </span>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => setConfirmRemoveQuotaId(q.id)}
                                        className="text-[11px] font-semibold text-stone-500 hover:text-[#C81E2B]"
                                      >
                                        Anular
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* SUB-TAB 3: RECEIPTS & REDEMPTIONS */}
                  {memberDetailTab === 'atividade' && (
                    <div className="space-y-6">
                      {/* Receipts */}
                      <div className="space-y-3">
                        <h4 className="text-sm font-bold text-[#141619] flex items-center gap-2">
                          <FileText className="w-4 h-4 text-[#C81E2B]" />
                          <span>Recibos Arquivados ({memberDetail.receipts.length})</span>
                        </h4>
                        {memberDetail.receipts.length === 0 ? (
                          <p className="text-xs text-stone-500">Sem recibos carregados pelo sócio.</p>
                        ) : (
                          <div className="border border-stone-200 rounded-xl divide-y divide-stone-100">
                            {memberDetail.receipts.map((r: any) => (
                              <div
                                key={r.id}
                                className="px-4 py-3 flex items-center justify-between gap-3 text-xs"
                              >
                                <div>
                                  <strong className="text-[#141619] block">{r.original_name}</strong>
                                  <span className="text-[11px] text-stone-500 tabular-nums">
                                    {(r.file_size / 1024).toFixed(1)} KB ·{' '}
                                    {new Date(r.created_at).toLocaleDateString('pt-PT')}
                                    {r.notes ? ` · ${r.notes}` : ''}
                                  </span>
                                </div>
                                <a
                                  href={`/api/receipts/${r.id}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-stone-300 text-xs font-bold text-[#141619] hover:bg-stone-50"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  <span>Ver</span>
                                </a>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Partner Redemptions */}
                      <div className="space-y-3">
                        <h4 className="text-sm font-bold text-[#141619] flex items-center gap-2">
                          <Tag className="w-4 h-4 text-[#C81E2B]" />
                          <span>Códigos de Desconto Emitidos ({memberDetail.redemptions.length})</span>
                        </h4>
                        {memberDetail.redemptions.length === 0 ? (
                          <p className="text-xs text-stone-500">
                            Nenhum código promocional emitido até ao momento.
                          </p>
                        ) : (
                          <div className="border border-stone-200 rounded-xl overflow-hidden">
                            <table className="w-full text-left text-xs text-stone-600">
                              <thead className="font-condensed bg-[#FAF8F5] text-[11px] uppercase font-bold tracking-wider text-stone-500 border-b border-stone-200">
                                <tr>
                                  <th className="py-2.5 px-4">Parceiro</th>
                                  <th className="py-2.5 px-3">Referência</th>
                                  <th className="py-2.5 px-3">Estado</th>
                                  <th className="py-2.5 px-4 text-right">Emissão / Validação</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-stone-100">
                                {memberDetail.redemptions.map((rd: any) => (
                                  <tr key={rd.id}>
                                    <td className="py-2.5 px-4 font-bold text-[#141619]">
                                      {rd.partner_name}
                                    </td>
                                    <td className="py-2.5 px-3 font-mono text-[11px]">
                                      {rd.reference_code}
                                    </td>
                                    <td className="py-2.5 px-3 font-bold">
                                      {rd.status === 'used' ? (
                                        <span className="text-emerald-700">Validado</span>
                                      ) : rd.status === 'active' ? (
                                        <span className="text-amber-700">Ativo</span>
                                      ) : (
                                        <span className="text-stone-400">Expirado</span>
                                      )}
                                    </td>
                                    <td className="py-2.5 px-4 text-right font-mono text-[11px] tabular-nums">
                                      {rd.used_at
                                        ? `Validado: ${new Date(rd.used_at).toLocaleDateString('pt-PT')}`
                                        : new Date(rd.issued_at).toLocaleDateString('pt-PT')}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL: CONFIRM PERMANENT DELETION          */}
      {/* ========================================== */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#141619]/75 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-6 sm:p-7 max-w-md w-full border border-stone-200 shadow-2xl space-y-5">
            <div className="flex items-start justify-between border-b border-stone-100 pb-3">
              <div>
                <div className="font-condensed text-xs font-bold uppercase tracking-wider text-[#C81E2B]">
                  Confirmação Irreversível
                </div>
                <h3 className="font-display text-lg font-bold text-[#141619] mt-0.5">
                  {deleteTarget.type === 'user' ? 'Remover Associado' : 'Remover Parceiro'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="text-stone-400 hover:text-[#141619]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs text-stone-600 leading-relaxed">
              <p>
                Tem a certeza que pretende remover permanentemente{' '}
                <strong className="text-[#141619]">{deleteTarget.name}</strong>?
              </p>
              <div className="p-3 rounded-lg bg-[#FAF8F5] border border-stone-200 font-mono text-[11px] text-stone-700">
                {deleteTarget.subtitle}
              </div>
              {deleteTarget.type === 'user' && (
                <p className="text-[#C81E2B] font-medium">
                  Todos os pagamentos de quotas, recibos arquivados, sessões e códigos de desconto deste associado serão eliminados.
                </p>
              )}
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                disabled={deleteSubmitting}
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 rounded-lg border border-stone-300 text-xs font-bold text-stone-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deleteSubmitting}
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 rounded-lg bg-[#C81E2B] hover:bg-[#A11622] text-white text-xs font-bold"
              >
                {deleteSubmitting ? 'A remover...' : 'Confirmar Remoção'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL: QUICK MANUAL QUOTA GRANT            */}
      {/* ========================================== */}
      {manualQuotaModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#141619]/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-6 sm:p-8 max-w-md w-full border border-stone-200 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="font-display text-lg font-bold text-[#141619]">
                Lançar Quota Manualmente
              </h3>
              <button
                type="button"
                onClick={() => setManualQuotaModalUser(null)}
                className="text-stone-400 hover:text-[#141619]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed">
              Atribuir quota a <strong className="text-[#141619]">{manualQuotaModalUser.name}</strong> (
              <span className="font-mono">{manualQuotaModalUser.member_number}</span>) após confirmação de pagamento externo.
            </p>

            <form onSubmit={handleGrantManualQuota} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1.5">
                  Plano de Quota
                </label>
                <select
                  value={manualQuotaPlan}
                  onChange={(e) => setManualQuotaPlan(e.target.value as any)}
                  className="w-full p-2.5 rounded-lg border border-stone-300 text-xs font-medium bg-white"
                >
                  <option value="anual">Anual (35,00 € · 12 Meses)</option>
                  <option value="semestral">Semestral (17,50 € · 6 Meses)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1.5">Nota Interna</label>
                <input
                  type="text"
                  value={manualQuotaNotes}
                  onChange={(e) => setManualQuotaNotes(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-stone-300 text-xs"
                  placeholder="Ex: Transferência bancária comprovativo nº 849"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setManualQuotaModalUser(null)}
                  className="flex-1 py-2.5 rounded-lg border border-stone-300 text-xs font-bold text-stone-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-lg bg-[#C81E2B] hover:bg-[#A11622] text-white text-xs font-bold"
                >
                  Confirmar Lançamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL: ADD / EDIT PARTNER                  */}
      {/* ========================================== */}
      {partnerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-[#141619]/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 sm:p-8 max-w-2xl w-full border border-stone-200 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <h3 className="font-display text-lg font-bold text-[#141619]">
                  {editingPartner
                    ? `Editar Parceiro: ${editingPartner.name}`
                    : fromInquiryId
                    ? `Publicar Proposta: ${partnerFormData.name}`
                    : 'Adicionar Novo Parceiro'}
                </h3>
                {fromInquiryId && (
                  <p className="text-[11px] text-stone-500 mt-0.5">
                    O logótipo e as imagens da candidatura serão transferidos automaticamente para o catálogo.
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setPartnerModalOpen(false)}
                className="text-stone-400 hover:text-[#141619]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {partnerFormError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-[#C81E2B] shrink-0" />
                <span>{partnerFormError}</span>
              </div>
            )}

            <form onSubmit={handleSavePartner} className="space-y-4">
              {/* MANDATORY LOGO & OPTIONAL SERVICE IMAGES */}
              <div className="p-4 rounded-xl bg-[#FAF8F5] border border-stone-200 space-y-4">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <label className="text-xs font-bold text-stone-800">
                      Logótipo da Entidade Parceira *
                    </label>
                    <span className="text-[11px] text-stone-500">
                      PNG, JPG, WEBP ou SVG · máx. 5 MB
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-24 h-24 rounded-2xl border border-stone-200 bg-white flex items-center justify-center p-2 shrink-0 overflow-hidden shadow-xs">
                      {partnerLogoPreview || partnerExistingLogoUrl ? (
                        <img
                          src={partnerLogoPreview || partnerExistingLogoUrl || ''}
                          alt="Pré-visualização do logótipo"
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <Building2 className="w-8 h-8 text-stone-300" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 text-xs font-bold text-[#141619] cursor-pointer transition-colors">
                        <Upload className="w-3.5 h-3.5 text-[#C81E2B]" />
                        <span>
                          {partnerLogoFile
                            ? 'Substituir ficheiro selecionado'
                            : partnerExistingLogoUrl
                            ? 'Substituir logótipo atual'
                            : 'Carregar logótipo obrigatório'}
                        </span>
                        <input
                          type="file"
                          accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml"
                          onChange={handlePartnerLogoChange}
                          className="sr-only"
                        />
                      </label>
                      {partnerLogoFile && (
                        <p className="text-[11px] text-emerald-700 font-medium truncate">
                          Selecionado: {partnerLogoFile.name}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="border-t border-stone-200 pt-3">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <label className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-stone-500" />
                      <span>Imagens Ilustrativas dos Serviços (Opcional · máx. 4)</span>
                    </label>
                    <label className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 text-[11px] font-bold text-[#141619] cursor-pointer transition-colors">
                      <Plus className="w-3 h-3 text-[#C81E2B]" />
                      <span>Adicionar fotos</span>
                      <input
                        type="file"
                        multiple
                        accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                        onChange={handlePartnerServiceImagesChange}
                        className="sr-only"
                      />
                    </label>
                  </div>

                  {existingServiceImages.length === 0 && partnerServiceFiles.length === 0 ? (
                    <p className="text-[11px] text-stone-500">
                      Sem fotografias de serviço associadas. O cartão exibirá o logótipo em destaque.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {existingServiceImages.map((img) => {
                        const markedRemove = removeServiceImageIds.includes(img.id);
                        return (
                          <div
                            key={`existing-${img.id}`}
                            className={`relative rounded-lg border overflow-hidden aspect-[4/3] bg-stone-100 ${
                              markedRemove ? 'border-red-300 opacity-45' : 'border-stone-200'
                            }`}
                          >
                            <img
                              src={img.url}
                              alt={img.original_name}
                              className="w-full h-full object-cover"
                            />
                            {!fromInquiryId && (
                              <button
                                type="button"
                                onClick={() =>
                                  setRemoveServiceImageIds((prev) =>
                                    prev.includes(img.id)
                                      ? prev.filter((id) => id !== img.id)
                                      : [...prev, img.id]
                                  )
                                }
                                title={markedRemove ? 'Repor imagem' : 'Marcar para remover'}
                                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-[#141619]/80 text-white flex items-center justify-center hover:bg-[#C81E2B]"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        );
                      })}

                      {partnerServiceFiles.map((item, idx) => (
                        <div
                          key={`new-${idx}`}
                          className="relative rounded-lg border border-emerald-300 overflow-hidden aspect-[4/3] bg-stone-100"
                        >
                          <img
                            src={item.preview}
                            alt={item.file.name}
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setPartnerServiceFiles((prev) => prev.filter((_, i) => i !== idx))
                            }
                            title="Remover foto"
                            className="absolute top-1 right-1 w-6 h-6 rounded-full bg-[#141619]/80 text-white flex items-center justify-center hover:bg-[#C81E2B]"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-stone-700 block mb-1">
                    Nome do Parceiro *
                  </label>
                  <input
                    type="text"
                    required
                    value={partnerFormData.name}
                    onChange={(e) => setPartnerFormData({ ...partnerFormData, name: e.target.value })}
                    className="w-full p-2.5 rounded-lg border border-stone-300 text-xs"
                    placeholder="Ex: Farmácia Saúde+"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">Categoria *</label>
                  <input
                    type="text"
                    required
                    value={partnerFormData.category}
                    onChange={(e) => setPartnerFormData({ ...partnerFormData, category: e.target.value })}
                    className="w-full p-2.5 rounded-lg border border-stone-300 text-xs"
                    placeholder="Ex: Farmácias & Parafarmácia"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">
                    Área de Atividade *
                  </label>
                  <select
                    value={partnerFormData.area}
                    onChange={(e) => setPartnerFormData({ ...partnerFormData, area: e.target.value })}
                    className="w-full p-2.5 rounded-lg border border-stone-300 text-xs bg-white"
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
                  <label className="text-xs font-bold text-stone-700 block mb-1">Distrito *</label>
                  <input
                    type="text"
                    required
                    value={partnerFormData.district}
                    onChange={(e) => setPartnerFormData({ ...partnerFormData, district: e.target.value })}
                    className="w-full p-2.5 rounded-lg border border-stone-300 text-xs"
                    placeholder="Ex: Lisboa, Porto, Coimbra ou Nacional"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">Localidade *</label>
                  <input
                    type="text"
                    required
                    value={partnerFormData.city}
                    onChange={(e) => setPartnerFormData({ ...partnerFormData, city: e.target.value })}
                    className="w-full p-2.5 rounded-lg border border-stone-300 text-xs"
                    placeholder="Ex: Lisboa, Online ou Matosinhos"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">
                    Tipo de Benefício *
                  </label>
                  <select
                    value={partnerFormData.benefit_type}
                    onChange={(e) => setPartnerFormData({ ...partnerFormData, benefit_type: e.target.value })}
                    className="w-full p-2.5 rounded-lg border border-stone-300 text-xs bg-white"
                  >
                    <option value="cupao">Cupão Promocional (valor fixo €)</option>
                    <option value="codigo">Código de Desconto (% contínuo)</option>
                    <option value="voucher">Voucher Nominal (uso único)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">
                    Desconto em Destaque *
                  </label>
                  <input
                    type="text"
                    required
                    value={partnerFormData.discount_highlight}
                    onChange={(e) =>
                      setPartnerFormData({ ...partnerFormData, discount_highlight: e.target.value })
                    }
                    className="w-full p-2.5 rounded-lg border border-stone-300 text-xs"
                    placeholder="Ex: 35% em análises ou 50€ em tratamentos"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">
                    Poupança Anual Estimada (€) *
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    value={partnerFormData.estimated_annual_savings}
                    onChange={(e) =>
                      setPartnerFormData({ ...partnerFormData, estimated_annual_savings: e.target.value })
                    }
                    className="w-full p-2.5 rounded-lg border border-stone-300 text-xs font-mono tabular-nums"
                    placeholder="50.0"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">
                    Modo de Utilização do Código *
                  </label>
                  <select
                    value={partnerFormData.code_mode}
                    onChange={(e) => setPartnerFormData({ ...partnerFormData, code_mode: e.target.value })}
                    className="w-full p-2.5 rounded-lg border border-stone-300 text-xs bg-white"
                  >
                    <option value="rotativo">Rotativo 6 dígitos + QR Code (/validar)</option>
                    <option value="codigo_unico">Código Único direto para todos os associados</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">
                    Nº Máximo de Utilizações (por sócio)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={999}
                    value={partnerFormData.max_uses}
                    onChange={(e) => setPartnerFormData({ ...partnerFormData, max_uses: e.target.value })}
                    className="w-full p-2.5 rounded-lg border border-stone-300 text-xs font-mono tabular-nums"
                    placeholder="Ex: 4 (0 ou vazio = ilimitado)"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">
                    Data de Validade da Parceria *
                  </label>
                  <input
                    type="date"
                    required
                    value={partnerFormData.valid_until}
                    onChange={(e) => setPartnerFormData({ ...partnerFormData, valid_until: e.target.value })}
                    className="w-full p-2.5 rounded-lg border border-stone-300 text-xs font-mono tabular-nums"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">
                    Código Único (Mascarado) *
                  </label>
                  <input
                    type="text"
                    required
                    value={partnerFormData.secret_code}
                    onChange={(e) => setPartnerFormData({ ...partnerFormData, secret_code: e.target.value })}
                    className="w-full p-2.5 rounded-lg border border-stone-300 text-xs font-mono uppercase"
                    placeholder="Ex: FARMA5"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-stone-700 block mb-1">Descrição</label>
                  <textarea
                    rows={2}
                    value={partnerFormData.description}
                    onChange={(e) => setPartnerFormData({ ...partnerFormData, description: e.target.value })}
                    className="w-full p-2.5 rounded-lg border border-stone-300 text-xs"
                    placeholder="Breve descrição dos serviços e produtos oferecidos."
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-stone-700 block mb-1">
                    Condições e Termos
                  </label>
                  <input
                    type="text"
                    value={partnerFormData.terms}
                    onChange={(e) => setPartnerFormData({ ...partnerFormData, terms: e.target.value })}
                    className="w-full p-2.5 rounded-lg border border-stone-300 text-xs"
                    placeholder="Ex: Não acumulável com outras promoções."
                  />
                </div>

                <div className="sm:col-span-2 p-3.5 rounded-xl bg-[#FAF8F5] border border-stone-200 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2 font-condensed text-xs font-bold uppercase tracking-wider text-stone-600">
                    Credenciais de Acesso ao Validador de Parceiros
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-stone-700 block mb-1">
                      E-mail de Login do Parceiro
                    </label>
                    <input
                      type="email"
                      value={partnerFormData.partner_email}
                      onChange={(e) =>
                        setPartnerFormData({ ...partnerFormData, partner_email: e.target.value })
                      }
                      className="w-full p-2 rounded-lg border border-stone-300 bg-white text-xs"
                      placeholder="Automático se vazio (ex: loja@parceiro.lpcs.pt)"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-stone-700 block mb-1">
                      {editingPartner
                        ? 'Nova Palavra-passe (opcional)'
                        : 'Palavra-passe Inicial (padrão: Parceiro!2026)'}
                    </label>
                    <input
                      type="password"
                      minLength={6}
                      value={partnerFormData.partner_password}
                      onChange={(e) =>
                        setPartnerFormData({ ...partnerFormData, partner_password: e.target.value })
                      }
                      className="w-full p-2 rounded-lg border border-stone-300 bg-white text-xs"
                      placeholder={editingPartner ? 'Deixe vazio para manter' : 'Mínimo 6 carateres'}
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-2.5 pt-4 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setPartnerModalOpen(false)}
                  className="flex-1 py-2.5 rounded-lg border border-stone-300 text-xs font-bold text-stone-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={partnerSubmitting}
                  className="flex-1 py-2.5 rounded-lg bg-[#C81E2B] hover:bg-[#A11622] disabled:opacity-60 text-white text-xs font-bold"
                >
                  {partnerSubmitting
                    ? 'A guardar...'
                    : fromInquiryId
                    ? 'Publicar Parceiro'
                    : 'Guardar Parceiro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
