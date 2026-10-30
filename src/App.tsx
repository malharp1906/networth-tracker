import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileSpreadsheet, UploadCloud, X } from 'lucide-react';
import Dashboard from './components/Dashboard';
import { parseReport } from './lib/parseReport';
import type { ClientReport, Holding } from './lib/types';
import { loadProfile, saveProfile, type Profile } from './lib/profile';
import { ageOn, formatDate } from './lib/format';

const ALL = '__all__';
const ACCEPT = '.xlsx,.xls,.csv';

interface LoadError {
  file: string;
  message: string;
}

export default function App() {
  const [reports, setReports] = useState<ClientReport[]>([]);
  const [errors, setErrors] = useState<LoadError[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [clientId, setClientId] = useState<string>('');
  const [applicant, setApplicant] = useState<string>(''); // '' = all applicants in the file
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const dragDepth = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);

  const ingest = useCallback(async (files: { name: string; read: () => Promise<ArrayBuffer> }[]) => {
    const parsed: ClientReport[] = [];
    const failed: LoadError[] = [];
    for (const f of files) {
      try {
        parsed.push(parseReport(await f.read(), f.name));
      } catch (e) {
        failed.push({ file: f.name, message: e instanceof Error ? e.message : String(e) });
      }
    }
    setReports(prev => {
      const byId = new Map(prev.map(r => [r.id, r]));
      for (const r of parsed) {
        const existing = byId.get(r.id);
        // Re-uploading a client keeps whichever report is more recent.
        if (!existing || r.asOf >= existing.asOf) byId.set(r.id, r);
      }
      return [...byId.values()];
    });
    setErrors(prev => [...prev.filter(p => !failed.some(f => f.file === p.file)), ...failed]);
    if (parsed.length > 0) {
      setClientId(cur => cur || parsed[0].id);
      setApplicant('');
    }
  }, []);

  // Load everything that was in "csv files/" when the app was built / started.
  useEffect(() => {
    const base = import.meta.env.BASE_URL;
    (async () => {
      try {
        const res = await fetch(`${base}reports/manifest.json`);
        const names: unknown = await res.json();
        if (Array.isArray(names)) {
          await ingest(
            names.map(n => ({
              name: String(n),
              read: async () => {
                const r = await fetch(`${base}reports/${encodeURIComponent(String(n))}`);
                if (!r.ok) throw new Error(`Could not fetch ${n} (${r.status})`);
                return r.arrayBuffer();
              },
            })),
          );
        }
      } catch {
        /* no manifest (e.g. static host without the folder) — the upload box still works */
      } finally {
        setLoading(false);
      }
    })();
  }, [ingest]);

  const addFiles = (list: FileList | File[]) => {
    const files = Array.from(list).filter(f => /\.(xlsx|xls|csv)$/i.test(f.name));
    if (files.length === 0) {
      setErrors(prev => [...prev, { file: 'Upload', message: 'Only .xlsx, .xls or .csv files are supported.' }]);
      return;
    }
    void ingest(files.map(f => ({ name: f.name, read: () => f.arrayBuffer() })));
  };

  const sorted = useMemo(() => [...reports].sort((a, b) => a.name.localeCompare(b.name)), [reports]);
  const isCombined = clientId === ALL;
  const client = isCombined ? undefined : sorted.find(r => r.id === clientId) ?? sorted[0];
  const effectiveApplicant = client && client.applicants.some(a => a.name === applicant) ? applicant : '';

  const { holdings, reported, reportedLabel, duplicatesDropped } = useMemo(() => {
    if (isCombined) {
      const seen = new Set<string>();
      const all: Holding[] = [];
      let dropped = 0;
      for (const r of sorted) {
        for (const h of r.holdings) {
          const k = `${h.applicant}|${h.folio}|${h.scheme}`;
          if (seen.has(k)) dropped++;
          else {
            seen.add(k);
            all.push(h);
          }
        }
      }
      return { holdings: all, reported: null, reportedLabel: '', duplicatesDropped: dropped };
    }
    if (!client) return { holdings: [] as Holding[], reported: null, reportedLabel: '', duplicatesDropped: 0 };
    if (effectiveApplicant) {
      const a = client.applicants.find(x => x.name === effectiveApplicant);
      return {
        holdings: client.holdings.filter(h => h.applicant === effectiveApplicant),
        reported: a?.totals ?? null,
        reportedLabel: 'applicant total, since inception',
        duplicatesDropped: 0,
      };
    }
    return { holdings: client.holdings, reported: client.grandTotals, reportedLabel: 'since inception, as reported', duplicatesDropped: 0 };
  }, [isCombined, sorted, client, effectiveApplicant]);

  // Manual assets/liabilities apply to a whole client, not to one family member or the combined view.
  const profileId = client && !effectiveApplicant ? client.id : null;
  const profile = useMemo(() => {
    if (!client || !profileId) return null;
    return profiles[profileId] ?? loadProfile(client.id);
  }, [client, profileId, profiles]);

  const onProfileChange = (p: Profile) => {
    if (!profileId) return;
    setProfiles(prev => ({ ...prev, [profileId]: p }));
    saveProfile(profileId, p);
  };

  const title = isCombined ? 'All clients (combined)' : client?.name ?? 'Portfolio Dashboard';
  const age = client ? ageOn(client.dob, client.asOf) : null;
  const asOfDates = [...new Set(sorted.map(r => r.asOf).filter(Boolean))].sort();
  const subtitle = isCombined
    ? `${sorted.length} clients · reports as of ${asOfDates.map(formatDate).join(', ') || '—'}`
    : client
      ? [
          'Mutual fund & net worth dashboard',
          age != null ? `Age ${age}` : null,
          `Report as of ${formatDate(client.asOf)}`,
        ].filter(Boolean).join(' · ')
      : 'Load portfolio reports to begin';

  return (
    <div
      className="dashboard-container"
      onDragEnter={e => { e.preventDefault(); dragDepth.current++; setDragging(true); }}
      onDragOver={e => e.preventDefault()}
      onDragLeave={() => { if (--dragDepth.current <= 0) { dragDepth.current = 0; setDragging(false); } }}
      onDrop={e => { e.preventDefault(); dragDepth.current = 0; setDragging(false); addFiles(e.dataTransfer.files); }}
    >
      {dragging && (
        <div className="drop-overlay"><UploadCloud size={48} /><p>Drop reports to add them</p></div>
      )}

      <header>
        <div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        <div className="toolbar">
          {sorted.length > 0 && (
            <select aria-label="Client" value={isCombined ? ALL : client?.id} onChange={e => { setClientId(e.target.value); setApplicant(''); }}>
              {sorted.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              {sorted.length > 1 && <option value={ALL}>All clients (combined)</option>}
            </select>
          )}
          <button className="primary-btn" onClick={() => fileInput.current?.click()}>
            <UploadCloud size={16} /> Add reports
          </button>
          <input ref={fileInput} type="file" accept={ACCEPT} multiple hidden onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }} />
        </div>
      </header>

      {client && client.applicants.length > 1 && (
        <div className="chips" role="tablist" aria-label="Applicant">
          <button className={`chip ${!effectiveApplicant ? 'on' : ''}`} onClick={() => setApplicant('')}>Everyone in this report</button>
          {client.applicants.map(a => (
            <button key={a.name} className={`chip ${effectiveApplicant === a.name ? 'on' : ''}`} onClick={() => setApplicant(a.name)}>
              {a.name}
            </button>
          ))}
        </div>
      )}

      {errors.length > 0 && (
        <div className="glass-panel error-box">
          {errors.map(er => (
            <div key={er.file} className="error-row">
              <span><strong>{er.file}</strong> — {er.message}</span>
              <button className="icon-btn" aria-label="Dismiss" onClick={() => setErrors(prev => prev.filter(p => p !== er))}><X size={14} /></button>
            </div>
          ))}
        </div>
      )}

      {duplicatesDropped > 0 && (
        <p className="muted small" style={{ marginBottom: '1rem' }}>
          {duplicatesDropped} position{duplicatesDropped > 1 ? 's' : ''} appeared in more than one report and {duplicatesDropped > 1 ? 'were' : 'was'} counted once.
        </p>
      )}

      {loading ? (
        <p className="muted">Reading reports…</p>
      ) : holdings.length === 0 ? (
        <div className="glass-panel empty" onClick={() => fileInput.current?.click()}>
          <FileSpreadsheet size={44} />
          <h2>No reports loaded</h2>
          <p>Drop portfolio summary files here (.xlsx, .xls or .csv), or click to choose them.</p>
          <p className="muted small">To load them automatically, put the files in the “csv files” folder and restart <code>npm run dev</code>.</p>
        </div>
      ) : (
        <Dashboard
          key={`${isCombined ? ALL : client?.id}|${effectiveApplicant}`}
          holdings={holdings}
          reported={reported}
          reportedLabel={reportedLabel}
          profile={profile}
          onProfileChange={onProfileChange}
        />
      )}
    </div>
  );
}
