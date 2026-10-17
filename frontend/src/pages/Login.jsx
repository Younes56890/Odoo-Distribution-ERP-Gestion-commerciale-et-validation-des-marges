import { useState } from 'react';
import { ArrowRight, Check, ShieldCheck } from '../components/icons';
import OptikaMark from '../components/OptikaMark';
import { login, startDemo } from '../services/api';
import { seedDemo } from '../services/demo';
import { money, percent } from '../domain/quote';
import { Field } from '../components/ui';

const example = seedDemo().orders[0];
export default function Login({ onLogin }) {
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  return <div className="login-layout">
    <section className="login-story">
      <div className="brand"><span className="brand-mark"><OptikaMark size={38}/></span><span>optika<span className="brand-period">.</span><strong>operations</strong></span></div>
      <div className="login-story-content"><p className="login-intro">Le quotidien de la distribution optique.</p><h1>Une vision claire.<br/>{' '}À chaque étape.</h1><p>Du premier devis au dernier paiement, vos équipes avancent dans le même sens.</p>
        <div className="order-specimen" aria-label="Exemple de devis de démonstration">
          <div className="specimen-heading"><span>Bon de commande</span><strong>{example.name}</strong></div>
          <div className="specimen-client"><span>Préparé pour</span><strong>{example.partner_name}</strong></div>
          <div className="specimen-product"><svg viewBox="0 0 300 115" role="img" aria-label="Dessin de montures de lunettes Aurora"><path d="M35 38 18 28M265 38l17-10M127 48q23-16 46 0"/><path d="M39 34q-11 0-12 14l5 22q4 17 32 17 35 0 47-22l9-23q1-12-15-13-41-5-66 5ZM261 34q11 0 12 14l-5 22q-4 17-32 17-35 0-47-22l-9-23q-1-12 15-13 41-5 66 5Z"/><path className="specimen-temple" d="m34 36 23-19q7-5 17-4m192 23-23-19q-7-5-17-4"/></svg><div><strong>Monture Aurora</strong><span>10 unités · Collection optique</span></div><strong>{money(example.amount_untaxed)}</strong></div>
          <div className="specimen-margin"><div><span>Taux de marque</span><strong>{percent(example.margin_percent)}</strong></div><div className="specimen-threshold"><span>Seuil requis</span><strong>15 %</strong></div><span className="badge warning">À examiner</span></div>
          <div className="specimen-footer"><Check size={16}/><span>Un accord documenté avant confirmation.</span></div>
        </div>
        <p className="specimen-caption">Un exemple du parcours commercial proposé dans la démonstration.</p>
      </div>
      <footer className="story-footer"><span>Conçu pour vos opérations.</span><span>Ventes · Stock · Finance</span></footer>
    </section>
    <section className="login-access"><div className="login-form-wrap"><p className="login-welcome">Votre espace Optika</p><h2>Au travail, ensemble.</h2><p className="muted">Connectez-vous avec votre compte personnel.</p>
      {error && <div className="notice danger" role="alert">{error}</div>}
      <form onSubmit={async event => { event.preventDefault(); setBusy(true); setError(''); try { onLogin(await login(email, password)); } catch (err) { setError(err.message); } finally { setBusy(false); } }}>
        <Field label="Identifiant"><input required autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} placeholder="vous@entreprise.ma"/></Field>
        <Field label="Mot de passe"><input required autoComplete="current-password" type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Votre mot de passe"/></Field>
        <button className="btn primary full" disabled={busy}>{busy ? 'Connexion en cours…' : 'Ouvrir mon espace'}<ArrowRight size={18}/></button>
      </form>
      <div className="demo-access"><div className="demo-access-heading"><h3>Juste de passage ?</h3><span>Sans compte</span></div><p>Choisissez un rôle pour explorer le projet. Les données sont fictives et vos actions restent locales.</p>
        <div className="demo-role-grid">{[['manager', 'Direction', 'Pilotage & approbations'], ['commercial', 'Commercial', 'Opportunités & devis'], ['logistics', 'Logistique', 'Préparation & réceptions'], ['accountant', 'Finance', 'Factures & paiements']].map(([role, title, text]) => <button key={role} onClick={() => onLogin(startDemo(role))}><strong>{title}<ArrowRight size={16}/></strong><small>{text}</small></button>)}</div>
      </div>
      <p className="login-footnote"><ShieldCheck size={15}/> Une session personnelle, des permissions adaptées.</p>
    </div></section>
  </div>;
}
