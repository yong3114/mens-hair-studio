import React,{useCallback,useEffect,useRef,useState} from 'react'
import {supabase} from '../lib/supabase'
import {CalendarDays, Scissors, Wallet, Home, CreditCard, WalletCards, ChevronRight, UserRound} from 'lucide-react'
import './Members.css'
import {Badge, Empty} from '../components/UI'
import {money,shortDate} from '../lib/utils'

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
export default function Members({previewId,onExit,onRecords}){
 const [key,setKey]=useState(()=>previewId?'':sessionStorage.getItem(storageKey)||''),[input,setInput]=useState(''),[data,setData]=useState(null),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false)
 const [page,setPage]=useState('home')
 const [pickup,setPickup]=useState(0)
 const lock=useRef(false),request=useRef(null)
 const refresh=useCallback(async()=>{if(key)setData(await call('member_home',{p_key:key}))},[key])
 useEffect(()=>{if(!key&&!previewId)return;let current=true
  const read=()=>(previewId?call('member_preview',{p_customer:previewId}):call('member_home',{p_key:key})).then(d=>{if(current)setData(d)}).catch(e=>{if(current){setData(null);setError(e.message);if(e.message.includes('Invalid member')){sessionStorage.removeItem(storageKey);setKey('')}}})
  read();window.addEventListener('focus',read);const timer=setInterval(read,30000)
  return()=>{current=false;window.removeEventListener('focus',read);clearInterval(timer)}
 },[key,previewId])
 async function login(e){e.preventDefault();setBusy(true);setError('')
  try{const k=input.trim();const result=await call('member_home',{p_key:k});sessionStorage.setItem(storageKey,k);setData(result);setKey(k);setInput('')}catch(err){setError(err.message)}finally{setBusy(false)}
 }
 async function act(kind,id){
  if(previewId||lock.current)return
  if(!window.confirm(kind==='book'?'Confirm this studio appointment?':'Redeem points for this voucher?'))return
  lock.current=true;setBusy(true);setMessage('');setError('')
  try{
   if(kind==='book')await call('member_book_visit',{p_key:key,p_slot:id,p_pickup:pickup})
   else{if(request.current?.id!==id)request.current={id,token:crypto.randomUUID()};await call('member_redeem',{p_key:key,p_offer:id,p_request:request.current.token});request.current=null}
   setMessage(kind==='book'?(pickup?'Studio visit confirmed. The studio will confirm your CIQ pickup separately.':'Booking confirmed.'):'Voucher added to your account.')
  }catch(e){setError(e.message)}finally{try{await refresh()}catch(e){setError(e.message)}lock.current=false;setBusy(false)}
 }
 if(previewId&&!data)return <div className="portal-main"><button className="btn btn-ghost" onClick={onExit}>Back to client</button><p role="status">{error||"Loading member view…"}</p></div>
 if((!previewId&&!key)||!data)return <div className="login-shell member-entry"><form className="login-card" onSubmit={login}><div className="member-symbol"><Scissors size={28}/></div><h1>Member login</h1><label className="field">Private member code<input required type="password" autoComplete="current-password" value={input} onChange={e=>setInput(e.target.value)}/></label><small>Your studio can issue or replace your code.</small>{error&&<p role="alert">{error}</p>}<button className="btn btn-primary" disabled={busy}>Sign in</button><a href={window.location.pathname}>Staff login</a></form></div>
 const c=data.profile||{},upcoming=data.visits[0],currentSystem=data.systems[0]
 return <div className="portal-shell"><header className="portal-preview-bar"><strong>{previewId?'Customer view · Read only':'Member account'}</strong>{previewId?<div><button className="btn btn-ghost" onClick={onRecords}>Client records</button> <button className="btn btn-ghost" onClick={onExit}>Back to client</button></div>:<button className="btn btn-ghost" onClick={()=>{sessionStorage.removeItem(storageKey);setKey('');setData(null);setPage('home');setMessage('');setError('')}}>Sign out</button>}</header><main className="portal-main">
 {page==='home'&&<><section className="portal-hero"><span className="portal-kicker">MY HAIR STUDIO</span><h1>Hi, {data.name}</h1></section>
       {upcoming?<section className="portal-next-card"><div className="portal-card-icon"><CalendarDays size={22}/></div><div className="grow"><span className="portal-label">NEXT APPOINTMENT</span><h2>{upcoming.service}</h2><p>{displayTime(upcoming.starts)}</p></div><Badge tone={upcoming.status==='confirmed'?'success':'neutral'}>{upcoming.status.replace('_',' ')}</Badge></section>:<section className="portal-empty-card"><CalendarDays size={22}/><div><strong>No upcoming appointment</strong><span>Your next booking will appear here.</span></div></section>}
       <div className="portal-actions"><button onClick={()=>setPage('booking')}><CalendarDays size={19}/><span><strong>Customer view</strong><small>See member booking times</small></span><ChevronRight size={18}/></button></div>
       <div className="portal-summary-grid"><article><WalletCards size={19}/><span>Account credit</span><strong>{money(data.credit)}</strong></article><article><CreditCard size={19}/><span>Outstanding</span><strong>{money(data.outstanding)}</strong></article><article><Scissors size={19}/><span>Last service</span><strong>{data.last_service?shortDate(data.last_service):'—'}</strong></article><article><Wallet size={19}/><span>Reward points</span><strong>{data.points}</strong></article></div>
       <section className="portal-section"><div className="portal-section-head"><div><span className="portal-label">MY HAIR SYSTEM</span><h2>Current system</h2></div></div>{currentSystem?<div className="portal-system"><div><Badge tone={'success'}>Installed</Badge><h3>{currentSystem.code}</h3></div><div className="portal-specs"><span>Base<strong>{currentSystem.base||'—'}</strong></span><span>Colour<strong>{currentSystem.colour||'—'}</strong></span><span>Size<strong>{currentSystem.size||'—'}</strong></span><span>Density<strong>{currentSystem.density||'—'}</strong></span></div><p>{currentSystem.days!=null?`${currentSystem.days} days of wear`:null}</p></div>:<Empty title="No hair system yet" text="Your installed hair system details will appear here."/>}{data.due&&<p><strong>{data.due<today()?"Service overdue":"Next recommended service"} · {shortDate(data.due+"T12:00:00")}</strong></p>}</section>
       <section className="portal-section"><div className="portal-section-head"><div><span className="portal-label">PROFILE</span><h2>Your details</h2></div><UserRound size={20}/></div><div className="portal-profile"><div><span>Phone</span><strong>{c.phone||'—'}</strong></div><div><span>Email</span><strong>{c.email||'—'}</strong></div><div><span>Area</span><strong>{c.area||'—'}</strong></div>{c.address&&<div className="wide"><span>Saved address</span><strong>{c.address}</strong></div>}</div></section>
     </>}
 {page==='wallet'&&<> <div className="portal-summary-grid">{[['Account credit',money(data.credit)],['Deal balance',money(data.deal_balance)],['Outstanding payments',money(data.outstanding)],['Reward points',data.points]].map(([label,value])=><article key={label}><span>{label}</span><strong>{value}</strong></article>)}</div>
</>}
 {message&&<p role="status">{message}</p>}{error&&<p role="alert">{error}</p>}
 {page==='booking'&&<section className="portal-section"><h2>Upcoming visits</h2>{data.visits.length?data.visits.map((v,i)=><p key={i}>{displayTime(v.starts)} · {v.service} · {v.status}</p>):<p>No upcoming appointment.</p>}</section>}
 {page==='booking'&&<section className="portal-section"><h2>Book a studio visit</h2>{data.slots.length>0&&<label className="field">JB CIQ pickup<select value={pickup} onChange={e=>setPickup(Number(e.target.value))}><option value="0">Arriving on my own</option><option value="1">Request pickup for me</option><option value="2">Request pickup for me and one companion</option></select></label>}{data.slots.length?data.slots.map(s=><p key={s.id}><button className="btn btn-ghost" disabled={busy||!!previewId} onClick={()=>act('book',s.id)}>{displayTime(s.starts)} · {s.service} · {s.minutes} min</button></p>):<p>No times open for booking yet.</p>}</section>}
 {page==='wallet'&&<><section className="portal-section"><h2>Redeem rewards</h2><p>Earn 1 point for every RM1 paid after refunds.</p>{data.offers.length?data.offers.map(o=><p key={o.id}><button className="btn btn-ghost" disabled={busy||!!previewId||data.points<o.cost} onClick={()=>act('redeem',o.id)}>{o.title} · {o.cost} points</button></p>):<p>No vouchers on offer yet.</p>}</section>
 <section className="portal-section"><h2>My vouchers</h2>{data.vouchers.length?data.vouchers.map(v=><p key={v.id}><strong>{v.title}</strong> · {v.used?'Used':'Available'}{!v.used&&<small style={{display:'block',overflowWrap:'anywhere'}}>{v.id}</small>}</p>):<p>No vouchers redeemed yet.</p>}</section></>}</main><nav className="portal-bottom-nav" aria-label="Member menu">{[['home','Home',Home],['booking','Visits',CalendarDays],['wallet','Account',Wallet]].map(([id,label,Icon])=><button key={id} className={page===id?'active':''} onClick={()=>{setPage(id);window.scrollTo(0,0)}}><Icon size={20}/><span>{label}</span></button>)}</nav></div>
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
