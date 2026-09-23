import React,{useEffect,useState} from 'react'
import { Mail } from 'lucide-react'
import { supabase, configured } from '../lib/supabase'

export default function CustomerLogin(){
 const[email,setEmail]=useState('')
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

 if(!configured)return <div className="customer-auth-shell"><div className="customer-auth-card"><div className="brand-mark big">MH</div><span className="eyebrow">CUSTOMER PORTAL</span><h1>Portal unavailable</h1><p>Please contact the studio for assistance.</p></div></div>

 const submit=async e=>{
  e.preventDefault()
  if(!portalReady)return
  setError('')
  setSent(false)
  setBusy(true)
  const redirectTo=window.location.origin+window.location.pathname
  const{error}=await supabase.auth.signInWithOtp({
   email,
   options:{shouldCreateUser:true,emailRedirectTo:redirectTo}
  })
  if(error)setError(error.message)
  else setSent(true)
  setBusy(false)
 }

 return <div className="customer-auth-shell">
  <form className="customer-auth-card" onSubmit={submit}>
   <div className="brand-mark big">MH</div>
   <span className="eyebrow">CUSTOMER PORTAL</span>
   <h1>Welcome</h1>
   <p>Enter the email registered with the studio. We’ll send you a secure sign-in link.</p>

   {!portalReady&&<div className="customer-login-setup"><strong>Customer portal is not active yet.</strong><span>Please contact the studio if you need access.</span></div>}
   {error&&<div className="notice danger">{error}</div>}
   {sent&&<div className="notice success"><strong>Check your email</strong><span>Open the secure link sent to {email}.</span></div>}

   <label className="field"><span className="field-label">Email</span><input type="email" required value={email} onChange={e=>{setEmail(e.target.value);setSent(false)}} autoComplete="email" placeholder="you@example.com"/></label>
   <button className="btn btn-primary btn-lg" disabled={busy||!portalReady||sent}><Mail size={18}/>{busy?'Sending...':sent?'Email sent':'Send secure login link'}</button>
   <small className="customer-login-hint">No password needed.</small>
  </form>
 </div>
}
