import { SchoolRecord, SiteSettings } from '../types';
import { DEFAULT_RECORDS, DEFAULT_SETTINGS } from './defaultData';

const TOKEN_KEY = 'school_admin_jwt_token';
const CACHE_RECORDS_KEY = 'cached_school_records';
const CACHE_SETTINGS_KEY = 'cached_school_settings';

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function saveStoredToken(token: string | null) {
  if (typeof window === 'undefined') return;
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

function getAuthHeaders(): HeadersInit {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// ----------------- RECORDS API -----------------

export async function fetchSchoolRecords(isAdmin = false): Promise<{ records: SchoolRecord[]; isCloud: boolean }> {
  try {
    const res = await fetch('/api/records', {
      headers: getAuthHeaders(),
      credentials: 'include',
    });

    if (res.ok) {
      const data = await res.json();
      if (data.records && Array.isArray(data.records)) {
        localStorage.setItem(CACHE_RECORDS_KEY, JSON.stringify(data.records));
        return { records: data.records, isCloud: Boolean(data.cloudDatabase) };
      }
    }
  } catch (err) {
    console.warn('[Client DB] Server fetch failed, using local cache:', err);
  }

  // Fallback to cache or defaults
  try {
    const cached = localStorage.getItem(CACHE_RECORDS_KEY);
    if (cached) {
      const parsed: SchoolRecord[] = JSON.parse(cached);
      return {
        records: isAdmin ? parsed : parsed.filter((r) => r.is_published),
        isCloud: false,
      };
    }
  } catch {}

  return {
    records: isAdmin ? DEFAULT_RECORDS : DEFAULT_RECORDS.filter((r) => r.is_published),
    isCloud: false,
  };
}

export async function saveRecord(record: SchoolRecord): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if updating or creating
    const isEdit = Boolean(record.id && !record.id.startsWith('new-'));
    const url = isEdit ? `/api/records/${record.id}` : '/api/records';
    const method = isEdit ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(isEdit ? record : { record }),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      return { success: true };
    }
    return { success: false, error: data.error || 'فشل حفظ السجل' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'خطأ في الاتصال بالخادم';
    return { success: false, error: msg };
  }
}

export async function deleteRecord(recordId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/records/${recordId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
      credentials: 'include',
    });

    const data = await res.json();
    if (res.ok && data.success) {
      return { success: true };
    }
    return { success: false, error: data.error || 'فشل حذف السجل' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'خطأ في الاتصال بالخادم';
    return { success: false, error: msg };
  }
}

export async function batchUpdateRecordOrders(records: SchoolRecord[]): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch('/api/records', {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify({ reorderedRecords: records }),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      return { success: true };
    }
    return { success: false, error: data.error || 'فشل إعادة ترتيب السجلات' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'خطأ في الاتصال بالخادم';
    return { success: false, error: msg };
  }
}

// ----------------- SETTINGS API -----------------

export async function fetchSiteSettings(): Promise<{ settings: SiteSettings; isCloud: boolean }> {
  try {
    const res = await fetch('/api/settings', {
      headers: getAuthHeaders(),
      credentials: 'include',
    });

    if (res.ok) {
      const data = await res.json();
      if (data.settings) {
        localStorage.setItem(CACHE_SETTINGS_KEY, JSON.stringify(data.settings));
        return { settings: data.settings, isCloud: Boolean(data.cloudDatabase) };
      }
    }
  } catch (err) {
    console.warn('[Client DB] Server fetch settings failed, using cache:', err);
  }

  // Fallback to cache or defaults
  try {
    const cached = localStorage.getItem(CACHE_SETTINGS_KEY);
    if (cached) {
      return { settings: { ...DEFAULT_SETTINGS, ...JSON.parse(cached) }, isCloud: false };
    }
  } catch {}

  return { settings: DEFAULT_SETTINGS, isCloud: false };
}

export async function saveSiteSettings(settings: SiteSettings): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(settings),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      localStorage.setItem(CACHE_SETTINGS_KEY, JSON.stringify(settings));
      return { success: true };
    }
    return { success: false, error: data.error || 'فشل حفظ الإعدادات' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'خطأ في الاتصال بالخادم';
    return { success: false, error: msg };
  }
}

// ----------------- AUTH API -----------------

export async function loginApi(email: string, pass: string): Promise<{ success: boolean; token?: string; error?: string }> {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password: pass }),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      saveStoredToken(data.token);
      return { success: true, token: data.token };
    }
    return { success: false, error: data.error || 'فشل تسجيل الدخول' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'تعذر الاتصال بخادم المصادقة';
    return { success: false, error: msg };
  }
}

export async function logoutApi(): Promise<void> {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
  } catch {}
  saveStoredToken(null);
}

export async function checkAuthApi(): Promise<{ authenticated: boolean; email?: string; isCloud?: boolean }> {
  try {
    const res = await fetch('/api/auth/me', {
      headers: getAuthHeaders(),
      credentials: 'include',
    });

    if (res.ok) {
      const data = await res.json();
      return {
        authenticated: Boolean(data.authenticated),
        email: data.user?.email,
        isCloud: Boolean(data.cloudDatabase),
      };
    }
  } catch {}
  return { authenticated: false };
}

// ----------------- UPLOAD API -----------------

export async function uploadHeroImageApi(fileOrUrl: File | string): Promise<{ url: string | null; error?: string }> {
  try {
    let payload: { dataUrl?: string; url?: string } = {};

    if (typeof fileOrUrl === 'string') {
      payload = { url: fileOrUrl };
    } else {
      // Convert file to base64
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(fileOrUrl);
      });
      payload = { dataUrl };
    }

    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      return { url: data.url };
    }
    return { url: null, error: data.error || 'فشل رفع ومعالجة الصورة' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'خطأ في رفع الصورة';
    return { url: null, error: msg };
  }
}
