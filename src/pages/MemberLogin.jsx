import React,{useEffect,useState} from 'react'
import {Scissors} from 'lucide-react'
import {supabase} from '../lib/supabase'

async function call(name,args){
 const {data,error}=await supabase.rpc(name,args)
 if(error)throw error
 return data
}
export function MemberAccess({id}){
 const [issued,setIssued]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[copied,setCopied]=useState(false)
 async function issue(){
  if(busy||!window.confirm('Verify the client’s identity before sharing a login link. Replace any unused link?'))return
  setBusy(true);setError('');setCopied(false);setIssued(null)
  try{
   const result=await call('member_login_link',{p_customer:id})
   const url=new URL(window.location.pathname,window.location.origin)
   url.search='member';url.hash='setup='+result.ticket
   setIssued({...result,url:url.href})
  }catch(e){setError(e.message)}finally{setBusy(false)}
 }
 return <div><button className="btn btn-ghost" disabled={busy} onClick={issue}>Create member login / reset link</button>
 {issued&&<div><p>{issued.reset?'Password reset':'Activate membership'} · Send privately to +{issued.phone} on WhatsApp. Valid for 30 minutes.</p>
 <input aria-label="Private one-time link" readOnly value={issued.url} onFocus={e=>e.target.select()}/>
 <button className="btn btn-ghost" onClick={async()=>{try{await navigator.clipboard.writeText(issued.url);setCopied(true)}catch{setError('Select and copy the link above.')}}}>{copied?'Copied':'Copy link'}</button></div>}
 {error&&<p role="alert">{error}</p>}</div>
}
export function MemberLogin({ticket,onComplete,onExitSetup}){
 const [mode,setMode]=useState('phone'),[country,setCountry]=useState('60'),[phone,setPhone]=useState(''),[password,setPassword]=useState(''),[repeat,setRepeat]=useState(''),[code,setCode]=useState(''),[error,setError]=useState(''),[status,setStatus]=useState(''),[busy,setBusy]=useState(false)
 const setup=!!ticket,legacy=!setup&&mode==='code'
 useEffect(()=>{if(setup)window.history.replaceState(null,'',window.location.pathname+window.location.search)},[setup])
 async function submit(e){
  e.preventDefault();setError('');setStatus('');setBusy(true)
  try{
   const digits=phone.replace(/[\s()-]/g,'')
   const international=digits.startsWith('+')?digits:'+'+(digits.startsWith(country)?digits:country+(country==='60'?digits.replace(/^0/,''):digits))
   if(setup){
    if(password!==repeat)throw new Error('The two passwords must match.')
    await call('member_set_password',{p_ticket:ticket,p_phone:international,p_password:password})
    setStatus('Password saved. Sign in with your mobile number.');setPassword('');setRepeat('');onExitSetup();return
   }
   const key=legacy?code.trim():await call('member_password_login',{p_phone:international,p_password:password})
   if(!key)throw new Error('Unable to sign in. Check your details. After repeated attempts, try again in 15 minutes.')
   const data=await call('member_home',{p_key:key});onComplete(key,data)
  }catch(err){setError(err.message)}finally{setBusy(false)}
 }
 return <div className="login-shell member-entry"><form className="login-card" onSubmit={submit}>
 <div className="member-symbol"><Scissors size={28}/></div><h1>{setup?'Set your member password':'Member login'}</h1>
 {legacy?<label className="field">Private member code<input autoComplete="off" type="password" required value={code} onChange={e=>setCode(e.target.value)}/></label>:<>
 <label className="field">Country<select value={country} onChange={e=>setCountry(e.target.value)}><option value="60">Malaysia (+60)</option><option value="65">Singapore (+65)</option></select></label>
 <label className="field">Mobile number<input required type="tel" autoComplete="tel" value={phone} onChange={e=>setPhone(e.target.value)}/></label>
 <label className="field">{setup?'New password':'Password'}<input type="password" required minLength={setup?6:undefined} autoComplete={setup?'new-password':'current-password'} value={password} onChange={e=>setPassword(e.target.value)}/></label>
 {setup&&<><small>Use at least 6 characters. Letters or numbers are fine.</small><label className="field">Confirm password<input type="password" required autoComplete="new-password" value={repeat} onChange={e=>setRepeat(e.target.value)}/></label></>}</>}
 {status&&<p role="status">{status}</p>}{error&&<p role="alert">{error}</p>}
 <button className="btn btn-primary" disabled={busy}>{setup?'Save password':'Sign in'}</button>
 {!setup&&<><button type="button" className="btn btn-ghost" onClick={()=>{setMode(legacy?'phone':'code');setError('');setStatus('')}}>{legacy?'Use mobile and password':'Use existing member code'}</button>
 <details><summary>First visit or forgot password?</summary><p>Contact the studio on WhatsApp. Staff will verify your identity and send a private setup or reset link to your registered number.</p></details></>}
 <a href={window.location.pathname}>Staff login</a></form></div>
}
