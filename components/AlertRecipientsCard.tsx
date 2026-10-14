'use client';

import { useCallback, useEffect, useState } from 'react';
import { BellRing, Loader2, Plus, Send, Trash2 } from 'lucide-react';

type Recipient = { email: string; createdAt: string };

export default function AlertRecipientsCard() {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [fallback, setFallback] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState<string | null>(null); // 'add' | email being removed/tested
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/alert-recipients');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setRecipients(json.recipients);
      setFallback(json.fallback || []);
    } catch (e: any) {
      setNotice({ kind: 'err', text: e.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function call(method: 'POST' | 'DELETE', body: Record<string, string>, key: string) {
    setBusy(key);
    setNotice(null);
    try {
      const res = await fetch('/api/admin/alert-recipients', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      return json;
    } catch (e: any) {
      setNotice({ kind: 'err', text: e.message });
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function add() {
    const email = input.trim();
    if (!email) return;
    const json = await call('POST', { email }, 'add');
    if (json) {
      setRecipients(json.recipients);
      setInput('');
      setNotice({ kind: 'ok', text: `${email.toLowerCase()} will receive alerts.` });
    }
  }

  async function remove(email: string) {
    const json = await call('DELETE', { email }, `rm:${email}`);
    if (json) {
      setRecipients(json.recipients);
      setNotice({ kind: 'ok', text: `Removed ${email}.` });
    }
  }

  async function test(email: string) {
    const json = await call('POST', { email, action: 'test' }, `test:${email}`);
    if (json) setNotice({ kind: 'ok', text: `Test alert sent to ${email}.` });
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mb-6">
      <div className="flex items-center gap-3 mb-1">
        <BellRing className="w-5 h-5 text-amber-600 dark:text-amber-400" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Missing Lead Alerts</h2>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Checked hourly. When a CallRail form submission has no matching contact in Spark, everyone below gets one digest email.
        Each lead is alerted once.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading recipients
        </div>
      ) : (
        <>
          {recipients.length === 0 ? (
            <p className="text-sm text-amber-700 dark:text-amber-400 mb-3">
              No recipients set.{' '}
              {fallback.length
                ? <>Alerts fall back to <span className="font-mono">{fallback.join(', ')}</span> from the server config.</>
                : <>Alerts will fail until one is added.</>}
            </p>
          ) : (
            <ul className="divide-y divide-gray-200 dark:divide-gray-700 mb-4">
              {recipients.map(r => (
                <li key={r.email} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="text-sm text-gray-900 dark:text-white break-all">{r.email}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => test(r.email)}
                      disabled={busy !== null}
                      title="Send a test alert to this address"
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 cursor-pointer"
                    >
                      {busy === `test:${r.email}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      Test
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(r.email)}
                      disabled={busy !== null}
                      title="Stop sending alerts to this address"
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-50 cursor-pointer"
                    >
                      {busy === `rm:${r.email}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <form
            onSubmit={e => { e.preventDefault(); add(); }}
            className="flex flex-col sm:flex-row gap-2"
          >
            <input
              type="email"
              required
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="name@example.com"
              className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={busy !== null || !input.trim()}
              className="flex items-center justify-center gap-2 px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
            >
              {busy === 'add' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Add recipient
            </button>
          </form>

          {notice && (
            <p className={`mt-3 text-sm ${notice.kind === 'ok' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
              {notice.text}
            </p>
          )}
        </>
      )}
    </div>
  );
}
