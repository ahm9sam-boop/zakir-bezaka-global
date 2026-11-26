import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dbEnabled, dbQuery } from './db';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.resolve(__dirname, '../../data/contacts.json');

export type ContactMsg = { id: string; name: string; phone: string; subject: string; message: string; createdAt: string; read: boolean };

let schemaDone: Promise<void> | null = null;
function schema() {
  if (!schemaDone) schemaDone = dbQuery(`CREATE TABLE IF NOT EXISTS zk_contacts (
    id TEXT PRIMARY KEY, data JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`).then(() => undefined);
  return schemaDone;
}

function readFile(): ContactMsg[] {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf-8')); } catch { return []; }
}
function writeFile(list: ContactMsg[]) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(list.slice(0, 500), null, 2), 'utf-8');
}

export async function addContact(m: Omit<ContactMsg, 'id' | 'createdAt' | 'read'>): Promise<ContactMsg> {
  const full: ContactMsg = { ...m, id: 'msg_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), createdAt: new Date().toISOString(), read: false };
  if (dbEnabled) { await schema(); await dbQuery('INSERT INTO zk_contacts (id, data) VALUES ($1, $2::jsonb)', [full.id, JSON.stringify(full)]); }
  else writeFile([full, ...readFile()]);
  return full;
}

export async function listContacts(): Promise<ContactMsg[]> {
  if (dbEnabled) { await schema(); const r = await dbQuery('SELECT data FROM zk_contacts ORDER BY created_at DESC LIMIT 500'); return r.rows.map((x: any) => x.data as ContactMsg); }
  return readFile();
}

export async function markContactRead(id: string): Promise<void> {
  if (dbEnabled) { await schema(); await dbQuery("UPDATE zk_contacts SET data = jsonb_set(data, '{read}', 'true'::jsonb) WHERE id = $1", [id]); return; }
  writeFile(readFile().map((x) => (x.id === id ? { ...x, read: true } : x)));
}

export async function deleteContact(id: string): Promise<void> {
  if (dbEnabled) { await schema(); await dbQuery('DELETE FROM zk_contacts WHERE id = $1', [id]); return; }
  writeFile(readFile().filter((x) => x.id !== id));
}
