import { ArrowRight, ArrowUpRight, Check, CheckCheck, ChevronDown, CircleHelp, Clock3, FileText, Fingerprint, FlaskConical, KeyRound, Layers3, LoaderCircle, LockKeyhole, MoreHorizontal, Play, Plus, RefreshCw, RotateCcw, ScanLine, ShieldCheck, ShieldOff, Wallet } from 'lucide-react';
import { formatUnits } from 'ethers';
import type { ChainState, ExecutionReceipt, PermitRecord, ProbeResult } from './core/types';
import type { PermissionStatus } from './core/status';

const amount = (value?: string) => value === undefined ? '—' : Number(formatUnits(value, 18)).toLocaleString('en-US', { maximumFractionDigits: 2 });
const short = (address: string) => `${address.slice(0,7)}…${address.slice(-5)}`;
const labels = { ready: 'Can still activate', invalidated: 'Cannot activate', expired: 'Expired', future: 'Future permission', unknown: 'Not verified' };
type Props = {
  records: PermitRecord[]; current: PermitRecord[]; selected?: PermitRecord; state?: ChainState;
  status: PermissionStatus | null; busy: string; actionable: boolean; paused: boolean;
  probe?: ProbeResult; baseline?: ProbeResult; receipts: ExecutionReceipt[]; openCount: number;
  onSelect: (id: string) => void; onCapture: () => void; onCancel: () => void;
  onPreview: () => void; onVerify: () => void; onDetails: () => void;
  onRefresh: () => void; onRestart: () => void; onCoverage: () => void;
  onReceipts: () => void; onTrail: () => void; onLab: () => void;
};

