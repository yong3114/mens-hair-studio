import React,{useEffect,useMemo,useState} from 'react'
import { Plus, Search, MessageCircle, ChevronRight, MapPin } from 'lucide-react'
import { listCustomers, saveCustomer } from '../lib/api'
import { Empty, Field, Modal, Badge } from '../components/UI'
import PlaceAutocomplete from '../components/PlaceAutocomplete'
import { shortDate, mapsUrl } from '../lib/utils'

const blank={name:'',phone:'',email:'',area:'',address:'',place_name:'',google_place_id:'',lat:null,lng:null,google_maps_url:'',notes:'',status:'active'}
export default function Customers({onOpen}){
 const [rows,setRows]=useState([]),[q,setQ]=useState(''),[open,setOpen]=useState(false),[form,setForm]=useState(blank),[busy,setBusy]=useState(false)
 const load=()=>listCustomers().then(setRows); useEffect(()=>{load()},[])
 const filtered=useMemo(()=>rows.filter(x=>`${x.name} ${x.phone} ${x.area} ${x.address}`.toLowerCase().includes(q.toLowerCase())),[rows,q])
 const placeValue={place_name:form.place_name,formatted_address:form.address,google_place_id:form.google_place_id,lat:form.lat,lng:form.lng,google_maps_url:form.google_maps_url}
 const submit=async e=>{e.preventDefault();setBusy(true);try{const c=await saveCustomer({...form,lat:form.lat||null,lng:form.lng||null});setOpen(false);setForm(blank);await load();onOpen?.(c.id)}finally{setBusy(false)}}
 return <div className="page"><div className="page-head"><div><span className="eyebrow">CUSTOMERS</span><h1>Customers</h1><p>One clean profile for service, hair system, payment and maintenance.</p></div><button className="btn btn-primary" onClick={()=>{setForm(blank);setOpen(true)}}><Plus size={17}/>New customer</button></div>
 <div className="toolbar"><div className="search"><Search size={17}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search customer, phone, area..."/></div><span className="toolbar-count">{filtered.length} customers</span></div>
 <section className="panel customer-grid-panel">{filtered.length?<div className="customer-grid">{filtered.map(x=><button className="customer-card" key={x.id} onClick={()=>onOpen?.(x.id)}><div className="customer-card-top"><div className="avatar large">{x.name?.[0]||'C'}</div><div className="grow"><strong>{x.name}</strong><span>{x.phone||'No phone'} · {x.area||'No area'}</span></div><ChevronRight size={18}/></div><div className="customer-card-meta"><span><MapPin size={15}/>{x.place_name||x.address||'No address saved'}</span><span>Since {shortDate(x.created_at)}</span></div></button>)}</div>:<Empty title="No customers yet" text="Convert a lead or add a customer manually."/>}</section>
 <Modal open={open} onClose={()=>setOpen(false)} title="New customer" wide><form className="form-grid" onSubmit={submit}><Field label="Name"><input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></Field><Field label="Phone / WhatsApp"><input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></Field><Field label="Email"><input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></Field><Field label="Area"><input value={form.area} onChange={e=>setForm({...form,area:e.target.value})}/></Field><div className="span-2"><PlaceAutocomplete value={placeValue} onChange={p=>setForm({...form,address:p.formatted_address,place_name:p.place_name,google_place_id:p.google_place_id,lat:p.lat,lng:p.lng,google_maps_url:p.google_maps_url})}/></div><Field label="Full address (manual / backup)"><textarea value={form.address} onChange={e=>setForm({...form,address:e.target.value})}/></Field><Field label="Notes"><textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></Field><div className="form-actions"><button type="button" className="btn btn-ghost" onClick={()=>setOpen(false)}>Cancel</button><button className="btn btn-primary" disabled={busy}>{busy?'Saving...':'Create customer'}</button></div></form></Modal>
 </div>
}
