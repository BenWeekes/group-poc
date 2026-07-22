import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const app = express();
app.use(express.json({ limit: '64kb' }));
const port = Number(process.env.PORT || 8111);
const secret = process.env.INTERNAL_TOOL_SECRET || '';
const dataPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data', 'accounts.json');

function unauthorized(res) { return res.status(403).json({ error: 'forbidden' }); }
function authorised(req) {
  const supplied = req.get('x-internal-tool-secret') || '';
  return Boolean(secret) && supplied.length === secret.length && crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(secret));
}
async function readStore() { return JSON.parse(await fs.readFile(dataPath, 'utf8')); }
async function writeStore(store) { await fs.writeFile(dataPath, `${JSON.stringify(store, null, 2)}\n`); }
function findAccount(store, body = {}) { return store.accounts.find((a) => a.id === body.customer_id || a.phone === body.dialed_phone); }
async function event(store, type, body) { store.events.push({ id: crypto.randomUUID(), type, at: new Date().toISOString(), ...body }); await writeStore(store); }

app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.use((req, res, next) => authorised(req) ? next() : unauthorized(res));

app.post('/v1/call-verification/right-party', async (req, res) => {
  const store = await readStore(); const account = findAccount(store, req.body);
  const verified = Boolean(account && String(req.body.challenge_answer || '').trim().toLowerCase() === account.verification_answer);
  return res.json({ verified, result: verified ? 'Right-party verification succeeded.' : 'Verification failed.', customer: verified ? { id: account.id, display_name: account.display_name, contact_preference: account.contact_preference } : null });
});
app.get('/v1/accounts/summary', async (req, res) => {
  const store = await readStore(); const account = store.accounts.find((a) => a.id === req.query.customer_id);
  if (!account) return res.status(404).json({ error: 'not_found' });
  return res.json({ status: account.status, balance: { display: account.balance.toFixed(2) }, next_due_date: account.next_due_date, payment_status: account.payment_status, approved_spoken_summary: `Your account status is ${account.status}. The approved balance is ${account.balance.toFixed(2)} and the next due date is ${account.next_due_date}.` });
});
app.post('/v1/payment-options/quote', async (req, res) => {
  const store = await readStore(); const account = findAccount(store, req.body); if (!account) return res.status(404).json({ error: 'not_found' });
  const options = account.approved_options || []; return res.json({ options, requires_human_approval: options.length === 0, spoken_options: options.length ? options.join('. ') : 'No automatic option is available; a specialist must review this.' });
});
app.post('/v1/promises-to-pay', async (req, res) => { const store = await readStore(); await event(store, 'promise_to_pay', req.body); return res.json({ id: crypto.randomUUID(), contact_suppressed_until: req.body.payment_date, confirmation: 'Your proposed payment has been recorded pending official written confirmation.' }); });
app.post('/v1/payment-investigations', async (req, res) => { const store = await readStore(); const id = crypto.randomUUID(); await event(store, 'payment_investigation', { id, ...req.body }); return res.json({ reference: id, next_steps: 'An investigation has been opened. Do not make another payment until you receive the official follow-up.' }); });
app.post('/v1/hardship-cases', async (req, res) => { const store = await readStore(); const id = crypto.randomUUID(); await event(store, 'hardship', { id, ...req.body }); return res.json({ reference: id, payment_requests_suspended: true, safe_next_step: 'Payment discussion is paused and a specialist will review the support options.' }); });
app.post('/v1/disputes', async (req, res) => { const store = await readStore(); const id = crypto.randomUUID(); await event(store, 'dispute', { id, ...req.body }); return res.json({ reference: id, next_steps: 'The dispute has been recorded for review.' }); });
app.post('/v1/contact-preferences', async (req, res) => { const store = await readStore(); const account = findAccount(store, req.body); if (account) account.contact_preference = req.body.preference; await event(store, 'contact_preference', req.body); return res.json({ preference: req.body.preference, suppressed: true, confirmation: 'Your communication preference has been recorded.' }); });
app.post('/v1/official-communications', async (req, res) => { const store = await readStore(); const id = crypto.randomUUID(); await event(store, 'official_communication', { id, ...req.body }); return res.json({ reference: id, delivery_summary: 'An official written follow-up has been queued to the registered contact method.' }); });
app.post('/v1/compliance-incidents', async (req, res) => { const store = await readStore(); const id = crypto.randomUUID(); await event(store, 'compliance_incident', { id, ...req.body }); return res.json({ reference: id, result: 'Safety incident logged.' }); });
app.listen(port, () => console.log(`tools service listening on ${port}`));
