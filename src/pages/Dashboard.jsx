import React, { useEffect, useMemo, useState } from 'react'
import { CalendarPlus, UserPlus, PackagePlus, CreditCard, AlertCircle } from 'lucide-react'
import { getDashboard } from '../lib/api'
import { money, timeOnly } from '../lib/utils'
import { Badge, Empty, Stat } from '../components/UI'

export default function Dashboard({go}){
  const [d,setD]=useState(null); const [err,setErr]=useState('')
  useEffect(()=>{getDashboard().then(setD).catch(e=>setErr(e.message))},[])
  const m=useMemo(()=>{
    if(!d)return null
    const today=new Date().toISOString().slice(0,10)
    const todayAppts=d.appts.filter(x=>x.scheduled_at?.slice(0,10)===today && !['cancelled','no-show'].includes(x.status))
    const openLeads=d.leads.filter(x=>!['customer','lost'].includes(x.stage))
    const overdueLeads=openLeads.filter(x=>x.follow_up_date && x.follow_up_date<today)
    const low=d.consumables.filter(x=>Number(x.qty)<=Number(x.min_qty))
    const outstanding=d.payments.filter(x=>x.status==='outstanding').reduce((a,x)=>a+Number(x.amount||0),0)
    const sales=d.payments.filter(x=>(x.paid_at||x.created_at)?.slice(0,10)===today && x.status==='paid').reduce((a,x)=>a+Number(x.amount||0),0)
    return {todayAppts,openLeads,overdueLeads,low,outstanding,sales,available:d.systems.filter(x=>x.status==='available').length}
  },[d])
  return <div className="page">
    <div className="page-head"><div><span className="eyebrow">OPERATIONS</span><h1>Dashboard</h1><p>Everything important, without the clutter.</p></div><div className="page-actions"><button className="btn btn-primary" onClick={()=>go('appointments')}><CalendarPlus size={17}/>New booking</button></div></div>
    {err&&<div className="notice danger">{err}</div>}
    {!m?<div className="skeleton panel">Loading...</div>:<>
      <div className="stats-grid"><Stat label="Today's bookings" value={m.todayAppts.length} sub="Studio + home visits"/><Stat label="Open leads" value={m.openLeads.length} sub={`${m.overdueLeads.length} follow-up overdue`} tone={m.overdueLeads.length?'warn':'default'}/><Stat label="Sales today" value={money(m.sales)} sub="Paid transactions"/><Stat label="Outstanding" value={money(m.outstanding)} sub="Needs collection" tone={m.outstanding?'warn':'default'}/><Stat label="Available systems" value={m.available} sub="Ready to reserve"/><Stat label="Low stock" value={m.low.length} sub="Consumables at minimum" tone={m.low.length?'danger':'default'}/></div>
      <div className="dashboard-grid">
        <section className="panel"><div className="section-head"><div><span className="eyebrow">TODAY</span><h2>Schedule</h2></div><button className="text-btn" onClick={()=>go('appointments')}>View calendar</button></div>
          {m.todayAppts.length? <div className="schedule-list">{m.todayAppts.map(a=><div className="schedule-row" key={a.id}><div className="time-block">{timeOnly(a.scheduled_at)}</div><div className="grow"><strong>{a.customers?.name||'Customer'}</strong><span>{a.service_type} · {a.location_type==='home'?'Home visit':'Studio'}</span></div><Badge tone={a.status==='confirmed'?'success':'neutral'}>{a.status}</Badge></div>)}</div>:<Empty title="No appointments today" text="A quiet schedule. Use the time for follow-ups or stock work."/>}
        </section>
        <section className="panel"><div className="section-head"><div><span className="eyebrow">QUICK ACTIONS</span><h2>Do it fast</h2></div></div><div className="quick-grid"><button onClick={()=>go('leads')}><UserPlus/><span><strong>New lead</strong><small>Add enquiry & follow-up</small></span></button><button onClick={()=>go('appointments')}><CalendarPlus/><span><strong>New booking</strong><small>Studio or home visit</small></span></button><button onClick={()=>go('inventory')}><PackagePlus/><span><strong>Stock in</strong><small>Hair system / consumable</small></span></button><button onClick={()=>go('payments')}><CreditCard/><span><strong>Payment</strong><small>Collect or record balance</small></span></button></div></section>
      </div>
      {(m.overdueLeads.length||m.low.length||m.outstanding>0)&&<section className="panel attention"><div className="section-head"><div><span className="eyebrow">NEEDS ATTENTION</span><h2>Handle these next</h2></div></div><div className="attention-grid">{m.overdueLeads.length>0&&<button onClick={()=>go('leads')}><AlertCircle/><strong>{m.overdueLeads.length} overdue lead follow-up</strong><span>Open Leads</span></button>}{m.low.length>0&&<button onClick={()=>go('inventory')}><AlertCircle/><strong>{m.low.length} low-stock item</strong><span>Open Inventory</span></button>}{m.outstanding>0&&<button onClick={()=>go('payments')}><AlertCircle/><strong>{money(m.outstanding)} outstanding</strong><span>Open Payments</span></button>}</div></section>}
    </>}
  </div>
}
