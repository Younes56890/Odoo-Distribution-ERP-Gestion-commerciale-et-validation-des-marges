import { useEffect, useRef } from 'react';
import { AlertCircle, ArrowLeft, ArrowRight, Inbox, LoaderCircle, Search, X } from './icons';

const labels = {
  draft: 'Brouillon', sent: 'Envoyé', sale: 'Confirmée', done: 'Terminé', cancel: 'Annulé',
  waiting: 'En attente', approved: 'Approuvée', refused: 'Refusée', cancelled: 'Invalidée',
  no_required: 'Marge conforme', to_request: 'À soumettre', assigned: 'Disponible',
  confirmed: 'À préparer', paid: 'Payée', partial: 'Paiement partiel', not_paid: 'À régler',
  in_payment: 'Paiement en cours', posted: 'Comptabilisée', invoiced: 'Facturée',
};
export function Badge({ state, children }) {
  const tone = ['sale', 'done', 'approved', 'paid', 'no_required'].includes(state) ? 'success'
    : ['refused', 'cancel', 'cancelled'].includes(state) ? 'danger'
      : ['waiting', 'to_request', 'partial', 'not_paid', 'confirmed'].includes(state) ? 'warning' : 'neutral';
  return <span className={`badge ${tone}`}>{children || labels[state] || state}</span>;
}
export function PageHeading({ eyebrow, title, description, children }) {
  return <div className="page-heading"><div><p className="page-context">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div>{children && <div className="heading-actions">{children}</div>}</div>;
}
export function Panel({ title, subtitle, children, action, className = '' }) {
  return <section className={`panel ${className}`}>{title && <div className="panel-heading"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</div>}{children}</section>;
}
export function ResourceState({ resource, children }) {
  if (resource.loading) return <div className="resource-state loading-state" role="status" aria-label="Chargement de votre espace"><div className="skeleton-layout" aria-hidden="true"><div className="skeleton-heading"/><div className="skeleton-row"><i/><i/><i/></div><div className="skeleton-table"><i/><i/><i/><i/></div></div><span className="sr-only">Chargement de votre espace…</span></div>;
  if (resource.error) return <div className="resource-state error" role="alert"><AlertCircle size={24}/><p>{resource.error}</p><button className="btn secondary" onClick={resource.retry}>Réessayer</button></div>;
  return children;
}
export function Empty({ title = 'Aucun résultat', description = 'Les nouveaux éléments apparaîtront ici.', action }) {
  return <div className="empty"><span className="empty-icon"><Inbox size={26}/></span><h3>{title}</h3><p>{description}</p>{action}</div>;
}
export function SearchField({ value, onChange, placeholder = 'Rechercher…', label = 'Rechercher' }) {
  return <label className="search-field"><Search size={17}/><input aria-label={label} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder}/>{value && <button type="button" aria-label="Effacer la recherche" onClick={() => onChange('')}><X size={14}/></button>}</label>;
}
export function Pagination({ data, onPage }) {
  if (!data) return null;
  return <div className="pagination"><span>{data.total ? `${data.offset + 1}–${Math.min(data.offset + data.limit, data.total)}` : '0'} sur {data.total}</span><div><button className="icon-btn" aria-label="Page précédente" disabled={!data.offset} onClick={() => onPage(Math.max(0, data.offset - data.limit))}><ArrowLeft size={17}/></button><button className="icon-btn" aria-label="Page suivante" disabled={data.offset + data.limit >= data.total} onClick={() => onPage(data.offset + data.limit)}><ArrowRight size={17}/></button></div></div>;
}
export function Metric({ label, value, detail, icon: Icon, tone = '' }) {
  return <div className={`metric ${tone}`}><div className="metric-top"><span>{label}</span>{Icon && <span className="metric-icon"><Icon size={19}/></span>}</div><strong>{value}</strong><p>{detail}</p></div>;
}
export function Modal({ title, children, onClose, wide = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    dialog.querySelector('input:not([type="hidden"]), select, textarea')?.focus();
    return () => dialog.close();
  }, []);
  return <dialog ref={ref} className={`modal ${wide ? 'wide' : ''}`} onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === ref.current) onClose(); }} aria-label={title}>
    <div className="modal-header"><h2>{title}</h2><button className="icon-btn" aria-label="Fermer" onClick={onClose}><X size={20}/></button></div><div className="modal-body">{children}</div>
  </dialog>;
}
export function Field({ label, children, hint }) { return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>; }
