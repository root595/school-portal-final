import { Redis } from '@upstash/redis';
import fs from 'fs';
import path from 'path';
import { SchoolRecord, SiteSettings } from '../types';
import { DEFAULT_RECORDS, DEFAULT_SETTINGS } from '../lib/defaultData';

const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

let redisClient: Redis | null = null;

if (REDIS_URL && REDIS_TOKEN) {
  try {
    redisClient = new Redis({
      url: REDIS_URL,
      token: REDIS_TOKEN,
    });
    console.log('[Storage] Connected to Upstash Redis / Vercel KV');
  } catch (err) {
    console.error('[Storage] Failed to initialize Redis client:', err);
    redisClient = null;
  }
} else {
  console.log('[Storage] Upstash Redis credentials not detected. Operating with local persistent JSON fallback.');
}

const LOCAL_DATA_DIR = path.resolve(process.cwd(), '.data');
const LOCAL_DATA_FILE = path.resolve(LOCAL_DATA_DIR, 'database.json');

interface LocalDatabase {
  records: SchoolRecord[];
  settings: SiteSettings;
}

function initLocalFile(): LocalDatabase {
  try {
    if (!fs.existsSync(LOCAL_DATA_DIR)) {
      fs.mkdirSync(LOCAL_DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(LOCAL_DATA_FILE)) {
      const initial: LocalDatabase = {
        records: DEFAULT_RECORDS,
        settings: DEFAULT_SETTINGS,
      };
      fs.writeFileSync(LOCAL_DATA_FILE, JSON.stringify(initial, null, 2), 'utf-8');
      return initial;
    }
    const raw = fs.readFileSync(LOCAL_DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      records: parsed.records || DEFAULT_RECORDS,
      settings: parsed.settings || DEFAULT_SETTINGS,
    };
  } catch (err) {
    console.error('[Storage] Error reading local data file:', err);
    return {
      records: DEFAULT_RECORDS,
      settings: DEFAULT_SETTINGS,
    };
  }
}

function writeLocalFile(data: LocalDatabase) {
  try {
    if (!fs.existsSync(LOCAL_DATA_DIR)) {
      fs.mkdirSync(LOCAL_DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(LOCAL_DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Storage] Error writing local data file:', err);
  }
}

// In-memory cache for speed
let inMemoryData: LocalDatabase = initLocalFile();

export async function getStoredRecords(isAdmin = false): Promise<SchoolRecord[]> {
  if (redisClient) {
    try {
      const records = await redisClient.get<SchoolRecord[]>('school:records');
      if (records && Array.isArray(records)) {
        return isAdmin ? records : records.filter((r) => r.is_published);
      }
      // Seed Redis if empty
      await redisClient.set('school:records', DEFAULT_RECORDS);
      return isAdmin ? DEFAULT_RECORDS : DEFAULT_RECORDS.filter((r) => r.is_published);
    } catch (err) {
      console.error('[Storage] Redis get records failed, using local cache:', err);
    }
  }

  // Fallback to local
  const records = inMemoryData.records;
  return isAdmin ? records : records.filter((r) => r.is_published);
}

export async function saveStoredRecord(record: SchoolRecord): Promise<SchoolRecord> {
  let records = await getStoredRecords(true);
  const existingIdx = records.findIndex((r) => r.id === record.id);
  const now = new Date().toISOString();

  if (existingIdx >= 0) {
    records[existingIdx] = { ...record, updated_at: now };
  } else {
    records.push({ ...record, created_at: now, updated_at: now });
  }

  records.sort((a, b) => a.order_index - b.order_index);

  if (redisClient) {
    try {
      await redisClient.set('school:records', records);
    } catch (err) {
      console.error('[Storage] Redis save record failed:', err);
    }
  }

  inMemoryData.records = records;
  writeLocalFile(inMemoryData);

  return record;
}

export async function deleteStoredRecord(recordId: string): Promise<boolean> {
  let records = await getStoredRecords(true);
  records = records.filter((r) => r.id !== recordId);

  if (redisClient) {
    try {
      await redisClient.set('school:records', records);
    } catch (err) {
      console.error('[Storage] Redis delete record failed:', err);
    }
  }

  inMemoryData.records = records;
  writeLocalFile(inMemoryData);

  return true;
}

export async function reorderStoredRecords(newOrder: SchoolRecord[]): Promise<SchoolRecord[]> {
  const updated = newOrder.map((r, idx) => ({
    ...r,
    order_index: idx + 1,
    updated_at: new Date().toISOString(),
  }));

  if (redisClient) {
    try {
      await redisClient.set('school:records', updated);
    } catch (err) {
      console.error('[Storage] Redis reorder failed:', err);
    }
  }

  inMemoryData.records = updated;
  writeLocalFile(inMemoryData);

  return updated;
}

export async function getStoredSettings(): Promise<SiteSettings> {
  if (redisClient) {
    try {
      const settings = await redisClient.get<SiteSettings>('school:settings');
      if (settings && typeof settings === 'object') {
        return settings;
      }
      // Seed Redis if empty
      await redisClient.set('school:settings', DEFAULT_SETTINGS);
      return DEFAULT_SETTINGS;
    } catch (err) {
      console.error('[Storage] Redis get settings failed, using local cache:', err);
    }
  }

  return inMemoryData.settings;
}

export async function updateStoredSettings(partial: Partial<SiteSettings>): Promise<SiteSettings> {
  const current = await getStoredSettings();
  const merged: SiteSettings = {
    ...current,
    ...partial,
    theme: { ...current.theme, ...(partial.theme || {}) },
    navigation: { ...current.navigation, ...(partial.navigation || {}) },
    contact: { ...current.contact, ...(partial.contact || {}) },
    updated_at: new Date().toISOString(),
  };

  if (redisClient) {
    try {
      await redisClient.set('school:settings', merged);
    } catch (err) {
      console.error('[Storage] Redis update settings failed:', err);
    }
  }

  inMemoryData.settings = merged;
  writeLocalFile(inMemoryData);

  return merged;
}

export function isUsingCloudDatabase(): boolean {
  return Boolean(redisClient);
}