export default function Workspace(p: Props) {
  const { selected, state, status, current, probe, baseline } = p;
  const closed = !!status && !status.needsAction && status.signature !== 'unknown';
  const after = closed ? probe : undefined;
  const exposure = baseline?.transferAccepted ? amount((BigInt(baseline.balanceBefore) - BigInt(baseline.balanceAfter)).toString()) : baseline ? '0' : '—';
  const events = p.receipts.filter(r => r.permissionId === selected?.id).slice(0,2);
  const tone = status?.signature === 'unknown' ? 'unknown' : status?.needsAction ? 'attention' : 'closed';

  return <div className="desk-shell">
    <header className="desk-header">
      <a className="brand" href="/"><span className="brand-mark"><ScanLine size={24}/></span><strong>PermitScope<span>.</span></strong></a>
      <span className="header-divider"/><a className="hub-link" href="/">Hackathon lab <ArrowUpRight size={13}/></a>
      <div className="header-actions"><button className="header-button" aria-label="Privacy & coverage" onClick={p.onCoverage}><LockKeyhole size={16}/><span>Privacy & coverage</span></button><button className="header-button" aria-label="Restart demo" disabled={!!p.busy} onClick={p.onRestart}><RotateCcw size={16}/><span>Restart demo</span></button><button className="primary capture-button" aria-label="Capture test permit" disabled={!!p.busy} onClick={p.onCapture}><Plus size={16}/><span>Capture test permit</span></button></div>
    </header>

    <div className="desk-intro"><div><h1>Know what’s still open.</h1><p>One signature. Two states. A verifiable outcome.</p></div><div className="environment-badge"><FlaskConical size={18}/><span><strong>Isolated EVM</strong><small>Real execution · test assets only</small></span></div></div>

    <main className="desk-grid">
      <aside className="panel record-panel">
        <div className="panel-heading"><h2>Recorded permission</h2><button className="icon-button" onClick={p.onReceipts} aria-label="Browse all receipts"><FileText size={18}/></button></div>
        <div className="wallet-summary"><span className="wallet-icon"><Wallet size={22}/></span><div><span>Demo wallet balance</span><strong>{amount(state?.balance)} <small>tUSD</small></strong></div></div>
        <label className="receipt-selector"><span>Active receipt</span><div><select aria-label="Select permission" value={selected?.id || ''} disabled={!!p.busy || !p.records.length} onChange={e => p.onSelect(e.target.value)}>{!selected && <option value="">Preparing demo…</option>}{current.map(r => <option key={r.id} value={r.id}>{r.app} · {amount(r.payload.message.value)} tUSD</option>)}{selected && !current.some(r=>r.id===selected.id) && <option value={selected.id}>{selected.app} · Archived</option>}</select><ChevronDown size={15}/></div></label>
        {selected && <><div className="record-badge"><Fingerprint size={15}/>{selected.verification === 'verified-at-capture' ? 'Signature verified at capture' : 'Imported · unverified'}</div><dl className="record-facts"><div><dt>Spender</dt><dd className="mono">{short(selected.payload.message.spender)}</dd></div><div><dt>Owner</dt><dd className="mono">{short(selected.payload.message.owner)}</dd></div><div><dt>Expires</dt><dd>{new Date(Number(selected.payload.message.deadline) * 1000).toLocaleString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</dd></div></dl></>}
        <div className="record-totals"><span><strong>{current.length}</strong> captured</span><span><strong>{p.paused ? '—' : p.openCount}</strong> need attention</span></div>
        <button className="text-button receipt-details-button" disabled={!selected} onClick={p.onDetails}>View receipt details <ArrowUpRight size={14}/></button>
        <div className="retention-note"><LockKeyhole size={14}/><p>Stored on your device. Open records are never silently discarded.</p></div>
      </aside>

      <section className="panel permission-panel">
        <div className="panel-heading"><div className="token-heading"><span className="token-logo">$</span><div><h2>Scope Test Dollar <span>tUSD</span></h2><p>Standard ERC-2612 permission</p></div></div><button className="icon-button" disabled={!!p.busy || !selected} onClick={p.onRefresh} aria-label="Refresh contract state"><RefreshCw size={17}/></button></div>
        {!selected ? <div className="loading-panel"><LoaderCircle className="spin"/><p>{p.busy || 'Start a fresh demo to capture a permission.'}</p><button className="secondary" disabled={!!p.busy} onClick={p.onRestart}>Start demo</button></div> : <>
          <div className={`permission-insight ${tone}`}><span>{tone === 'closed' ? <ShieldCheck size={21}/> : tone === 'unknown' ? <CircleHelp size={21}/> : <KeyRound size={21}/>}</span><div><h3>{status?.title}</h3><p>{tone === 'closed' ? 'Signature inactive. Allowance zero. Verify the original signature below.' : tone === 'unknown' ? 'Current state is unknown. No safety conclusion is available.' : status?.allowance === 'open' ? 'The signature may be spent or expired. This allowance still needs revoking.' : status?.signature === 'future' ? 'This nonce is ahead of the contract and may become usable later.' : 'The signature can activate an allowance, even when the current allowance is zero.'}</p></div></div>
          <div className="two-states">
            <div className="state-card"><div className="state-label"><FileText size={15}/><span>Signed permission</span></div><span className="state-kind">OFF-CHAIN</span><div className="state-amount">{amount(selected.payload.message.value)}<small>tUSD</small></div><div className={`state-verdict ${status?.signature === 'ready' || status?.signature === 'future' ? 'attention' : status?.signature === 'unknown' ? 'unknown' : 'closed'}`}>{status?.signature === 'invalidated' || status?.signature === 'expired' ? <Check size={15}/> : <KeyRound size={15}/>}{labels[status?.signature || 'unknown']}</div><p>Amount this signature authorizes</p></div>
            <span className="state-connector" aria-hidden="true"><ArrowRight size={18}/></span>
            <div className="state-card"><div className="state-label"><Layers3 size={15}/><span>Current allowance</span></div><span className="state-kind">ON-CHAIN</span><div className="state-amount">{status?.allowance === 'unknown' ? '—' : amount(state?.allowance)}<small>tUSD</small></div><div className={`state-verdict ${status?.allowance === 'open' ? 'attention' : status?.allowance === 'unknown' ? 'unknown' : 'closed'}`}>{status?.allowance === 'zero' ? <Check size={15}/> : <Layers3 size={15}/>}{status?.allowance === 'open' ? 'Available to spend' : status?.allowance === 'unknown' ? 'Not verified' : 'No active allowance'}</div><p>Amount the spender can use now</p></div>
          </div>
          <div className="contract-read"><span>Signed nonce <strong>{selected.payload.message.nonce}</strong><ArrowRight size={12}/>Current <strong>{state?.nonce ?? '—'}</strong></span><span>{state ? `Local block ${state.block}` : 'State unavailable'}</span></div>
          <div className="action-sequence" aria-label="Permission workflow"><button className="step-button" disabled={!p.actionable} onClick={p.onPreview}><span className="step-number">1</span><span>Preview risk</span><Play size={13}/></button><button className="step-button primary" disabled={!p.actionable || !status?.needsAction || status.signature === 'future'} onClick={p.onCancel}><span className="step-number">2</span><span>{status?.allowance === 'open' ? 'Revoke allowance' : 'Cancel permission'}</span></button><button className={`step-button ${closed ? 'ready-action' : ''}`} disabled={!p.actionable || !closed} onClick={p.onVerify}><span className="step-number">3</span><span>Verify closure</span><CheckCheck size={15}/></button></div>
          <p className="scope-note">This permission only. Unknown or unrecorded signatures are not covered.</p>
        </>}
      </section>

      <aside className="panel proof-panel">
        <div className="panel-heading"><h2>Execution proof</h2><span className="proof-tag">EVM</span></div>
        <div className={`proof-summary ${after ? after.transferAccepted ? 'attention' : 'closed' : baseline ? 'attention' : 'unknown'}`}><span className="proof-icon">{after && !after.transferAccepted ? <ShieldCheck size={28}/> : baseline ? <ScanLine size={28}/> : <FlaskConical size={28}/>}</span><div><h3>{after ? after.transferAccepted ? 'Permission still open' : 'Closure verified' : baseline ? 'Risk reproduced' : 'Check, don’t assume.'}</h3><p>{after ? 'Original signature and transfer tested.' : baseline ? 'Actual contract execution. No funds moved.' : 'Run the preview to see what it allows.'}</p></div></div>
        <div className="proof-comparison"><div><span>Before cancellation</span><strong className={baseline?.transferAccepted ? 'attention' : 'unknown'}>{baseline ? `${exposure} tUSD could move` : 'Not tested yet'}</strong></div><div><span>After cancellation</span><strong className={after ? after.transferAccepted ? 'attention' : 'closed' : 'unknown'}>{after ? after.transferAccepted ? 'Transfer still possible' : 'Test transfer rejected' : closed ? 'Ready to verify' : 'Not tested yet'}</strong></div></div>
        <div className="proof-checks"><span>{after && !after.permitAccepted ? <Check size={14}/> : <span className="pending-dash">—</span>}Old signature rejected</span><span>{after && !after.transferAccepted ? <Check size={14}/> : <span className="pending-dash">—</span>}Test transfer rejected</span></div>
        <div className="recent-events"><div className="recent-label">LATEST EXECUTION</div>{events.length ? events.map(r => <div className="mini-event" key={r.id}><span className="event-dot"/><span>{r.label}<small>Block {r.block} · {r.status === 'success' ? 'Executed' : 'Rejected'}</small></span></div>) : <p>Evidence appears here as you act.</p>}</div>
        <button className="text-button proof-trail-button" onClick={p.onTrail}>View execution trail <ArrowUpRight size={14}/></button>
      </aside>
    </main>

    <footer className="desk-footer"><span><LockKeyhole size={13}/><span>Browser-local EVM. Test tokens. No real wallet connected.</span></span><button onClick={p.onLab}><FlaskConical size={14}/>Test edge cases <ArrowUpRight size={13}/></button></footer>
  </div>;
}
