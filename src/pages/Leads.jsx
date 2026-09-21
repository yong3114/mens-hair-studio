import React,{useEffect,useMemo,useState} from 'react'
import { Plus, Search, MessageCircle, Trash2, AtSign, CalendarPlus, ChevronRight, Clock3, Save, History, PhoneCall } from 'lucide-react'
import { listLeads, saveLead, deleteLead, listLeadFollowups, logLeadFollowup } from '../lib/api'
import { Badge, Empty, Field, Drawer, Stat } from '../components/UI'
import { dateTime, leadLabel, localDateKey, money, shortDate } from '../lib/utils'

const blank={whatsapp_name:'',name:'',phone:'',area:'',source:'Meta Ads',stage:'new',follow_up_date:'',potential_value:'',concern:'',notes:'',lost_reason:''}
const editableStages=['new','contacted','interested','follow_up','lost']
const stageLabel=v=>({new:'New',contacted:'Contacted',interested:'Interested',consultation_booked:'Consultation booked',consultation_done:'Consultation done',follow_up:'Follow up',signed:'Signed',lost:'Lost'}[v]||v)
const stageTone=v=>v==='signed'?'success':v==='follow_up'?'warn':v==='lost'?'danger':v==='interested'?'success':'neutral'
const followBlank={channel:'WhatsApp',stage:'follow_up',note:'',next_follow_up_date:''}
const clean=v=>String(v??'').trim()||null

