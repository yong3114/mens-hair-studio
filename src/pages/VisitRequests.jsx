import React, {useCallback,useEffect,useRef,useState} from 'react'
import {supabase} from '../lib/supabase'

const services=['Maintenance','Studio Consultation','New System Installation']
const localInput=date=>new Date(new Date(date).getTime()+8*3600000).toISOString().slice(0,16)
const malaysiaTime=value=>value ? value+':00+08:00' : null
const display=date=>new Date(date).toLocaleString('en-MY',{timeZone:'Asia/Kuala_Lumpur',dateStyle:'medium',timeStyle:'short'})
const ride=n=>n ? 'JB CIQ pickup · '+n+' passenger(s), including member' : 'Arriving independently'

export function whatsappLink(contact,name,r){
 const lines=['Studio visit request #'+r.id,'Name: '+name,'WhatsApp: '+r.phone,'Service: '+r.service,'Preferred: '+display(r.preferred)+' MYT']
 if(r.alternative)lines.push('Alternative: '+display(r.alternative)+' MYT')
 lines.push(ride(r.passengers))
 if(r.note)lines.push('Notes: '+r.note)
 lines.push('Please confirm my visit time.')
 return 'https://wa.me/'+contact+'?text='+encodeURIComponent(lines.join('\n'))
}
async function rpc(name,args){
 const {data,error}=await supabase.rpc(name,args)
 if(error)throw error
 return data
}
export function RequestVisit({data,memberKey,disabled,refresh}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[pickup,setPickup]=useState(false)
 const lock=useRef(false),attempt=useRef(null)
 async function submit(e){
  e.preventDefault()
  if(lock.current||disabled)return
  const form=e.currentTarget,values=Object.fromEntries(new FormData(form))
  const r={preferred:malaysiaTime(values.preferred),alternative:malaysiaTime(values.alternative),service:values.service,phone:values.phone.trim(),passengers:pickup?Number(values.passengers):0,note:values.note.trim()}
  const signature=JSON.stringify(r)
  if(attempt.current?.signature!==signature)attempt.current={signature,token:crypto.randomUUID()}
  lock.current=true;setBusy(true);setError('')
  try{
   r.id=await rpc('member_request_visit',{p_key:memberKey,p_token:attempt.current.token,p_preferred:r.preferred,p_alternative:r.alternative,p_service:r.service,p_phone:r.phone,p_passengers:r.passengers,p_note:r.note})
   form.reset();setPickup(false);attempt.current=null
   await refresh()
   window.location.assign(whatsappLink(data.contact,data.name,r))
  }catch(err){setError(err.message)}finally{lock.current=false;setBusy(false)}
 }
 return <>
 {data.requests?.length>0&&<section className="portal-section"><h2>Pending confirmation</h2>{data.requests.map(r=><article key={r.id}><strong>{r.service}</strong><p>{display(r.preferred)} MYT · {ride(r.passengers)}</p>{data.contact&&memberKey&&<a className="btn btn-ghost" href={whatsappLink(data.contact,data.name,r)}>Continue in WhatsApp</a>}</article>)}</section>}
 <section className="portal-section"><h2>Request a visit</h2><p>Choose your preferred time in Malaysia. Your visit is booked once the studio confirms it.</p>
 <form className="form-grid" onSubmit={submit}><fieldset disabled={disabled||busy||!data.contact} style={{display:'grid',gap:12,border:0,padding:0,minWidth:0}}>
 <strong>{data.name}</strong>
 <label className="field">Your WhatsApp number<input type="tel" required name="phone" maxLength="30" defaultValue={data.profile?.phone||''}/></label>
 <label className="field">Service<select name="service">{services.map(x=><option key={x}>{x}</option>)}</select></label>
 <label className="field">Preferred time (MYT)<input name="preferred" type="datetime-local" min={localInput(Date.now())} required/></label>
 <label className="field">Alternative time (optional)<input name="alternative" type="datetime-local" min={localInput(Date.now())}/></label>
 <label className="field">Getting here<select value={pickup?'pickup':'self'} onChange={e=>setPickup(e.target.value==='pickup')}><option value="self">Arriving on my own</option><option value="pickup">Request JB CIQ pickup</option></select></label>
 {pickup&&<label className="field">Passengers including you<select name="passengers">{[1,2,3,4].map(n=><option key={n}>{n}</option>)}</select></label>}
 <label className="field">Note (optional)<textarea name="note" maxLength="500" rows="2"/></label>
 <small>Your request is saved first. Tap Send in WhatsApp to share it with the studio.</small>
 <button className="btn btn-primary">{busy?'Saving…':'Submit & open WhatsApp'}</button></fieldset>
 {error&&<p role="alert">{error}</p>}</form></section></>
}
export function VisitInbox({profiles,onConfirmed}){
 const [rows,setRows]=useState([]),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 const load=useCallback(async()=>{try{setRows(await rpc('staff_visit_requests',{}));setError('')}catch(err){setError(err.message)}},[])
 useEffect(()=>{load();const timer=setInterval(load,30000);window.addEventListener('focus',load);return()=>{clearInterval(timer);window.removeEventListener('focus',load)}},[load])
 async function confirm(e,r){
  e.preventDefault();const v=Object.fromEntries(new FormData(e.currentTarget));setBusy(true);setError('')
  try{await rpc('confirm_visit_request',{p_id:r.id,p_start:malaysiaTime(v.starts),p_minutes:Number(v.minutes),p_staff:v.staff});await load();await onConfirmed(new Date(malaysiaTime(v.starts)))}catch(err){setError(err.message)}finally{setBusy(false)}
 }
 return <section className="panel"><details><summary>Member visit requests ({rows.length})</summary>
 {!rows.length&&<p>No pending requests.</p>}{rows.map(r=><form className="form-grid" key={r.id} onSubmit={e=>confirm(e,r)}>
 <div><strong>{r.name} · {r.service}</strong><p>{r.phone} · {ride(r.passengers)}</p><p>Preferred {display(r.preferred)} MYT{r.alternative?' · Alternative '+display(r.alternative)+' MYT':''}</p>{r.note&&<p>{r.note}</p>}</div>
 <label className="field">Agreed time (MYT)<input required name="starts" type="datetime-local" defaultValue={localInput(r.preferred)}/></label>
 <label className="field">Duration<select name="minutes" defaultValue="120">{[60,90,120].map(n=><option value={n} key={n}>{n} minutes</option>)}</select></label>
 <label className="field">Staff<select required name="staff" defaultValue=""><option value="">Choose staff</option>{profiles.filter(p=>p.active!==false).map(p=><option key={p.id} value={p.id}>{p.full_name}</option>)}</select></label>
 <button className="btn btn-primary" disabled={busy}>Confirm & add to Calendar</button></form>)}</details>{error&&<p role="alert">{error}</p>}</section>
}
