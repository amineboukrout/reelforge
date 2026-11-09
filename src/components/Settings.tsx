import { Eye, EyeOff, ExternalLink, KeyRound, Plus, ShieldCheck, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CUSTOM_MODEL_TEMPLATE, generatedAt, generatedCount, validateModelJson } from '../lib/catalog';
import { isDesktop, keystore } from '../lib/keystore';
import { muapi, readBalance } from '../lib/muapi';
import { cx } from '../lib/util';
import { useApp } from '../store/app';

const KEY_URL = 'https://muapi.ai/dashboard';

function openExternal(url: string) {
  if (window.reelforge) window.reelforge.openExternal(url);
  else window.open(url, '_blank', 'noopener');
}

export function Settings() {
  const open = useApp((s) => s.settingsOpen);
  const setOpen = useApp((s) => s.setSettingsOpen);
  const [tab, setTab] = useState<'key' | 'models' | 'data'>('key');
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen]);
  if (!open) return null;

  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div className="modal" role="dialog" aria-label="Settings">
        <div className="modal-head">
          <h3>Settings</h3>
          <button className="btn ghost icon sm" onClick={() => setOpen(false)} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div style={{ padding: '12px 18px 0' }}>
          <div className="tabs">
            <button className={cx(tab === 'key' && 'on')} onClick={() => setTab('key')}>API key</button>
            <button className={cx(tab === 'models' && 'on')} onClick={() => setTab('models')}>Custom models</button>
            <button className={cx(tab === 'data' && 'on')} onClick={() => setTab('data')}>Data</button>
          </div>
        </div>
        <div className="modal-body">
          {tab === 'key' && <KeyTab />}
          {tab === 'models' && <ModelsTab />}
          {tab === 'data' && <DataTab />}
        </div>
      </div>
    </div>
  );
}

