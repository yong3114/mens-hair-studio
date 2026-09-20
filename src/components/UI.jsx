import React from 'react'
import { X } from 'lucide-react'
import { classNames } from '../lib/utils'

export function Badge({children,tone='neutral'}){return <span className={`badge badge-${tone}`}>{children}</span>}
export function Empty({title='Nothing here yet',text='Add your first record to get started.'}){return <div className="empty"><div className="empty-dot"/><h3>{title}</h3><p>{text}</p></div>}
export function Modal({open,onClose,title,children,wide=false}){
  if(!open)return null
  return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose?.()}><div className={classNames('modal',wide&&'modal-wide')} role="dialog" aria-modal="true"><div className="modal-head"><h2>{title}</h2><button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><X size={20}/></button></div><div className="modal-body">{children}</div></div></div>
}

export function Drawer({open,onClose,title,children}){
  if(!open)return null
  return <div className="drawer-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose?.()}><aside className="drawer" role="dialog" aria-modal="true"><div className="drawer-head"><div><span className="eyebrow">BOOKING</span><h2>{title}</h2></div><button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><X size={20}/></button></div><div className="drawer-body">{children}</div></aside></div>
}
export function Field({label,children,hint}){return <label className="field"><span className="field-label">{label}</span>{children}{hint&&<span className="hint">{hint}</span>}</label>}
export function Stat({label,value,sub,tone='default'}){return <div className={`stat-card stat-${tone}`}><span>{label}</span><strong>{value}</strong>{sub&&<small>{sub}</small>}</div>}
export function Tabs({value,onChange,items}){return <div className="tabs">{items.map(x=><button type="button" key={x.value} className={value===x.value?'active':''} onClick={()=>onChange(x.value)}>{x.label}</button>)}</div>}
