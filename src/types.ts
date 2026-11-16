export interface QuotaStatus {
  has_active_quota: boolean;
  status: 'valida' | 'expirar' | 'expirada' | 'sem_quota';
  valid_until: string | null;
  days_remaining: number;
  days_expired: number;
  progress_percentage: number;
  total_paid_count: number;
  total_paid_euros: number;
}

export interface User {
  id: number;
  email: string;
  name: string;
  member_number: string;
  is_admin: number;
  is_suspended: number;
  birth_date: string;
  address: string;
  postal_code: string;
  city: string;
  nif: string;
  phone: string;
  google_id?: string | null;
  quota_status: QuotaStatus;
}

export interface PartnerServiceImage {
  id: number;
  url: string;
  original_name: string;
  caption?: string | null;
}

export interface Partner {
  id: number;
  name: string;
  category: string;
  description: string;
  area: string;
  district: string;
  city: string;
  benefit_type: 'cupao' | 'codigo' | 'voucher';
  benefit_value: string;
  discount_highlight: string;
  usage_limit: string;
  max_uses?: number | null;
  code_mode?: 'rotativo' | 'codigo_unico';
  used_count?: number;
  remaining_uses?: number | null;
  is_limit_reached?: boolean;
  estimated_annual_savings: number;
  valid_until: string;
  terms: string;
  website?: string;
  logo_url?: string | null;
  service_images?: PartnerServiceImage[];
  secret_code?: string | null;
  can_access_code: boolean;
}

export interface Quota {
  id: number;
  user_id: number;
  plan_type: 'semestral' | 'anual';
  amount_cents: number;
  payment_method: string;
  reference: string;
  status: string;
  valid_from: string;
  valid_until: string;
  created_at: string;
}

export interface Receipt {
  id: number;
  quota_id?: number | null;
  original_name: string;
  mime_type: string;
  file_size: number;
  notes?: string;
  created_at: string;
}

export interface HeroStats {
  totalSavings: number;
  annualQuotaCost: number;
  savingsMultiplier: number;
  partnersCount: number;
  partnersPayingQuotaCount: number;
  breakdown: {
    couponSavings: number;
    voucherSavings: number;
    codeSavings: number;
  };
  topBenefits: Array<{
    id: number;
    name: string;
    area: string;
    benefit_type: string;
    estimated_annual_savings: number;
    discount_highlight: string;
    pays_quota: boolean;
  }>;
}

export interface AuditLog {
  id: number;
  user_id?: number;
  user_name?: string;
  member_number?: string;
  action: string;
  details: string;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}
