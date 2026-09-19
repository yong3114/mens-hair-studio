import React from 'react'
import { Home, Users, UserRound, CalendarDays, Scissors, Boxes, WalletCards, Image, History, Settings, LogOut, Menu } from 'lucide-react'

const nav=[
  ['dashboard','Dashboard',Home],['leads','Leads',Users],['customers','Customers',UserRound],['appointments','Appointments',CalendarDays],['services','Service',Scissors],['inventory','Inventory',Boxes],['payments','Payments',WalletCards],['media','Before / After',Image],['activity','Activity',History],['settings','More',Settings]
]
export default function Layout({page,setPage,profile,onLogout,children}){
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">MH</div><div><strong>MEN'S HAIR</strong><span>Studio Operations</span></div></div>
      <nav>{nav.map(([id,label,Icon])=><button key={id} className={page===id?'active':''} onClick={()=>setPage(id)}><Icon size={19}/><span>{label}</span></button>)}</nav>
      <div className="sidebar-foot"><div className="user-chip"><div className="avatar">{profile?.full_name?.[0]||'A'}</div><div><strong>{profile?.full_name||'Admin'}</strong><span>Administrator</span></div></div><button className="icon-btn" title="Sign out" onClick={onLogout}><LogOut size={18}/></button></div>
    </aside>
    <main className="main"><header className="mobile-top"><div className="brand mini"><div className="brand-mark">MH</div><strong>MEN'S HAIR</strong></div><div className="avatar">{profile?.full_name?.[0]||'A'}</div></header>{children}</main>
    <nav className="bottom-nav">{nav.slice(0,5).map(([id,label,Icon])=><button key={id} className={page===id?'active':''} onClick={()=>setPage(id)}><Icon size={20}/><span>{label==='Appointments'?'Booking':label}</span></button>)}<button className={['inventory','payments','media','activity','settings'].includes(page)?'active':''} onClick={()=>setPage('settings')}><Menu size={20}/><span>More</span></button></nav>
  </div>
}
