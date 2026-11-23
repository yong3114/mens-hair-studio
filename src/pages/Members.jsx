import React,{useCallback,useEffect,useRef,useState} from 'react'
import {supabase} from '../lib/supabase'
import {money} from '../lib/utils'

async function call(name,args){
 const {data,error}=await supabase.rpc(name,args)
 if(error)throw error
 return data
}
const displayTime=value=>new Date(value).toLocaleString('en-MY',{timeZone:'Asia/Kuala_Lumpur',dateStyle:'medium',timeStyle:'short'})
const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Kuala_Lumpur'}).format(new Date())
const storageKey='studio-member-access'
export function MemberAccess({id}){
 const [code,setCode]=useState(''),[error,setError]=useState('')
 async function issue(){
  if(!window.confirm('Issue a new member code? Any previous code for this client will stop working.'))return
  try{setCode(await call('member_issue',{p_customer:id}));setError('')}catch(e){setError(e.message)}
 }
 return <div><button className="btn btn-ghost" onClick={issue}>Issue member login</button>{code&&<label className="field">Private member code<input readOnly value={code} onFocus={e=>e.target.select()}/></label>}{error&&<p role="alert">{error}</p>}</div>
}
export default function Members(){
 const [key,setKey]=useState(()=>sessionStorage.getItem(storageKey)||''),[input,setInput]=useState(''),[data,setData]=useState(null),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false)
 const lock=useRef(false),request=useRef(null)
 const refresh=useCallback(async()=>{if(key)setData(await call('member_home',{p_key:key}))},[key])
 useEffect(()=>{if(!key)return;let current=true
  const read=()=>call('member_home',{p_key:key}).then(d=>{if(current)setData(d)}).catch(e=>{if(current){setData(null);setError(e.message);if(e.message.includes('Invalid member')){sessionStorage.removeItem(storageKey);setKey('')}}})
  read();window.addEventListener('focus',read);const timer=setInterval(read,60000)
  return()=>{current=false;window.removeEventListener('focus',read);clearInterval(timer)}
 },[key])
 async function login(e){e.preventDefault();setBusy(true);setError('')
  try{const k=input.trim();const result=await call('member_home',{p_key:k});sessionStorage.setItem(storageKey,k);setData(result);setKey(k);setInput('')}catch(err){setError(err.message)}finally{setBusy(false)}
 }
 async function act(kind,id){
  if(lock.current)return
  if(!window.confirm(kind==='book'?'Confirm this studio appointment?':'Redeem points for this voucher?'))return
  lock.current=true;setBusy(true);setMessage('');setError('')
  try{
   if(kind==='book')await call('member_book',{p_key:key,p_slot:id})
   else{if(request.current?.id!==id)request.current={id,token:crypto.randomUUID()};await call('member_redeem',{p_key:key,p_offer:id,p_request:request.current.token});request.current=null}
   setMessage(kind==='book'?'Booking confirmed.':'Voucher added to your account.')
  }catch(e){setError(e.message)}finally{try{await refresh()}catch(e){setError(e.message)}lock.current=false;setBusy(false)}
 }
 if(!key||!data)return <div className="login-shell"><form className="login-card" onSubmit={login}><h1>Member login</h1><label className="field">Private member code<input required type="password" autoComplete="current-password" value={input} onChange={e=>setInput(e.target.value)}/></label><small>Your studio can issue or replace your code.</small>{error&&<p role="alert">{error}</p>}<button className="btn btn-primary" disabled={busy}>Sign in</button><a href={window.location.pathname}>Staff login</a></form></div>
 return <main className="portal-main"><header className="page-head"><div><span className="eyebrow">MEMBER ACCOUNT</span><h1>{data.name}</h1></div><button className="btn btn-ghost" onClick={()=>{sessionStorage.removeItem(storageKey);setKey('');setData(null);setMessage('');setError('')}}>Sign out</button></header>
 <div className="portal-summary-grid">{[['Account credit',money(data.credit)],['Deal balance',money(data.deal_balance)],['Outstanding payments',money(data.outstanding)],['Reward points',data.points]].map(([label,value])=><article key={label}><span>{label}</span><strong>{value}</strong></article>)}</div>
 {message&&<p role="status">{message}</p>}{error&&<p role="alert">{error}</p>}
 <section className="portal-section"><h2>My hair system</h2>{data.systems.length?data.systems.map(s=><p key={s.code}><strong>{s.code}</strong> · {s.installed?'Installed '+s.installed+' · '+s.days+' days of wear':'Installation date pending'}</p>):<p>No installed system yet.</p>}
 <strong>{data.due?(data.due<today()?'Service overdue':data.due===today()?'Service due today':'Next recommended service')+' · '+data.due:'Service date pending'}</strong></section>
 <section className="portal-section"><h2>Upcoming visits</h2>{data.visits.length?data.visits.map((v,i)=><p key={i}>{displayTime(v.starts)} · {v.service} · {v.status}</p>):<p>No upcoming appointment.</p>}</section>
 <section className="portal-section"><h2>Book a studio visit</h2>{data.slots.length?data.slots.map(s=><p key={s.id}><button className="btn btn-ghost" disabled={busy} onClick={()=>act('book',s.id)}>{displayTime(s.starts)} · {s.service} · {s.minutes} min</button></p>):<p>No times open for booking yet.</p>}</section>
 <section className="portal-section"><h2>Redeem rewards</h2>{data.offers.length?data.offers.map(o=><p key={o.id}><button className="btn btn-ghost" disabled={busy||data.points<o.cost} onClick={()=>act('redeem',o.id)}>{o.title} · {o.cost} points</button></p>):<p>No vouchers on offer yet.</p>}</section>
 <section className="portal-section"><h2>My vouchers</h2>{data.vouchers.length?data.vouchers.map(v=><p key={v.id}><strong>{v.title}</strong> · {v.used?'Used':'Available'}{!v.used&&<small style={{display:'block',overflowWrap:'anywhere'}}>{v.id}</small>}</p>):<p>No vouchers redeemed yet.</p>}</section></main>
}
export function MemberSettings(){
 const [data,setData]=useState({offers:[],slots:[]}),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 async function manage(action,payload){
  setBusy(true);setError('')
  try{setData(await call('member_manage',{p_action:action,p_data:payload}))}catch(e){setError(e.message)}finally{setBusy(false)}
 }
 useEffect(()=>{manage('list',{})},[])
 function submit(action){return e=>{e.preventDefault();const values=Object.fromEntries(new FormData(e.currentTarget));if(values.starts)values.starts+=':00+08:00';manage(action,values)}}
 return <section className="panel"><h2>Member bookings & rewards</h2>{error&&<p role="alert">{error}</p>}
 <form className="form-grid" onSubmit={submit('slot')}><label className="field">Open a time (Malaysia)<input required type="datetime-local" name="starts"/></label><label className="field">Service<select name="service">{['Maintenance','Studio Consultation','New System Installation'].map(x=><option key={x}>{x}</option>)}</select></label><label className="field">Duration (minutes)<input name="minutes" type="number" min="15" max="240" defaultValue="60" required/></label><button disabled={busy} className="btn btn-primary">Open slot</button></form>
 {data.slots.map(s=><p key={s.id}>{displayTime(s.starts)} · {s.service} <button disabled={busy} onClick={()=>manage('remove_slot',{id:s.id})}>Withdraw</button></p>)}
 <form className="form-grid" onSubmit={submit('offer')}><label className="field">Voucher name<input name="title" required maxLength="100" placeholder="e.g. RM10 maintenance voucher"/></label><label className="field">Points required<input required name="cost" min="1" type="number"/></label><button disabled={busy} className="btn btn-primary">Publish voucher</button></form>
 {data.offers.map(o=><p key={o.id}>{o.title} · {o.cost} points <button disabled={busy} onClick={()=>manage('close_offer',{id:o.id})}>Withdraw</button></p>)}
 <form className="form-grid" onSubmit={submit('use')}><label className="field">Customer voucher code<input name="id" required/></label><button disabled={busy} className="btn btn-ghost">Mark voucher used</button></form></section>
}
