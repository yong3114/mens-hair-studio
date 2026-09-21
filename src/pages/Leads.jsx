import React,{useEffect,useMemo,useState} from 'react'
import { Plus, Search, MessageCircle, Pencil, Trash2, AtSign, CalendarPlus } from 'lucide-react'
import { listLeads, saveLead, deleteLead } from '../lib/api'
import { Badge, Empty, Field, Modal } from '../components/UI'
import { leadLabel, money, shortDate } from '../lib/utils'

const blank={whatsapp_name:'',name:'',phone:'',area:'',source:'Meta Ads',stage:'new',follow_up_date:'',potential_value:'',concern:'',notes:'',lost_reason:''}
const stages=['new','contacted','interested','consultation_booked','consultation_done','follow_up','signed','lost']
const stageLabel=v=>({new:'New',contacted:'Contacted',interested:'Interested',consultation_booked:'Consultation booked',consultation_done:'Consultation done',follow_up:'Follow up',signed:'Signed',lost:'Lost'}[v]||v)
const stageTone=v=>v==='signed'?'success':v==='follow_up'?'warn':v==='lost'?'danger':v==='interested'?'success':'neutral'

export default function Leads({onBookConsultation}){
 const[rows,setRows]=useState([]),[q,setQ]=useState(''),[open,setOpen]=useState(false),[form,setForm]=useState(blank),[editing,setEditing]=useState(null),[busy,setBusy]=useState(false)
 const load=()=>listLeads().then(setRows);useEffect(()=>{load()},[])
 const filtered=useMemo(()=>rows.filter(x=>`${x.whatsapp_name||''} ${x.name||''} ${x.phone||''} ${x.area||''} ${x.source||''}`.toLowerCase().includes(q.toLowerCase())),[rows,q])
 const edit=x=>{setEditing(x.id);setForm({...blank,...x});setOpen(true)}
 const submit=async e=>{e.preventDefault();if(!form.whatsapp_name.trim()&&!form.name.trim()&&!form.phone.trim()){alert('Add at least a WhatsApp name, real name, or phone number.');return}setBusy(true);try{await saveLead({...form,name:form.name.trim()||null,whatsapp_name:form.whatsapp_name.trim()||null,phone:form.phone.trim()||null,potential_value:Number(form.potential_value||0),follow_up_date:form.follow_up_date||null,lost_reason:form.lost_reason||null},editing);setOpen(false);setEditing(null);setForm(blank);await load()}finally{setBusy(false)}}
 return <div className="page"><div className="page-head"><div><span className="eyebrow">SALES CRM</span><h1>Leads</h1><p>A lead stays a prospect until the consultation is signed. Start with only the identity you actually know.</p></div><button className="btn btn-primary" onClick={()=>{setEditing(null);setForm(blank);setOpen(true)}}><Plus size={18}/>New lead</button></div>
  <div className="lead-workflow-strip"><span>Lead</span><b>→</b><span>Consultation</span><b>→</b><span>Signed / Follow up / Lost</span><b>→</b><span>Client</span></div>
  <div className="toolbar"><div className="search"><Search size={18}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search WhatsApp name, name, phone, area..."/></div><span className="toolbar-count">{filtered.length} leads</span></div>
  <section className="panel table-panel">{filtered.length?<div className="responsive-table"><table><thead><tr><th>Lead</th><th>Stage</th><th>Source</th><th>Follow-up</th><th>Potential</th><th></th></tr></thead><tbody>{filtered.map(x=>{const overdue=x.follow_up_date&&x.follow_up_date<new Date().toLocaleDateString('en-CA')&&x.stage==='follow_up';return <tr key={x.id}><td data-label="Lead"><div className="lead-identity"><strong>{leadLabel(x)}</strong>{x.name&&x.whatsapp_name&&<span>{x.name}</span>}<span>{x.phone||'Phone not captured yet'}{x.area?` · ${x.area}`:''}</span></div></td><td data-label="Stage"><Badge tone={stageTone(x.stage)}>{stageLabel(x.stage)}</Badge>{x.stage==='lost'&&x.lost_reason&&<small className="table-sub">{x.lost_reason}</small>}</td><td data-label="Source">{x.source}</td><td data-label="Follow-up"><span className={overdue?'text-danger':''}>{shortDate(x.follow_up_date)}</span></td><td data-label="Potential">{money(x.potential_value)}</td><td className="row-actions">{x.phone&&<a className="icon-btn" href={`https://wa.me/6${String(x.phone).replace(/\D/g,'').replace(/^6/,'')}`} target="_blank" rel="noreferrer" title="WhatsApp"><MessageCircle size={17}/></a>}{!['signed','lost'].includes(x.stage)&&<button className="icon-btn success" onClick={()=>onBookConsultation?.(x)} title="Book consultation"><CalendarPlus size={17}/></button>}<button className="icon-btn" onClick={()=>edit(x)} title="Edit"><Pencil size={17}/></button><button className="icon-btn danger" onClick={async()=>{if(confirm('Delete this lead?')){await deleteLead(x.id);load()}}} title="Delete"><Trash2 size={17}/></button></td></tr>})}</tbody></table></div>:<Empty title="No leads yet" text="A WhatsApp display name is enough to start."/>}</section>
  <Modal open={open} onClose={()=>setOpen(false)} title={editing?'Edit lead':'New lead'} wide><form className="form-grid" onSubmit={submit}>
   <Field label="WhatsApp / display name" hint="Usually the first identity you know from WhatsApp or ads."><div className="input-icon"><AtSign size={17}/><input autoFocus value={form.whatsapp_name||''} onChange={e=>setForm({...form,whatsapp_name:e.target.value})} placeholder="e.g. Jason Home"/></div></Field>
   <Field label="Real name (optional)"><input value={form.name||''} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Fill later if unknown"/></Field>
   <Field label="Phone / WhatsApp number (optional)"><input inputMode="tel" value={form.phone||''} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="Can be added later"/></Field>
   <Field label="Area"><input value={form.area||''} onChange={e=>setForm({...form,area:e.target.value})}/></Field>
   <Field label="Source"><select value={form.source} onChange={e=>setForm({...form,source:e.target.value})}>{['Meta Ads','TikTok','Instagram','Xiaohongshu','WhatsApp','Referral','Walk-in','Other'].map(v=><option key={v}>{v}</option>)}</select></Field>
   <Field label="Stage"><select value={form.stage} onChange={e=>setForm({...form,stage:e.target.value})}>{stages.map(v=><option key={v} value={v}>{stageLabel(v)}</option>)}</select></Field>
   {form.stage==='follow_up'&&<Field label="Follow-up date"><input type="date" value={form.follow_up_date||''} onChange={e=>setForm({...form,follow_up_date:e.target.value})}/></Field>}
   {form.stage==='lost'&&<Field label="Lost reason"><select value={form.lost_reason||''} onChange={e=>setForm({...form,lost_reason:e.target.value})}><option value="">Select reason</option>{['Price','Not ready','Competitor','Distance','Not suitable','No reply','Other'].map(x=><option key={x}>{x}</option>)}</select></Field>}
   <Field label="Potential value (RM)"><input type="number" min="0" value={form.potential_value} onChange={e=>setForm({...form,potential_value:e.target.value})}/></Field>
   <Field label="Hair concern"><input value={form.concern||''} onChange={e=>setForm({...form,concern:e.target.value})}/></Field>
   <Field label="Notes"><textarea value={form.notes||''} onChange={e=>setForm({...form,notes:e.target.value})}/></Field>
   <div className="form-actions"><button type="button" className="btn btn-ghost" onClick={()=>setOpen(false)}>Cancel</button><button disabled={busy} className="btn btn-primary">{busy?'Saving...':'Save lead'}</button></div>
  </form></Modal>
 </div>
}
