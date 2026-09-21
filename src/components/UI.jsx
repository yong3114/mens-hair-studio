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

function useSwipeDismiss(open,onClose){
  const surfaceRef=useRef(null)
  const scrollRef=useRef(null)
  const dragRef=useRef({active:false,startY:0,lastY:0,startT:0})
  const reset=()=>{
    const el=surfaceRef.current
    if(!el)return
    el.style.transition='transform .22s cubic-bezier(.2,.8,.2,1), opacity .18s ease'
    el.style.transform=''
    el.style.opacity=''
    window.setTimeout(()=>{if(el)el.style.transition=''},240)
  }
  useEffect(()=>{if(open)reset()},[open])
  const onTouchStart=e=>{
    if(window.innerWidth>820||e.touches.length!==1)return
    if(e.target.closest('input,textarea,select,button,a,[data-no-drag]'))return
    const scroller=scrollRef.current
    if(scroller&&scroller.scrollTop>0)return
    const y=e.touches[0].clientY
    dragRef.current={active:true,startY:y,lastY:y,startT:Date.now()}
    if(surfaceRef.current)surfaceRef.current.style.transition='none'
  }
  const onTouchMove=e=>{
    const d=dragRef.current
    if(!d.active||e.touches.length!==1)return
    const scroller=scrollRef.current
    if(scroller&&scroller.scrollTop>0){d.active=false;reset();return}
    const y=e.touches[0].clientY
    d.lastY=y
    const dy=Math.max(0,y-d.startY)
    if(!surfaceRef.current)return
    surfaceRef.current.style.transform=`translateY(${Math.min(dy,340)}px)`
    surfaceRef.current.style.opacity=String(Math.max(.72,1-dy/700))
  }
  const onTouchEnd=()=>{
    const d=dragRef.current
    if(!d.active)return
    d.active=false
    const dy=Math.max(0,d.lastY-d.startY)
    const dt=Math.max(1,Date.now()-d.startT)
    const velocity=dy/dt
    if(dy>115||(dy>58&&velocity>.52)){
      const el=surfaceRef.current
      if(el){el.style.transition='transform .18s ease-in, opacity .16s ease-in';el.style.transform='translateY(105%)';el.style.opacity='.65'}
      window.setTimeout(()=>onClose?.(),145)
    }else reset()
  }
  return {surfaceRef,scrollRef,handlers:{onTouchStart,onTouchMove,onTouchEnd,onTouchCancel:()=>{dragRef.current.active=false;reset()}}}
}

export function Badge({children,tone='neutral'}){return <span className={`badge badge-${tone}`}>{children}</span>}
export function Empty({title='Nothing here yet',text='Add your first record to get started.'}){return <div className="empty"><div className="empty-dot"/><h3>{title}</h3><p>{text}</p></div>}

export function Modal({open,onClose,title,children,wide=false}){
  useDialogEffects(open,onClose)
  const swipe=useSwipeDismiss(open,onClose)
  if(!open)return null
  const node=<div className="modal-backdrop ui-enter" onMouseDown={e=>e.target===e.currentTarget&&onClose?.()}>
    <section ref={swipe.surfaceRef} {...swipe.handlers} className={classNames('modal','surface-pop',wide&&'modal-wide')} role="dialog" aria-modal="true" aria-label={title}>
      <div className="sheet-handle" aria-hidden="true"><span/></div>
      <div className="modal-head"><h2>{title}</h2><button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><X size={20}/></button></div>
      <div ref={swipe.scrollRef} className="modal-body">{children}</div>
    </section>
  </div>
  return createPortal(node,document.body)
}

export function Drawer({open,onClose,title,children,eyebrow='BOOKING'}){
  useDialogEffects(open,onClose)
  const swipe=useSwipeDismiss(open,onClose)
  if(!open)return null
  const node=<div className="drawer-backdrop ui-enter" onMouseDown={e=>e.target===e.currentTarget&&onClose?.()}>
    <aside ref={swipe.surfaceRef} {...swipe.handlers} className="drawer surface-pop" role="dialog" aria-modal="true" aria-label={title}>
      <div className="sheet-handle" aria-hidden="true"><span/></div>
      <div className="drawer-head"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div><button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><X size={20}/></button></div>
      <div ref={swipe.scrollRef} className="drawer-body">{children}</div>
    </aside>
  </div>
  return createPortal(node,document.body)
}

export function Field({label,children,hint}){return <label className="field"><span className="field-label">{label}</span>{children}{hint&&<span className="hint">{hint}</span>}</label>}
export function Stat({label,value,sub,tone='default'}){return <div className={`stat-card stat-${tone}`}><span>{label}</span><strong>{value}</strong>{sub&&<small>{sub}</small>}</div>}
export function Tabs({value,onChange,items}){return <div className="tabs" role="tablist">{items.map(x=><button type="button" role="tab" aria-selected={value===x.value} key={x.value} className={value===x.value?'active':''} onClick={()=>onChange(x.value)}>{x.label}</button>)}</div>}
