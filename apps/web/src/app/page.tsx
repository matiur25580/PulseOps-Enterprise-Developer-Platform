'use client';

import { FormEvent, useState } from 'react';

type Service = {
  id: string; name: string; slug: string; description: string | null;
  repository: string | null; lifecycle: 'EXPERIMENTAL' | 'PRODUCTION' | 'DEPRECATED' | 'RETIRED';
  createdAt: string; updatedAt: string;
};
type AuthPayload = {
  accessToken: string; user: { id: string; name: string; email: string };
  tenant: { id: string; slug: string }; role: string;
};

const API = (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000').replace(/\/$/, '') + '/api/v1';
const emptyForm = { name: '', slug: '', description: '', repository: '', lifecycle: 'EXPERIMENTAL' as Service['lifecycle'] };

async function apiRequest<T>(path: string, token?: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload.message;
    throw new Error(Array.isArray(message) ? message.join(', ') : message || 'Request failed');
  }
  return payload as T;
}

export default function Home() {
  const [token, setToken] = useState('');
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [identity, setIdentity] = useState<AuthPayload | null>(null);
  const [tenantSlug, setTenantSlug] = useState('');
  const [services, setServices] = useState<Service[]>([]);
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '', tenantName: '', tenantSlug: '' });
  const [serviceForm, setServiceForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function authenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const payload = await apiRequest<AuthPayload>(`/auth/${mode}`, undefined, {
        method: 'POST',
        body: JSON.stringify(mode === 'register'
          ? { name: authForm.name, email: authForm.email, password: authForm.password, tenantName: authForm.tenantName }
          : { email: authForm.email, password: authForm.password, tenantSlug: authForm.tenantSlug }),
      });
      setToken(payload.accessToken); setIdentity(payload); setTenantSlug(payload.tenant.slug);
      const rows = await apiRequest<Service[]>('/services', payload.accessToken);
      setServices(rows); setNotice(mode === 'register' ? 'Workspace created. Your Service Catalog is ready.' : 'Signed in successfully.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Authentication failed'); }
    finally { setBusy(false); }
  }

  async function saveService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!token) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const payload = { ...serviceForm, description: serviceForm.description || undefined, repository: serviceForm.repository || undefined };
      if (editingId) {
        const updated = await apiRequest<Service>(`/services/${editingId}`, token, { method: 'PATCH', body: JSON.stringify(payload) });
        setServices((current) => current.map((item) => item.id === editingId ? updated : item));
        setNotice('Service updated.');
      } else {
        const created = await apiRequest<Service>('/services', token, { method: 'POST', body: JSON.stringify(payload) });
        setServices((current) => [created, ...current]); setNotice('Service registered.');
      }
      setServiceForm(emptyForm); setEditingId(null);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save service'); }
    finally { setBusy(false); }
  }

  async function deleteService(id: string) {
    if (!token || !window.confirm('Delete this service from the workspace?')) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await apiRequest<{ deleted: boolean }>(`/services/${id}`, token, { method: 'DELETE' });
      setServices((current) => current.filter((item) => item.id !== id)); setNotice('Service deleted.');
      if (editingId === id) { setEditingId(null); setServiceForm(emptyForm); }
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not delete service'); }
    finally { setBusy(false); }
  }

  function beginEdit(service: Service) {
    setEditingId(service.id);
    setServiceForm({ name: service.name, slug: service.slug, description: service.description ?? '', repository: service.repository ?? '', lifecycle: service.lifecycle });
    setError(''); setNotice('');
  }

  function signOut() {
    setToken(''); setIdentity(null); setServices([]); setEditingId(null); setServiceForm(emptyForm); setNotice('Signed out.');
  }

  return (
    <main className="shell">
      <nav className="topbar">
        <a className="brand" href="/" aria-label="PulseOps home"><span className="brand-mark">P</span><span>PulseOps</span></a>
        <span className="environment"><span /> {identity ? 'WORKSPACE CONNECTED' : 'SERVICE CATALOG / EARLY ACCESS'}</span>
      </nav>

      {!identity ? (
        <section className="auth-layout">
          <div className="auth-copy">
            <p className="eyebrow">ENGINEERING OPERATIONS PLATFORM</p>
            <h1>Know your systems.<br /><span>Operate with confidence.</span></h1>
            <p className="intro">Create a workspace and register your engineering services. Your catalog is scoped to your authenticated workspace.</p>
            <div className="hero-meta"><span className="status-dot" /> JWT-protected API <span className="meta-divider">/</span> PostgreSQL persistence</div>
          </div>
          <section className="auth-card">
            <div className="tabs"><button className={mode === 'register' ? 'tab active' : 'tab'} onClick={() => { setMode('register'); setError(''); }}>Create workspace</button><button className={mode === 'login' ? 'tab active' : 'tab'} onClick={() => { setMode('login'); setError(''); }}>Sign in</button></div>
            <h2>{mode === 'register' ? 'Start your workspace' : 'Welcome back'}</h2>
            <p className="muted">{mode === 'register' ? 'Your account becomes the first workspace administrator.' : 'Use your workspace slug and account credentials.'}</p>
            <form onSubmit={authenticate} className="stack-form">
              {mode === 'register' && <label>Your name<input required minLength={2} maxLength={80} value={authForm.name} onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })} placeholder="Ada Lovelace" /></label>}
              <label>Email address<input required type="email" value={authForm.email} onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })} placeholder="you@company.com" /></label>
              <label>Password<input required type="password" minLength={12} maxLength={72} value={authForm.password} onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })} placeholder="At least 12 characters" /></label>
              {mode === 'register'
                ? <label>Workspace name<input required minLength={2} maxLength={100} value={authForm.tenantName} onChange={(e) => setAuthForm({ ...authForm, tenantName: e.target.value })} placeholder="Platform Engineering" /></label>
                : <label>Workspace slug<input required value={authForm.tenantSlug} onChange={(e) => setAuthForm({ ...authForm, tenantSlug: e.target.value })} placeholder="platform-engineering-a1b2c3d4" /></label>}
              <button className="primary-button" disabled={busy}>{busy ? 'Please wait…' : mode === 'register' ? 'Create workspace →' : 'Sign in →'}</button>
            </form>
            <p className="fine-print">Access tokens stay in page memory and expire after one hour. Refreshing the page signs you out.</p>
          </section>
        </section>
      ) : (
        <section className="workspace">
          <div className="workspace-head">
            <div><p className="eyebrow">SERVICE CATALOG</p><h1 className="workspace-title">Your services<span>.</span></h1><p className="muted">{identity.tenant.slug} · signed in as {identity.user.name} · {identity.role}</p></div>
            <button className="quiet-button" onClick={signOut}>Sign out</button>
          </div>
          <div className="catalog-layout">
            <section className="catalog-main">
              <div className="catalog-toolbar"><div><h2>Registered services</h2><p className="muted">{services.length} service{services.length === 1 ? '' : 's'} in this workspace</p></div><span className="counter">TENANT SCOPED</span></div>
              {services.length === 0 ? <div className="empty-state"><span className="empty-icon">◇</span><h3>No services yet</h3><p>Register your first service to start building your developer catalog.</p></div> : <div className="service-list">
                {services.map((service) => <article className="service-row" key={service.id}>
                  <div className="service-symbol">S</div><div className="service-info"><div className="service-title-line"><h3>{service.name}</h3><span className={service.lifecycle === 'PRODUCTION' ? 'lifecycle production' : 'lifecycle'}>{service.lifecycle}</span></div><p>{service.description || service.slug}</p>{service.repository && <a href={service.repository} target="_blank" rel="noreferrer">{service.repository}</a>}</div>
                  <div className="service-actions"><button onClick={() => beginEdit(service)}>Edit</button><button className="danger-link" onClick={() => deleteService(service.id)} disabled={busy}>Delete</button></div>
                </article>)}
              </div>}
            </section>
            <aside className="editor-card">
              <p className="eyebrow">{editingId ? 'UPDATE ENTRY' : 'NEW ENTRY'}</p><h2>{editingId ? 'Edit service' : 'Register a service'}</h2>
              <form className="stack-form" onSubmit={saveService}>
                <label>Service name<input required minLength={2} maxLength={100} value={serviceForm.name} onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })} placeholder="Payments API" /></label>
                <label>Slug<input required minLength={2} maxLength={100} value={serviceForm.slug} onChange={(e) => setServiceForm({ ...serviceForm, slug: e.target.value })} placeholder="payments-api" /></label>
                <label>Description<textarea maxLength={1000} rows={3} value={serviceForm.description} onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })} placeholder="What does this service do?" /></label>
                <label>Repository URL<input type="url" value={serviceForm.repository} onChange={(e) => setServiceForm({ ...serviceForm, repository: e.target.value })} placeholder="https://github.com/org/repo" /></label>
                <label>Lifecycle<select value={serviceForm.lifecycle} onChange={(e) => setServiceForm({ ...serviceForm, lifecycle: e.target.value as Service['lifecycle'] })}><option value="EXPERIMENTAL">Experimental</option><option value="PRODUCTION">Production</option><option value="DEPRECATED">Deprecated</option><option value="RETIRED">Retired</option></select></label>
                <button className="primary-button" disabled={busy}>{busy ? 'Saving…' : editingId ? 'Save changes →' : 'Register service →'}</button>
                {editingId && <button type="button" className="quiet-button cancel-button" onClick={() => { setEditingId(null); setServiceForm(emptyForm); }}>Cancel edit</button>}
              </form>
            </aside>
          </div>
        </section>
      )}

      {(error || notice) && <div className={error ? 'feedback error' : 'feedback success'} role="status">{error || notice}</div>}
      <footer className="footer"><span>PULSEOPS / DEVELOPER PLATFORM</span><span>Workspace-scoped service ownership.</span></footer>
    </main>
  );
}
