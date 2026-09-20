import React,{useState} from 'react'
import { Home, Users, UserRound, CalendarDays, Scissors, Boxes, WalletCards, Image, History, Settings, LogOut, Menu, X } from 'lucide-react'

const nav=[
  ['dashboard','Dashboard',Home],['leads','Leads',Users],['customers','Customers',UserRound],['appointments','Calendar',CalendarDays],['services','Service',Scissors],['inventory','Inventory',Boxes],['payments','Payments',WalletCards],['media','Before / After',Image],['activity','Activity',History],['settings','Settings',Settings]
]
const mobileMain=['dashboard','leads','appointments','customers']
export default function Layout({page,setPage,profile,onLogout,children}){
 const [more,setMore]=useState(false)
 const pick=id=>{setMore(false);setPage(id)}
 return <div className="app-shell">
   <aside className="sidebar">
     <div className="brand"><div className="brand-mark">MH</div><div><strong>MEN'S HAIR</strong><span>Studio OS</span></div></div>
     <nav>{nav.map(([id,label,Icon])=><button key={id} className={page===id?'active':''} onClick={()=>pick(id)}><Icon size={19}/><span>{label}</span></button>)}</nav>
     <div className="sidebar-foot"><div className="user-chip"><div className="avatar">{profile?.full_name?.[0]||'A'}</div><div><strong>{profile?.full_name||'Admin'}</strong><span>Administrator</span></div></div><button className="icon-btn" title="Sign out" onClick={onLogout}><LogOut size={18}/></button></div>
   </aside>
   <main className="main"><header className="mobile-top"><div className="brand mini"><div className="brand-mark">MH</div><div><strong>MEN'S HAIR</strong><span>{nav.find(x=>x[0]===page)?.[1]||'Studio OS'}</span></div></div><div className="avatar">{profile?.full_name?.[0]||'A'}</div></header>{children}</main>
   <nav className="bottom-nav">{mobileMain.map(id=>{const [,label,Icon]=nav.find(x=>x[0]===id);return <button key={id} className={page===id?'active':''} onClick={()=>pick(id)}><Icon size={21}/><span>{label==='Appointments'?'Calendar':label}</span></button>})}<button className={!mobileMain.includes(page)?'active':''} onClick={()=>setMore(true)}><Menu size={21}/><span>More</span></button></nav>
   {more&&<div className="mobile-more-backdrop" onClick={e=>e.target===e.currentTarget&&setMore(false)}><div className="mobile-more"><div className="mobile-more-head"><div><span className="eyebrow">MORE</span><h2>Operations</h2></div><button className="icon-btn" onClick={()=>setMore(false)}><X size={20}/></button></div><div className="mobile-more-grid">{nav.filter(x=>!mobileMain.includes(x[0])).map(([id,label,Icon])=><button key={id} className={page===id?'active':''} onClick={()=>pick(id)}><Icon size={21}/><span>{label}</span></button>)}</div><button className="btn btn-ghost mobile-signout" onClick={onLogout}><LogOut size={18}/>Sign out</button></div></div>}
 </div>
}
