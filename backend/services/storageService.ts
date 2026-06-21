/**
 * Storage abstraction layer.
 * Current implementation: Vercel KV (Redis).
 * To migrate to Supabase: replace the kv calls with Supabase client calls.
 * The interface (CRUD operations per collection) stays the same.
 */

import { kv } from '@vercel/kv';

type Collection = 'prospects' | 'audits' | 'emails' | 'events' | 'tasks' | 'campaigns' | 'research';

const PREFIX = 'koaland';

function collectionKey(collection: Collection): string {
  return `${PREFIX}:${collection}`;
}

function itemKey(collection: Collection, id: string): string {
  return `${PREFIX}:${collection}:${id}`;
}

// ── INDEX: maintain a set of IDs per collection ──────────────────

async function addToIndex(collection: Collection, id: string): Promise<void> {
  await kv.sadd(collectionKey(collection), id);
}

async function removeFromIndex(collection: Collection, id: string): Promise<void> {
  await kv.srem(collectionKey(collection), id);
}

async function getIndex(collection: Collection): Promise<string[]> {
  const members = await kv.smembers(collectionKey(collection));
  return (members || []) as string[];
}

// ── SETTINGS: single object ──────────────────────────────────────

const SETTINGS_KEY = `${PREFIX}:settings`;

export async function getSettings(): Promise<Record<string, any>> {
  const data = await kv.get<Record<string, any>>(SETTINGS_KEY);
  return data || getDefaultSettings();
}

export async function saveSettings(settings: Record<string, any>): Promise<void> {
  await kv.set(SETTINGS_KEY, settings);
}

function getDefaultSettings(): Record<string, any> {
  return {
    senderName: 'Murat',
    company: 'Koaland.ai',
    signature: 'Best,\nMurat\nKoaland.ai',
    koalandDescription: 'Koaland.ai is a commercial decision engine for brand-sensitive hotels.',
    demoKitLink: '',
    calendarLink: '',
    testEmailAddress: '',
    dailySendLimit: 10,
    followupDelay1Days: 3,
    followupDelay2Days: 5,
    followupDelay3Days: 8,
    unsubscribeFooter: true,
    replyToEmail: '',
    hotLeadScoreWeights: {
      delivered: 5,
      opened: 15,
      clicked: 20,
      pdfOpened: 30,
      pdfOpenedAgain: 20,
      replied: 50,
      icpFitHigh: 20,
      bounced: -50,
      unsubscribed: -100,
      spamReport: -100
    },
    icpFitWeights: {
      segment: 30,
      location: 20,
      size: 20,
      digital: 30
    }
  };
}

// ── GENERIC CRUD ─────────────────────────────────────────────────

export async function create<T extends { id: string }>(collection: Collection, item: T): Promise<T> {
  await kv.set(itemKey(collection, item.id), item);
  await addToIndex(collection, item.id);
  return item;
}

export async function getById<T>(collection: Collection, id: string): Promise<T | null> {
  return kv.get<T>(itemKey(collection, id));
}

export async function list<T>(collection: Collection): Promise<T[]> {
  const ids = await getIndex(collection);
  if (!ids.length) return [];
  const keys = ids.map(id => itemKey(collection, id));
  const items = await kv.mget<T[]>(...keys);
  return (items || []).filter(Boolean) as T[];
}

export async function update<T extends { id: string }>(collection: Collection, id: string, patch: Partial<T>): Promise<T | null> {
  const existing = await getById<T>(collection, id);
  if (!existing) return null;
  const updated = { ...existing, ...patch, updatedAt: new Date().toISOString() } as T;
  await kv.set(itemKey(collection, id), updated);
  return updated;
}

export async function remove(collection: Collection, id: string): Promise<boolean> {
  const existing = await getById(collection, id);
  if (!existing) return false;
  await kv.del(itemKey(collection, id));
  await removeFromIndex(collection, id);
  return true;
}

export async function findWhere<T>(collection: Collection, predicate: (item: T) => boolean): Promise<T[]> {
  const all = await list<T>(collection);
  return all.filter(predicate);
}

export async function findOne<T>(collection: Collection, predicate: (item: T) => boolean): Promise<T | null> {
  const all = await list<T>(collection);
  return all.find(predicate) || null;
}

export async function count(collection: Collection): Promise<number> {
  const ids = await getIndex(collection);
  return ids.length;
}

// ── CONVENIENCE EXPORTS ──────────────────────────────────────────

export const storage = {
  prospects: {
    create: (item: any) => create('prospects', item),
    getById: (id: string) => getById('prospects', id),
    list: () => list('prospects'),
    update: (id: string, patch: any) => update('prospects', id, patch),
    remove: (id: string) => remove('prospects', id),
    findWhere: (pred: any) => findWhere('prospects', pred),
    findOne: (pred: any) => findOne('prospects', pred),
    count: () => count('prospects'),
  },
  audits: {
    create: (item: any) => create('audits', item),
    getById: (id: string) => getById('audits', id),
    list: () => list('audits'),
    update: (id: string, patch: any) => update('audits', id, patch),
    findOne: (pred: any) => findOne('audits', pred),
    findWhere: (pred: any) => findWhere('audits', pred),
  },
  emails: {
    create: (item: any) => create('emails', item),
    getById: (id: string) => getById('emails', id),
    list: () => list('emails'),
    update: (id: string, patch: any) => update('emails', id, patch),
    findWhere: (pred: any) => findWhere('emails', pred),
  },
  events: {
    create: (item: any) => create('events', item),
    list: () => list('events'),
    findWhere: (pred: any) => findWhere('events', pred),
  },
  tasks: {
    create: (item: any) => create('tasks', item),
    getById: (id: string) => getById('tasks', id),
    list: () => list('tasks'),
    update: (id: string, patch: any) => update('tasks', id, patch),
    findWhere: (pred: any) => findWhere('tasks', pred),
  },
  campaigns: {
    create: (item: any) => create('campaigns', item),
    getById: (id: string) => getById('campaigns', id),
    list: () => list('campaigns'),
    update: (id: string, patch: any) => update('campaigns', id, patch),
  },
  research: {
    create: (item: any) => create('research', item),
    getById: (id: string) => getById('research', id),
    findOne: (pred: any) => findOne('research', pred),
    update: (id: string, patch: any) => update('research', id, patch),
  },
  settings: {
    get: getSettings,
    save: saveSettings,
  },
};
