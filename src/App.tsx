import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Activity, ArrowDownLeft, ArrowRight, ArrowUpRight, Check, CheckCheck, ChevronDown, ChevronRight, CircleHelp, Clock3, Code2, Copy, Download, ExternalLink, FileCheck2, FileText, Fingerprint, FlaskConical, Info, KeyRound, Layers3, LoaderCircle, LockKeyhole, MoreHorizontal, Pause, Play, Plus, RefreshCw, RotateCcw, ScanLine, ShieldCheck, ShieldOff, Sparkles, Upload, Wallet, X } from 'lucide-react';
import { formatUnits } from 'ethers';
import { assess } from './core/status';
import { parseImport } from './core/recorder';
import { backup, recordsStore } from './core/storage';
import Workspace from './Workspace';
import type { PermitSandbox } from './core/sandbox';
import type { ChainState, ExecutionReceipt, PermitRecord, ProbeResult } from './core/types';

const short = (value: string, n = 5) => value ? `${value.slice(0,n + 2)}…${value.slice(-n)}` : '—';
const units = (value?: string) => value === undefined ? '—' : Number(formatUnits(value, 18)).toLocaleString('en-US', { maximumFractionDigits: 2 });
const time = (timestamp?: number) => timestamp ? new Date(timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '—';

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); const d = ref.current; return () => { d?.close(); }; }, []);
  return <dialog ref={ref} onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="modal-head"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={20}/></button></div>{children}
  </dialog>;
}

