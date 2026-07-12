/**
 * Shared file-JSON storage for the local server and the orchestration engine.
 * One source of truth, local-server.js and every engine module require this.
 */

const fs = require('fs');
const path = require('path');

let nanoid;
try { ({ nanoid } = require('nanoid')); }
catch { nanoid = () => Math.random().toString(36).slice(2, 14); }

const STORAGE = path.join(__dirname, '..', 'storage');

function emptyFor(name) {
  if (name === 'settings') return {};
  if (name === 'engine') return { state: {}, log: [] };
  return [];
}

function read(name) {
  const file = path.join(STORAGE, `${name}.json`);
  if (!fs.existsSync(file)) return emptyFor(name);
  try {
    const raw = fs.readFileSync(file, 'utf8');
    if (!raw.trim()) return emptyFor(name);
    return JSON.parse(raw);
  } catch {
    return emptyFor(name);
  }
}

function write(name, data) {
  if (!fs.existsSync(STORAGE)) fs.mkdirSync(STORAGE, { recursive: true });
  fs.writeFileSync(path.join(STORAGE, `${name}.json`), JSON.stringify(data, null, 2));
}

function lid(prefix) { return `${prefix}_${nanoid(12)}`; }

const DEFAULT_SETTINGS = {
  senderName: 'Murat', company: 'Koaland.ai',
  koalandDescription: 'Commercial intelligence for brand-sensitive hotels',
  demoKitLink: '', calendarLink: '', testEmailAddress: '',
  dailySendLimit: 10, followupDelay1Days: 3, followupDelay2Days: 5,
  hotLeadScoreWeights: {
    delivered: 5, opened: 15, clicked: 20, pdfOpened: 30, pdfOpenedAgain: 20,
    replied: 50, icpFitHigh: 20, bounced: -50, unsubscribed: -100, spamReport: -100,
  },
};

function getSettings() { return { ...DEFAULT_SETTINGS, ...read('settings') }; }

module.exports = { STORAGE, read, write, lid, getSettings, DEFAULT_SETTINGS };
