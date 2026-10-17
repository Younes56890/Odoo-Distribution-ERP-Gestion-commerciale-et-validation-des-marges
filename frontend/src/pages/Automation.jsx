import { useState } from 'react';
import { api } from '../services/api';
import { useResource } from '../hooks/useResource';
import { Badge, Empty, Field, Metric, PageHeading, Pagination, Panel, ResourceState } from '../components/ui';

const kinds = { waiting: 'Nouvelle attente', overdue: 'Relance', quote_pdf: 'PDF du devis', report_csv: 'Rapport CSV' };
const states = { pending: 'À traiter', succeeded: 'Réussi', failed: 'Échec', skipped: 'Obsolète', success: 'Réussi', error: 'Échec' };
const when = value => value ? new Date(value.replace(' ', 'T') + 'Z').toLocaleString('fr-MA') : '—';
const tone = state => ['succeeded', 'success'].includes(state) ? 'approved' : ['failed', 'error'].includes(state) ? 'refused' : state === 'pending' ? 'waiting' : '';

function PolicyForm({ overview, run }) {
  const [form, setForm] = useState(() => {
    const source = overview.policy || { enabled: false, notifications_enabled: true, pdf_enabled: true,
      reports_enabled: true, reminder_hours: 24, report_frequency: 'weekly', timezone: 'Africa/Casablanca', recipient_ids: [] };
    return Object.fromEntries(Object.entries(source).filter(([name]) => !['id', 'report_cursor', 'activation_from'].includes(name)));
  });
  const [busy, setBusy] = useState(false);
  const change = (name, value) => setForm(current => ({ ...current, [name]: value }));
  return <form className="automation-form" onSubmit={async event => {
    event.preventDefault(); setBusy(true);
    await run(() => api.updateAutomation(form), 'Politique de suivi enregistrée.');
    setBusy(false);
  }}>
    <label className="automation-check"><input type="checkbox" checked={form.enabled} onChange={event => change('enabled', event.target.checked)}/><span><strong>Autoriser les traitements internes</strong><small>Active les exécutions manuelles. La planification se configure séparément dans Odoo.</small></span></label>
    <div className="automation-fields">
      <Field label="Relance après (heures)"><input type="number" required min="0.25" max="8760" step="0.25" value={form.reminder_hours} onChange={event => change('reminder_hours', Number(event.target.value))}/></Field>
      <Field label="Fréquence du rapport"><select value={form.report_frequency} onChange={event => change('report_frequency', event.target.value)}><option value="daily">Quotidienne</option><option value="weekly">Hebdomadaire</option></select></Field>
      <Field label="Fuseau des périodes"><input required value={form.timezone} onChange={event => change('timezone', event.target.value)}/></Field>
    </div>
    <fieldset className="automation-recipients"><legend>Approbateurs à notifier</legend>{overview.recipients.length ? overview.recipients.map(user => <label className="automation-check" key={user.id}><input type="checkbox" checked={form.recipient_ids.includes(user.id)} onChange={event => change('recipient_ids', event.target.checked ? [...form.recipient_ids, user.id] : form.recipient_ids.filter(id => id !== user.id))}/><span>{user.name}</span></label>) : <p className="muted">Aucun approbateur interne disponible pour cette société.</p>}</fieldset>
    <div className="automation-options">{[['notifications_enabled', 'Activités de validation'], ['pdf_enabled', 'PDF après approbation humaine'], ['reports_enabled', 'Rapports CSV privés']].map(([name, label]) => <label className="automation-check" key={name}><input type="checkbox" checked={form[name]} onChange={event => change(name, event.target.checked)}/><span>{label}</span></label>)}</div>
    <div className="form-actions"><button className="btn primary" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer la politique'}</button></div>
  </form>;
}

