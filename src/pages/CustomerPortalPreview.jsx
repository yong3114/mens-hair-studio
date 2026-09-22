import React,{useEffect,useMemo,useState} from 'react'
import { ArrowLeft, CalendarDays, CreditCard, Scissors, WalletCards, ChevronRight, MapPin, Image as ImageIcon, Clock3, Home, UserRound } from 'lucide-react'
import { getCustomer, signedMedia } from '../lib/api'
import { Badge, Empty } from '../components/UI'
import { customerLabel, dateTime, money, shortDate, mapsUrl } from '../lib/utils'
import { accountOutstanding, dealPaidAmount, dealRefundedAmount } from '../lib/finance'

export default function CustomerPortalPreview({id,onExit,onBook}){
 const[d,setD]=useState(null),[urls,setUrls]=useState({}),[tab,setTab]=useState('home')
 useEffect(()=>{getCustomer(id).then(setD)},[id])
 useEffect(()=>{if(!d?.media?.length){setUrls({});return}Promise.all(d.media.map(async m=>[m.id,await signedMedia(m.storage_path).catch(()=>null)])).then(x=>setUrls(Object.fromEntries(x)))},[d?.media?.length])
 useEffect(()=>{window.scrollTo({top:0,left:0,behavior:'auto'})},[tab])
 const stats=useMemo(()=>{if(!d)return{};const credit=d.credits.reduce((a,x)=>a+(x.type==='use'?-1:1)*Number(x.amount||0),0);const outstanding=accountOutstanding(d.deals,d.payments);return{credit,outstanding}},[d])
 if(!d)return <div className="portal-shell"><div className="portal-loading">Loading customer portal…</div></div>
 const c=d.customer
 const upcoming=d.appointments.filter(x=>!['completed','cancelled','no-show'].includes(x.status)&&new Date(x.scheduled_at)>=new Date()).sort((a,b)=>new Date(a.scheduled_at)-new Date(b.scheduled_at))[0]
 const currentSystem=d.systems.find(x=>x.status==='installed')||d.systems[0]
 const currentDeal=d.deals?.find(x=>x.status!=='cancelled')||null
 const completed=d.services.filter(x=>x.status==='completed')
 const last=completed[0]
 const media=d.media.slice(0,24)
 const nav=[['home','Home',Home],['visits','Visits',CalendarDays],['photos','Photos',ImageIcon],['account','Account',WalletCards]]
 return <div className="portal-shell">
   <header className="portal-preview-bar"><button className="portal-back" onClick={onExit}><ArrowLeft size={18}/>Exit preview</button><div><strong>Customer view</strong><span>Preview only — customer login is not enabled yet</span></div></header>
   <main className="portal-main">
     {tab==='home'&&<>
       <section className="portal-hero"><span className="portal-kicker">MY HAIR STUDIO</span><h1>Hi, {customerLabel(c)}</h1><p>Your appointments, hair system and service history in one place.</p></section>
       {upcoming?<section className="portal-next-card"><div className="portal-card-icon"><CalendarDays size={22}/></div><div className="grow"><span className="portal-label">NEXT APPOINTMENT</span><h2>{upcoming.service_type}</h2><p>{dateTime(upcoming.scheduled_at)} · {upcoming.location_type==='home'?'Home visit':'Studio'}</p>{upcoming.location_type==='home'&&upcoming.address&&<small>{upcoming.place_name||upcoming.address}</small>}</div><Badge tone={upcoming.status==='confirmed'?'success':'neutral'}>{upcoming.status.replace('_',' ')}</Badge></section>:<section className="portal-empty-card"><CalendarDays size={22}/><div><strong>No upcoming appointment</strong><span>Your next booking will appear here.</span></div></section>}
       <div className="portal-actions"><button onClick={onBook}><CalendarDays size={19}/><span><strong>Book service</strong><small>Request your next visit</small></span><ChevronRight size={18}/></button>{c.address&&<a href={mapsUrl(c)} target="_blank" rel="noreferrer"><MapPin size={19}/><span><strong>Saved location</strong><small>Open Google Maps</small></span><ChevronRight size={18}/></a>}</div>
       <div className="portal-summary-grid"><article><WalletCards size={19}/><span>Account credit</span><strong>{money(stats.credit)}</strong></article><article><CreditCard size={19}/><span>Outstanding</span><strong>{money(stats.outstanding)}</strong></article><article><Scissors size={19}/><span>Last service</span><strong>{last?shortDate(last.completed_at):'—'}</strong></article></div>
       <section className="portal-section"><div className="portal-section-head"><div><span className="portal-label">MY HAIR SYSTEM</span><h2>Current system</h2></div></div>{currentSystem?<div className="portal-system"><div><Badge tone={currentSystem.status==='installed'?'success':'neutral'}>{currentSystem.status}</Badge><h3>{currentSystem.code}</h3></div><div className="portal-specs"><span>Base<strong>{currentSystem.base||'—'}</strong></span><span>Colour<strong>{currentSystem.colour||'—'}</strong></span><span>Size<strong>{currentSystem.size||'—'}</strong></span><span>Density<strong>{currentSystem.density||'—'}</strong></span></div></div>:<Empty title="No hair system yet" text="Your installed hair system details will appear here."/>}</section>
       <section className="portal-section"><div className="portal-section-head"><div><span className="portal-label">PROFILE</span><h2>Your details</h2></div><UserRound size={20}/></div><div className="portal-profile"><div><span>Phone</span><strong>{c.phone||'—'}</strong></div><div><span>Email</span><strong>{c.email||'—'}</strong></div><div><span>Area</span><strong>{c.area||'—'}</strong></div>{c.address&&<div className="wide"><span>Saved address</span><strong>{c.address}</strong></div>}</div></section>
     </>}
     {tab==='visits'&&<>
       <section className="portal-hero compact"><span className="portal-kicker">MY VISITS</span><h1>Appointments & history</h1><p>See your upcoming booking and completed services.</p></section>
       {upcoming&&<section className="portal-next-card"><div className="portal-card-icon"><CalendarDays size={22}/></div><div className="grow"><span className="portal-label">UPCOMING</span><h2>{upcoming.service_type}</h2><p>{dateTime(upcoming.scheduled_at)}</p></div><Badge tone={upcoming.status==='confirmed'?'success':'neutral'}>{upcoming.status.replace('_',' ')}</Badge></section>}
       <section className="portal-section"><div className="portal-section-head"><div><span className="portal-label">SERVICE HISTORY</span><h2>Recent visits</h2></div></div>{completed.length?<div className="portal-history">{completed.slice(0,20).map(s=><div key={s.id}><div className="portal-history-icon"><Clock3 size={17}/></div><div className="grow"><strong>{s.service_type}</strong><span>{dateTime(s.completed_at)}</span>{s.next_maintenance_date&&<small>Recommended next maintenance: {shortDate(s.next_maintenance_date)}</small>}</div></div>)}</div>:<Empty title="No completed service yet"/>}</section>
     </>}
     {tab==='photos'&&<>
       <section className="portal-hero compact"><span className="portal-kicker">MY PHOTOS</span><h1>Before / After</h1><p>Your hair transformation photos in one private place.</p></section>
       <section className="portal-section">{media.length?<div className="portal-media-grid">{media.map(m=>urls[m.id]?<figure key={m.id}><img src={urls[m.id]} alt={m.kind}/><figcaption>{m.kind}</figcaption></figure>:null)}</div>:<Empty title="No photos shared yet" text="Your service photos can appear here after they are uploaded."/>}</section>
     </>}
     {tab==='account'&&<>
       <section className="portal-hero compact"><span className="portal-kicker">MY ACCOUNT</span><h1>Payments & credit</h1><p>Track account credit, outstanding balances and recent payments.</p></section>
       <div className="portal-summary-grid account"><article><WalletCards size={19}/><span>Account credit</span><strong>{money(stats.credit)}</strong></article><article><CreditCard size={19}/><span>Outstanding</span><strong>{money(stats.outstanding)}</strong></article></div>
       {currentDeal&&<section className="portal-section"><div className="portal-section-head"><div><span className="portal-label">ORDER</span><h2>Hair system balance</h2></div></div><div className="portal-profile"><div><span>Total</span><strong>{money(currentDeal.final_price)}</strong></div><div><span>Paid</span><strong>{money(dealPaidAmount(currentDeal))}</strong></div><div><span>Refunded</span><strong>{money(dealRefundedAmount(currentDeal))}</strong></div><div><span>Balance</span><strong>{money(currentDeal.balance_amount)}</strong></div></div></section>}
       <section className="portal-section"><div className="portal-section-head"><div><span className="portal-label">PAYMENTS</span><h2>Recent transactions</h2></div></div>{d.payments.length?<div className="portal-payments">{d.payments.slice(0,30).map(p=><div key={p.id}><div><strong>{p.type}</strong><span>{shortDate(p.paid_at||p.created_at)} · {p.method}</span></div><div><strong>{money(p.amount)}</strong><Badge tone={p.status==='paid'?'success':p.status==='outstanding'?'warn':'neutral'}>{p.status}</Badge></div></div>)}</div>:<Empty title="No payments yet"/>}</section>
       {d.credits.length>0&&<section className="portal-section"><div className="portal-section-head"><div><span className="portal-label">CREDIT HISTORY</span><h2>Account credit</h2></div></div><div className="portal-payments">{d.credits.slice(0,30).map(x=><div key={x.id}><div><strong>{x.type}</strong><span>{shortDate(x.created_at)} · {x.notes||''}</span></div><strong>{x.type==='use'?'-':'+'}{money(x.amount)}</strong></div>)}</div></section>}
     </>}
     <p className="portal-preview-note">Preview mode uses your admin session. A real customer login will need customer-specific authentication and RLS before launch.</p>
   </main>
   <nav className="portal-bottom-nav">{nav.map(([key,label,Icon])=><button key={key} className={tab===key?'active':''} onClick={()=>setTab(key)}><Icon size={20}/><span>{label}</span></button>)}</nav>
 </div>
}
