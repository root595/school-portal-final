import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ShieldCheck, Lock, Mail, ArrowRight, Eye, EyeOff, Server, Cloud, HardDrive } from 'lucide-react';

export const AdminLogin: React.FC = () => {
  const { loginAdmin, isCloudBackend, setActiveTab } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim() || !password.trim()) {
      setErrorMessage('يرجى إدخال البريد الإلكتروني وكلمة المرور');
      return;
    }

    setLoading(true);
    const result = await loginAdmin(email, password);
    setLoading(false);

    if (!result.success) {
      setErrorMessage(result.error || 'فشل تسجيل الدخول');
    }
  };

  const handleUseDemo = () => {
    setEmail('admin@school.edu.sa');
    setPassword('Admin@2026');
  };

  return (
    <div className="w-full flex-1 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-2xl md:rounded-3xl border border-slate-200/90 shadow-xl shadow-slate-200/50 p-6 sm:p-8 space-y-6">
        {/* Top Emblem */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-lg shadow-slate-900/10">
            <ShieldCheck className="w-7 h-7 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-black text-slate-900">تسجيل دخول الإدارة</h1>
          <p className="text-xs text-slate-500">
            لوحة تحكم إدارة السجلات والمحتوى المكتبي والمدرسي
          </p>
        </div>

        {/* Cloud Backend Status */}
        <div className={`p-3.5 rounded-xl text-xs flex items-start gap-2.5 ${
          isCloudBackend ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-slate-50 text-slate-700 border border-slate-200'
        }`}>
          {isCloudBackend ? (
            <Cloud className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <HardDrive className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
          )}
          <div className="leading-relaxed">
            {isCloudBackend ? (
              <span className="font-medium">الخادم السحابي متصل بنجاح (Upstash Redis / Vercel KV)</span>
            ) : (
              <div>
                <p className="font-semibold text-slate-800">وضع التخزين المحلي الآمن (Local Storage Backend)</p>
                <p className="mt-0.5 text-slate-600">
                  بيانات الدخول الافتراضية: <button type="button" onClick={handleUseDemo} className="underline font-mono font-bold text-emerald-700 cursor-pointer">admin@school.edu.sa / Admin@2026</button>
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3.5 rounded-xl text-xs bg-rose-50 text-rose-800 border border-rose-200 leading-relaxed animate-in fade-in">
            {errorMessage}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              البريد الإلكتروني للمسؤول (ADMIN_EMAIL)
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@school.edu.sa"
                className="w-full pr-10 pl-4 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-mono text-left"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              كلمة المرور (ADMIN_PASSWORD)
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                dir="ltr"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pr-10 pl-10 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-mono text-left"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold rounded-xl shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 mt-2"
          >
            {loading ? (
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : (
              <>
                <span>دخول لوحة الإدارة</span>
                <ArrowRight className="w-4 h-4 rotate-180" />
              </>
            )}
          </button>
        </form>

        <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            className="text-slate-600 hover:text-emerald-700 transition-colors cursor-pointer"
          >
            ← العودة للموقع العام
          </button>
          <span className="text-[11px] text-slate-400 font-mono">
            JWT Session Token
          </span>
        </div>
      </div>
    </div>
  );
};
