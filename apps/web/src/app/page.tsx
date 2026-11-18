'use client';

import { FormEvent, useEffect, useState } from 'react';

type Service = {
  id: string; name: string; slug: string; description: string | null;
  repository: string | null; teamId: string | null;
  lifecycle: 'EXPERIMENTAL' | 'PRODUCTION' | 'DEPRECATED' | 'RETIRED';
  createdAt: string; updatedAt: string;
};
type Team = { id: string; name: string; email: string | null; createdAt: string; updatedAt: string };
type Member = { id: string; role: 'ADMIN' | 'MEMBER'; user: { id: string; name: string; email: string } };
type Incident = { id: string; title: string; description: string | null; serviceId?: string | null; service?: { id: string; name: string } | null; escalationLevel?: number; severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'; status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED'; assignedToUserId: string | null; assignee: { id: string; name: string; email: string } | null; events: { id: string; eventType: string; message: string; createdAt: string; actor: { name: string } | null }[]; createdAt: string; };
type AuditLog = { id: string; action: string; entityType: string; entityId: string | null; createdAt: string; actor: { name: string; email: string } | null };
type Dependency = { id: string; sourceService: { id: string; name: string }; targetService: { id: string; name: string } };
type Slo = { id: string; name: string; indicator: 'AVAILABILITY' | 'LATENCY'; targetPercent: number; windowDays: number; latencyThresholdMs: number | null; service: { id: string; name: string }; measurement: { sampleCount: number; goodCount: number; sliPercent: number | null; errorBudgetRemainingPercent: number | null; dataSource: string } };
type Runbook = { id: string; title: string; url: string; category: string; isPrimary: boolean };
type EscalationPolicy = { id: string; primaryContactEmail: string; secondaryContactEmail: string | null; escalationAfterMinutes: number; onCallUrl: string | null; notes: string | null };
type CostSummary = {
  period: string; recordCount: number;
  totalsByCurrency: { currency: string; amount: number }[];
  byProvider: { provider: string; currency: string; amount: number }[];
  byService: { serviceId: string | null; serviceName: string; currency: string; amount: number }[];
  note: string;
};
type CostBudget = {
  id: string; name: string; amount: number; currency: string; thresholdPercent: number;
  actualAmount: number; utilizationPercent: number | null; recordCount: number;
  serviceId: string | null; service: { id: string; name: string } | null; period: string;
};
type DoraMetrics = {
  windowDays: number; deploymentFrequencyPerDay: number; deploymentFrequencyPerWeek: number;
  leadTimeForChangesHours: number | null; changeFailureRatePercent: number | null; meanTimeToRestoreHours: number | null;
  sampleSizes: { successfulDeployments: number; failedDeployments: number; deploymentAttempts: number; mergedPullRequests: number; leadTimeSamples: number; resolvedIncidents: number };
  services: { serviceId: string; serviceName: string; repository: string }[];
  limitations: string[];
};
type AuthSession = { id: string; createdAt: string; lastUsedAt: string | null; expiresAt: string };
type AuthPayload = {
  accessToken: string;
  user: { id: string; name: string; email: string };
  tenant: { id: string; slug: string };
  role: 'ADMIN' | 'MEMBER';
};

