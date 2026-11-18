'use client';
import { FormEvent, useState } from 'react';

const API=(process.env.NEXT_PUBLIC_API_BASE_URL??'http://localhost:4000').replace(/\/$/,'')+'/api/v1';
export default function AcceptInvitationPage(){
 const [form,setForm]=useState({name:'',email:'',password:'',token:''});
 const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [accepted,setAccepted]=useState<{tenant:{slug:string};user:{email:string}}|null>(null);
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setBusy(true);setError('');
  try{
   const response=await fetch(API+'/auth/accept-invitation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)});
   const result=await response.json().catch(()=>({}));
   if(!response.ok){const message=result.message;throw new Error(Array.isArray(message)?message.join(', '):message||'Invitation could not be accepted')}
   setAccepted(result);
  }catch(err){setError(err instanceof Error?err.message:'Invitation could not be accepted')}finally{setBusy(false)}
 }
 return <main className="shell invite-page"><nav className="topbar"><a className="brand" href="/"><span className="brand-mark">P</span><span>PulseOps</span></a><span className="environment">WORKSPACE INVITATION</span></nav><section className="invite-card">
 {accepted?<><p className="eyebrow">INVITATION ACCEPTED</p><h1 className="invite-title">You're in<span>.</span></h1><p className="muted">Your account {accepted.user.email} has joined workspace <strong>{accepted.tenant.slug}</strong>.</p><p className="muted">You can now sign in with your email, password, and workspace slug.</p><a className="primary-button invite-link" href="/">Continue to sign in →</a></>:<><p className="eyebrow">JOIN YOUR TEAM</p><h1 className="invite-title">Accept invitation<span>.</span></h1><p className="muted">Enter the one-time token shared by your workspace administrator. Invitations expire after seven days.</p><form className="stack-form" onSubmit={submit}><label>Your name<input required minLength={2} maxLength={80} value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Ada Lovelace"/></label><label>Invited email<input required type="email" maxLength={254} value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="you@company.com"/></label><label>{'Password (use your existing account password if you already have one)'}<input required type="password" minLength={12} maxLength={72} value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="At least 12 characters"/></label><label>One-time invitation token<textarea required minLength={32} maxLength={128} rows={3} value={form.token} onChange={e=>setForm({...form,token:e.target.value.trim()})} placeholder="Paste the token from your administrator"/></label><button className="primary-button" disabled={busy}>{busy?'Accepting…':'Accept invitation →'}</button></form>{error&&<div className="feedback error invite-error" role="alert">{error}</div>}<p className="fine-print"><a href="/">Back to sign in</a></p></>}
 </section><footer className="footer"><span>PULSEOPS / DEVELOPER PLATFORM</span><span>Secure, workspace-scoped access.</span></footer></main>
}
