import React,{useEffect,useRef,useState} from 'react'
import {supabase} from '../lib/supabase'

async function rpc(name,args){
 const {data,error}=await supabase.rpc(name,args)
 if(error)throw error
 return data
}

export function MemberProfile({memberKey,data,refresh,disabled}){
 const [draft,setDraft]=useState(null),[before,setBefore]=useState(null),[changing,setChanging]=useState(false)
 const [message,setMessage]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 const change=data.phone_change, pending=change?.status==='pending'
 async function submit(e,phone){
  e.preventDefault()
  const values=new FormData(e.currentTarget)
  setBusy(true);setError('');setMessage('')
  try{
   if(phone){
    await rpc('member_request_phone',{p_key:memberKey,p_phone:values.get('phone')})
    setChanging(false);setMessage('Request sent. Keep using your current number until the studio confirms.')
   }else{
    await rpc('member_save_profile',{p_key:memberKey,p_before:before,p_name:draft.name,p_display:draft.whatsapp_name,p_email:draft.email,p_area:draft.area})
    setDraft(null);setMessage('Profile saved.')
   }
   await refresh()
  }catch(err){setError(err.message);await refresh()}finally{setBusy(false)}
 }
 return <div>
 {data.edit_fields?.whatsapp_name&&<p>Preferred name · {data.edit_fields.whatsapp_name}</p>}
 {memberKey&&<><button className="btn btn-ghost" disabled={disabled||busy} onClick={()=>{setBefore(data.edit_fields);setDraft({...data.edit_fields});setChanging(false);setError('');setMessage('')}}>Edit profile</button>
 {!pending&&<button className="btn btn-ghost" disabled={disabled||busy} onClick={()=>{setChanging(true);setDraft(null);setError('');setMessage('')}}>Request number change</button>}</>}
 {change&&<p>Phone change · +{change.number} · {change.status}</p>}
 {draft&&<form className="form-grid" onSubmit={e=>submit(e,false)}>{[['name','Name'],['whatsapp_name','Preferred name'],['email','Email (optional)'],['area','Area (optional)']].map(([key,label])=><label className="field" key={key}>{label}<input value={draft[key]||''} type={key==='email'?'email':'text'} maxLength={key==='email'?254:120} onChange={e=>setDraft({...draft,[key]:e.target.value})}/></label>)}<button className="btn btn-primary" disabled={busy||disabled}>Save profile</button><button type="button" className="btn btn-ghost" disabled={busy} onClick={()=>setDraft(null)}>Cancel</button></form>}
 {changing&&<form className="form-grid" onSubmit={e=>submit(e,true)}><label className="field">New mobile number, including +60 or +65<input type="tel" name="phone" maxLength="25" required/></label><button className="btn btn-primary" disabled={busy||disabled}>Submit request</button><button type="button" className="btn btn-ghost" disabled={busy} onClick={()=>setChanging(false)}>Cancel</button></form>}
 {message&&<p role="status">{message}</p>}{error&&<p role="alert">{error}</p>}</div>
}

export function PhoneChangeInbox({onChange}){
 const [rows,setRows]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const sequence=useRef(0)
 async function load(){
  const version=++sequence.current
  try{const records=await rpc('staff_phone_changes',{});if(version===sequence.current)setRows(records)}catch(err){if(version===sequence.current)setError(err.message)}
 }
 useEffect(()=>{load();const timer=setInterval(load,30000);window.addEventListener('focus',load);return()=>{++sequence.current;clearInterval(timer);window.removeEventListener('focus',load)}},[])
 async function decide(r,approve){
  if(!window.confirm(approve?'Have you verified the client’s identity and that they control +'+r.requested+'? Approve the new number?':'Decline this number change?'))return
  setBusy(true);setError('')
  try{await rpc('staff_decide_phone',{p_id:r.id,p_approve:approve});await load();await onChange()}catch(err){setError(err.message)}finally{setBusy(false)}
 }
 if(!rows.length&&!error)return null
 return <section className="panel"><h2>Phone change requests</h2>{rows.map(r=><article key={r.id}><strong>{r.name}</strong><p>{r.old||'No number on file'} → +{r.requested}</p><button className="btn btn-primary" disabled={busy} onClick={()=>decide(r,true)}>Verify & approve</button> <button className="btn btn-ghost" disabled={busy} onClick={()=>decide(r,false)}>Decline</button></article>)}{error&&<p role="alert">{error}</p>}</section>
}
