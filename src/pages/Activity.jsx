import React,{useEffect,useState} from 'react'
import { listActivity } from '../lib/api'
import { Empty,Badge } from '../components/UI'
import { dateTime } from '../lib/utils'
export default function Activity(){const[rows,setRows]=useState([]);useEffect(()=>{listActivity().then(setRows)},[]);return <div className="page"><div className="page-head"><div><span className="eyebrow">AUDIT</span><h1>Activity</h1><p>See what Yong or Ah Bi changed and when.</p></div></div><section className="panel">{rows.length?<div className="timeline-list">{rows.map(x=><div className="timeline-item" key={x.id}><div className="timeline-dot"/><div className="grow"><strong>{x.profiles?.full_name||'System'} · {x.action}</strong><span>{x.entity_type} · {dateTime(x.created_at)}</span>{x.details&&<small>{typeof x.details==='string'?x.details:JSON.stringify(x.details)}</small>}</div><Badge>{x.action}</Badge></div>)}</div>:<Empty title="No activity yet"/>}</section></div>}