export default function App() {
  const sandbox = useRef<PermitSandbox | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [records, setRecords] = useState<PermitRecord[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [states, setStates] = useState<Record<string, ChainState>>({});
  const [receipts, setReceipts] = useState<ExecutionReceipt[]>([]);
  const [probes, setProbes] = useState<Record<string, ProbeResult>>({});
  const [baselines, setBaselines] = useState<Record<string, ProbeResult>>({});
  const [busy, setBusy] = useState('Starting isolated EVM');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [modal, setModal] = useState<'capture' | 'cancel' | 'coverage' | 'reset' | 'delete' | 'details' | 'receipts' | 'trail' | 'lab' | null>(null);
  const [activeReceipt, setActiveReceipt] = useState<ExecutionReceipt | null>(null);
  const [paused, setPaused] = useState(false);
  const [captureApp, setCaptureApp] = useState<'Swap demo' | 'Checkout demo'>('Swap demo');

  const session = sandbox.current?.sessionId;
  const current = records.filter(r => r.sessionId === session);
  const selected = records.find(r => r.id === selectedId);
  const state = selected && !paused ? states[selected.id] : undefined;
  const status = selected ? assess(selected, state) : null;
  const actionable = !!selected && !!state && !paused && status?.signature !== 'unknown' && !busy;
  const probe = selected ? probes[selected.id] : undefined;
  const openCount = current.filter(r => assess(r, paused ? undefined : states[r.id]).needsAction).length;

  async function sync(evm = sandbox.current) {
    if (!evm) return;
    const all = await recordsStore.list();
    const next: Record<string, ChainState> = {};
    for (const record of all.filter(r => r.sessionId === evm.sessionId)) next[record.id] = await evm.state(record.payload.message.spender);
    setRecords(all); setStates(next); setReceipts([...evm.receipts]);
  }

  async function initialize() {
    const { PermitSandbox } = await import('./core/sandbox');
    const evm = await PermitSandbox.create();
    sandbox.current = evm;
    // DEMO: creates a genuine test signature using an ephemeral account; not a user's wallet.
    const record = await evm.record('Swap demo', recordsStore.save);
    await sync(evm); setSelectedId(record.id); setProbes({}); setBaselines({}); setPaused(false);
  }

  async function run(label: string, fn: () => Promise<void>) {
    if (busy) return;
    setBusy(label); setError(''); setNotice('');
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : 'The operation could not be verified. Try refreshing the state.'); }
    finally { setBusy(''); }
  }

  useEffect(() => {
    initialize().catch(e => setError(e instanceof Error ? e.message : 'Could not start the demo.')).finally(() => setBusy(''));
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 5000);
    return () => clearTimeout(timer);
  }, [notice]);

  function download(filename: string, text: string) {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
  }
  async function importFile(file?: File) {
    if (!file) return;
    await run('Importing receipt metadata', async () => {
      if (file.size > 1_000_000) throw new Error('Choose a backup smaller than 1 MB.');
      const imported = parseImport(await file.text());
      for (const record of imported) await recordsStore.save(record);
      await sync(); setModal('receipts'); if (imported[0]) setSelectedId(imported[0].id);
      setNotice(`${imported.length} receipts imported as unverified metadata.`);
    });
  }
  async function simulate() {
    if (!selected || !actionable) return;
    await run('Checking a discarded EVM branch', async () => {
      const result = await sandbox.current!.probe(selected);
      setProbes(p => ({ ...p, [selected.id]: result })); if (status?.needsAction) setBaselines(p => ({ ...p, [selected.id]: result })); await sync();
    });
  }
  async function verify() {
    if (!selected || !actionable) return;
    await run('Replaying the original test signature', async () => {
      await sandbox.current!.replay(selected);
      const result = await sandbox.current!.probe(selected);
      setProbes(p => ({ ...p, [selected.id]: result })); await sync();
      setNotice(result.permitAccepted || result.transferAccepted ? 'An executable permission remains. Review the evidence.' : 'Old signature rejected. Test transfer rejected.');
    });
  }

  return <>
    <Workspace records={records} current={current} selected={selected} state={state} status={status} busy={busy} actionable={actionable} paused={paused} probe={probe} baseline={selected ? baselines[selected.id] : undefined} receipts={receipts} openCount={openCount}
      onSelect={setSelectedId} onCapture={() => setModal('capture')} onCancel={() => setModal('cancel')}
      onPreview={simulate} onVerify={verify} onDetails={() => setModal('details')} onRestart={() => setModal('reset')}
      onCoverage={() => setModal('coverage')} onReceipts={() => setModal('receipts')} onTrail={() => setModal('trail')} onLab={() => setModal('lab')}
      onRefresh={() => run('Reading current contract state', async () => { setPaused(false); await sync(); setNotice('State refreshed from the isolated EVM.'); })}/>
    {error && <div className="message error" role="alert"><ShieldOff size={18}/><span>{error}</span><button className="icon-button" onClick={() => setError('')} aria-label="Dismiss error"><X size={17}/></button></div>}
    {notice && <div className="toast" role="status"><Check size={17}/>{notice}</div>}
    <input type="file" ref={fileInput} accept="application/json,.json" hidden onChange={e => { importFile(e.target.files?.[0]); e.target.value = ''; }}/>
    {busy && <div className="busy-indicator" role="status"><LoaderCircle size={17} className="spin"/>{busy}</div>}

    {modal === 'receipts' && <Modal title="Your local receipts" onClose={() => setModal(null)}><p className="modal-intro">{records.length} records on this device. Previous sessions and imports are unverified. Changing domains does not move browser storage; export from the old site and import here.</p><div className="receipt-browser">{records.map(r => <button className="receipt-browser-item" key={r.id} onClick={() => { setSelectedId(r.id); setModal(null); }}><FileText size={19}/><span><strong>{r.app} · {units(r.payload.message.value)} tUSD</strong><small>{r.sessionId === session ? 'Current demo' : 'Previous / imported · unverified'} · {time(r.capturedAt)}</small></span><ChevronRight size={16}/></button>)}</div><div className="modal-actions"><button className="secondary" onClick={() => download('permitscope-receipts.json', backup(records))}><Download size={16}/>Export all receipts</button><button className="secondary" onClick={() => { setModal(null); fileInput.current?.click(); }}><Upload size={16}/>Import backup</button></div></Modal>}
    {modal === 'trail' && <Modal title="Execution trail" onClose={() => setModal(null)}><p className="modal-intro">Actual execution receipts from this browser’s isolated EVM. No public network or real assets.</p><div className="execution-list">{receipts.filter(r => r.permissionId === selected?.id).map(r => <button className="receipt-browser-item" key={r.id} onClick={() => { setModal(null); setActiveReceipt(r); }}><CheckCheck size={18}/><span><strong>{r.label}</strong><small>Block {r.block} · {r.status} · {r.gasUsed} gas</small></span><ArrowUpRight size={16}/></button>)}{!receipts.some(r => r.permissionId === selected?.id) && <p className="modal-intro">No transactions for this permission yet. Start with a risk preview, then cancel and verify.</p>}</div><button className="secondary full" onClick={() => download('permitscope-proof.json', JSON.stringify({ environment: 'isolated-browser-evm', record: selected, currentState: state, before: selected ? baselines[selected.id] : undefined, latestProbe: probe, executions: receipts.filter(r=>r.permissionId === selected?.id) }, null, 2))}><Download size={16}/>Download evidence</button></Modal>}
    {modal === 'lab' && <Modal title="Explore the edge cases" onClose={() => setModal(null)}><p className="modal-intro">These controls change only your isolated demo. An activated allowance can survive the signature’s expiry.</p><div className="lab-options"><button className="secondary full" disabled={!actionable || status?.signature !== 'ready'} onClick={() => { setModal(null); run('Activating the test permit', async () => { await sandbox.current!.activate(selected!); setProbes({}); await sync(); }); }}>Activate the signed permit <Play size={16}/></button><button className="secondary full" disabled={!actionable} onClick={() => { setModal(null); run('Advancing demo time', async () => { sandbox.current!.advanceTime(86401); setProbes({}); await sync(); setNotice('Clock advanced 24 hours. Existing allowances do not automatically expire.'); }); }}>Advance the demo clock 24 hours <Clock3 size={16}/></button><button className="secondary full" disabled={!!busy} onClick={() => { setPaused(!paused); setModal(null); setNotice(paused ? 'Verification resumed.' : 'Checks paused. State is now unknown.'); }}>{paused ? 'Resume verification' : 'Pause verification'} <Pause size={16}/></button></div></Modal>}
    {modal === 'capture' && <Modal title="Capture a test permission" onClose={() => setModal(null)}><p className="modal-intro">Choose a test dApp. A fresh ERC-2612 signature will be created by your ephemeral demo wallet and captured through the recorder SDK.</p><div className="capture-choices">{(['Swap demo','Checkout demo'] as const).map(app => <button key={app} className={captureApp === app ? 'chosen' : ''} onClick={() => setCaptureApp(app)}><span className="dapp-icon">{app === 'Swap demo' ? <ArrowDownLeft size={23}/> : <Wallet size={22}/>}</span><strong>{app}</strong><span>{app === 'Swap demo' ? '750' : '120'} tUSD · 24 hours</span>{captureApp === app && <Check size={18}/>}</button>)}</div><div className="modal-note"><Info size={17}/>No personal wallet is connected. Only receipt metadata is saved.</div><button className="primary full" onClick={() => { setModal(null); run('Signing and capturing a test permit', async () => { const r = await sandbox.current!.record(captureApp, recordsStore.save); await sync(); setSelectedId(r.id);  }); }}>Sign with demo wallet <ArrowRight size={17}/></button></Modal>}
    {modal === 'cancel' && selected && <Modal title={status?.allowance === 'open' ? 'Revoke this allowance?' : 'Cancel this permission?'} onClose={() => setModal(null)}><p className="modal-intro">{status?.signature === 'ready' ? 'Submit a new zero-value permit at the current nonce. This invalidates the old signature and sets this spender’s allowance to zero.' : 'Set this spender’s existing token allowance to zero.'}</p><div className="confirmation-grid"><span>Network</span><strong>Isolated browser EVM · 31337</strong><span>Token</span><strong>Scope Test Dollar (tUSD)</strong><span>Spender</span><code>{selected.payload.message.spender}</code><span>New allowance</span><strong>0 tUSD</strong></div><div className="modal-note"><Info size={17}/>A zero-value permit also invalidates other signatures for this token at the same nonce. Existing allowances to other spenders stay unchanged.</div><div className="modal-actions"><button className="secondary" onClick={() => setModal(null)}>Keep permission</button><button className="primary" onClick={() => { setModal(null); run('Cancelling and checking contract state', async () => { await sandbox.current!.close(selected); setProbes(p => { const n = { ...p }; delete n[selected.id]; return n; }); await sync(); setNotice('Cancellation executed. Verify the old signature to inspect the outcome.'); }); }}>Confirm cancellation <ArrowRight size={16}/></button></div></Modal>}
    {modal === 'reset' && <Modal title="Start a fresh demo?" onClose={() => setModal(null)}><p className="modal-intro">This replaces the ephemeral wallet and EVM state. Existing receipts stay in your local archive, where their state is marked unverified. Export a backup first if you need it.</p><div className="modal-actions"><button className="secondary" onClick={() => setModal(null)}>Keep this session</button><button className="primary" onClick={() => { setModal(null); run('Creating a fresh isolated demo', initialize); }}>Restart demo <RotateCcw size={16}/></button></div></Modal>}
    {modal === 'details' && selected && <Modal title="Receipt details" onClose={() => setModal(null)}><div className="receipt-detail-meta"><span className="badge">{selected.verification}</span><span>Metadata only</span></div><pre className="json-view">{JSON.stringify(selected, null, 2)}</pre><div className="modal-actions"><button className="secondary" onClick={() => { download('permitscope-receipt.json', backup([selected])); }}>Export receipt <Download size={16}/></button><button className="text-button danger" onClick={() => setModal('delete')}>Delete local record</button></div></Modal>}
    {modal === 'delete' && selected && <Modal title="Delete the local record?" onClose={() => setModal(null)}><p className="modal-intro">Deleting this receipt does not cancel a signature or revoke an allowance. The record will disappear from this device even if the permission is still open.</p><div className="modal-actions"><button className="secondary" onClick={() => setModal(null)}>Keep record</button><button className="danger-button" onClick={() => { setModal(null); run('Deleting local metadata', async () => { await recordsStore.remove(selected.id); const rest = await recordsStore.list(); await sync(); setSelectedId(rest.find(r => r.sessionId === session)?.id || rest[0]?.id || ''); setNotice('Local metadata deleted. No permission was revoked.'); }); }}>Delete metadata only</button></div></Modal>}
    {activeReceipt && <Modal title="Execution receipt" onClose={() => setActiveReceipt(null)}><div className="modal-note"><FlaskConical size={18}/>This transaction executed in the isolated browser EVM. It is not a public testnet or mainnet transaction.</div><pre className="json-view">{JSON.stringify(activeReceipt, null, 2)}</pre><button className="secondary full" onClick={() => download('permitscope-execution.json', JSON.stringify(activeReceipt, null, 2))}>Download execution receipt <Download size={16}/></button></Modal>}
    {modal === 'coverage' && <Modal title="A clear boundary, by design." onClose={() => setModal(null)}><div className="coverage-section"><span className="summary-icon lavender"><Fingerprint size={23}/></span><div><h3>Records you actually captured</h3><p>The recorder verifies the signing account, chain and typed-data signature. It cannot discover signatures from before you connected it, another browser or another device.</p></div></div><div className="coverage-section"><span className="summary-icon mint"><LockKeyhole size={23}/></span><div><h3>Your device. Your metadata.</h3><p>Receipts stay in IndexedDB. Backups contain no executable signatures or keys. This demo temporarily holds test signatures in memory so you can replay them. Imported records are always unverified.</p></div></div><div className="coverage-section"><span className="summary-icon amber"><FlaskConical size={23}/></span><div><h3>Real execution, isolated assets</h3><p>OpenZeppelin’s ERC20Permit runs on EthereumJS VM in this browser. No real wallet, remote RPC, public-chain settlement or recovery of stolen funds. Reloading creates a new isolated session.</p></div></div><div className="coverage-section"><span className="summary-icon gray"><Code2 size={23}/></span><div><h3>A deliberately narrow first version</h3><p>Standard ERC-2612, one known test token, two test dApps. Permit2, DAI-style permits, NFTs and EIP-7702 need different verification. This is not a universal wallet security audit.</p></div></div><div className="modal-actions"><button className="secondary" disabled={!!busy} onClick={() => download('permitscope-receipts.json', backup(records))}><Download size={16}/>Back up all receipts</button><button className="secondary" disabled={!!busy} onClick={() => { setModal(null); fileInput.current?.click(); }}><Upload size={16}/>Restore a backup</button></div><div className="source-links"><a href="https://eips.ethereum.org/EIPS/eip-2612" target="_blank" rel="noreferrer">ERC-2612 specification <ExternalLink size={13}/></a><a href="https://revoke.cash/learn/approvals/what-are-eip2612-permit-signatures" target="_blank" rel="noreferrer">Why signatures can be invisible <ExternalLink size={13}/></a></div></Modal>}
  </>;
}
