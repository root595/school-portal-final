import express, { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import {
  getStoredRecords,
  saveStoredRecord,
  deleteStoredRecord,
  reorderStoredRecords,
  getStoredSettings,
  updateStoredSettings,
  isUsingCloudDatabase,
} from './storage';
import { SchoolRecord, SiteSettings } from '../types';

export const apiRouter = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'school-portal-jwt-secret-key-2026';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@school.edu.sa';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@2026';

// Middleware to extract user from JWT cookie or Authorization header
export function verifyAdminToken(req: Request): { email: string } | null {
  const tokenFromCookie = req.cookies?.admin_token;
  const authHeader = req.headers.authorization;
  const tokenFromHeader = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
  const token = tokenFromCookie || tokenFromHeader;

  if (!token) return null;

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { email: string };
    return decoded;
  } catch {
    return null;
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = verifyAdminToken(req);
  if (!user) {
    return res.status(401).json({ success: false, error: 'غير مصرح: يجب تسجيل الدخول كمدير للنظام' });
  }
  (req as any).user = user;
  next();
}

// ---------------- AUTH ROUTES ----------------

// POST /api/auth/login
apiRouter.post('/auth/login', (req: Request, res: Response) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'يرجى إدخال البريد الإلكتروني وكلمة المرور' });
  }

  const trimmedEmail = email.trim().toLowerCase();
  const trimmedPassword = password.trim();

  if (trimmedEmail === ADMIN_EMAIL.toLowerCase() && trimmedPassword === ADMIN_PASSWORD) {
    const token = jwt.sign({ email: ADMIN_EMAIL }, JWT_SECRET, { expiresIn: '7d' });

    res.cookie('admin_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
    });

    return res.json({
      success: true,
      token,
      user: { email: ADMIN_EMAIL },
      cloudDatabase: isUsingCloudDatabase(),
    });
  }

  return res.status(401).json({
    success: false,
    error: 'بيانات الدخول غير صحيحة. يرجى التحقق من البريد وكلمة المرور.',
  });
});

// POST /api/auth/logout
apiRouter.post('/auth/logout', (_req: Request, res: Response) => {
  res.clearCookie('admin_token', { path: '/' });
  return res.json({ success: true, message: 'تم تسجيل الخروج بنجاح' });
});

// GET /api/auth/me
apiRouter.get('/auth/me', (req: Request, res: Response) => {
  const user = verifyAdminToken(req);
  if (user) {
    return res.json({
      authenticated: true,
      user: { email: user.email },
      cloudDatabase: isUsingCloudDatabase(),
    });
  }
  return res.json({
    authenticated: false,
    user: null,
    cloudDatabase: isUsingCloudDatabase(),
  });
});

// ---------------- RECORDS ROUTES ----------------

// GET /api/records (public: published only, admin: all)
apiRouter.get('/records', async (req: Request, res: Response) => {
  try {
    const isAdmin = Boolean(verifyAdminToken(req));
    const records = await getStoredRecords(isAdmin);
    return res.json({
      success: true,
      records,
      cloudDatabase: isUsingCloudDatabase(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'فشل جلب السجلات';
    return res.status(500).json({ success: false, error: message });
  }
});

// POST /api/records (admin only)
apiRouter.post('/records', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { reorderedRecords, record } = req.body;

    if (reorderedRecords && Array.isArray(reorderedRecords)) {
      const updated = await reorderStoredRecords(reorderedRecords);
      return res.json({ success: true, records: updated });
    }

    if (!record || !record.name) {
      return res.status(400).json({ success: false, error: 'اسم السجل مطلوب' });
    }

    const newRecord: SchoolRecord = {
      id: record.id || `rec-${Date.now()}`,
      name: record.name.trim(),
      description: record.description?.trim() || '',
      drive_url: record.drive_url?.trim() || '',
      icon: record.icon || 'FileText',
      order_index: Number(record.order_index) || 999,
      is_published: record.is_published !== false,
    };

    const saved = await saveStoredRecord(newRecord);
    return res.status(201).json({ success: true, record: saved });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'فشل إضافة السجل';
    return res.status(500).json({ success: false, error: message });
  }
});

// PUT /api/records/:id (admin only)
apiRouter.put('/records/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!updateData || !updateData.name) {
      return res.status(400).json({ success: false, error: 'اسم السجل مطلوب' });
    }

    const recordToSave: SchoolRecord = {
      id,
      name: updateData.name.trim(),
      description: updateData.description?.trim() || '',
      drive_url: updateData.drive_url?.trim() || '',
      icon: updateData.icon || 'FileText',
      order_index: Number(updateData.order_index) || 1,
      is_published: updateData.is_published !== false,
    };

    const updated = await saveStoredRecord(recordToSave);
    return res.json({ success: true, record: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'فشل تحديث السجل';
    return res.status(500).json({ success: false, error: message });
  }
});

// DELETE /api/records/:id (admin only)
apiRouter.delete('/records/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await deleteStoredRecord(id);
    return res.json({ success: true, message: 'تم حذف السجل بنجاح' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'فشل حذف السجل';
    return res.status(500).json({ success: false, error: message });
  }
});

// ---------------- SETTINGS ROUTES ----------------

// GET /api/settings
apiRouter.get('/settings', async (_req: Request, res: Response) => {
  try {
    const settings = await getStoredSettings();
    return res.json({
      success: true,
      settings,
      cloudDatabase: isUsingCloudDatabase(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'فشل جلب إعدادات الموقع';
    return res.status(500).json({ success: false, error: message });
  }
});

// PUT /api/settings (admin only)
apiRouter.put('/settings', requireAdmin, async (req: Request, res: Response) => {
  try {
    const partialSettings: Partial<SiteSettings> = req.body;
    const updated = await updateStoredSettings(partialSettings);
    return res.json({ success: true, settings: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'فشل حفظ الإعدادات';
    return res.status(500).json({ success: false, error: message });
  }
});

// ---------------- UPLOAD ROUTE ----------------

// POST /api/upload (admin only)
apiRouter.post('/upload', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { dataUrl, url } = req.body;

    if (url && typeof url === 'string') {
      return res.json({ success: true, url });
    }

    if (!dataUrl || typeof dataUrl !== 'string') {
      return res.status(400).json({ success: false, error: 'لم يتم توفير بيانات الصورة' });
    }

    // Check size if Base64
    const stringLength = dataUrl.length - 'data:image/png;base64,'.length;
    const sizeInBytes = 4 * Math.ceil(stringLength / 3) * 0.56248963343834;
    const sizeInMb = sizeInBytes / (1024 * 1024);

    if (sizeInMb > 5) {
      return res.status(400).json({ success: false, error: 'حجم الصورة يتجاوز الحد المسموح (5 ميجابايت)' });
    }

    // In serverless / server environment, return dataUrl directly for storage in Redis/DB
    return res.json({ success: true, url: dataUrl });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'فشل معالجة الصورة';
    return res.status(500).json({ success: false, error: message });
  }
});
