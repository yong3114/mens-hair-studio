import React,{useEffect,useState} from 'react'
import { LockKeyhole, Mail, UserRound } from 'lucide-react'
import { supabase, configured } from '../lib/supabase'

export default function Login(){
 const[mode,setMode]=useState('staff')
 const[email,setEmail]=useState('')
 const[password,setPassword]=useState('')
 const[error,setError]=useState('')
 const[busy,setBusy]=useState(false)
 const[sent,setSent]=useState(false)
 const[portalReady,setPortalReady]=useState(false)

 useEffect(()=>{
  if(!configured)return
  supabase.rpc('customer_portal_ready')
   .then(({data,error})=>setPortalReady(!error&&data===true))
   .catch(()=>setPortalReady(false))
 },[])

 if(!configured)return <div className="login-shell"><div className="login-card setup-card"><div className="brand-mark big">MH</div><span className="eyebrow">SETUP REQUIRED</span><h1>Connect the system first</h1><p>Copy <strong>.env.example</strong> to <strong>.env</strong>, then fill in your Supabase URL, Publishable/Anon key and Google Maps browser key.</p><div className="code-box">VITE_SUPABASE_URL=...<br/>VITE_SUPABASE_ANON_KEY=...<br/>VITE_GOOGLE_MAPS_API_KEY=...</div></div></div>

 const switchMode=next=>{setMode(next);setError('');setSent(false);setPassword('')}

 const staffSignIn=async e=>{
  e.preventDefault();setError('');setBusy(true)
  const{error}=await supabase.auth.signInWithPassword({email,password})
  if(error)setError(error.message)
  setBusy(false)
 }

 const customerSignIn=async e=>{
  e.preventDefault()
  if(!portalReady)return
  setError('');setSent(false);setBusy(true)
  const redirectTo=new URL(import.meta.env.BASE_URL||'/',window.location.origin).toString()
  const{error}=await supabase.auth.signInWithOtp({
   email,
   options:{shouldCreateUser:true,emailRedirectTo:redirectTo}
  })
  if(error)setError(error.message)
  else setSent(true)
  setBusy(false)
 }

 return <div className="login-shell">
  <div className="login-card">
   <div className="brand-mark big">MH</div>
   <span className="eyebrow">MEN'S HAIR STUDIO</span>
   <h1>{mode==='staff'?'Welcome back':'Customer Portal'}</h1>
   <p>{mode==='staff'?'Sign in as Yong or Ah Bi.':'Use the email registered with the studio. We will send you a secure sign-in link.'}</p>

   <div className="login-switch" role="tablist">
    <button type="button" className={mode==='staff'?'active':''} onClick={()=>switchMode('staff')}><LockKeyhole size={16}/>Staff</button>
    <button type="button" className={mode==='customer'?'active':''} onClick={()=>switchMode('customer')}><UserRound size={16}/>Customer</button>
   </div>

   {error&&<div className="notice danger">{error}</div>}
   {sent&&<div className="notice success"><strong>Check your email</strong><span>Open the secure link we just sent to {email}.</span></div>}

   {mode==='staff'?<form className="login-form" onSubmit={staffSignIn}>
    <label className="field"><span className="field-label">Email</span><input type="email" required value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email"/></label>
    <label className="field"><span className="field-label">Password</span><input type="password" required value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password"/></label>
    <button className="btn btn-primary btn-lg" disabled={busy}><LockKeyhole size={18}/>{busy?'Signing in...':'Sign in'}</button>
   </form>:<form className="login-form" onSubmit={customerSignIn}>
    {!portalReady&&<div className="customer-login-setup"><strong>Customer login is not enabled on this database yet.</strong><span>Run and verify the V2.5 customer portal migration first. The login button stays disabled until the security layer is ready.</span></div>}
    <label className="field"><span className="field-label">Registered email</span><input type="email" required value={email} onChange={e=>{setEmail(e.target.value);setSent(false)}} autoComplete="email" placeholder="you@example.com"/></label>
    <button className="btn btn-primary btn-lg" disabled={busy||!portalReady||sent}><Mail size={18}/>{busy?'Sending...':sent?'Email sent':'Send secure login link'}</button>
    <small className="customer-login-hint">No password needed. Portal access only works for a client email that staff has enabled.</small>
   </form>}
  </div>
 </div>
}