function Supervision({ revision, run }) {
  const [offset, setOffset] = useState(0), [logOffset, setLogOffset] = useState(0), [busy, setBusy] = useState(false);
  const resource = useResource('automationOverview', {}, revision);
  const available = !!resource.data?.available;
  const jobs = useResource('automationJobs', { offset, limit: 10 }, revision, available);
  const logs = useResource('automationRuns', { offset: logOffset, limit: 10 }, revision, available);
  const download = async job => {
    await run(async () => {
      const artifact = await api.automationDocument(job.id);
      const bytes = Uint8Array.from(atob(artifact.data), char => char.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: artifact.mimetype }));
      const link = window.document.createElement('a'); link.href = url; link.download = artifact.name; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return true;
    });
  };
  return <ResourceState resource={resource}>{resource.data && (!available ? <Panel><Empty title="Module de suivi indisponible" description="Installez le module sale_margin_automation dans Odoo pour ouvrir la supervision."/></Panel> : <>
    <div className="notice"><span><strong>{resource.data.policy?.enabled ? 'Traitements autorisés' : 'Traitements désactivés'}</strong> · {resource.data.scheduled ? 'Planification active dans Odoo' : 'Planification inactive : activation réservée à l’administrateur Odoo'}. Les décisions restent humaines et les documents restent internes.</span></div>
    {resource.data.preview && <div className="metric-grid automation-metrics"><Metric label="En attente" value={resource.data.preview.waiting} detail="Demandes dans la période de reprise"/><Metric label="Délai dépassé" value={resource.data.preview.overdue} detail="Selon le délai configuré"/><Metric label="À soumettre" value={resource.data.preview.to_request} detail="Action du commercial nécessaire"/><Metric label="Échecs" value={resource.data.preview.failed_jobs} detail="Consultez les traces avant une reprise"/></div>}
    <Panel title="Politique de suivi" subtitle="Une configuration par société, désactivée à l’installation." action={<button className="btn secondary" disabled={busy || !resource.data.policy?.enabled} onClick={async () => {
      setBusy(true); await run(async () => { const result = await api.runAutomation(); if (result.failed) throw new Error(`${result.failed} traitement(s) en échec. Consultez le journal.`); return result; }, 'Lot exécuté. Consultez les traitements et leur résultat.');
      setBusy(false); jobs.retry(); logs.retry(); resource.retry();
    }}>{busy ? 'Exécution…' : 'Exécuter un lot'}</button>}><PolicyForm key={JSON.stringify(resource.data.policy)} overview={resource.data} run={run}/></Panel>
    <Panel title="Traitements et documents" subtitle="Un événement, un destinataire et une version. Les PDF obsolètes sont bloqués au téléchargement."><ResourceState resource={jobs}>{jobs.data && <>{jobs.data.items.length ? <div className="table-wrap"><table><thead><tr><th>Traitement</th><th>Destinataire</th><th>État</th><th>Tentatives</th><th>Résultat</th><th>Actions</th></tr></thead><tbody>{jobs.data.items.map(job => <tr key={job.id}><td><strong>{kinds[job.kind]}</strong><small className="cell-note">{job.order_name || 'Rapport périodique'} · {when(job.created_at)}</small></td><td>{job.recipient || 'Supervision Manager'}</td><td><Badge state={tone(job.state)}>{states[job.state]}</Badge></td><td>{job.attempts}</td><td className="automation-result">{job.result || 'En file'}{job.error_code && <small className="cell-note">{job.error_code} · reprise : {when(job.next_attempt_at)}</small>}</td><td><div className="automation-actions">{job.state === 'failed' && <button className="btn text" disabled={busy || !resource.data.policy?.enabled} onClick={async () => { setBusy(true); await run(() => api.retryAutomation(job.id), 'Reprise mise en file pour la prochaine exécution.'); setBusy(false); }}>Remettre en file</button>}{job.has_document && <button className="btn text" onClick={() => download(job)}>Télécharger</button>}</div></td></tr>)}</tbody></table></div> : <Empty title="Aucun traitement" description="Enregistrez une politique, puis exécutez un lot ou activez la planification dans Odoo."/>}<Pagination data={jobs.data} onPage={setOffset}/></>}</ResourceState></Panel>
    <Panel title="Journal d’exécution" subtitle="Dates affichées dans le fuseau du navigateur. Les exports utilisent UTC."><ResourceState resource={logs}>{logs.data && <>{logs.data.items.length ? <div className="table-wrap"><table><thead><tr><th>Date</th><th>Exécution</th><th>Déclencheur</th><th>Résultat</th><th>Diagnostic</th></tr></thead><tbody>{logs.data.items.map(log => <tr key={log.id}><td>{when(log.started_at)}</td><td>{log.kind === 'discovery' ? 'Détection' : log.kind === 'manual_retry' ? 'Reprise demandée' : `Traitement #${log.job_id} · tentative ${log.attempt}`}</td><td>{log.triggered_by}</td><td><Badge state={tone(log.state)}>{states[log.state]}</Badge></td><td className="automation-result">{log.error_code && <strong>{log.error_code}</strong>}<details><summary>Voir les traces</summary><pre className="automation-trace">{log.detail}</pre></details></td></tr>)}</tbody></table></div> : <Empty title="Aucune exécution enregistrée"/>}<Pagination data={logs.data} onPage={setLogOffset}/></>}</ResourceState></Panel>
  </>)}</ResourceState>;
}

export default function Automation({ user, revision, run }) {
  return <><PageHeading eyebrow="Supervision Manager" title="Le suivi avance, vous décidez." description="Retrouvez les attentes à relancer, les documents préparés et les résultats de chaque exécution."/>{user.demo ? <Panel><Empty title="Disponible avec votre connexion Odoo" description="Les automatisations utilisent les devis et les permissions réels. Connectez-vous à Odoo pour les configurer."/></Panel> : <Supervision revision={revision} run={run}/>}</>;
}
