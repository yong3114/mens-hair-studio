import React,{useEffect,useMemo,useState} from 'react'
import { CalendarPlus, UserPlus, CreditCard, Play, Scissors, HandCoins, BellRing } from 'lucide-react'
import { getDashboard } from '../lib/api'
import { localDateKey, money, personLabel, timeOnly } from '../lib/utils'
import { isConsultationType } from '../lib/calendar'
import { Badge, Empty, Stat } from '../components/UI'

export default function Dashboard({go,profile,onStartService,onStartConsultation}){
 const [d,setD]=useState(null),[err,setErr]=useState('')
 useEffect(()=>{getDashboard(profile?.id).then(setD).catch(e=>setErr(e.message))},[profile?.id])
 const m=useMemo(()=>{
  if(!d)return null
  const today=localDateKey(new Date())
  const todayAppts=d.appts.filter(x=>localDateKey(x.scheduled_at)===today&&!['cancelled','no-show'].includes(x.status))
  const myJobs=d.appts.filter(x=>x.assigned_user_id===profile?.id&&!['completed','cancelled','no-show'].includes(x.status)).slice(0,8)
  const openLeads=d.leads.filter(x=>!['signed','customer','lost'].includes(x.stage))
  const followups=openLeads.filter(x=>x.stage==='follow_up'&&x.follow_up_date&&x.follow_up_date<=today)
  const low=d.consumables.filter(x=>Number(x.qty)<=Number(x.min_qty))
  const outstanding=d.payments.filter(x=>x.status==='outstanding').reduce((a,x)=>a+Number(x.amount||0),0)
  const sales=d.payments.filter(x=>localDateKey(x.paid_at||x.created_at)===today&&x.status==='paid'&&x.type!=='refund').reduce((a,x)=>a+Number(x.amount||0),0)
  const latestServiceByCustomer=new Map();[...d.services].sort((a,b)=>new Date(b.completed_at||b.started_at)-new Date(a.completed_at||a.started_at)).forEach(x=>{if(x.customer_id&&!latestServiceByCustomer.has(x.customer_id))latestServiceByCustomer.set(x.customer_id,x)});const maintenanceDue=[...latestServiceByCustomer.values()].filter(x=>x.next_maintenance_date&&x.next_maintenance_date<=today)
  const signedThisMonth=d.deals.filter(x=>{const dt=new Date(x.signed_at);const now=new Date();return dt.getMonth()===now.getMonth()&&dt.getFullYear()===now.getFullYear()})
  return {todayAppts,myJobs,openLeads,followups,low,outstanding,sales,maintenanceDue,signedThisMonth,unread:d.notifications?.length||0}
 },[d,profile?.id])
 const act=a=>isConsultationType(a.service_type)?onStartConsultation?.(a):onStartService?.(a)
 return <div className="page">
  <div className="page-head"><div><span className="eyebrow">TODAY</span><h1>{profile?.full_name?`${profile.full_name}'s dashboard`:'Dashboard'}</h1><p>Jobs, sales follow-up and client work in one place.</p></div><div className="page-actions"><button className="btn btn-primary" onClick={()=>go('appointments')}><CalendarPlus size={17}/>New booking</button></div></div>
  {err&&<div className="notice danger">{err}</div>}
  {!m?<div className="skeleton panel">Loading...</div>:<>
   <div className="stats-grid"><Stat label="Today's bookings" value={m.todayAppts.length} sub="Consultations + services"/><Stat label="Follow-ups due" value={m.followups.length} sub="Consulted, not decided" tone={m.followups.length?'warn':'default'}/><Stat label="Signed this month" value={m.signedThisMonth.length} sub="New hair-system deals"/><Stat label="Sales today" value={money(m.sales)} sub="Paid transactions"/><Stat label="Outstanding" value={money(m.outstanding)} sub="Needs collection" tone={m.outstanding?'warn':'default'}/><Stat label="Maintenance due" value={m.maintenanceDue.length} sub="Active clients" tone={m.maintenanceDue.length?'warn':'default'}/></div>
   <div className="dashboard-grid">
    <section className="panel"><div className="section-head"><div><span className="eyebrow">MY JOBS</span><h2>Assigned to {profile?.full_name||'me'}</h2></div><button className="text-btn" onClick={()=>go('appointments')}>Open calendar</button></div>{m.myJobs.length?<div className="schedule-list">{m.myJobs.map(a=><div className="schedule-row" key={a.id}><div className="time-block">{localDateKey(a.scheduled_at)===localDateKey(new Date())?timeOnly(a.scheduled_at):new Date(a.scheduled_at).toLocaleDateString('en-MY',{day:'2-digit',month:'short'})}</div><div className="grow"><strong>{personLabel(a)}</strong><span>{a.service_type} · {a.location_type==='home'?'Home':'Studio'}</span></div><Badge tone={a.status==='in_progress'?'warn':a.status==='confirmed'?'success':'neutral'}>{a.status.replace('_',' ')}</Badge>{!['completed','cancelled','no-show'].includes(a.status)&&<button className="btn btn-service btn-sm" onClick={()=>act(a)}><Play size={14}/>{a.status==='in_progress'?'Continue':isConsultationType(a.service_type)?'Consult':'Start'}</button>}</div>)}</div>:<Empty title="No jobs assigned" text="Jobs assigned in Calendar will appear here automatically."/>}</section>
    <section className="panel"><div className="section-head"><div><span className="eyebrow">QUICK ACTIONS</span><h2>Do it fast</h2></div></div><div className="quick-grid"><button onClick={()=>go('leads')}><UserPlus/><span><strong>New lead</strong><small>WhatsApp name is enough</small></span></button><button onClick={()=>go('appointments')}><CalendarPlus/><span><strong>Calendar</strong><small>Consultation or service</small></span></button><button onClick={()=>go('sales')}><HandCoins/><span><strong>Consultations & deals</strong><small>Signed / follow-up / lost</small></span></button><button onClick={()=>go('payments')}><CreditCard/><span><strong>Payment</strong><small>Paid or outstanding</small></span></button></div></section>
   </div>
   {(m.followups.length||m.maintenanceDue.length||m.low.length||m.unread)&&<section className="panel attention-panel"><div className="section-head"><div><span className="eyebrow">NEEDS ATTENTION</span><h2>Don't let these slip</h2></div></div><div className="attention-grid">{m.followups.length>0&&<button onClick={()=>go('leads')}><HandCoins/><span><strong>{m.followups.length} consultation follow-up{m.followups.length>1?'s':''}</strong><small>Decision still pending</small></span></button>}{m.maintenanceDue.length>0&&<button onClick={()=>go('services')}><Scissors/><span><strong>{m.maintenanceDue.length} maintenance due</strong><small>Active clients to contact</small></span></button>}{m.low.length>0&&<button onClick={()=>go('inventory')}><BellRing/><span><strong>{m.low.length} low-stock item{m.low.length>1?'s':''}</strong><small>Reorder soon</small></span></button>}{m.unread>0&&<div><BellRing/><span><strong>{m.unread} unread notification{m.unread>1?'s':''}</strong><small>Check the bell icon</small></span></div>}</div></section>}
  </>}
 </div>
}