export default function Leads({onBookConsultation}){
 const[rows,setRows]=useState([]),[q,setQ]=useState(''),[filter,setFilter]=useState('open')
 const[open,setOpen]=useState(false),[form,setForm]=useState(blank),[editing,setEditing]=useState(null),[history,setHistory]=useState([])
 const[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[follow,setFollow]=useState(followBlank),[followBusy,setFollowBusy]=useState(false)
 const today=localDateKey(new Date())
 const load=()=>listLeads().then(setRows)
 useEffect(()=>{load()},[])

 const filtered=useMemo(()=>rows.filter(x=>{
   const text=`${x.whatsapp_name||''} ${x.name||''} ${x.phone||''} ${x.area||''} ${x.source||''}`.toLowerCase()
   if(!text.includes(q.toLowerCase()))return false
   if(filter==='all')return true
   if(filter==='open')return !['signed','lost'].includes(x.stage)
   if(filter==='due')return !!x.follow_up_date&&x.follow_up_date<=today&&!['signed','lost'].includes(x.stage)
   return x.stage===filter
 }),[rows,q,filter,today])

 const stats=useMemo(()=>({
   open:rows.filter(x=>!['signed','lost'].includes(x.stage)).length,
   due:rows.filter(x=>x.follow_up_date&&x.follow_up_date<=today&&!['signed','lost'].includes(x.stage)).length,
   booked:rows.filter(x=>x.stage==='consultation_booked').length,
   signed:rows.filter(x=>x.stage==='signed').length
 }),[rows,today])

 const openNew=()=>{setEditing(null);setForm(blank);setHistory([]);setFollow(followBlank);setError('');setNotice('');setOpen(true)}
 const openLead=async x=>{setEditing(x.id);setForm({...blank,...x,potential_value:x.potential_value??''});setFollow(followBlank);setError('');setNotice('');setOpen(true);try{setHistory(await listLeadFollowups(x.id))}catch{setHistory([])}}

 const buildPayload=()=>{
   let stage=form.stage||'new'
   const followDate=!['signed','lost'].includes(stage)?(form.follow_up_date||null):null
   if(followDate&&['new','contacted','interested','follow_up'].includes(stage))stage='follow_up'
   return {
     whatsapp_name:clean(form.whatsapp_name),name:clean(form.name),phone:clean(form.phone),area:clean(form.area),source:form.source||'Other',stage,
     follow_up_date:followDate,potential_value:Number(form.potential_value||0),concern:clean(form.concern),notes:clean(form.notes),lost_reason:stage==='lost'?clean(form.lost_reason):null
   }
 }

 const submit=async e=>{e.preventDefault();setError('');setNotice('');if(!clean(form.whatsapp_name)&&!clean(form.name)&&!clean(form.phone)){setError('Add at least a WhatsApp/display name, real name, or phone number.');return}setBusy(true);try{const saved=await saveLead(buildPayload(),editing);setEditing(saved.id);setForm({...blank,...saved,potential_value:saved.potential_value??''});await load();setNotice('Lead saved');setTimeout(()=>setNotice(''),2200)}catch(e){setError(e.message||'Could not save lead.')}finally{setBusy(false)}}

 const logFollow=async()=>{if(!editing)return;setError('');if(!clean(follow.note)&&!follow.next_follow_up_date){setError('Add a follow-up note or choose the next follow-up date.');return}setFollowBusy(true);try{await logLeadFollowup(editing,{note:follow.note,next_follow_up_date:follow.next_follow_up_date||null,channel:follow.channel,stage:follow.stage});const [fresh,h]=await Promise.all([listLeads(),listLeadFollowups(editing)]);setRows(fresh);const current=fresh.find(x=>x.id===editing);if(current)setForm({...blank,...current,potential_value:current.potential_value??''});setHistory(h);setFollow(followBlank);setNotice('Follow-up logged');setTimeout(()=>setNotice(''),2200)}catch(e){setError(e.message||'Could not log follow-up.')}finally{setFollowBusy(false)}}

 const remove=async()=>{if(!editing)return;if(!confirm('Delete this lead and its consultation bookings?'))return;setBusy(true);try{await deleteLead(editing);setOpen(false);await load()}catch(e){setError(e.message)}finally{setBusy(false)}}
 const current=editing?rows.find(x=>x.id===editing):null
 const overdue=x=>!!x.follow_up_date&&x.follow_up_date<today&&!['signed','lost'].includes(x.stage)
 const dueToday=x=>!!x.follow_up_date&&x.follow_up_date===today&&!['signed','lost'].includes(x.stage)
 const nextAction=x=>x.stage==='signed'?'Converted to client':x.stage==='lost'?'Closed':x.stage==='consultation_booked'?'Consultation booked':overdue(x)?`Overdue · ${shortDate(x.follow_up_date)}`:dueToday(x)?'Follow up today':x.follow_up_date?`Follow up ${shortDate(x.follow_up_date)}`:'No follow-up set'

 return <div className="page leads-page">
  <div className="page-head"><div><span className="eyebrow">SALES CRM</span><h1>Leads</h1><p>Capture what you know, follow up clearly, then book consultation. Signed clients are created only after the consultation outcome.</p></div><button className="btn btn-primary" onClick={openNew}><Plus size={18}/>New lead</button></div>

  <div className="lead-stats"><Stat label="Open leads" value={stats.open}/><Stat label="Follow-up due" value={stats.due} tone={stats.due?'warn':'default'}/><Stat label="Consultations booked" value={stats.booked}/><Stat label="Signed" value={stats.signed} tone="success"/></div>

  <div className="lead-workflow-strip"><span>Lead</span><b>→</b><span>Follow up</span><b>→</b><span>Consultation</span><b>→</b><span>Signed / Lost</span></div>

  <div className="toolbar leads-toolbar"><div className="search"><Search size={18}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search WhatsApp name, name, phone, area..."/></div><select className="lead-filter" value={filter} onChange={e=>setFilter(e.target.value)}><option value="open">Open leads</option><option value="due">Follow-up due</option><option value="all">All leads</option><option value="new">New</option><option value="contacted">Contacted</option><option value="interested">Interested</option><option value="consultation_booked">Consultation booked</option><option value="follow_up">Follow up</option><option value="signed">Signed</option><option value="lost">Lost</option></select><span className="toolbar-count">{filtered.length} leads</span></div>

  <section className="panel table-panel lead-table-panel">{filtered.length?<div className="responsive-table"><table className="lead-table"><thead><tr><th>Lead</th><th>Status</th><th>Next action</th><th>Last contact</th><th>Source</th><th>Potential</th><th></th></tr></thead><tbody>{filtered.map(x=><tr key={x.id} className={`clickable-row ${overdue(x)?'row-overdue':''}`} tabIndex="0" onClick={()=>openLead(x)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openLead(x)}}}><td data-label="Lead"><div className="lead-identity"><strong>{leadLabel(x)}</strong>{x.name&&x.whatsapp_name&&<span>{x.name}</span>}<span>{x.phone||'Phone not captured'}{x.area?` · ${x.area}`:''}</span></div></td><td data-label="Status"><Badge tone={stageTone(x.stage)}>{stageLabel(x.stage)}</Badge></td><td data-label="Next action"><div className={`lead-next ${overdue(x)?'danger':dueToday(x)?'warn':''}`}><Clock3 size={14}/><span>{nextAction(x)}</span></div></td><td data-label="Last contact">{x.last_contacted_at?dateTime(x.last_contacted_at):'—'}</td><td data-label="Source">{x.source||'—'}</td><td data-label="Potential">{money(x.potential_value)}</td><td className="row-actions lead-row-actions"><div>{x.phone&&<a className="icon-btn" href={`https://wa.me/6${String(x.phone).replace(/\D/g,'').replace(/^6/,'')}`} target="_blank" rel="noreferrer" title="WhatsApp" onClick={e=>e.stopPropagation()}><MessageCircle size={17}/></a>}{!['signed','lost'].includes(x.stage)&&<button className="icon-btn success" onClick={e=>{e.stopPropagation();onBookConsultation?.(x)}} title="Book consultation"><CalendarPlus size={17}/></button>}<ChevronRight size={18}/></div></td></tr>)}</tbody></table></div>:<Empty title="No leads found" text={q||filter!=='open'?'Try another search or filter.':'A WhatsApp display name is enough to start.'}/>}</section>

  <Drawer open={open} onClose={()=>setOpen(false)} title={editing?'Lead details':'New lead'} eyebrow="SALES CRM"><form className="form-grid lead-drawer-form" onSubmit={submit}>
   {error&&<div className="notice danger span-2">{error}</div>}{notice&&<div className="notice success span-2">{notice}</div>}
   {editing&&<div className="lead-detail-hero span-2"><div><span className="eyebrow">LEAD</span><h3>{leadLabel(form)}</h3><p>{form.phone||'No phone yet'}{form.area?` · ${form.area}`:''}</p></div><Badge tone={stageTone(form.stage)}>{stageLabel(form.stage)}</Badge></div>}
   <Field label="WhatsApp / display name" hint="Usually the first identity you know from WhatsApp or ads."><div className="input-icon"><AtSign size={17}/><input value={form.whatsapp_name||''} onChange={e=>setForm({...form,whatsapp_name:e.target.value})} placeholder="e.g. Jason Home"/></div></Field>
   <Field label="Real name (optional)"><input value={form.name||''} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Fill later if unknown"/></Field>
   <Field label="Phone / WhatsApp number"><input inputMode="tel" value={form.phone||''} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="Can be added later"/></Field>
   <Field label="Area"><input value={form.area||''} onChange={e=>setForm({...form,area:e.target.value})}/></Field>
   <Field label="Source"><select value={form.source||'Meta Ads'} onChange={e=>setForm({...form,source:e.target.value})}>{['Meta Ads','TikTok','Instagram','Xiaohongshu','WhatsApp','Referral','Walk-in','Other'].map(v=><option key={v}>{v}</option>)}</select></Field>
   <Field label="Stage">{['signed','consultation_booked','consultation_done'].includes(form.stage)?<div className="status-readonly"><Badge tone={stageTone(form.stage)}>{stageLabel(form.stage)}</Badge><span>{form.stage==='signed'?'Managed by consultation outcome':'Managed by the consultation booking / outcome'}</span></div>:<select value={form.stage||'new'} onChange={e=>setForm({...form,stage:e.target.value,lost_reason:e.target.value==='lost'?form.lost_reason:''})}>{editableStages.map(v=><option key={v} value={v}>{stageLabel(v)}</option>)}</select>}</Field>
   <Field label="Next follow-up" hint="Set a date and this lead will be moved to Follow up automatically unless it is Signed/Lost."><input type="date" value={form.follow_up_date||''} onChange={e=>setForm({...form,follow_up_date:e.target.value})}/></Field>
   {form.stage==='lost'&&<Field label="Lost reason"><select value={form.lost_reason||''} onChange={e=>setForm({...form,lost_reason:e.target.value})}><option value="">Select reason</option>{['Price','Not ready','Competitor','Distance','Not suitable','No reply','Other'].map(x=><option key={x}>{x}</option>)}</select></Field>}
   <Field label="Potential value (RM)"><input type="number" min="0" value={form.potential_value??''} onChange={e=>setForm({...form,potential_value:e.target.value})}/></Field>
   <Field label="Hair concern"><input value={form.concern||''} onChange={e=>setForm({...form,concern:e.target.value})} placeholder="Thinning top / frontal / crown..."/></Field>
   <Field label="Lead notes"><textarea value={form.notes||''} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="General context about this lead"/></Field>

   {editing&&form.stage!=='signed'&&<div className="lead-followup-box span-2"><div className="section-head mini"><div><span className="eyebrow">FOLLOW-UP</span><h3>Log contact</h3><small className="section-helper">Every call or WhatsApp follow-up stays in the timeline.</small></div>{form.last_contacted_at&&<span className="last-contact">Last {dateTime(form.last_contacted_at)}</span>}</div><div className="followup-grid"><Field label="Channel"><select value={follow.channel} onChange={e=>setFollow({...follow,channel:e.target.value})}>{['WhatsApp','Call','Email','Instagram','Facebook','Walk-in','Other'].map(x=><option key={x}>{x}</option>)}</select></Field><Field label="Result"><select value={follow.stage} onChange={e=>setFollow({...follow,stage:e.target.value})}><option value="contacted">Contacted</option><option value="interested">Interested</option><option value="follow_up">Follow up</option></select></Field><Field label="Next follow-up"><input type="date" value={follow.next_follow_up_date} onChange={e=>setFollow({...follow,next_follow_up_date:e.target.value})}/></Field><Field label="Follow-up note"><textarea value={follow.note} onChange={e=>setFollow({...follow,note:e.target.value})} placeholder="What did the lead say? What should we do next?"/></Field></div><div className="followup-actions"><button type="button" className="btn btn-ghost" disabled={followBusy} onClick={logFollow}><PhoneCall size={16}/>{followBusy?'Saving...':'Log follow-up'}</button>{!['signed','lost'].includes(form.stage)&&<button type="button" className="btn btn-service" onClick={()=>{setOpen(false);onBookConsultation?.(current||form)}}><CalendarPlus size={16}/>Book consultation</button>}</div>{history.length>0&&<div className="followup-history"><div className="followup-history-title"><History size={15}/><strong>Follow-up history</strong></div>{history.map(h=><div className="followup-history-row" key={h.id}><div><strong>{h.channel}</strong><span>{dateTime(h.contacted_at)} · {h.profiles?.full_name||'Admin'}</span></div><p>{h.note||'No note'}</p>{h.next_follow_up_date&&<small>Next: {shortDate(h.next_follow_up_date)}</small>}</div>)}</div>}</div>}

   <div className="form-actions lead-form-actions">{editing&&<button type="button" className="btn btn-danger-ghost" disabled={busy} onClick={remove}><Trash2 size={16}/>Delete</button>}<span className="grow"/><button type="button" className="btn btn-ghost" onClick={()=>setOpen(false)}>Close</button><button disabled={busy} className="btn btn-primary"><Save size={16}/>{busy?'Saving...':'Save lead'}</button></div>
  </form></Drawer>
 </div>
}