function KeyTab() {
  const apiKey = useApp((s) => s.apiKey);
  const setApiKey = useApp((s) => s.setApiKey);
  const setOpen = useApp((s) => s.setSettingsOpen);
  const toast = useApp((s) => s.toast);
  const [val, setVal] = useState(apiKey);
  const [show, setShow] = useState(false);
  const [state, setState] = useState<{ kind: 'idle' | 'testing' | 'ok' | 'err'; msg?: string }>({ kind: 'idle' });

  const save = async () => {
    const k = val.trim();
    if (!k) {
      await setApiKey('');
      toast('info', 'API key removed');
      return;
    }
    setState({ kind: 'testing' });
    try {
      const r = await muapi.balance(k);
      const b = readBalance(r);
      setState({ kind: 'ok', msg: b ? `Connected · balance ${b}` : 'Connected' });
      await setApiKey(k);
      toast('success', 'API key saved');
      setTimeout(() => setOpen(false), 600);
    } catch (e) {
      setState({ kind: 'err', msg: (e as Error).message });
    }
  };

  return (
    <>
      <div className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
        <div className="model-avatar" style={{ background: 'var(--grad)', width: 40, height: 40 }}>
          <KeyRound size={18} />
        </div>
        <div>
          <div style={{ fontWeight: 600 }}>Connect your Muapi account</div>
          <div className="small muted">
            Reelforge uses your own Muapi key to run 400+ image, video and lip-sync models. Create one under <b>Dashboard → API Keys</b>.
          </div>
        </div>
      </div>
      <div className="field">
        <div className="fl">API key</div>
        <div className="row">
          <input
            className="input"
            type={show ? 'text' : 'password'}
            autoComplete="off"
            spellCheck={false}
            placeholder="Paste your Muapi API key"
            value={val}
            onChange={(e) => (setVal(e.target.value), setState({ kind: 'idle' }))}
            onKeyDown={(e) => e.key === 'Enter' && save()}
          />
          <button className="btn icon" onClick={() => setShow(!show)} aria-label={show ? 'Hide key' : 'Show key'}>
            {show ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
        {state.kind !== 'idle' && (
          <div className="small" style={{ color: state.kind === 'err' ? 'var(--err)' : state.kind === 'ok' ? 'var(--ok)' : 'var(--text-3)' }}>
            {state.kind === 'testing' ? 'Checking key…' : state.msg}
          </div>
        )}
      </div>
      <div className="row small muted" style={{ gap: 8 }}>
        <ShieldCheck size={15} color="var(--ok)" style={{ flex: 'none' }} />
        {keystore.describe()}
      </div>
      <div className="row">
        <button className="btn ghost" onClick={() => openExternal(KEY_URL)}>
          Get a key <ExternalLink size={13} />
        </button>
        <span className="grow" />
        {apiKey && (
          <button className="btn danger" onClick={() => (setVal(''), setApiKey(''))}>
            Remove
          </button>
        )}
        <button className="btn primary" onClick={save} disabled={state.kind === 'testing'}>
          Save & test
        </button>
      </div>
    </>
  );
}

function ModelsTab() {
  const localCustom = useApp((s) => s.localCustom);
  const fileCustom = useApp((s) => s.fileCustom);
  const add = useApp((s) => s.addCustomModels);
  const remove = useApp((s) => s.removeCustomModel);
  const toast = useApp((s) => s.toast);
  const [text, setText] = useState('');
  const [err, setErr] = useState<string | null>(null);

  return (
    <>
      <div className="small muted">
        Add any Muapi endpoint (or override a built-in one) by describing its inputs and parameters. Controls are generated
        automatically. Self-hosters can also edit <code>public/models.custom.json</code>, or run <code>npm run sync-models</code> to
        pull every new model from Muapi's API spec.
      </div>
      <div className="small muted">
        Built-in catalog: <b style={{ color: 'var(--text-2)' }}>{generatedCount} models</b>, synced {new Date(generatedAt).toLocaleDateString()}.
      </div>
      {[...fileCustom.map((m) => ({ m, file: true })), ...localCustom.map((m) => ({ m, file: false }))].map(({ m, file }) => (
        <div key={(file ? 'f:' : 'l:') + m.id} className="file-chip">
          <div className="meta">
            <div className="name">{m.name}</div>
            <div className="small muted">
              {m.id} · {m.category} {file && '· from models.custom.json'}
            </div>
          </div>
          {!file && (
            <button className="btn ghost icon sm" onClick={() => remove(m.id)} aria-label="Remove model">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ))}
      <div className="field">
        <div className="fl">
          <span>Model definition (JSON object or array)</span>
          <button className="btn ghost sm" onClick={() => setText(CUSTOM_MODEL_TEMPLATE)}>Insert template</button>
        </div>
        <textarea
          className="textarea"
          rows={12}
          style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}
          value={text}
          onChange={(e) => (setText(e.target.value), setErr(null))}
          placeholder={CUSTOM_MODEL_TEMPLATE}
        />
        {err && <div className="small" style={{ color: 'var(--err)' }}>{err}</div>}
      </div>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button
          className="btn primary"
          disabled={!text.trim()}
          onClick={() => {
            const r = validateModelJson(text);
            if (!r.ok) return setErr(r.error);
            add(r.models);
            setText('');
            toast('success', `Added ${r.models.length} model${r.models.length > 1 ? 's' : ''}`);
          }}
        >
          <Plus size={14} /> Add model
        </button>
      </div>
    </>
  );
}

function DataTab() {
  const gens = useApp((s) => s.generations);
  const uploads = useApp((s) => s.uploads);
  const clearHistory = useApp((s) => s.clearHistory);
  const clearUploads = useApp((s) => s.clearUploads);

  const exportHistory = () => {
    const blob = new Blob([JSON.stringify(gens, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `reelforge-history-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <>
      <div className="small muted">
        Everything is stored locally {isDesktop() ? 'in the Reelforge app data folder' : 'in this browser (IndexedDB)'}. Nothing is sent
        anywhere except the requests you make to Muapi. Output links are hosted by Muapi — download anything you want to keep.
      </div>
      <div className="file-chip">
        <div className="meta">
          <div className="name">Generation history</div>
          <div className="small muted">{gens.length} items</div>
        </div>
        <button className="btn sm" onClick={exportHistory} disabled={!gens.length}>Export JSON</button>
        <button className="btn sm danger" disabled={!gens.length} onClick={() => window.confirm('Clear history? Favorites are kept.') && clearHistory()}>
          Clear
        </button>
      </div>
      <div className="file-chip">
        <div className="meta">
          <div className="name">Upload history</div>
          <div className="small muted">{uploads.length} files · {(uploads.reduce((a, u) => a + u.size, 0) / 1024 / 1024).toFixed(1)} MB</div>
        </div>
        <button className="btn sm danger" disabled={!uploads.length} onClick={() => window.confirm('Delete all stored uploads?') && clearUploads()}>
          Clear
        </button>
      </div>
    </>
  );
}
