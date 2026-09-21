import React,{useEffect,useMemo,useState} from 'react'
import { Plus, Search, MessageCircle, Trash2, AtSign, CalendarPlus, ChevronRight, Clock3, Save, History, PhoneCall, Flame, CircleDot } from 'lucide-react'
import { listLeads, saveLead, deleteLead, listLeadFollowups, logLeadContact } from '../lib/api'
import { Badge, Empty, Field, Drawer, Stat } from '../components/UI'
import { dateTime, leadLabel, localDateKey, shortDate } from '../lib/utils'

const blank={whatsapp_name:'',name:'',phone:'',area:'',source:'Meta Ads',stage:'new',interest_status:'unknown',follow_up_date:'',potential_value:'',concern:'',notes:'',lost_reason:''}
const manualStages=['new','contacted','consultation_booked','consultation_done','lost']
const stageLabel=v=>({new:'New',contacted:'Contacted',consultation_booked:'Consultation booked',consultation_done:'Consultation done',signed:'Signed',lost:'Lost'}[v]||v)
const stageTone=v=>v==='signed'?'success':v==='lost'?'danger':v==='consultation_booked'||v==='consultation_done'?'warn':'neutral'
const interestLabel=v=>({unknown:'Unknown',interested:'Interested',considering:'Considering',not_interested:'Not interested'}[v]||'Unknown')
const interestTone=v=>v==='interested'?'success':v==='considering'?'warn':v==='not_interested'?'danger':'neutral'
const contactBlank={channel:'WhatsApp',outcome:'general',note:'',next_follow_up_date:''}
const clean=v=>String(v??'').trim()||null

