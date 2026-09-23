import React,{useEffect,useState} from 'react'
import { supabase, configured } from './lib/supabase'
import { getProfileMaybe, getMyCustomerPortal } from './lib/api'
import CustomerLogin from './pages/CustomerLogin'
import CustomerPortalPreview from './pages/CustomerPortalPreview'

export default function CustomerApp(){
 const[session,setSession]=useState(null)
 const[portal,setPortal]=useState(null)
 const[loading,setLoading]=useState(true)
 const[error,setError]=useState('')

 useEffect(()=>{
  if(!configured){setLoading(false);return}
  supabase.auth.getSession().then(({data})=>{setSession(data.session);setLoading(false)})
  const{data:{subscription}}=supabase.auth.onAuthStateChange((_event,nextSession)=>setSession(nextSession))
  return()=>subscription.unsubscribe()
 },[])

 useEffect(()=>{
  let active=true
  if(!session?.user?.id){setPortal(null);setError('');return}
  setPortal(null);setError('')
  ;(async()=>{
   try{
    const staff=await getProfileMaybe(session.user.id)
    if(staff)throw new Error('This link is for customers only. Please use the staff system instead.')
    const data=await getMyCustomerPortal()
    if(active)setPortal(data)
   }catch(e){
    if(active){setPortal(null);setError(e.message||'Customer portal access unavailable.')}
   }
  })()
  return()=>{active=false}
 },[session?.user?.id])

 if(loading)return <div className="portal-shell"><div className="portal-loading">Loading…</div></div>
 if(!session)return <CustomerLogin/>
 if(error)return <div className="customer-auth-shell"><div className="customer-auth-card"><div className="brand-mark big">MH</div><span className="eyebrow">CUSTOMER PORTAL</span><h1>Access unavailable</h1><p>{error}</p><button className="btn btn-ghost" onClick={()=>supabase.auth.signOut()}>Sign out</button></div></div>
 if(!portal)return <div className="portal-shell"><div className="portal-loading">Opening your portal…</div></div>

 return <CustomerPortalPreview live customerData={portal} onLogout={()=>supabase.auth.signOut()}/>
}
