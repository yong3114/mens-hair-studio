import React, { useEffect, useMemo, useState } from 'react'
import { CalendarPlus, UserPlus, PackagePlus, CreditCard, AlertCircle, Play, Scissors } from 'lucide-react'
import { getDashboard } from '../lib/api'
import { customerLabel, localDateKey, money, shortDate, timeOnly } from '../lib/utils'
import { Badge, Empty, Stat } from '../components/UI'

export default function Dashboard({go,onStartService}){
  const [d,setD]=useState(null); const [err,setErr]=useState('')
  useEffect(()=>{getDashboard().then(setD).catch(e=>setErr(e.message))},[])
  const m=useMemo(()=>{
    if(!d)return null
    const today=localDateKey(new Date())
    const todayAppts=d.appts.filter(x=>localDateKey(x.scheduled_at)===today && !['cancelled','no-show'].includes(x.status))
    const openLeads=d.leads.filter(x=>!['customer','lost'].includes(x.stage))
    const overdueLeads=openLeads.filter(x=>x.follow_up_date && x.follow_up_date<today)
    const low=d.consumables.filter(x=>Number(x.qty)<=Number(x.min_qty))
    const outstanding=d.payments.filter(x=>x.status==='outstanding').reduce((a,x)=>a+Number(x.amount||0),0)
    const sales=d.payments.filter(x=>localDateKey(x.paid_at||x.created_at)===today && x.status==='paid'&&x.type!=='refund').reduce((a,x)=>a+Number(x.amount||0),0)
    const maintenanceDue=d.services.filter(x=>x.next_maintenance_date&&x.next_maintenance_date<=today)
    const maintenanceSoon=d.services.filter(x=>x.next_maintenance_date&&x.next_maintenance_date>today).slice(0,6)
    return {todayAppts,openLeads,overdueLeads,low,outstanding,sales,maintenanceDue,maintenanceSoon,available:d.systems.filter(x=>x.status==='available').length}
  },[d])
  return <div className="page">
    <div className="page-head"><div><span className="eyebrow">TODAY</span><h1>Dashboard</h1><p>What needs attention now, without the clutter.</p></div><div className="page-actions"><button className="btn btn-primary" onClick={()=>go('appointments')}><CalendarPlus size={17}/>New booking</button></div></div>
    {err&&<div className="notice danger">{err}</div>}
    {!m?<div className="skeleton panel">Loading...</div>:<>
      <div className="stats-grid"><Stat label="Today's bookings" value={m.todayAppts.length} sub="Calendar"/><Stat label="Open leads" value={m.openLeads.length} sub={`${m.overdueLeads.length} follow-up overdue`} tone={m.overdueLeads.length?'warn':'default'}/><Stat label="Sales today" value={money(m.sales)} sub="Paid transactions"/><Stat label="Outstanding" value={money(m.outstanding)} sub="Needs collection" tone={m.outstanding?'warn':'default'}/><Stat label="Maintenance due" value={m.maintenanceDue.length} sub="Follow up customers" tone={m.maintenanceDue.length?'warn':'default'}/><Stat label="Low stock" value={m.low.length} sub="At minimum" tone={m.low.length?'danger':'default'}/></div>
      <div className="dashboard-grid">
        <section className="panel"><div className="section-head"><div><span className="eyebrow">SCHEDULE</span><h2>Today</h2></div><button className="text-btn" onClick={()=>go('appointments')}>Open calendar</button></div>
          {m.todayAppts.length? <div className="schedule-list">{m.todayAppts.map(a=><div className="schedule-row" key={a.id}><div className="time-block">{timeOnly(a.scheduled_at)}</div><div className="grow"><strong>{customerLabel(a.customers)}</strong><span>{a.service_type} · {a.location_type==='home'?'Home visit':'Studio'} · {a.profiles?.full_name||'Unassigned'}</span></div><Badge tone={a.status==='confirmed'?'success':a.status==='in_progress'?'warn':'neutral'}>{a.status.replace('_',' ')}</Badge>{!['completed','cancelled','no-show'].includes(a.status)&&<button className="btn btn-service btn-sm" onClick={()=>onStartService?.(a)}><Play size={14}/>{a.status==='in_progress'?'Continue':'Start'}</button>}</div>)}</div>:<Empty title="No appointments today" text="Use the time for lead follow-up or stock work."/>}
        </section>
        <section className="panel"><div className="section-head"><div><span className="eyebrow">QUICK ACTIONS</span><h2>Do it fast</h2></div></div><div className="quick-grid"><button onClick={()=>go('leads')}><UserPlus/><span><strong>New lead</strong><small>WhatsApp name is enough</small></span></button><button onClick={()=>go('appointments')}><CalendarPlus/><span><strong>New booking</strong><small>Month / week / day</small></span></button><button onClick={()=>go('services')}><Scissors/><span><strong>Service queue</strong><small>Start actual work</small></span></button><button onClick={()=>go('payments')}><CreditCard/><span><strong>Payment</strong><small>Paid or outstanding</small></span></button></div></section>
      </div>
      {(m.overdueLeads.length||m.low.length||m.outstanding>0||m.maintenanceDue.length>0)&&<section className="panel attention"><div className="section-head"><div><span className="eyebrow">NEEDS ATTENTION</span><h2>Handle these next</h2></div></div><div className="attention-grid">{m.overdueLeads.length>0&&<button onClick={()=>go('leads')}><AlertCircle/><strong>{m.overdueLeads.length} overdue lead follow-up</strong><span>Open Leads</span></button>}{m.maintenanceDue.length>0&&<button onClick={()=>go('services')}><AlertCircle/><strong>{m.maintenanceDue.length} maintenance follow-up due</strong><span>Open Service</span></button>}{m.low.length>0&&<button onClick={()=>go('inventory')}><AlertCircle/><strong>{m.low.length} low-stock item</strong><span>Open Inventory</span></button>}{m.outstanding>0&&<button onClick={()=>go('payments')}><AlertCircle/><strong>{money(m.outstanding)} outstanding</strong><span>Open Payments</span></button>}</div></section>}
      {m.maintenanceSoon.length>0&&<section className="panel"><div className="section-head"><div><span className="eyebrow">UPCOMING</span><h2>Maintenance follow-up</h2></div></div><div className="mini-list">{m.maintenanceSoon.map(s=><div key={s.id}><div><strong>{customerLabel(s.customers)}</strong><span>{s.service_type}</span></div><strong>{shortDate(s.next_maintenance_date)}</strong></div>)}</div></section>}
    </>}
  </div>
}
