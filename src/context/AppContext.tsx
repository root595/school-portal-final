import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { SchoolRecord, SiteSettings, ActiveTab, AdminSubTab } from '../types';
import { DEFAULT_SETTINGS, DEFAULT_RECORDS } from '../lib/defaultData';
import {
  fetchSchoolRecords,
  fetchSiteSettings,
  saveRecord,
  deleteRecord,
  batchUpdateRecordOrders,
  saveSiteSettings,
  loginApi,
  logoutApi,
  checkAuthApi,
} from '../lib/db';

interface ToastInfo {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface AppContextType {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  adminSubTab: AdminSubTab;
  setAdminSubTab: (tab: AdminSubTab) => void;

  records: SchoolRecord[];
  settings: SiteSettings;
  loading: boolean;
  toasts: ToastInfo[];

  // Auth & Backend Status
  isAuthenticated: boolean;
  userEmail: string | null;
  isCloudBackend: boolean;

  // Actions
  refreshData: () => Promise<void>;
  createRecord: (record: Omit<SchoolRecord, 'id'>) => Promise<{ success: boolean; error?: string }>;
  editRecord: (record: SchoolRecord) => Promise<{ success: boolean; error?: string }>;
  removeRecord: (id: string) => Promise<{ success: boolean; error?: string }>;
  reorderRecords: (records: SchoolRecord[]) => Promise<{ success: boolean; error?: string }>;
  updateSettings: (newSettings: Partial<SiteSettings>) => Promise<{ success: boolean; error?: string }>;
  loginAdmin: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  logoutAdmin: () => Promise<void>;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  dismissToast: (id: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTabState] = useState<ActiveTab>('home');
  const [adminSubTab, setAdminSubTab] = useState<AdminSubTab>('home');
  const [records, setRecords] = useState<SchoolRecord[]>(DEFAULT_RECORDS);
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState<boolean>(true);
  const [toasts, setToasts] = useState<ToastInfo[]>([]);

  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isCloudBackend, setIsCloudBackend] = useState<boolean>(false);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Update URL hash / history when tab changes
  const setActiveTab = useCallback((tab: ActiveTab) => {
    setActiveTabState(tab);
    if (tab === 'admin') {
      window.location.hash = '#admin';
    } else if (tab === 'admin-login') {
      window.location.hash = '#admin/login';
    } else if (tab === 'records') {
      window.location.hash = '#records';
    } else if (tab === 'vision') {
      window.location.hash = '#vision';
    } else {
      window.location.hash = '';
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Load data from REST API
  const loadData = useCallback(async (isAdmin: boolean) => {
    setLoading(true);
    try {
      const [recordsRes, settingsRes] = await Promise.all([
        fetchSchoolRecords(isAdmin),
        fetchSiteSettings(),
      ]);
      setRecords(recordsRes.records);
      setSettings(settingsRes.settings);
      setIsCloudBackend(recordsRes.isCloud || settingsRes.isCloud);
    } catch (err) {
      console.error('[AppContext] Failed to load data:', err);
      showToast('تعذر تحميل بعض البيانات من الخادم', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  // Check auth session
  useEffect(() => {
    checkAuthApi().then((res) => {
      if (res.authenticated) {
        setIsAuthenticated(true);
        setUserEmail(res.email || 'المدير');
        if (res.isCloud !== undefined) setIsCloudBackend(res.isCloud);
      } else {
        setIsAuthenticated(false);
        setUserEmail(null);
      }
    });
  }, []);

  // Check initial hash route
  useEffect(() => {
    const checkHash = () => {
      const hash = window.location.hash.replace('#', '');
      const pathname = window.location.pathname;

      if (hash === 'admin/login' || pathname === '/admin/login') {
        setActiveTabState('admin-login');
      } else if (hash === 'admin' || pathname === '/admin') {
        setActiveTabState('admin');
      } else if (hash === 'records') {
        setActiveTabState('records');
      } else if (hash === 'vision') {
        setActiveTabState('vision');
      } else {
        setActiveTabState('home');
      }
    };

    checkHash();
    window.addEventListener('hashchange', checkHash);
    return () => window.removeEventListener('hashchange', checkHash);
  }, []);

  // Initial and reactive data load
  useEffect(() => {
    loadData(isAuthenticated);
  }, [loadData, isAuthenticated]);

  // Apply theme styling dynamically to CSS root
  useEffect(() => {
    if (!settings.theme) return;
    const root = document.documentElement;
    root.style.setProperty('--primary-color', settings.theme.primary_color || '#0d9488');
    root.style.setProperty('--secondary-color', settings.theme.secondary_color || '#0f172a');

    if (settings.theme.background_color) {
      document.body.style.backgroundColor = settings.theme.background_color;
    }

    if (settings.theme.font_size === 'sm') {
      root.style.fontSize = '15px';
    } else if (settings.theme.font_size === 'lg') {
      root.style.fontSize = '17px';
    } else {
      root.style.fontSize = '16px';
    }
  }, [settings.theme]);

  const refreshData = async () => {
    await loadData(isAuthenticated);
  };

  // Records actions
  const createRecord = async (recordData: Omit<SchoolRecord, 'id'>) => {
    const id = `rec-${Date.now()}`;
    const newRecord: SchoolRecord = { ...recordData, id };
    const res = await saveRecord(newRecord);
    if (res.success) {
      setRecords((prev) => [...prev, newRecord].sort((a, b) => a.order_index - b.order_index));
      showToast('تمت إضافة السجل بنجاح', 'success');
      return { success: true };
    } else {
      showToast(res.error || 'فشل إضافة السجل', 'error');
      return res;
    }
  };

  const editRecord = async (updated: SchoolRecord) => {
    const res = await saveRecord(updated);
    if (res.success) {
      setRecords((prev) =>
        prev.map((r) => (r.id === updated.id ? updated : r)).sort((a, b) => a.order_index - b.order_index)
      );
      showToast('تم تحديث بيانات السجل بنجاح', 'success');
      return { success: true };
    } else {
      showToast(res.error || 'فشل تحديث السجل', 'error');
      return res;
    }
  };

  const removeRecord = async (id: string) => {
    const res = await deleteRecord(id);
    if (res.success) {
      setRecords((prev) => prev.filter((r) => r.id !== id));
      showToast('تم حذف السجل بنجاح', 'success');
      return { success: true };
    } else {
      showToast(res.error || 'فشل حذف السجل', 'error');
      return res;
    }
  };

  const reorderRecords = async (reordered: SchoolRecord[]) => {
    const withIndices = reordered.map((rec, i) => ({
      ...rec,
      order_index: i + 1,
    }));
    setRecords(withIndices);
    const res = await batchUpdateRecordOrders(withIndices);
    if (res.success) {
      showToast('تم حفظ الترتيب الجديد بنجاح', 'success');
      return { success: true };
    } else {
      showToast(res.error || 'فشل حفظ الترتيب الجديد', 'error');
      return res;
    }
  };

  const updateSettings = async (partial: Partial<SiteSettings>) => {
    const merged: SiteSettings = {
      ...settings,
      ...partial,
      theme: { ...settings.theme, ...(partial.theme || {}) },
      navigation: { ...settings.navigation, ...(partial.navigation || {}) },
      contact: { ...settings.contact, ...(partial.contact || {}) },
    };
    const res = await saveSiteSettings(merged);
    if (res.success) {
      setSettings(merged);
      showToast('تم حفظ التعديلات بنجاح', 'success');
      return { success: true };
    } else {
      showToast(res.error || 'فشل حفظ التعديلات', 'error');
      return res;
    }
  };

  // Auth actions
  const loginAdmin = async (email: string, pass: string) => {
    const res = await loginApi(email, pass);
    if (res.success) {
      setIsAuthenticated(true);
      setUserEmail(email);
      showToast('تم تسجيل الدخول بنجاح', 'success');
      await loadData(true);
      setActiveTab('admin');
      return { success: true };
    } else {
      return { success: false, error: res.error || 'فشل تسجيل الدخول' };
    }
  };

  const logoutAdmin = async () => {
    await logoutApi();
    setIsAuthenticated(false);
    setUserEmail(null);
    showToast('تم تسجيل الخروج بنجاح', 'info');
    setActiveTab('home');
    await loadData(false);
  };

  return (
    <AppContext.Provider
      value={{
        activeTab,
        setActiveTab,
        adminSubTab,
        setAdminSubTab,
        records,
        settings,
        loading,
        toasts,
        isAuthenticated,
        userEmail,
        isCloudBackend,
        refreshData,
        createRecord,
        editRecord,
        removeRecord,
        reorderRecords,
        updateSettings,
        loginAdmin,
        logoutAdmin,
        showToast,
        dismissToast,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
