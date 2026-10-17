import { lazy, Suspense } from 'react';
import { ArrowRight, ArrowUpRight, Banknote, Clock3, FileCheck2, Plus, ShieldCheck, Truck, Wallet } from '../components/icons';
import { useResource } from '../hooks/useResource';
import { money } from '../domain/quote';
import { Empty, Metric, PageHeading, Panel, ResourceState } from '../components/ui';

const RevenueChart = lazy(() => import('../components/RevenueChart'));
export default function Dashboard({ user, revision, navigate }) {
  const resource = useResource('dashboard', {}, revision);
  const data = resource.data;
  const aging = data?.aging || [];
  const receivable = data?.kpis.receivable || 0;
  return <div className="dashboard-page"><PageHeading eyebrow={`Bonjour, ${user.name.split(' · ')[0]}`} title="Une vue claire de l’activité." description="L’essentiel de vos finances et les décisions qui vous attendent.">
    {user.capabilities.includes('sales') && <button className="btn primary" onClick={() => navigate('quotes')}><Plus size={17}/> Créer un devis</button>}
  </PageHeading>
    <ResourceState resource={resource}>{data && <>
      <div className="overview-meta"><span><i className="status-dot"/>{user.demo ? 'Démonstration interactive' : 'Données de la société active'}</span><span>{data.currency} · Toutes les périodes</span></div>
      <div className="metric-grid">
        <Metric label="Chiffre d’affaires facturé" value={money(data.kpis.invoiced, data.currency)} detail="Factures comptabilisées · hors taxes" icon={FileCheck2}/>
        <Metric label="Montant réglé" value={money(data.kpis.settled, data.currency)} detail="Total TTC moins le solde des factures" icon={Banknote} tone="accent"/>
        <Metric label="Reste à recevoir" value={money(data.kpis.receivable, data.currency)} detail="Solde client · toutes taxes comprises" icon={Wallet}/>
        <Metric label="Échéances dépassées" value={money(data.kpis.overdue, data.currency)} detail="Solde des factures échues · TTC" icon={Clock3} tone="amber"/>
      </div>
      <div className="dashboard-grid">
        <Panel title="Le rythme de votre activité" subtitle="Facturation mensuelle hors taxes" className="revenue-panel" action={<span className="chart-legend"><i/>Montant facturé</span>}>
          {data.trend.length ? <Suspense fallback={<div className="chart-placeholder"/>}><RevenueChart data={data.trend} currency={data.currency}/></Suspense> : <Empty title="Votre activité commence ici" description="Le graphique apparaîtra après la première facture comptabilisée."/>}
          <div className="chart-footer"><span>Six derniers mois avec activité</span><span>Les avoirs ne sont pas inclus.</span></div>
        </Panel>
        <Panel title="À votre attention" subtitle="Vos prochaines actions" className="priorities-panel">
          <div className="priority-list">
            {data.pending_approvals !== null && <button onClick={() => navigate('approvals')}><span className="priority-icon amber"><ShieldCheck size={21}/></span><span><strong>Dérogations de marge</strong><small>En attente d’une décision</small></span><span className="priority-count">{data.pending_approvals}</span><ArrowUpRight size={17}/></button>}
            {data.pending_deliveries !== null && <button onClick={() => navigate('logistics')}><span className="priority-icon teal"><Truck size={21}/></span><span><strong>Livraisons à préparer</strong><small>Commandes à faire avancer</small></span><span className="priority-count">{data.pending_deliveries}</span><ArrowUpRight size={17}/></button>}
            <button onClick={() => navigate('finance')}><span className="priority-icon rose"><Clock3 size={21}/></span><span><strong>Échéances à suivre</strong><small>{money(data.kpis.overdue, data.currency)} en retard</small></span><ArrowUpRight size={17}/></button>
          </div>
          <button className="priority-bottom" onClick={() => navigate('finance')}>Ouvrir le suivi financier <ArrowRight size={16}/></button>
        </Panel>
      </div>
      <div className="dashboard-bottom-grid">
        <Panel title="Le temps compte aussi" subtitle="Répartition du solde client par ancienneté" className="aging-panel" action={<button className="btn text" onClick={() => navigate('finance')}>Voir les échéances <ArrowUpRight size={15}/></button>}>
          {aging.length ? <div className="aging-breakdown">{aging.map((bucket, index) => <div className="aging-breakdown-row" key={bucket.name}><div><span className={`aging-key bucket-${index}`}/><span>{bucket.name}</span><strong>{money(bucket.value, data.currency)}</strong></div><meter min="0" max={Math.max(receivable, bucket.value, 1)} value={bucket.value} aria-label={`${bucket.name} : ${money(bucket.value, data.currency)}`}/></div>)}</div> : <Empty title="Aucun solde à répartir"/>}
        </Panel>
        <section className="workflow-banner"><div><p className="workflow-kicker">Le parcours Optika</p><h2>Un accord.<br/>Toute une équipe.</h2><p>Des conditions commerciales à la facture, chaque décision garde son historique.</p></div><ol className="workflow-steps"><li>Devis</li><li>Approbation</li><li>Livraison</li><li>Facture</li></ol><button className="btn text" onClick={() => navigate(user.capabilities.includes('sales') ? 'orders' : 'finance')}>Retrouver mes dossiers <ArrowRight size={16}/></button></section>
      </div>
    </>}</ResourceState>
  </div>;
}
