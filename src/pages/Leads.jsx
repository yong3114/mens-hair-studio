import React,{useEffect,useMemo,useState} from 'react'
import { Plus, Search, MessageCircle, Trash2, AtSign, CalendarPlus, ChevronRight, Clock3, Save, History } from 'lucide-react'
import { listLeads, saveLead, deleteLead, listLeadFollowups, logLeadContact } from '../lib/api'
import { Badge, Empty, Field, Drawer, Stat } from '../components/UI'
import { dateTime, leadLabel, localDateKey, shortDate } from '../lib/utils'

const blank={whatsapp_name:'',name:'',phone:'',area:'',source:'Meta Ads',stage:'new',interest_status:'unknown',follow_up_date:'',potential_value:'',concern:'',notes:'',lost_reason:''}
const manualStages=['new','contacted','lost']
const stageLabel=v=>({new:'New',contacted:'In discussion',consultation_booked:'Consult booked',consultation_done:'In discussion',signed:'Signed',lost:'Lost'}[v]||v)
const stageTone=v=>v==='signed'?'success':v==='lost'?'danger':v==='consultation_booked'?'warn':'neutral'
const updateBlank={note:'',next_follow_up_date:''}
const clean=v=>String(v??'').trim()||null

export default function Leads({onBookConsultation}){
 const[rows,setRows]=useState([]),[q,setQ]=useState(''),[filter,setFilter]=useState('all')
 const[open,setOpen]=useState(false),[form,setForm]=useState(blank),[editing,setEditing]=useState(null),[history,setHistory]=useState([])
 const[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[update,setUpdate]=useState(updateBlank),[updateBusy,setUpdateBusy]=useState(false)
 const today=localDateKey(new Date())
 const load=()=>listLeads().then(setRows)
 useEffect(()=>{load()},[])

 const normalizedStage=x=>x?.stage==='consultation_done'?'contacted':x?.stage
 const isOpen=x=>!['signed','lost'].includes(normalizedStage(x))
 const isFollowupDue=x=>isOpen(x)&&!!x.follow_up_date&&x.follow_up_date<=today

 const filtered=useMemo(()=>rows.filter(x=>{
   const text=`${x.whatsapp_name||''} ${x.name||''} ${x.phone||''} ${x.area||''} ${x.source||''}`.toLowerCase()
   const stage=normalizedStage(x)
   if(!text.includes(q.toLowerCase()))return false
   if(filter==='all')return true
   if(filter==='new')return stage==='new'
   if(filter==='discussion')return stage==='contacted'
   if(filter==='followup')return isOpen(x)&&!!x.follow_up_date
   if(filter==='consultation')return stage==='consultation_booked'
   if(filter==='signed')return stage==='signed'
   if(filter==='lost')return stage==='lost'
   return true
 }),[rows,q,filter,today])

 const stats=useMemo(()=>({
   new:rows.filter(x=>normalizedStage(x)==='new').length,
   discussion:rows.filter(x=>normalizedStage(x)==='contacted').length,
   due:rows.filter(isFollowupDue).length,
   consultation:rows.filter(x=>normalizedStage(x)==='consultation_booked').length
 }),[rows,today])

 const openNew=()=>{setEditing(null);setForm(blank);setHistory([]);setUpdate(updateBlank);setError('');setNotice('');setOpen(true)}
 const openLead=async x=>{setEditing(x.id);setForm({...blank,...x,stage:normalizedStage(x),potential_value:x.potential_value??''});setUpdate(updateBlank);setError('');setNotice('');setOpen(true);try{setHistory(await listLeadFollowups(x.id))}catch{setHistory([])}}

 const buildPayload=()=>({
   whatsapp_name:clean(form.whatsapp_name),
   name:clean(form.name),
   phone:clean(form.phone),
   area:clean(form.area),
   source:form.source||'Other',
   stage:form.stage||'new',
   interest_status:form.interest_status||'unknown',
   follow_up_date:['signed','lost'].includes(form.stage)?null:(form.follow_up_date||null),
   potential_value:Number(form.potential_value||0),
   concern:clean(form.concern),
   notes:clean(form.notes),
   lost_reason:form.stage==='lost'?clean(form.lost_reason):null
 })

 const submit=async e=>{
   e.preventDefault()
   setError('');setNotice('')
   if(!clean(form.whatsapp_name)&&!clean(form.name)&&!clean(form.phone)){setError('Add at least a WhatsApp/display name, real name, or phone number.');return}
   setBusy(true)
   try{
     const saved=await saveLead(buildPayload(),editing)
     setEditing(saved.id)
     setForm({...blank,...saved,stage:normalizedStage(saved),potential_value:saved.potential_value??''})
     await load()
     setNotice('Lead saved')
     setTimeout(()=>setNotice(''),2200)
   }catch(e){setError(e.message||'Could not save lead.')}
   finally{setBusy(false)}
 }

 const saveUpdate=async()=>{
   if(!editing)return
   setError('')
   if(!clean(update.note)&&!update.next_follow_up_date){setError('Add a note or choose the next follow-up date.');return}
   setUpdateBusy(true)
   try{
     await logLeadContact(editing,{note:update.note,next_follow_up_date:update.next_follow_up_date||null,channel:'WhatsApp',outcome:'general'})
     const[fresh,h]=await Promise.all([listLeads(),listLeadFollowups(editing)])
     setRows(fresh)
     const current=fresh.find(x=>x.id===editing)
     if(current)setForm({...blank,...current,stage:normalizedStage(current),potential_value:current.potential_value??''})
     setHistory(h)
     setUpdate(updateBlank)
     setNotice('Update saved')
     setTimeout(()=>setNotice(''),2200)
   }catch(e){setError(e.message||'Could not save update.')}
   finally{setUpdateBusy(false)}
 }

 const remove=async()=>{if(!editing)return;if(!confirm('Delete this lead and its consultation bookings?'))return;setBusy(true);try{await deleteLead(editing);setOpen(false);await load()}catch(e){setError(e.message)}finally{setBusy(false)}}
 const current=editing?rows.find(x=>x.id===editing):null
 const overdue=x=>!!x.follow_up_date&&x.follow_up_date<today&&isOpen(x)
 const dueToday=x=>!!x.follow_up_date&&x.follow_up_date===today&&isOpen(x)
 const followupText=x=>overdue(x)?`Overdue · ${shortDate(x.follow_up_date)}`:dueToday(x)?'Today':x.follow_up_date?shortDate(x.follow_up_date):'—'
 const systemManaged=['consultation_booked','signed'].includes(form.stage)

 return <div className="page leads-page">
  <div className="page-head"><div><span className="eyebrow">SALES CRM</span><h1>Leads</h1><p>One status tells you where the lead is. Follow-up is only the next date you need to chase.</p></div><button className="btn btn-primary" onClick={openNew}><Plus size={18}/>New lead</button></div>

  <div className="lead-stats"><Stat label="New" value={stats.new} sub="Just came in"/><Stat label="In discussion" value={stats.discussion} sub="Talking / considering"/><Stat label="Follow-up due" value={stats.due} sub="Needs attention" tone={stats.due?'warn':'default'}/><Stat label="Consult booked" value={stats.consultation} sub="Waiting for consultation"/></div>

  <div className="lead-filter-tabs" role="tablist">
   {[['all','All'],['new','New'],['discussion','In discussion'],['followup','Follow-up'],['consultation','Consult booked'],['signed','Signed'],['lost','Lost']].map(([v,label])=><button key={v} className={filter===v?'active':''} onClick={()=>setFilter(v)}>{label}</button>)}
  </div>

  <div className="toolbar leads-toolbar"><div className="search"><Search size={18}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search WhatsApp name, name, phone, area..."/></div><span className="toolbar-count">{filtered.length} leads</span></div>

  <section className="panel table-panel lead-table-panel">{filtered.length?<div className="responsive-table"><table className="lead-table"><thead><tr><th>Lead</th><th>Status</th><th>Next follow-up</th><th>Lead since</th><th>Source</th><th></th></tr></thead><tbody>{filtered.map(x=><tr key={x.id} className={`clickable-row ${overdue(x)?'row-overdue':''}`} tabIndex="0" onClick={()=>openLead(x)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openLead(x)}}}><td data-label="Lead"><div className="lead-identity"><strong>{leadLabel(x)}</strong>{x.name&&x.whatsapp_name&&<span>{x.name}</span>}<span>{x.phone||'Phone not captured'}{x.area?` · ${x.area}`:''}</span></div></td><td data-label="Status"><Badge tone={stageTone(normalizedStage(x))}>{stageLabel(normalizedStage(x))}</Badge></td><td data-label="Next follow-up"><div className={`lead-next ${overdue(x)?'danger':dueToday(x)?'warn':''}`}><Clock3 size={14}/><span>{followupText(x)}</span></div></td><td data-label="Lead since">{dateTime(x.created_at)}</td><td data-label="Source">{x.source||'—'}</td><td className="row-actions lead-row-actions"><div>{x.phone&&<a className="icon-btn" href={`https://wa.me/6${String(x.phone).replace(/\D/g,'').replace(/^6/,'')}`} target="_blank" rel="noreferrer" title="WhatsApp" onClick={e=>e.stopPropagation()}><MessageCircle size={17}/></a>}{!['signed','lost'].includes(normalizedStage(x))&&<button className="icon-btn success" onClick={e=>{e.stopPropagation();onBookConsultation?.(x)}} title="Book consultation"><CalendarPlus size={17}/></button>}<ChevronRight size={18}/></div></td></tr>)}</tbody></table></div>:<Empty title="No leads found" text={q||filter!=='all'?'Try another search or filter.':'A WhatsApp display name is enough to start.'}/>}</section>

  <Drawer open={open} onClose={()=>setOpen(false)} title={editing?'Lead details':'New lead'} eyebrow="SALES CRM"><form className="form-grid lead-drawer-form" onSubmit={submit}>
   {error&&<div className="notice danger span-2">{error}</div>}{notice&&<div className="notice success span-2">{notice}</div>}

   {editing&&<div className="lead-detail-hero span-2"><div><span className="eyebrow">LEAD</span><h3>{leadLabel(form)}</h3><p>{form.phone||'No phone yet'}{form.area?` · ${form.area}`:''}</p><small>Lead since {dateTime(form.created_at)}</small></div><div className="lead-hero-badges"><Badge tone={stageTone(form.stage)}>{stageLabel(form.stage)}</Badge></div></div>}

   <div className="lead-status-card span-2">
    <div>
     <span className="eyebrow">PROGRESS</span>
     <h3>Where is this lead now?</h3>
     <p>Keep one simple status. Booking and signing update it automatically.</p>
    </div>
    <div className="lead-progress-fields">
     <Field label="Status">
      {systemManaged
       ? <div className="status-readonly">
          <Badge tone={stageTone(form.stage)}>{stageLabel(form.stage)}</Badge>
          <span className="status-readonly-note">{form.stage==='signed'?'Updated automatically when the deal is signed.':'Updated automatically from the consultation booking.'}</span>
         </div>
       : <select value={form.stage||'new'} onChange={e=>setForm({...form,stage:e.target.value,lost_reason:e.target.value==='lost'?form.lost_reason:'',follow_up_date:e.target.value==='lost'?'':form.follow_up_date})}>
          {manualStages.map(v=><option key={v} value={v}>{stageLabel(v)}</option>)}
         </select>}
     </Field>
     <Field label="Follow up on" hint="Optional. Only set this when you really need to chase the lead.">
      <input type="date" value={form.follow_up_date||''} disabled={['signed','lost'].includes(form.stage)} onChange={e=>setForm({...form,follow_up_date:e.target.value})}/>
     </Field>
    </div>
   </div>

   <Field label="WhatsApp / display name" hint="Usually the first identity you know from WhatsApp or ads."><div className="input-icon"><AtSign size={17}/><input value={form.whatsapp_name||''} onChange={e=>setForm({...form,whatsapp_name:e.target.value})} placeholder="e.g. Jason"/></div></Field>
   <Field label="Real name (optional)"><input value={form.name||''} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Fill later if unknown"/></Field>
   <Field label="Phone / WhatsApp number"><input inputMode="tel" value={form.phone||''} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="Can be added later"/></Field>
   <Field label="Area"><input value={form.area||''} onChange={e=>setForm({...form,area:e.target.value})}/></Field>
   <Field label="Source"><select value={form.source||'Meta Ads'} onChange={e=>setForm({...form,source:e.target.value})}>{['Meta Ads','TikTok','Instagram','Xiaohongshu','WhatsApp','Referral','Walk-in','Other'].map(v=><option key={v}>{v}</option>)}</select></Field>
   <Field label="Hair concern"><input value={form.concern||''} onChange={e=>setForm({...form,concern:e.target.value})} placeholder="Thinning top / frontal / crown..."/></Field>
   <Field label="Lead notes"><textarea value={form.notes||''} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Anything important about this lead"/></Field>
   {form.stage==='lost'&&<Field label="Lost reason"><select value={form.lost_reason||''} onChange={e=>setForm({...form,lost_reason:e.target.value})}><option value="">Select reason</option>{['Price','Not ready','Competitor','Distance','Not suitable','No reply','Other'].map(x=><option key={x}>{x}</option>)}</select></Field>}

   {editing&&!['signed','lost'].includes(form.stage)&&<div className="lead-followup-box span-2">
    <div className="section-head mini">
     <div>
      <span className="eyebrow">UPDATES</span>
      <h3>Add note / next follow-up</h3>
      <small className="section-helper">Record what matters, then choose when you want to follow up again.</small>
     </div>
     {form.last_contacted_at&&<span className="last-contact">Last update {dateTime(form.last_contacted_at)}</span>}
    </div>

    <div className="followup-grid">
     <Field label="Update note">
      <textarea value={update.note} onChange={e=>setUpdate({...update,note:e.target.value})} placeholder="e.g. Asked about price, wants to discuss with wife..."/>
     </Field>
     <Field label="Next follow-up" hint="Optional">
      <input type="date" value={update.next_follow_up_date} onChange={e=>setUpdate({...update,next_follow_up_date:e.target.value})}/>
     </Field>
    </div>

    <div className="followup-actions">
     <button type="button" className="btn btn-ghost" disabled={updateBusy} onClick={saveUpdate}><Save size={16}/>{updateBusy?'Saving...':'Save update'}</button>
     <button type="button" className="btn btn-service" onClick={()=>{setOpen(false);onBookConsultation?.(current||form)}}><CalendarPlus size={16}/>Book consultation</button>
    </div>

    {history.length>0&&<div className="followup-history">
     <div className="followup-history-title"><History size={15}/><strong>Update history</strong></div>
     <div className="lead-history-list">
      {history.map(h=><div className="lead-history-item" key={h.id}>
       <div className="lead-history-note">{h.note||'Follow-up updated'}</div>
       <div className="lead-history-meta">
        <span>{dateTime(h.contacted_at)} · {h.profiles?.full_name||'Admin'}</span>
        {h.next_follow_up_date&&<span className="lead-history-next">Next follow-up: {shortDate(h.next_follow_up_date)}</span>}
       </div>
      </div>)}
     </div>
    </div>}
   </div>}

   <div className="form-actions lead-form-actions">{editing&&<button type="button" className="btn btn-danger-ghost" disabled={busy} onClick={remove}><Trash2 size={16}/>Delete</button>}<span className="grow"/><button type="button" className="btn btn-ghost" onClick={()=>setOpen(false)}>Close</button><button disabled={busy} className="btn btn-primary"><Save size={16}/>{busy?'Saving...':'Save lead'}</button></div>
  </form></Drawer>
 </div>
}
