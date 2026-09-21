import React,{useEffect,useRef} from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { classNames } from '../lib/utils'

function useDialogEffects(open,onClose){
  const closeRef=useRef(onClose)
  closeRef.current=onClose
  useEffect(()=>{
    if(!open)return
    const body=document.body
    const html=document.documentElement
    const previousBodyOverflow=body.style.overflow
    const previousHtmlOverflow=html.style.overflow
    body.style.overflow='hidden'
    html.style.overflow='hidden'
    const onKey=e=>{if(e.key==='Escape')closeRef.current?.()}
    window.addEventListener('keydown',onKey)
    return()=>{
      body.style.overflow=previousBodyOverflow
      html.style.overflow=previousHtmlOverflow
      window.removeEventListener('keydown',onKey)
    }
  },[open])
}

export function Badge({children,tone='neutral'}){return <span className={`badge badge-${tone}`}>{children}</span>}
export function Empty({title='Nothing here yet',text='Add your first record to get started.'}){return <div className="empty"><div className="empty-dot"/><h3>{title}</h3><p>{text}</p></div>}

export function Modal({open,onClose,title,children,wide=false}){
  useDialogEffects(open,onClose)
  if(!open)return null
  const node=<div className="modal-backdrop ui-enter" onMouseDown={e=>e.target===e.currentTarget&&onClose?.()}>
    <section className={classNames('modal','surface-pop',wide&&'modal-wide')} role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal-head"><h2>{title}</h2><button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><X size={20}/></button></div>
      <div className="modal-body">{children}</div>
    </section>
  </div>
  return createPortal(node,document.body)
}

export function Drawer({open,onClose,title,children,eyebrow='BOOKING'}){
  useDialogEffects(open,onClose)
  if(!open)return null
  const node=<div className="drawer-backdrop ui-enter" onMouseDown={e=>e.target===e.currentTarget&&onClose?.()}>
    <aside className="drawer surface-pop" role="dialog" aria-modal="true" aria-label={title}>
      <div className="drawer-head"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div><button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><X size={20}/></button></div>
      <div className="drawer-body">{children}</div>
    </aside>
  </div>
  return createPortal(node,document.body)
}

export function Field({label,children,hint}){return <label className="field"><span className="field-label">{label}</span>{children}{hint&&<span className="hint">{hint}</span>}</label>}
export function Stat({label,value,sub,tone='default'}){return <div className={`stat-card stat-${tone}`}><span>{label}</span><strong>{value}</strong>{sub&&<small>{sub}</small>}</div>}
export function Tabs({value,onChange,items}){return <div className="tabs" role="tablist">{items.map(x=><button type="button" role="tab" aria-selected={value===x.value} key={x.value} className={value===x.value?'active':''} onClick={()=>onChange(x.value)}>{x.label}</button>)}</div>}