const API = (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000').replace(/\/$/, '') + '/api/v1';
const emptyService = { name: '', slug: '', description: '', repository: '', lifecycle: 'EXPERIMENTAL' as Service['lifecycle'], teamId: '' };
const emptyTeam = { name: '', email: '' };

async function apiRequest<T>(path: string, token?: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers },
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
  const [services, setServices] = useState<Service[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [dependencies, setDependencies] = useState<Dependency[]>([]);
  const [slos, setSlos] = useState<Slo[]>([]);
  const [costPeriod, setCostPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [costSummary, setCostSummary] = useState<CostSummary | null>(null);
  const [costBudgets, setCostBudgets] = useState<CostBudget[]>([]);
  const [doraMetrics, setDoraMetrics] = useState<DoraMetrics | null>(null);
  const [sessions, setSessions] = useState<AuthSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [runbookServiceId, setRunbookServiceId] = useState('');
  const [runbooks, setRunbooks] = useState<Runbook[]>([]);
  const [escalationPolicy, setEscalationPolicy] = useState<EscalationPolicy | null>(null);
  const [runbookForm, setRunbookForm] = useState({ title: '', url: '', category: 'RUNBOOK', isPrimary: false });
  const [policyForm, setPolicyForm] = useState({ primaryContactEmail: '', secondaryContactEmail: '', escalationAfterMinutes: '15', onCallUrl: '', notes: '' });
  const [budgetForm, setBudgetForm] = useState({ name: '', amount: '500', currency: 'USD', serviceId: '', thresholdPercent: '80' });
  const [costImportText, setCostImportText] = useState('');
  const [dependencyForm, setDependencyForm] = useState({ sourceServiceId: '', targetServiceId: '' });
  const [sloForm, setSloForm] = useState({ serviceId: '', name: '', indicator: 'AVAILABILITY' as Slo['indicator'], targetPercent: '99.9', windowDays: '30', latencyThresholdMs: '300' });
  const [sampleForm, setSampleForm] = useState({ sloId: '', success: true, latencyMs: '100' });
  const [incidentForm, setIncidentForm] = useState({ title: '', description: '', severity: 'MEDIUM' as Incident['severity'], assignedToUserId: '', serviceId: '' });
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteToken, setInviteToken] = useState('');
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '', tenantName: '', tenantSlug: '' });
  const [serviceForm, setServiceForm] = useState(emptyService);
  const [teamForm, setTeamForm] = useState(emptyTeam);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch(`${API}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!response.ok) return;
        const payload = await response.json() as AuthPayload;
        if (!active) return;
        setToken(payload.accessToken);
        setIdentity(payload);
        await refreshWorkspace(payload.accessToken, payload.role);
      } catch { /* no active refresh session; show the sign-in screen */ }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!token) return;
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`${API}/auth/refresh`, { method: 'POST', credentials: 'include' });
        if (!response.ok) throw new Error('Session expired. Please sign in again.');
        const payload = await response.json() as { accessToken: string };
        setToken(payload.accessToken);
      } catch (err) {
        setToken('');
        setIdentity(null);
        setError(err instanceof Error ? err.message : 'Session expired. Please sign in again.');
      }
    }, 14 * 60 * 1000);
    return () => window.clearTimeout(timer);
  }, [token]);


  async function refreshServiceOperations(accessToken: string, serviceId: string) {
    setRunbookServiceId(serviceId);
    if (!serviceId) { setRunbooks([]); setEscalationPolicy(null); return; }
    const [rows, policy] = await Promise.all([
      apiRequest<Runbook[]>('/services/' + serviceId + '/runbooks', accessToken),
      apiRequest<EscalationPolicy | null>('/services/' + serviceId + '/escalation-policy', accessToken),
    ]);
    setRunbooks(rows); setEscalationPolicy(policy);
    setPolicyForm({
      primaryContactEmail: policy?.primaryContactEmail ?? '', secondaryContactEmail: policy?.secondaryContactEmail ?? '',
      escalationAfterMinutes: String(policy?.escalationAfterMinutes ?? 15), onCallUrl: policy?.onCallUrl ?? '', notes: policy?.notes ?? '',
    });
  }

  async function refreshFinops(accessToken: string, period: string) {
    const [summary, budgets, dora] = await Promise.all([
      apiRequest<CostSummary>('/finops/costs?period=' + period, accessToken),
      apiRequest<CostBudget[]>('/finops/budgets?period=' + period, accessToken),
      apiRequest<DoraMetrics>('/engineering-metrics/dora?windowDays=30', accessToken),
    ]);
    setCostSummary(summary); setCostBudgets(budgets); setDoraMetrics(dora);
  }

  async function refreshSessions(accessToken: string) {
    setSessionsLoading(true);
    try { setSessions(await apiRequest<AuthSession[]>('/auth/sessions', accessToken)); }
    finally { setSessionsLoading(false); }
  }

  async function revokeSession(id: string) {
    if (!token || !window.confirm('Revoke this session? Any device using it will need to sign in again.')) return;
    setBusy(true); setError('');
    try {
      await apiRequest('/auth/sessions/' + encodeURIComponent(id), token, { method: 'DELETE' });
      await refreshSessions(token);
      setNotice('Session revoked successfully.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not revoke session'); }
    finally { setBusy(false); }
  }

  async function revokeAllSessions() {
    if (!token || !window.confirm('Revoke every active session, including this device, and sign out?')) return;
    setBusy(true); setError('');
    try {
      await apiRequest('/auth/logout-all', token, { method: 'POST' });
      setToken(''); setIdentity(null); setSessions([]);
      setServices([]); setTeams([]); setMembers([]); setIncidents([]); setAuditLogs([]); setDependencies([]); setSlos([]);
      setRunbookServiceId(''); setRunbooks([]); setEscalationPolicy(null); setCostSummary(null); setCostBudgets([]); setDoraMetrics(null);
      setNotice('All active sessions were revoked. Sign in again to continue.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not revoke all sessions'); }
    finally { setBusy(false); }
  }

  async function refreshWorkspace(accessToken: string, role: AuthPayload['role']) {
    const [serviceRows, teamRows, memberRows, incidentRows, dependencyRows, sloRows] = await Promise.all([
      apiRequest<Service[]>('/services', accessToken),
      apiRequest<Team[]>('/teams', accessToken),
      apiRequest<Member[]>('/members', accessToken),
      apiRequest<Incident[]>('/incidents', accessToken),
      apiRequest<Dependency[]>('/service-dependencies', accessToken),
      apiRequest<Slo[]>('/slos', accessToken),
    ]);
    setServices(serviceRows); setTeams(teamRows); setMembers(memberRows); setIncidents(incidentRows); setDependencies(dependencyRows); setSlos(sloRows);
    await refreshSessions(accessToken);
    await refreshServiceOperations(accessToken, serviceRows[0]?.id ?? '');
    if (role === 'ADMIN') setAuditLogs(await apiRequest<AuditLog[]>('/audit-logs?limit=30', accessToken));
    await refreshFinops(accessToken, costPeriod);
  }

  async function changeCostPeriod(period: string) {
    setCostPeriod(period);
    if (!token) return;
    try { await refreshFinops(token, period); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not load FinOps period'); }
  }

  async function createCostBudget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!token) return; setBusy(true); setError('');
    try {
      await apiRequest('/finops/budgets', token, {
        method: 'POST',
        body: JSON.stringify({
          name: budgetForm.name, amount: Number(budgetForm.amount), currency: budgetForm.currency.toUpperCase(),
          ...(budgetForm.serviceId ? { serviceId: budgetForm.serviceId } : {}),
          thresholdPercent: Number(budgetForm.thresholdPercent),
        }),
      });
      await refreshFinops(token, costPeriod);
      setBudgetForm({ ...budgetForm, name: '' });
      setNotice('FinOps budget created.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not create budget'); }
    finally { setBusy(false); }
  }

  async function importCostRecords(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!token) return; setBusy(true); setError('');
    try {
      const payload = JSON.parse(costImportText);
      const result = await apiRequest<{ recordsProcessed: number }>('/finops/cost-records/import', token, { method: 'POST', body: JSON.stringify(payload) });
      await refreshFinops(token, costPeriod);
      setNotice(result.recordsProcessed + ' cost record(s) imported or updated.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Invalid JSON or cost import failed'); }
    finally { setBusy(false); }
  }

  async function evaluateCostBudgets() {
    if (!token) return; setBusy(true); setError('');
    try {
      const result = await apiRequest<{ outcomes: { state: string }[] }>('/finops/budgets/evaluate?period=' + costPeriod, token, { method: 'POST' });
      await refreshFinops(token, costPeriod);
      const triggered = result.outcomes.filter(item => item.state === 'THRESHOLD_REACHED').length;
      setNotice('Budget evaluation complete: ' + triggered + ' threshold(s) reached.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not evaluate budgets'); }
    finally { setBusy(false); }
  }

  async function selectRunbookService(serviceId: string) {
    if (!token) return;
    try { await refreshServiceOperations(token, serviceId); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not load service operations'); }
  }

  async function createRunbook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!token || !runbookServiceId) return; setBusy(true); setError('');
    try {
      await apiRequest('/services/' + runbookServiceId + '/runbooks', token, { method: 'POST', body: JSON.stringify(runbookForm) });
      await refreshServiceOperations(token, runbookServiceId);
      setRunbookForm({ title: '', url: '', category: 'RUNBOOK', isPrimary: false });
      setNotice('Runbook reference saved.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save runbook'); }
    finally { setBusy(false); }
  }

  async function deleteRunbook(id: string) {
    if (!token || !runbookServiceId) return; setBusy(true); setError('');
    try {
      await apiRequest('/services/' + runbookServiceId + '/runbooks/' + id, token, { method: 'DELETE' });
      setRunbooks(rows => rows.filter(row => row.id !== id)); setNotice('Runbook reference removed.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not remove runbook'); }
    finally { setBusy(false); }
  }

  async function saveEscalationPolicy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!token || !runbookServiceId) return; setBusy(true); setError('');
    try {
      await apiRequest('/services/' + runbookServiceId + '/escalation-policy', token, {
        method: 'PUT',
        body: JSON.stringify({
          primaryContactEmail: policyForm.primaryContactEmail,
          ...(policyForm.secondaryContactEmail ? { secondaryContactEmail: policyForm.secondaryContactEmail } : {}),
          escalationAfterMinutes: Number(policyForm.escalationAfterMinutes),
          ...(policyForm.onCallUrl ? { onCallUrl: policyForm.onCallUrl } : {}),
          ...(policyForm.notes ? { notes: policyForm.notes } : {}),
        }),
      });
      await refreshServiceOperations(token, runbookServiceId);
      setNotice('Escalation policy saved.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save escalation policy'); }
    finally { setBusy(false); }
  }

  async function escalateIncident(id: string) {
    if (!token) return; setBusy(true); setError('');
    try {
      await apiRequest('/incidents/' + id + '/escalate', token, { method: 'POST' });
      setIncidents(await apiRequest<Incident[]>('/incidents', token));
      if (identity?.role === 'ADMIN') setAuditLogs(await apiRequest<AuditLog[]>('/audit-logs?limit=30', token));
      setNotice('Incident escalation recorded in the timeline and audit trail.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not escalate incident'); }
    finally { setBusy(false); }
  }

  async function createDependency(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!token) return; setBusy(true); setError('');
    try { const row = await apiRequest<Dependency>('/service-dependencies', token, { method: 'POST', body: JSON.stringify(dependencyForm) }); setDependencies(rows => [...rows, row]); setDependencyForm({ sourceServiceId: '', targetServiceId: '' }); setNotice('Dependency created.'); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not create dependency'); } finally { setBusy(false); }
  }
  async function deleteDependency(id: string) {
    if (!token) return; setBusy(true);
    try { await apiRequest('/service-dependencies/' + id, token, { method: 'DELETE' }); setDependencies(rows => rows.filter(row => row.id !== id)); setNotice('Dependency removed.'); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not remove dependency'); } finally { setBusy(false); }
  }
  async function createSlo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!token || !sloForm.serviceId) return; setBusy(true); setError('');
    const body = { name: sloForm.name, indicator: sloForm.indicator, targetPercent: Number(sloForm.targetPercent), windowDays: Number(sloForm.windowDays), ...(sloForm.indicator === 'LATENCY' ? { latencyThresholdMs: Number(sloForm.latencyThresholdMs) } : {}) };
    try { await apiRequest<Slo>('/slos/services/' + sloForm.serviceId, token, { method: 'POST', body: JSON.stringify(body) }); setSlos(await apiRequest<Slo[]>('/slos', token)); setSloForm({ ...sloForm, name: '' }); setNotice('SLO created.'); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not create SLO'); } finally { setBusy(false); }
  }
  async function recordSliSample(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!token || !sampleForm.sloId) return; setBusy(true); setError('');
    const slo = slos.find(row => row.id === sampleForm.sloId);
    try { await apiRequest('/slos/' + sampleForm.sloId + '/samples', token, { method: 'POST', body: JSON.stringify({ success: sampleForm.success, ...(slo?.indicator === 'LATENCY' ? { latencyMs: Number(sampleForm.latencyMs) } : {}) }) }); setSlos(await apiRequest<Slo[]>('/slos', token)); setNotice('SLI sample recorded.'); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not record SLI sample'); } finally { setBusy(false); }
  }
  async function deleteSlo(id: string) {
    if (!token) return; setBusy(true);
    try { await apiRequest('/slos/' + id, token, { method: 'DELETE' }); setSlos(rows => rows.filter(row => row.id !== id)); setNotice('SLO removed.'); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not remove SLO'); } finally { setBusy(false); }
  }

  async function createIncident(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!token) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const created = await apiRequest<Incident>('/incidents', token, { method: 'POST', body: JSON.stringify({ ...incidentForm, description: incidentForm.description || undefined, assignedToUserId: incidentForm.assignedToUserId || undefined, serviceId: incidentForm.serviceId || undefined }) });
      setIncidents(current => [created, ...current]); setIncidentForm({ title: '', description: '', severity: 'MEDIUM', assignedToUserId: '', serviceId: '' });
      if (identity?.role === 'ADMIN') setAuditLogs(await apiRequest<AuditLog[]>('/audit-logs?limit=30', token));
      setNotice('Incident created and recorded in the audit trail.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not create incident'); }
    finally { setBusy(false); }
  }

  async function updateIncident(id: string, action: 'acknowledge' | 'resolve') {
    if (!token) return; setBusy(true); setError(''); setNotice('');
    try {
      await apiRequest<Incident>(`/incidents/${id}/${action}`, token, { method: 'POST', body: action === 'resolve' ? JSON.stringify({ message: 'Resolved from PulseOps workspace' }) : undefined });
      const rows = await apiRequest<Incident[]>('/incidents', token); setIncidents(rows);
      if (identity?.role === 'ADMIN') setAuditLogs(await apiRequest<AuditLog[]>('/audit-logs?limit=30', token));
      setNotice(action === 'acknowledge' ? 'Incident acknowledged.' : 'Incident resolved.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not update incident'); }
    finally { setBusy(false); }
  }


  async function authenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(''); setNotice('');
    try {
      const payload = await apiRequest<AuthPayload>(`/auth/${mode}`, undefined, {
        method: 'POST',
        body: JSON.stringify(mode === 'register'
          ? { name: authForm.name, email: authForm.email, password: authForm.password, tenantName: authForm.tenantName }
          : { email: authForm.email, password: authForm.password, tenantSlug: authForm.tenantSlug }),
      });
      setToken(payload.accessToken);
      setIdentity(payload);
      await refreshWorkspace(payload.accessToken, payload.role);
      setNotice(mode === 'register' ? 'Workspace created. Your Service Catalog and Team Management are ready.' : 'Signed in successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
      setToken(''); setIdentity(null);
    } finally { setBusy(false); }
  }

  async function saveService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!token) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const payload = {
        ...serviceForm,
        description: serviceForm.description || undefined,
        repository: serviceForm.repository || undefined,
        teamId: serviceForm.teamId || undefined,
      };
      if (editingId) {
        const updated = await apiRequest<Service>(`/services/${editingId}`, token, { method: 'PATCH', body: JSON.stringify(payload) });
        setServices(current => current.map(item => item.id === editingId ? updated : item));
        setNotice('Service updated.');
      } else {
        const created = await apiRequest<Service>('/services', token, { method: 'POST', body: JSON.stringify(payload) });
        setServices(current => [created, ...current]);
        setNotice('Service registered.');
      }
      setServiceForm(emptyService); setEditingId(null);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save service'); }
    finally { setBusy(false); }
  }

  async function deleteService(id: string) {
    if (!token || !window.confirm('Delete this service from the workspace?')) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await apiRequest(`/services/${id}`, token, { method: 'DELETE' });
      setServices(current => current.filter(item => item.id !== id));
      setDependencies(current => current.filter(edge => edge.sourceService.id !== id && edge.targetService.id !== id));
      setSlos(current => current.filter(slo => slo.service.id !== id));
      setNotice('Service deleted. Related dependency edges and SLOs were removed.');
      if (editingId === id) { setEditingId(null); setServiceForm(emptyService); }
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not delete service'); }
    finally { setBusy(false); }
  }

  async function saveTeam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!token) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const payload = { name: teamForm.name, email: teamForm.email || undefined };
      if (editingTeamId) {
        const updated = await apiRequest<Team>(`/teams/${editingTeamId}`, token, { method: 'PATCH', body: JSON.stringify(payload) });
        setTeams(current => current.map(team => team.id === editingTeamId ? updated : team));
        setNotice('Team updated.');
      } else {
        const created = await apiRequest<Team>('/teams', token, { method: 'POST', body: JSON.stringify(payload) });
        setTeams(current => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
        setNotice('Team created.');
      }
      setTeamForm(emptyTeam); setEditingTeamId(null);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save team'); }
    finally { setBusy(false); }
  }

  async function deleteTeam(id: string) {
    if (!token || !window.confirm('Delete this team? Services assigned to it will remain and become unassigned.')) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await apiRequest(`/teams/${id}`, token, { method: 'DELETE' });
      setTeams(current => current.filter(team => team.id !== id));
      setServices(current => current.map(service => service.teamId === id ? { ...service, teamId: null } : service));
      if (editingTeamId === id) { setEditingTeamId(null); setTeamForm(emptyTeam); }
      setNotice('Team deleted. Assigned services were kept.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not delete team'); }
    finally { setBusy(false); }
  }

  async function inviteMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!token) return;
    setBusy(true); setError(''); setNotice(''); setInviteToken('');
    try {
      const result = await apiRequest<{ invitation: { email: string; expiresAt: string }; acceptanceToken: string }>(
        '/members/invitations', token, { method: 'POST', body: JSON.stringify({ email: inviteEmail }) },
      );
      setInviteToken(result.acceptanceToken); setInviteEmail('');
      setNotice('Invitation created. Share the one-time token securely; email delivery is not configured.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not create invitation'); }
    finally { setBusy(false); }
  }

  async function changeMemberRole(userId: string, role: 'ADMIN' | 'MEMBER') {
    if (!token) return;
    setBusy(true); setError('');
    try {
      const updated = await apiRequest<{ id: string; role: 'ADMIN' | 'MEMBER'; user: Member['user'] }>(
        `/members/${userId}/role`, token, { method: 'PATCH', body: JSON.stringify({ role }) },
      );
      setMembers(current => current.map(member => member.user.id === userId ? { ...member, role: updated.role } : member));
      setNotice('Member role updated.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not update role'); }
    finally { setBusy(false); }
  }

  async function removeMember(userId: string) {
    if (!token || !window.confirm('Remove this member from the workspace?')) return;
    setBusy(true); setError('');
    try {
      await apiRequest(`/members/${userId}`, token, { method: 'DELETE' });
      setMembers(current => current.filter(member => member.user.id !== userId));
      setNotice('Workspace member removed; their existing access token is now invalid.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not remove member'); }
    finally { setBusy(false); }
  }

  function beginEdit(service: Service) {
    setEditingId(service.id);
    setServiceForm({
      name: service.name, slug: service.slug, description: service.description ?? '',
      repository: service.repository ?? '', lifecycle: service.lifecycle, teamId: service.teamId ?? '',
    });
    setError(''); setNotice('');
  }

  async function signOut() {
    try { await apiRequest('/auth/logout', undefined, { method: 'POST' }); } catch { /* local sign-out must still complete */ }
    setToken(''); setIdentity(null); setSessions([]); setServices([]); setTeams([]); setMembers([]); setIncidents([]); setAuditLogs([]); setDependencies([]); setSlos([]); setRunbookServiceId(''); setRunbooks([]); setEscalationPolicy(null); setCostSummary(null); setCostBudgets([]); setDoraMetrics(null);
    setInviteToken(''); setEditingId(null); setEditingTeamId(null);
    setServiceForm(emptyService); setTeamForm(emptyTeam); setNotice('Signed out.');
  }

  if (!identity) {
    return (
      <main className="shell">
        <nav className="topbar">
          <a className="brand" href="/" aria-label="PulseOps home"><span className="brand-mark">P</span><span>PulseOps</span></a>
          <span className="environment"><span /> SERVICE CATALOG / EARLY ACCESS</span>
        </nav>
        <section className="auth-layout">
          <div className="auth-copy">
            <p className="eyebrow">ENGINEERING OPERATIONS PLATFORM</p>
            <h1>Know your systems.<br /><span>Operate with confidence.</span></h1>
            <p className="intro">Create a workspace, organize engineering teams, and register services. Every record is scoped to your authenticated workspace.</p>
            <div className="hero-meta"><span className="status-dot" /> JWT-protected API <span className="meta-divider">/</span> PostgreSQL persistence</div>
          </div>
          <section className="auth-card">
            <div className="tabs">
              <button className={mode === 'register' ? 'tab active' : 'tab'} onClick={() => { setMode('register'); setError(''); }}>Create workspace</button>
              <button className={mode === 'login' ? 'tab active' : 'tab'} onClick={() => { setMode('login'); setError(''); }}>Sign in</button>
            </div>
            <h2>{mode === 'register' ? 'Start your workspace' : 'Welcome back'}</h2>
            <p className="muted">{mode === 'register' ? 'Your account becomes the first workspace administrator.' : 'Use your workspace slug and account credentials.'}</p>
            <form onSubmit={authenticate} className="stack-form">
              {mode === 'register' && <label>Your name<input required minLength={2} maxLength={80} value={authForm.name} onChange={event => setAuthForm({ ...authForm, name: event.target.value })} placeholder="Ada Lovelace" /></label>}
              <label>Email address<input required type="email" value={authForm.email} onChange={event => setAuthForm({ ...authForm, email: event.target.value })} placeholder="you@company.com" /></label>
              <label>Password<input required type="password" minLength={12} maxLength={72} value={authForm.password} onChange={event => setAuthForm({ ...authForm, password: event.target.value })} placeholder="At least 12 characters" /></label>
              {mode === 'register'
                ? <label>Workspace name<input required minLength={2} maxLength={100} value={authForm.tenantName} onChange={event => setAuthForm({ ...authForm, tenantName: event.target.value })} placeholder="Platform Engineering" /></label>
                : <label>Workspace slug<input required value={authForm.tenantSlug} onChange={event => setAuthForm({ ...authForm, tenantSlug: event.target.value })} placeholder="platform-engineering-a1b2c3d4" /></label>}
              <button className="primary-button" disabled={busy}>{busy ? 'Please wait…' : mode === 'register' ? 'Create workspace →' : 'Sign in →'}</button>
            </form>
            <p className="fine-print">Access tokens expire after 15 minutes and renew automatically. Refreshing the page restores your session when the secure refresh cookie is available.</p>
            <p className="fine-print">Received an invitation? <a href="/accept-invitation">Accept workspace invitation →</a></p>
          </section>
        </section>
        {(error || notice) && <div className={error ? 'feedback error' : 'feedback success'} role="status">{error || notice}</div>}
        <footer className="footer"><span>PULSEOPS / DEVELOPER PLATFORM</span><span>Workspace-scoped service ownership.</span></footer>
      </main>
    );
  }

  return (
    <main className="shell">
      <nav className="topbar">
        <a className="brand" href="/" aria-label="PulseOps home"><span className="brand-mark">P</span><span>PulseOps</span></a>
        <span className="environment"><span /> WORKSPACE CONNECTED</span>
      </nav>
      <section className="workspace">
        <div className="workspace-head">
          <div><p className="eyebrow">ENGINEERING WORKSPACE</p><h1 className="workspace-title">Your workspace<span>.</span></h1><p className="muted">{identity.tenant.slug} · signed in as {identity.user.name} · {identity.role}</p></div>
          <button className="quiet-button" onClick={signOut}>Sign out</button>
        </div>

        <section className="team-panel session-panel">
          <div className="catalog-toolbar">
            <div><p className="eyebrow">ACCOUNT SECURITY</p><h2>Active sessions</h2><p className="muted">Review authenticated sessions for this workspace and revoke access you no longer recognize.</p></div>
            <div className="session-actions">
              <span className="counter">{sessions.length} ACTIVE</span>
              <button type="button" className="quiet-button" disabled={sessionsLoading || busy} onClick={() => void refreshSessions(token)}>{sessionsLoading ? 'Refreshing…' : 'Refresh'}</button>
            </div>
          </div>
          {sessionsLoading && sessions.length === 0 ? <p className="team-empty">Loading active sessions…</p> : sessions.length === 0 ? <p className="team-empty">No active sessions were returned. Refresh to check again.</p> : <div className="session-list">
            {sessions.map((session, index) => (
              <article className="session-row" key={session.id}>
                <div className="session-icon" aria-hidden="true">⌘</div>
                <div className="team-info">
                  <strong>Authenticated session {index + 1}</strong>
                  <span>Created {new Date(session.createdAt).toLocaleString()}</span>
                  <small>{session.lastUsedAt ? 'Last activity ' + new Date(session.lastUsedAt).toLocaleString() : 'No activity timestamp yet'} · Expires {new Date(session.expiresAt).toLocaleDateString()}</small>
                  <code>{session.id.slice(0, 8)}…{session.id.slice(-4)}</code>
                </div>
                <button type="button" className="danger-link" disabled={busy} onClick={() => void revokeSession(session.id)}>Revoke session</button>
              </article>
            ))}
          </div>}
          <div className="session-footer">
            <p className="fine-print">Revoking a session immediately prevents it from refreshing or accessing protected API routes. Session details are limited to timestamps and an opaque identifier; device fingerprinting is not collected.</p>
            <button type="button" className="quiet-button session-danger" disabled={busy || sessions.length === 0} onClick={() => void revokeAllSessions()}>Revoke all sessions &amp; sign out</button>
          </div>
        </section>

        <section className="team-panel">
          <div className="catalog-toolbar">
            <div><p className="eyebrow">OWNERSHIP STRUCTURE</p><h2>Teams</h2><p className="muted">{teams.length} team{teams.length === 1 ? '' : 's'} in this workspace</p></div>
            <span className="counter">TENANT SCOPED</span>
          </div>
          <div className="team-content">
            <div className="team-list">
              {teams.length === 0 ? <p className="team-empty">No teams yet in this workspace.</p> : teams.map(team => (
                <article className="team-row" key={team.id}>
                  <div className="team-avatar">{team.name.trim().charAt(0).toUpperCase()}</div>
                  <div className="team-info"><strong>{team.name}</strong><span>{team.email || 'No team contact'}</span><small>{services.filter(service => service.teamId === team.id).length} owned service(s)</small></div>
                  {identity.role === 'ADMIN' && <div className="service-actions">
                    <button onClick={() => { setEditingTeamId(team.id); setTeamForm({ name: team.name, email: team.email ?? '' }); }}>Edit</button>
                    <button className="danger-link" disabled={busy} onClick={() => deleteTeam(team.id)}>Delete</button>
                  </div>}
                </article>
              ))}
            </div>
            {identity.role === 'ADMIN' && <form className="team-form" onSubmit={saveTeam}>
              <p className="eyebrow">{editingTeamId ? 'UPDATE TEAM' : 'NEW TEAM'}</p>
              <h3>{editingTeamId ? 'Edit team' : 'Create a team'}</h3>
              <label>Team name<input required minLength={2} maxLength={100} value={teamForm.name} onChange={event => setTeamForm({ ...teamForm, name: event.target.value })} placeholder="Platform Engineering" /></label>
              <label>Team contact email<input type="email" maxLength={254} value={teamForm.email} onChange={event => setTeamForm({ ...teamForm, email: event.target.value })} placeholder="platform@company.com" /></label>
              <button className="primary-button" disabled={busy}>{busy ? 'Saving…' : editingTeamId ? 'Save team →' : 'Create team →'}</button>
              {editingTeamId && <button type="button" className="quiet-button cancel-button" onClick={() => { setEditingTeamId(null); setTeamForm(emptyTeam); }}>Cancel edit</button>}
            </form>}
          </div>
        </section>

        <section className="team-panel member-panel">
          <div className="catalog-toolbar">
            <div><p className="eyebrow">ACCESS CONTROL</p><h2>Workspace members</h2><p className="muted">{members.length} member{members.length === 1 ? '' : 's'} · role-based access</p></div>
            <span className="counter">RBAC ENABLED</span>
          </div>
          <div className="member-content">
            <div className="member-list">
              {members.map(member => (
                <article className="member-row" key={member.user.id}>
                  <div className="team-avatar">{member.user.name.trim().charAt(0).toUpperCase()}</div>
                  <div className="team-info"><strong>{member.user.name}</strong><span>{member.user.email}</span></div>
                  <span className={member.role === 'ADMIN' ? 'role-pill admin' : 'role-pill'}>{member.role}</span>
                  {identity.role === 'ADMIN' && member.user.id !== identity.user.id && <>
                    <select aria-label={'Role for ' + member.user.email} value={member.role} disabled={busy} onChange={event => changeMemberRole(member.user.id, event.target.value as 'ADMIN' | 'MEMBER')}>
                      <option value="MEMBER">Member</option><option value="ADMIN">Admin</option>
                    </select>
                    <button className="danger-link member-remove" disabled={busy} onClick={() => removeMember(member.user.id)}>Remove</button>
                  </>}
                </article>
              ))}
            </div>
            {identity.role === 'ADMIN' && <form className="team-form" onSubmit={inviteMember}>
              <p className="eyebrow">INVITE MEMBER</p><h3>Add to workspace</h3>
              <label>Work email<input required type="email" maxLength={254} value={inviteEmail} onChange={event => setInviteEmail(event.target.value)} placeholder="colleague@company.com" /></label>
              <button className="primary-button" disabled={busy}>{busy ? 'Creating…' : 'Create invitation →'}</button>
              {inviteToken && <div className="invite-token">
                <small>ONE-TIME ACCEPTANCE TOKEN · EXPIRES IN 7 DAYS</small><code>{inviteToken}</code>
                <button type="button" className="quiet-button" onClick={() => { void navigator.clipboard.writeText(inviteToken); setNotice('Invitation token copied.'); }}>Copy token</button>
              </div>}
              <p className="fine-print">Email delivery is not configured. Share this one-time token through a secure channel.</p>
            </form>}
          </div>
        </section>

        <section className="team-panel">
          <div className="catalog-toolbar"><div><p className="eyebrow">SERVICE TOPOLOGY</p><h2>Dependency Graph</h2><p className="muted">Directed service dependencies. Cycles and cross-workspace edges are rejected.</p></div><span className="counter">TENANT SCOPED</span></div>
          {identity.role === 'ADMIN' && <form className="topology-form" onSubmit={createDependency}>
            <label>Upstream service<select required value={dependencyForm.sourceServiceId} onChange={event => setDependencyForm({ ...dependencyForm, sourceServiceId: event.target.value })}><option value="">Select source</option>{services.map(service => <option key={service.id} value={service.id}>{service.name}</option>)}</select></label>
            <span className="dependency-arrow">depends on →</span>
            <label>Downstream service<select required value={dependencyForm.targetServiceId} onChange={event => setDependencyForm({ ...dependencyForm, targetServiceId: event.target.value })}><option value="">Select dependency</option>{services.map(service => <option key={service.id} value={service.id}>{service.name}</option>)}</select></label>
            <button className="primary-button" disabled={busy || services.length < 2}>Add edge</button>
          </form>}
          {dependencies.length === 0 ? <p className="team-empty">No dependency edges yet.</p> : <div className="dependency-list">{dependencies.map(edge => <article className="dependency-edge" key={edge.id}><strong>{edge.sourceService.name}</strong><span>depends on →</span><strong>{edge.targetService.name}</strong>{identity.role === 'ADMIN' && <button className="danger-link" disabled={busy} onClick={() => deleteDependency(edge.id)}>Remove</button>}</article>)}</div>}
        </section>

        <section className="team-panel">
          <div className="catalog-toolbar"><div><p className="eyebrow">RELIABILITY OBJECTIVES</p><h2>SLI / SLO & Error Budget</h2><p className="muted">Rolling windows with measurable compliance and remaining budget.</p></div><span className="counter">SRE CONTROLS</span></div>
          {identity.role === 'ADMIN' && <form className="topology-form slo-form" onSubmit={createSlo}>
            <label>Service<select required value={sloForm.serviceId} onChange={event => setSloForm({ ...sloForm, serviceId: event.target.value })}><option value="">Select service</option>{services.map(service => <option key={service.id} value={service.id}>{service.name}</option>)}</select></label>
            <label>SLO name<input required minLength={3} maxLength={120} value={sloForm.name} onChange={event => setSloForm({ ...sloForm, name: event.target.value })} placeholder="Monthly availability" /></label>
            <label>Indicator<select value={sloForm.indicator} onChange={event => setSloForm({ ...sloForm, indicator: event.target.value as Slo['indicator'] })}><option value="AVAILABILITY">Availability</option><option value="LATENCY">Latency</option></select></label>
            <label>Target %<input type="number" min="0.01" max="100" step="0.01" required value={sloForm.targetPercent} onChange={event => setSloForm({ ...sloForm, targetPercent: event.target.value })} /></label>
            <label>Window days<input type="number" min="1" max="90" required value={sloForm.windowDays} onChange={event => setSloForm({ ...sloForm, windowDays: event.target.value })} /></label>
            {sloForm.indicator === 'LATENCY' && <label>Latency threshold (ms)<input type="number" min="1" required value={sloForm.latencyThresholdMs} onChange={event => setSloForm({ ...sloForm, latencyThresholdMs: event.target.value })} /></label>}
            <button className="primary-button" disabled={busy || services.length === 0}>Create SLO</button>
          </form>}
          {slos.length === 0 ? <p className="team-empty">No SLOs configured yet.</p> : <div className="slo-list">{slos.map(slo => <article className="slo-card" key={slo.id}>
            <div className="slo-head"><div><strong>{slo.name}</strong><p className="muted">{slo.service.name} · {slo.indicator} · target {slo.targetPercent}% over {slo.windowDays}d</p></div>{identity.role === 'ADMIN' && <button className="danger-link" disabled={busy} onClick={() => deleteSlo(slo.id)}>Delete</button>}</div>
            <div className="slo-metrics"><div><small>Measured SLI</small><strong>{slo.measurement.sliPercent === null ? 'No data' : slo.measurement.sliPercent.toFixed(3) + '%'}</strong></div><div><small>Error budget remaining</small><strong>{slo.measurement.errorBudgetRemainingPercent === null ? 'No data' : slo.measurement.errorBudgetRemainingPercent.toFixed(1) + '%'}</strong></div><div><small>Good / total</small><strong>{slo.measurement.goodCount} / {slo.measurement.sampleCount}</strong></div></div>
            <p className="fine-print">Data source: {slo.measurement.dataSource}. Production telemetry is not yet connected.</p>
          </article>)}</div>}
          {identity.role === 'ADMIN' && slos.length > 0 && <form className="topology-form sample-form" onSubmit={recordSliSample}>
            <label>SLO<select required value={sampleForm.sloId} onChange={event => setSampleForm({ ...sampleForm, sloId: event.target.value })}><option value="">Select SLO</option>{slos.map(slo => <option key={slo.id} value={slo.id}>{slo.name}</option>)}</select></label>
            <label>Outcome<select value={String(sampleForm.success)} onChange={event => setSampleForm({ ...sampleForm, success: event.target.value === 'true' })}><option value="true">Good event</option><option value="false">Bad event</option></select></label>
            {slos.find(row => row.id === sampleForm.sloId)?.indicator === 'LATENCY' && <label>Observed latency (ms)<input type="number" min="0" required value={sampleForm.latencyMs} onChange={event => setSampleForm({ ...sampleForm, latencyMs: event.target.value })} /></label>}
            <button className="quiet-button" disabled={busy}>Record SLI sample</button>
          </form>}
        </section>

        <section className="team-panel intelligence-panel">
          <div className="catalog-toolbar">
            <div><p className="eyebrow">ENGINEERING INTELLIGENCE</p><h2>Delivery & FinOps</h2><p className="muted">DORA delivery signals and allocated cloud spend from connected source data.</p></div>
            <label className="period-control">BILLING MONTH<input type="month" value={costPeriod} onChange={event => void changeCostPeriod(event.target.value)} /></label>
          </div>
          <div className="dora-grid">
            <article className="dora-card"><small>Deployment frequency</small><strong>{doraMetrics ? doraMetrics.deploymentFrequencyPerWeek.toFixed(2) + ' / week' : '—'}</strong><span>{doraMetrics?.sampleSizes.successfulDeployments ?? 0} successful deployments</span></article>
            <article className="dora-card"><small>Median lead time</small><strong>{doraMetrics?.leadTimeForChangesHours === null || !doraMetrics ? 'No data' : doraMetrics.leadTimeForChangesHours.toFixed(1) + ' h'}</strong><span>{doraMetrics?.sampleSizes.leadTimeSamples ?? 0} SHA-matched samples</span></article>
            <article className="dora-card"><small>Change failure rate</small><strong>{doraMetrics?.changeFailureRatePercent === null || !doraMetrics ? 'No data' : doraMetrics.changeFailureRatePercent.toFixed(1) + '%'}</strong><span>{doraMetrics?.sampleSizes.deploymentAttempts ?? 0} deployment attempts</span></article>
            <article className="dora-card"><small>Mean time to restore</small><strong>{doraMetrics?.meanTimeToRestoreHours === null || !doraMetrics ? 'No data' : doraMetrics.meanTimeToRestoreHours.toFixed(1) + ' h'}</strong><span>{doraMetrics?.sampleSizes.resolvedIncidents ?? 0} resolved incidents</span></article>
          </div>
          <p className="fine-print">{doraMetrics?.limitations[0] ?? 'DORA metrics require connected GitHub repositories and webhook data.'}</p>
          <div className="finops-summary">
            <div><p className="eyebrow">CLOUD COST ALLOCATION</p><h3>{costSummary?.recordCount ?? 0} cost line item(s)</h3></div>
            <div className="cost-total-list">{costSummary?.totalsByCurrency.length ? costSummary.totalsByCurrency.map(item => <strong key={item.currency}>{item.amount.toFixed(2)} <small>{item.currency}</small></strong>) : <span className="muted">No cost records for this month.</span>}</div>
          </div>
          {costSummary && costSummary.byService.length > 0 && <div className="cost-service-list">
            {costSummary.byService.map(item => <div className="cost-service-row" key={(item.serviceId ?? 'unallocated') + item.currency}><span>{item.serviceName}</span><strong>{item.amount.toFixed(2)} {item.currency}</strong></div>)}
          </div>}
          <p className="fine-print">{costSummary?.note ?? 'Currencies are reported separately; no FX conversion is applied.'}</p>
          <div className="finops-lower">
            <div className="finops-budget-column">
              <div className="catalog-toolbar"><div><p className="eyebrow">SPEND CONTROLS</p><h3>Monthly budgets</h3></div>{identity.role === 'ADMIN' && <button className="quiet-button" disabled={busy} onClick={() => void evaluateCostBudgets()}>Evaluate thresholds</button>}</div>
              {costBudgets.length === 0 ? <p className="team-empty">No budgets configured yet.</p> : <div className="budget-list">{costBudgets.map(budget => <article className="budget-row" key={budget.id}>
                <div className="budget-heading"><strong>{budget.name}</strong><span>{budget.service?.name ?? 'Workspace-wide'}</span></div>
                <div className="budget-values"><strong>{budget.actualAmount.toFixed(2)} {budget.currency}</strong><span>of {budget.amount.toFixed(2)} · {budget.utilizationPercent === null ? 'No data' : budget.utilizationPercent.toFixed(1) + '%'}</span></div>
                <div className="budget-track"><span style={{ width: Math.min(100, budget.utilizationPercent ?? 0) + '%' }} /></div>
                <small>{budget.recordCount} record(s) · alert at {budget.thresholdPercent}%</small>
              </article>)}</div>}
              {identity.role === 'ADMIN' && <form className="team-form" onSubmit={createCostBudget}>
                <p className="eyebrow">NEW BUDGET</p>
                <label>Budget name<input required minLength={3} maxLength={120} value={budgetForm.name} onChange={event => setBudgetForm({ ...budgetForm, name: event.target.value })} placeholder="Production cloud spend" /></label>
                <div className="budget-form-grid">
                  <label>Amount<input type="number" min="0.000001" step="0.000001" required value={budgetForm.amount} onChange={event => setBudgetForm({ ...budgetForm, amount: event.target.value })} /></label>
                  <label>Currency<input required maxLength={3} minLength={3} value={budgetForm.currency} onChange={event => setBudgetForm({ ...budgetForm, currency: event.target.value })} /></label>
                  <label>Alert threshold %<input type="number" min="1" max="1000" required value={budgetForm.thresholdPercent} onChange={event => setBudgetForm({ ...budgetForm, thresholdPercent: event.target.value })} /></label>
                </div>
                <label>Scope<select value={budgetForm.serviceId} onChange={event => setBudgetForm({ ...budgetForm, serviceId: event.target.value })}><option value="">Entire workspace</option>{services.map(service => <option key={service.id} value={service.id}>{service.name}</option>)}</select></label>
                <button className="primary-button" disabled={busy}>Create budget</button>
              </form>}
            </div>
            {identity.role === 'ADMIN' && <form className="team-form cost-import-form" onSubmit={importCostRecords}>
              <p className="eyebrow">NORMALIZED COST IMPORT</p><h3>Import cost records</h3>
              <label>JSON payload<textarea rows={10} required value={costImportText} onChange={event => setCostImportText(event.target.value)} placeholder={'{"records":[{"provider":"AWS","sourceRecordId":"line-001","resourceId":"i-123","billingPeriodStart":"2026-11-01T00:00:00.000Z","costAmount":12.5,"currency":"USD"}]}'}/></label>
              <button className="primary-button" disabled={busy || !costImportText.trim()}>Import up to 500 records</button>
              <p className="fine-print">Provider billing APIs and CSV parsing are not connected. Import normalized JSON exports; duplicate source IDs update existing rows.</p>
            </form>}
          </div>
        </section>

        <section className="team-panel operations-panel">
          <div className="catalog-toolbar">
            <div><p className="eyebrow">OPERATIONAL READINESS</p><h2>Runbooks & Escalation</h2><p className="muted">Service-specific response references and on-call contacts.</p></div>
            <label className="period-control">SERVICE<select value={runbookServiceId} onChange={event => void selectRunbookService(event.target.value)}><option value="">Select service</option>{services.map(service => <option key={service.id} value={service.id}>{service.name}</option>)}</select></label>
          </div>
          {!runbookServiceId ? <p className="team-empty">Register a service to configure operational references.</p> : <>
            <div className="runbook-list">
              {runbooks.length === 0 ? <p className="team-empty">No runbook references configured for this service.</p> : runbooks.map(runbook => <article className="runbook-row" key={runbook.id}>
                <div><div className="runbook-title"><strong>{runbook.title}</strong>{runbook.isPrimary && <span className="role-pill admin">PRIMARY</span>}</div><small>{runbook.category}</small><a href={runbook.url} target="_blank" rel="noreferrer">{runbook.url}</a></div>
                {identity.role === 'ADMIN' && <button className="danger-link" disabled={busy} onClick={() => void deleteRunbook(runbook.id)}>Remove</button>}
              </article>)}
            </div>
            {identity.role === 'ADMIN' && <form className="topology-form runbook-form" onSubmit={createRunbook}>
              <label>Reference title<input required minLength={3} maxLength={150} value={runbookForm.title} onChange={event => setRunbookForm({ ...runbookForm, title: event.target.value })} placeholder="Payments API recovery" /></label>
              <label>URL<input type="url" required value={runbookForm.url} onChange={event => setRunbookForm({ ...runbookForm, url: event.target.value })} placeholder="https://docs.example.com/runbooks/payments" /></label>
              <label>Category<select value={runbookForm.category} onChange={event => setRunbookForm({ ...runbookForm, category: event.target.value })}><option value="RUNBOOK">Runbook</option><option value="PLAYBOOK">Playbook</option><option value="DASHBOARD">Dashboard</option><option value="POSTMORTEM">Postmortem</option></select></label>
              <label className="inline-check"><input type="checkbox" checked={runbookForm.isPrimary} onChange={event => setRunbookForm({ ...runbookForm, isPrimary: event.target.checked })} /> Set as primary</label>
              <button className="primary-button" disabled={busy}>Add reference</button>
            </form>}
            <div className="policy-section">
              <div className="catalog-toolbar"><div><p className="eyebrow">ON-CALL POLICY</p><h3>Escalation contacts</h3></div><span className="counter">{escalationPolicy ? 'CONFIGURED' : 'NOT CONFIGURED'}</span></div>
              {escalationPolicy && <p className="muted">Primary: {escalationPolicy.primaryContactEmail} · Secondary: {escalationPolicy.secondaryContactEmail ?? 'Not set'} · Escalation guidance: {escalationPolicy.escalationAfterMinutes} minutes</p>}
              {identity.role === 'ADMIN' && <form className="topology-form policy-form" onSubmit={saveEscalationPolicy}>
                <label>Primary contact<input type="email" required value={policyForm.primaryContactEmail} onChange={event => setPolicyForm({ ...policyForm, primaryContactEmail: event.target.value })} placeholder="primary-oncall@company.com" /></label>
                <label>Secondary contact<input type="email" value={policyForm.secondaryContactEmail} onChange={event => setPolicyForm({ ...policyForm, secondaryContactEmail: event.target.value })} placeholder="secondary-oncall@company.com" /></label>
                <label>Escalate after (minutes)<input type="number" min="1" max="1440" required value={policyForm.escalationAfterMinutes} onChange={event => setPolicyForm({ ...policyForm, escalationAfterMinutes: event.target.value })} /></label>
                <label>On-call URL<input type="url" value={policyForm.onCallUrl} onChange={event => setPolicyForm({ ...policyForm, onCallUrl: event.target.value })} placeholder="https://oncall.example.com" /></label>
                <button className="primary-button" disabled={busy}>Save policy</button>
              </form>}
              <p className="fine-print">Escalation currently records the selected contact in the incident timeline and audit trail. It does not send notifications or run an automatic timer.</p>
            </div>
          </>}
        </section>

        <section className="workspace-members">
          <div className="catalog-toolbar"><div><p className="eyebrow">ON-CALL OPERATIONS</p><h2>Incident Management</h2><p className="muted">{incidents.filter(item => item.status !== 'RESOLVED').length} active incident(s) · tenant scoped</p></div><span className="counter">LIVE WORKSPACE DATA</span></div>
          <form className="team-form" onSubmit={createIncident}>
            <h3>Report an incident</h3>
            <label>Incident title<input required minLength={3} maxLength={160} value={incidentForm.title} onChange={event => setIncidentForm({ ...incidentForm, title: event.target.value })} placeholder="Elevated API latency" /></label>
            <label>Incident description<textarea maxLength={5000} rows={2} value={incidentForm.description} onChange={event => setIncidentForm({ ...incidentForm, description: event.target.value })} placeholder="Impact, symptoms and context" /></label>
            <label>Service<select value={incidentForm.serviceId} onChange={event => setIncidentForm({ ...incidentForm, serviceId: event.target.value })}><option value="">Not linked</option>{services.map(service => <option key={service.id} value={service.id}>{service.name}</option>)}</select></label>
            <label>Severity<select value={incidentForm.severity} onChange={event => setIncidentForm({ ...incidentForm, severity: event.target.value as Incident['severity'] })}><option>CRITICAL</option><option>HIGH</option><option>MEDIUM</option><option>LOW</option></select></label>
            <label>Assign to<select value={incidentForm.assignedToUserId} onChange={event => setIncidentForm({ ...incidentForm, assignedToUserId: event.target.value })}><option value="">Unassigned</option>{members.map(member => <option key={member.user.id} value={member.user.id}>{member.user.name}</option>)}</select></label>
            <button className="primary-button" disabled={busy}>Create incident →</button>
          </form>
          {incidents.length === 0 ? <div className="empty-state"><h3>No incidents reported</h3><p>New incidents and their lifecycle events will appear here.</p></div> : <div className="service-list">
            {incidents.map(incident => <article className="service-row" key={incident.id}>
              <div className="service-symbol">!</div><div className="service-info"><div className="service-title-line"><h3>{incident.title}</h3><span className="lifecycle">{incident.severity} · {incident.status}</span></div>
                <p>{incident.description || 'No description provided'}</p><span className="service-owner">Service: {incident.service?.name ?? 'Not linked'} · Assignee: {incident.assignee?.name ?? 'Unassigned'} · Escalation L{incident.escalationLevel ?? 0} · {new Date(incident.createdAt).toLocaleString()}</span>
                <div className="fine-print">{incident.events.map(item => <p key={item.id}>{item.eventType}: {item.message} · {new Date(item.createdAt).toLocaleString()}</p>)}</div>
              </div>
              <div className="service-actions">{incident.status !== 'RESOLVED' && incident.serviceId && <button disabled={busy} onClick={() => void escalateIncident(incident.id)}>Escalate</button>}{incident.status === 'OPEN' && <button disabled={busy} onClick={() => updateIncident(incident.id, 'acknowledge')}>Acknowledge</button>}{incident.status !== 'RESOLVED' && <button className="danger-link" disabled={busy} onClick={() => updateIncident(incident.id, 'resolve')}>Resolve</button>}</div>
            </article>)}
          </div>}
          {identity.role === 'ADMIN' && <div className="catalog-main"><div className="catalog-toolbar"><div><h2>Audit Trail</h2><p className="muted">Recent privileged and incident operations</p></div><span className="counter">ADMIN ONLY</span></div>
            {auditLogs.length === 0 ? <p className="muted">No audit events yet.</p> : auditLogs.map(log => <article className="team-row" key={log.id}><div><strong>{log.action}</strong><p className="muted">{log.entityType} · {log.actor?.name ?? 'System'} · {new Date(log.createdAt).toLocaleString()}</p></div></article>)}
          </div>}
        </section>

        <div className="catalog-layout">
          <section className="catalog-main">
            <div className="catalog-toolbar"><div><h2>Service Catalog</h2><p className="muted">{services.length} service{services.length === 1 ? '' : 's'} in this workspace</p></div><span className="counter">TENANT SCOPED</span></div>
            {services.length === 0 ? <div className="empty-state"><span className="empty-icon">◇</span><h3>No services yet</h3><p>Register your first service to start building your developer catalog.</p></div> : <div className="service-list">
              {services.map(service => (
                <article className="service-row" key={service.id}>
                  <div className="service-symbol">S</div>
                  <div className="service-info">
                    <div className="service-title-line"><h3>{service.name}</h3><span className={service.lifecycle === 'PRODUCTION' ? 'lifecycle production' : 'lifecycle'}>{service.lifecycle}</span></div>
                    <p>{service.description || service.slug}</p>
                    <span className="service-owner">Owner: {teams.find(team => team.id === service.teamId)?.name ?? 'Unassigned'}</span>
                    {service.repository && <a href={service.repository} target="_blank" rel="noreferrer">{service.repository}</a>}
                  </div>
                  {identity.role === 'ADMIN' && <div className="service-actions">
                    <button onClick={() => beginEdit(service)}>Edit</button>
                    <button className="danger-link" onClick={() => deleteService(service.id)} disabled={busy}>Delete</button>
                  </div>}
                </article>
              ))}
            </div>}
          </section>
          {identity.role === 'ADMIN' && <aside className="editor-card">
            <p className="eyebrow">{editingId ? 'UPDATE ENTRY' : 'NEW ENTRY'}</p><h2>{editingId ? 'Edit service' : 'Register a service'}</h2>
            <form className="stack-form" onSubmit={saveService}>
              <label>Service name<input required minLength={2} maxLength={100} value={serviceForm.name} onChange={event => setServiceForm({ ...serviceForm, name: event.target.value })} placeholder="Payments API" /></label>
              <label>Slug<input required minLength={2} maxLength={100} value={serviceForm.slug} onChange={event => setServiceForm({ ...serviceForm, slug: event.target.value })} placeholder="payments-api" /></label>
              <label>Owning team<select aria-label="Owning team" value={serviceForm.teamId} onChange={event => setServiceForm({ ...serviceForm, teamId: event.target.value })}><option value="">Unassigned</option>{teams.map(team => <option value={team.id} key={team.id}>{team.name}</option>)}</select></label>
              <label>Description<textarea maxLength={1000} rows={3} value={serviceForm.description} onChange={event => setServiceForm({ ...serviceForm, description: event.target.value })} placeholder="What does this service do?" /></label>
              <label>Repository URL<input type="url" value={serviceForm.repository} onChange={event => setServiceForm({ ...serviceForm, repository: event.target.value })} placeholder="https://github.com/org/repo" /></label>
              <label>Lifecycle<select value={serviceForm.lifecycle} onChange={event => setServiceForm({ ...serviceForm, lifecycle: event.target.value as Service['lifecycle'] })}>
                <option value="EXPERIMENTAL">Experimental</option><option value="PRODUCTION">Production</option><option value="DEPRECATED">Deprecated</option><option value="RETIRED">Retired</option>
              </select></label>
              <button className="primary-button" disabled={busy}>{busy ? 'Saving…' : editingId ? 'Save changes →' : 'Register service →'}</button>
              {editingId && <button type="button" className="quiet-button cancel-button" onClick={() => { setEditingId(null); setServiceForm(emptyService); }}>Cancel edit</button>}
            </form>
          </aside>}
        </div>
      </section>
      {(error || notice) && <div className={error ? 'feedback error' : 'feedback success'} role="status">{error || notice}</div>}
      <footer className="footer"><span>PULSEOPS / DEVELOPER PLATFORM</span><span>Workspace-scoped service ownership.</span></footer>
    </main>
  );
}