export default function Leads({onBookConsultation}){
 const[rows,setRows]=useState([]),[q,setQ]=useState(''),[filter,setFilter]=useState('all')
 const[open,setOpen]=useState(false),[form,setForm]=useState(blank),[editing,setEditing]=useState(null),[history,setHistory]=useState([])
 const[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[contact,setContact]=useState(contactBlank),[contactBusy,setContactBusy]=useState(false)
 const today=localDateKey(new Date())
 const load=()=>listLeads().then(setRows)
 useEffect(()=>{load()},[])

 const isOpen=x=>!['signed','lost'].includes(x.stage)
 const isFollowupDue=x=>isOpen(x)&&!!x.follow_up_date&&x.follow_up_date<=today
 const isConsultation=x=>['consultation_booked','consultation_done'].includes(x.stage)
 const isInterested=x=>isOpen(x)&&['interested','considering'].includes(x.interest_status||'unknown')

 const filtered=useMemo(()=>rows.filter(x=>{
   const text=`${x.whatsapp_name||''} ${x.name||''} ${x.phone||''} ${x.area||''} ${x.source||''}`.toLowerCase()
   if(!text.includes(q.toLowerCase()))return false
   if(filter==='all')return true
   if(filter==='new')return x.stage==='new'
   if(filter==='interested')return isInterested(x)
   if(filter==='followup')return isOpen(x)&&!!x.follow_up_date
   if(filter==='consultation')return isConsultation(x)
   if(filter==='lost')return x.stage==='lost'
   return true
 }),[rows,q,filter,today])

 const stats=useMemo(()=>({
   new:rows.filter(x=>x.stage==='new').length,
   interested:rows.filter(isInterested).length,
   due:rows.filter(isFollowupDue).length,
   consultation:rows.filter(isConsultation).length
 }),[rows,today])

 const openNew=()=>{setEditing(null);setForm(blank);setHistory([]);setContact(contactBlank);setError('');setNotice('');setOpen(true)}
 const openLead=async x=>{setEditing(x.id);setForm({...blank,...x,potential_value:x.potential_value??''});setContact(contactBlank);setError('');setNotice('');setOpen(true);try{setHistory(await listLeadFollowups(x.id))}catch{setHistory([])}}

 const buildPayload=()=>({
   whatsapp_name:clean(form.whatsapp_name),name:clean(form.name),phone:clean(form.phone),area:clean(form.area),source:form.source||'Other',
   stage:form.stage||'new',interest_status:form.interest_status||'unknown',follow_up_date:['signed','lost'].includes(form.stage)?null:(form.follow_up_date||null),
   potential_value:Number(form.potential_value||0),concern:clean(form.concern),notes:clean(form.notes),lost_reason:form.stage==='lost'?clean(form.lost_reason):null
 })

 const submit=async e=>{e.preventDefault();setError('');setNotice('');if(!clean(form.whatsapp_name)&&!clean(form.name)&&!clean(form.phone)){setError('Add at least a WhatsApp/display name, real name, or phone number.');return}if(form.stage==='signed'&&!editing){setError('Signed clients must come from a completed consultation.');return}setBusy(true);try{const saved=await saveLead(buildPayload(),editing);setEditing(saved.id);setForm({...blank,...saved,potential_value:saved.potential_value??''});await load();setNotice('Lead saved');setTimeout(()=>setNotice(''),2200)}catch(e){setError(e.message||'Could not save lead.')}finally{setBusy(false)}}

 const logContact=async()=>{if(!editing)return;setError('');if(!clean(contact.note)&&contact.outcome==='general'&&!contact.next_follow_up_date){setError('Add a note, choose a contact outcome, or set a follow-up date.');return}setContactBusy(true);try{await logLeadContact(editing,{note:contact.note,next_follow_up_date:contact.next_follow_up_date||null,channel:contact.channel,outcome:contact.outcome});const [fresh,h]=await Promise.all([listLeads(),listLeadFollowups(editing)]);setRows(fresh);const current=fresh.find(x=>x.id===editing);if(current)setForm({...blank,...current,potential_value:current.potential_value??''});setHistory(h);setContact(contactBlank);setNotice('Contact logged');setTimeout(()=>setNotice(''),2200)}catch(e){setError(e.message||'Could not log contact.')}finally{setContactBusy(false)}}

 const remove=async()=>{if(!editing)return;if(!confirm('Delete this lead and its consultation bookings?'))return;setBusy(true);try{await deleteLead(editing);setOpen(false);await load()}catch(e){setError(e.message)}finally{setBusy(false)}}
 const current=editing?rows.find(x=>x.id===editing):null
 const overdue=x=>!!x.follow_up_date&&x.follow_up_date<today&&isOpen(x)
 const dueToday=x=>!!x.follow_up_date&&x.follow_up_date===today&&isOpen(x)
 const nextAction=x=>x.stage==='signed'?'Converted to client':x.stage==='lost'?'Closed':x.stage==='consultation_booked'?'Consultation booked':overdue(x)?`Overdue · ${shortDate(x.follow_up_date)}`:dueToday(x)?'Follow up today':x.follow_up_date?`Follow up ${shortDate(x.follow_up_date)}`:x.stage==='consultation_done'?'Consultation completed':x.stage==='new'?'Contact lead':x.interest_status==='not_interested'?'Not interested · review':x.interest_status==='interested'?'Interested · no follow-up set':x.interest_status==='considering'?'Considering · no follow-up set':'No follow-up scheduled'

 return <div className="page leads-page">
  <div className="page-head"><div><span className="eyebrow">SALES CRM</span><h1>Leads</h1><p>Stage shows where the lead is in your sales process. Interest shows how warm they are. Follow-up is optional and only appears when you actually schedule one.</p></div><button className="btn btn-primary" onClick={openNew}><Plus size={18}/>New lead</button></div>

  <div className="lead-stats"><Stat label="New" value={stats.new} sub="Not contacted yet"/><Stat label="Interested" value={stats.interested} sub="Interested + considering" tone={stats.interested?'success':'default'}/><Stat label="Follow-up due" value={stats.due} sub="Only scheduled follow-ups" tone={stats.due?'warn':'default'}/><Stat label="Consultation" value={stats.consultation} sub="Booked or completed"/></div>

  <div className="lead-model-guide"><div><CircleDot size={15}/><span><strong>Stage</strong> = where they are</span></div><div><Flame size={15}/><span><strong>Interest</strong> = how warm they are</span></div><div><Clock3 size={15}/><span><strong>Follow-up</strong> = only when needed</span></div></div>

  <div className="lead-filter-tabs" role="tablist">
   {[['all','All'],['new','New'],['interested','Interested'],['followup','Follow-up'],['consultation','Consultation'],['lost','Lost']].map(([v,label])=><button key={v} className={filter===v?'active':''} onClick={()=>setFilter(v)}>{label}</button>)}
  </div>

  <div className="toolbar leads-toolbar"><div className="search"><Search size={18}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search WhatsApp name, name, phone, area..."/></div><span className="toolbar-count">{filtered.length} leads</span></div>

  <section className="panel table-panel lead-table-panel">{filtered.length?<div className="responsive-table"><table className="lead-table"><thead><tr><th>Lead</th><th>Stage</th><th>Interest</th><th>Next action</th><th>Last contact</th><th>Source</th><th></th></tr></thead><tbody>{filtered.map(x=><tr key={x.id} className={`clickable-row ${overdue(x)?'row-overdue':''}`} tabIndex="0" onClick={()=>openLead(x)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openLead(x)}}}><td data-label="Lead"><div className="lead-identity"><strong>{leadLabel(x)}</strong>{x.name&&x.whatsapp_name&&<span>{x.name}</span>}<span>{x.phone||'Phone not captured'}{x.area?` · ${x.area}`:''}</span></div></td><td data-label="Stage"><Badge tone={stageTone(x.stage)}>{stageLabel(x.stage)}</Badge></td><td data-label="Interest"><Badge tone={interestTone(x.interest_status)}>{interestLabel(x.interest_status)}</Badge></td><td data-label="Next action"><div className={`lead-next ${overdue(x)?'danger':dueToday(x)?'warn':''}`}><Clock3 size={14}/><span>{nextAction(x)}</span></div></td><td data-label="Last contact">{x.last_contacted_at?dateTime(x.last_contacted_at):'—'}</td><td data-label="Source">{x.source||'—'}</td><td className="row-actions lead-row-actions"><div>{x.phone&&<a className="icon-btn" href={`https://wa.me/6${String(x.phone).replace(/\D/g,'').replace(/^6/,'')}`} target="_blank" rel="noreferrer" title="WhatsApp" onClick={e=>e.stopPropagation()}><MessageCircle size={17}/></a>}{!['signed','lost'].includes(x.stage)&&<button className="icon-btn success" onClick={e=>{e.stopPropagation();onBookConsultation?.(x)}} title="Book consultation"><CalendarPlus size={17}/></button>}<ChevronRight size={18}/></div></td></tr>)}</tbody></table></div>:<Empty title="No leads found" text={q||filter!=='all'?'Try another search or filter.':'A WhatsApp display name is enough to start.'}/>}</section>

  <Drawer open={open} onClose={()=>setOpen(false)} title={editing?'Lead details':'New lead'} eyebrow="SALES CRM"><form className="form-grid lead-drawer-form" onSubmit={submit}>
   {error&&<div className="notice danger span-2">{error}</div>}{notice&&<div className="notice success span-2">{notice}</div>}
   {editing&&<div className="lead-detail-hero span-2"><div><span className="eyebrow">LEAD</span><h3>{leadLabel(form)}</h3><p>{form.phone||'No phone yet'}{form.area?` · ${form.area}`:''}</p></div><div className="lead-hero-badges"><Badge tone={stageTone(form.stage)}>{stageLabel(form.stage)}</Badge><Badge tone={interestTone(form.interest_status)}>{interestLabel(form.interest_status)}</Badge></div></div>}

   <div className="lead-status-card span-2"><div><span className="eyebrow">SALES STATUS</span><h3>Where is this lead now?</h3><p>Stage, interest and follow-up are separate. You can update each one without forcing the others to change.</p></div><div className="lead-status-grid"><Field label="Stage">{form.stage==='signed'?<div className="status-readonly"><Badge tone="success">Signed</Badge><span>Managed by the consultation outcome / signed deal.</span></div>:<select value={form.stage||'new'} onChange={e=>setForm({...form,stage:e.target.value,lost_reason:e.target.value==='lost'?form.lost_reason:'',follow_up_date:e.target.value==='lost'?'':form.follow_up_date})}>{manualStages.map(v=><option key={v} value={v}>{stageLabel(v)}</option>)}</select>}</Field><Field label="Interest"><select value={form.interest_status||'unknown'} onChange={e=>setForm({...form,interest_status:e.target.value})}>{['unknown','interested','considering','not_interested'].map(v=><option key={v} value={v}>{interestLabel(v)}</option>)}</select></Field><Field label="Next follow-up" hint="Optional. Leave blank if there is nothing to chase yet."><input type="date" value={form.follow_up_date||''} disabled={['signed','lost'].includes(form.stage)} onChange={e=>setForm({...form,follow_up_date:e.target.value})}/></Field></div></div>

   <Field label="WhatsApp / display name" hint="Usually the first identity you know from WhatsApp or ads."><div className="input-icon"><AtSign size={17}/><input value={form.whatsapp_name||''} onChange={e=>setForm({...form,whatsapp_name:e.target.value})} placeholder="e.g. Jason Home"/></div></Field>
   <Field label="Real name (optional)"><input value={form.name||''} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Fill later if unknown"/></Field>
   <Field label="Phone / WhatsApp number"><input inputMode="tel" value={form.phone||''} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="Can be added later"/></Field>
   <Field label="Area"><input value={form.area||''} onChange={e=>setForm({...form,area:e.target.value})}/></Field>
   <Field label="Source"><select value={form.source||'Meta Ads'} onChange={e=>setForm({...form,source:e.target.value})}>{['Meta Ads','TikTok','Instagram','Xiaohongshu','WhatsApp','Referral','Walk-in','Other'].map(v=><option key={v}>{v}</option>)}</select></Field>
   {form.stage==='lost'&&<Field label="Lost reason"><select value={form.lost_reason||''} onChange={e=>setForm({...form,lost_reason:e.target.value})}><option value="">Select reason</option>{['Price','Not ready','Competitor','Distance','Not suitable','No reply','Other'].map(x=><option key={x}>{x}</option>)}</select></Field>}
   <Field label="Potential value (RM)"><input type="number" min="0" value={form.potential_value??''} onChange={e=>setForm({...form,potential_value:e.target.value})}/></Field>
   <Field label="Hair concern"><input value={form.concern||''} onChange={e=>setForm({...form,concern:e.target.value})} placeholder="Thinning top / frontal / crown..."/></Field>
   <Field label="Lead notes"><textarea value={form.notes||''} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="General context about this lead"/></Field>

   {editing&&!['signed','lost'].includes(form.stage)&&<div className="lead-followup-box span-2"><div className="section-head mini"><div><span className="eyebrow">CONTACT LOG</span><h3>Log contact</h3><small className="section-helper">Record what happened. A next follow-up date is optional.</small></div>{form.last_contacted_at&&<span className="last-contact">Last {dateTime(form.last_contacted_at)}</span>}</div><div className="followup-grid"><Field label="Channel"><select value={contact.channel} onChange={e=>setContact({...contact,channel:e.target.value})}>{['WhatsApp','Call','Email','Instagram','Facebook','Walk-in','Other'].map(x=><option key={x}>{x}</option>)}</select></Field><Field label="Outcome"><select value={contact.outcome} onChange={e=>setContact({...contact,outcome:e.target.value})}><option value="general">General contact</option><option value="no_reply">No reply</option><option value="interested">Interested</option><option value="considering">Considering</option><option value="not_interested">Not interested</option></select></Field><Field label="Next follow-up" hint="Optional"><input type="date" value={contact.next_follow_up_date} onChange={e=>setContact({...contact,next_follow_up_date:e.target.value})}/></Field><Field label="Contact note"><textarea value={contact.note} onChange={e=>setContact({...contact,note:e.target.value})} placeholder="What did the lead say? What should we remember?"/></Field></div><div className="followup-actions"><button type="button" className="btn btn-ghost" disabled={contactBusy} onClick={logContact}><PhoneCall size={16}/>{contactBusy?'Saving...':'Log contact'}</button>{!['signed','lost'].includes(form.stage)&&<button type="button" className="btn btn-service" onClick={()=>{setOpen(false);onBookConsultation?.(current||form)}}><CalendarPlus size={16}/>Book consultation</button>}</div>{history.length>0&&<div className="followup-history"><div className="followup-history-title"><History size={15}/><strong>Contact history</strong></div>{history.map(h=><div className="followup-history-row" key={h.id}><div><strong>{h.channel} · {contactOutcomeLabel(h.outcome)}</strong><span>{dateTime(h.contacted_at)} · {h.profiles?.full_name||'Admin'}</span></div><p>{h.note||'No note'}</p><div className="history-meta">{h.interest_after&&<Badge tone={interestTone(h.interest_after)}>{interestLabel(h.interest_after)}</Badge>}{h.next_follow_up_date&&<small>Next: {shortDate(h.next_follow_up_date)}</small>}</div></div>)}</div>}</div>}

   <div className="form-actions lead-form-actions">{editing&&<button type="button" className="btn btn-danger-ghost" disabled={busy} onClick={remove}><Trash2 size={16}/>Delete</button>}<span className="grow"/><button type="button" className="btn btn-ghost" onClick={()=>setOpen(false)}>Close</button><button disabled={busy} className="btn btn-primary"><Save size={16}/>{busy?'Saving...':'Save lead'}</button></div>
  </form></Drawer>
 </div>
}

function contactOutcomeLabel(v){return ({general:'General',no_reply:'No reply',interested:'Interested',considering:'Considering',not_interested:'Not interested'}[v]||'General')}
