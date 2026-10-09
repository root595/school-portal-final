import React from 'react';
import { useApp } from '../../context/AppContext';
import { AdminSubTab } from '../../types';
import { HomeManager } from './HomeManager';
import { RecordsManager } from './RecordsManager';
import { PagesManager } from './PagesManager';
import { ThemeManager } from './ThemeManager';
import { SettingsManager } from './SettingsManager';
import {
  Image as ImageIcon,
  FileSpreadsheet,
  FileText,
  Palette,
  Settings,
  LogOut,
  ExternalLink,
  ShieldCheck,
  Cloud,
  HardDrive,
} from 'lucide-react';

export const AdminLayout: React.FC = () => {
  const { adminSubTab, setAdminSubTab, userEmail, isCloudBackend, logoutAdmin, setActiveTab } = useApp();

  const TABS: { id: AdminSubTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'records', label: 'إدارة السجلات المدرسية (17)', icon: FileSpreadsheet },
    { id: 'home', label: 'صورة الواجهة الرئيسية', icon: ImageIcon },
    { id: 'pages', label: 'نصوص وهوية الموقع', icon: FileText },
    { id: 'theme', label: 'المظهر والألوان', icon: Palette },
    { id: 'settings', label: 'معلومات التواصل و SEO', icon: Settings },
  ];

  return (
    <div className="w-full flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Admin Top Header Bar */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-6 shadow-lg shadow-slate-900/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold">لوحة التحكم الإدارية للمدرسة</h1>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono">
                Admin Panel
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 font-medium ${
                isCloudBackend ? 'bg-emerald-500/30 text-emerald-200' : 'bg-slate-700 text-slate-300'
              }`}>
                {isCloudBackend ? <Cloud className="w-3 h-3" /> : <HardDrive className="w-3 h-3" />}
                <span>{isCloudBackend ? 'Upstash Redis متصل' : 'تخزين محلي نشط'}</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              مرحبًا، <span className="text-slate-200 font-semibold">{userEmail || 'المدير'}</span> · تحكم كامل في كافة أجزاء الموقع
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            className="px-3.5 py-2 text-xs font-semibold bg-white/10 hover:bg-white/15 text-white rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>معاينة الموقع العام</span>
          </button>
          <button
            type="button"
            onClick={() => logoutAdmin()}
            className="px-3.5 py-2 text-xs font-semibold bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </div>

      {/* Admin Horizontal Subtabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200 no-scrollbar">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = adminSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setAdminSubTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Tab Content View */}
      <div className="pt-2">
        {adminSubTab === 'records' && <RecordsManager />}
        {adminSubTab === 'home' && <HomeManager />}
        {adminSubTab === 'pages' && <PagesManager />}
        {adminSubTab === 'theme' && <ThemeManager />}
        {adminSubTab === 'settings' && <SettingsManager />}
      </div>
    </div>
  );
};
