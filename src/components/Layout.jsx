import React,{useEffect,useMemo,useState} from 'react'
import { Home, Users, UserRound, CalendarDays, Scissors, Boxes, WalletCards, Image, History, Settings, LogOut, Menu, X, HandCoins, Bell, CheckCheck } from 'lucide-react'
import { listNotifications, markAllNotificationsRead, markNotificationRead, clearNotifications } from '../lib/api'
import { dateTime } from '../lib/utils'

const nav=[
  ['dashboard','Dashboard',Home],['leads','Leads',Users],['sales','Consultations & Deals',HandCoins],['customers','Clients',UserRound],['appointments','Calendar',CalendarDays],['services','Service',Scissors],['inventory','Inventory',Boxes],['payments','Payments',WalletCards],['media','Before / After',Image],['activity','Activity',History],['settings','Settings',Settings]
]
const mobileMain=['dashboard','leads','appointments','customers']

function NotificationBell({profile,onOpenCalendar}){
 const[rows,setRows]=useState([]),[open,setOpen]=useState(false)
 const load=()=>profile?.id?listNotifications(profile.id).then(setRows).catch(()=>{}):Promise.resolve()
 useEffect(()=>{load();const t=setInterval(load,30000);return()=>clearInterval(t)},[profile?.id])
 const unread=useMemo(()=>rows.filter(x=>!x.read_at),[rows])
 const openItem=async n=>{if(!n.read_at)await markNotificationRead(n.id).catch(()=>{});setOpen(false);await load();if(n.appointment_id)onOpenCalendar?.()}
 return <div className="notification-wrap"><button className="icon-btn notification-btn" onClick={()=>setOpen(!open)} aria-label="Notifications"><Bell size={19}/>{unread.length>0&&<span className="notification-count">{unread.length>9?'9+':unread.length}</span>}</button>{open&&<div className="notification-popover"><div className="notification-head"><div><span className="eyebrow">NOTIFICATIONS</span><strong>{unread.length} unread</strong></div>{unread.length>0&&<button className="text-btn" onClick={async()=>{await markAllNotificationsRead(profile.id);await load()}}><CheckCheck size={14}/>Read all</button>}</div><div className="notification-list">{rows.length?rows.slice(0,12).map(n=><button key={n.id} className={!n.read_at?'unread':''} onClick={()=>openItem(n)}><span className="notification-dot"/><div><strong>{n.title}</strong><p>{n.body}</p><small>{dateTime(n.created_at)}</small></div></button>):<div className="notification-empty">No notifications yet.</div>}</div><div className="notification-foot"><span>Email / WhatsApp delivery will be connected in the Automation phase.</span>{rows.length>0&&<button className="text-btn danger-text" onClick={async()=>{if(confirm('Clear all notifications for this account?')){await clearNotifications(profile.id);await load()}}}>Clear</button>}</div></div>}</div>
}

export default function Layout({page,setPage,profile,onLogout,children}){
 const [more,setMore]=useState(false)
 const pick=id=>{setMore(false);setPage(id)}
 return <div className="app-shell">
   <aside className="sidebar">
     <div className="brand"><div className="brand-mark">MH</div><div><strong>MEN'S HAIR</strong><span>Studio OS</span></div></div>
     <nav>{nav.map(([id,label,Icon])=><button key={id} className={page===id?'active':''} onClick={()=>pick(id)}><Icon size={19}/><span>{label}</span></button>)}</nav>
     <div className="sidebar-foot"><div className="user-chip"><div className="avatar">{profile?.full_name?.[0]||'A'}</div><div><strong>{profile?.full_name||'Admin'}</strong><span>{profile?.role==='staff'?'Staff':'Administrator'}</span></div></div><NotificationBell profile={profile} onOpenCalendar={()=>pick('appointments')}/><button className="icon-btn" title="Sign out" onClick={onLogout}><LogOut size={18}/></button></div>
   </aside>
   <main className="main"><header className="mobile-top"><div className="brand mini"><div className="brand-mark">MH</div><div><strong>MEN'S HAIR</strong><span>{nav.find(x=>x[0]===page)?.[1]||'Studio OS'}</span></div></div><div className="mobile-head-actions"><NotificationBell profile={profile} onOpenCalendar={()=>pick('appointments')}/><div className="avatar">{profile?.full_name?.[0]||'A'}</div></div></header>{children}</main>
   <nav className="bottom-nav">{mobileMain.map(id=>{const [,label,Icon]=nav.find(x=>x[0]===id);return <button key={id} className={page===id?'active':''} onClick={()=>pick(id)}><Icon size={21}/><span>{label}</span></button>})}<button className={!mobileMain.includes(page)?'active':''} onClick={()=>setMore(true)}><Menu size={21}/><span>More</span></button></nav>
   {more&&<div className="mobile-more-backdrop" onClick={e=>e.target===e.currentTarget&&setMore(false)}><div className="mobile-more"><div className="mobile-more-head"><div><span className="eyebrow">MORE</span><h2>Operations</h2></div><button className="icon-btn" onClick={()=>setMore(false)}><X size={20}/></button></div><div className="mobile-more-grid">{nav.filter(x=>!mobileMain.includes(x[0])).map(([id,label,Icon])=><button key={id} className={page===id?'active':''} onClick={()=>pick(id)}><Icon size={21}/><span>{label}</span></button>)}</div><button className="btn btn-ghost mobile-signout" onClick={onLogout}><LogOut size={18}/>Sign out</button></div></div>}
 </div>
}
