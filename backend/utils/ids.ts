import { nanoid } from 'nanoid';

export function generateId(prefix: string): string {
  return `${prefix}_${nanoid(12)}`;
}

export function prospectId() { return generateId('pro'); }
export function auditId() { return generateId('aud'); }
export function emailId() { return generateId('em'); }
export function eventId() { return generateId('evt'); }
export function taskId() { return generateId('tsk'); }
export function campaignId() { return generateId('cmp'); }
export function researchId() { return generateId('res'); }
