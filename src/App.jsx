import React,{useEffect,useState} from 'react'
import { supabase, configured } from './lib/supabase'
import { getProfile } from './lib/api'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Leads from './pages/Leads'
import Customers from './pages/Customers'
import CustomerDetail from './pages/CustomerDetail'
import Appointments from './pages/Appointments'
import Services from './pages/Services'
import Inventory from './pages/Inventory'
import Payments from './pages/Payments'
import Media from './pages/Media'
import Activity from './pages/Activity'
import Settings from './pages/Settings'

export default function App(){
 const[session,setSession]=useState(null),[profile,setProfile]=useState(null),[loading,setLoading]=useState(true),[page,setPage]=useState('dashboard'),[customerId,setCustomerId]=useState(null),[appointmentPrefill,setAppointmentPrefill]=useState(null),[servicePrefill,setServicePrefill]=useState(null),[mediaPrefill,setMediaPrefill]=useState(null)
 useEffect(()=>{if(!configured){setLoading(false);return} supabase.auth.getSession().then(({data})=>{setSession(data.session);setLoading(false)});const{data:{subscription}}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s));return()=>subscription.unsubscribe()},[])
 useEffect(()=>{if(session?.user?.id)getProfile(session.user.id).then(setProfile).catch(()=>setProfile({full_name:session.user.email?.split('@')[0],role:'admin'}));else setProfile(null)},[session?.user?.id])
 if(loading)return <div className="app-loading">Loading...</div>
 if(!session)return <Login/>
 const go=(p)=>{setPage(p);if(p!=='customers')setCustomerId(null)}
 const viewCustomer=id=>{setCustomerId(id);setPage('customers')}
 const startAppointment=a=>{setServicePrefill({appointment:a,customer:a.customers||null});setPage('services');setCustomerId(null)}
 let content
 if(page==='dashboard')content=<Dashboard go={go} onStartService={startAppointment}/>
 else if(page==='leads')content=<Leads goCustomer={viewCustomer}/>
 else if(page==='customers')content=customerId?<CustomerDetail id={customerId} onBack={()=>setCustomerId(null)} onBook={c=>{setAppointmentPrefill(c);setPage('appointments');setCustomerId(null)}} onService={x=>{setServicePrefill(x);setPage('services');setCustomerId(null)}}/>:<Customers onOpen={viewCustomer}/>
 else if(page==='appointments')content=<Appointments prefillCustomer={appointmentPrefill} onStartService={a=>{setServicePrefill({appointment:a,customer:a.customers||null});setPage('services')}}/>
 else if(page==='services')content=<Services prefill={servicePrefill} onDone={()=>setServicePrefill(null)} onViewCustomer={viewCustomer} onBook={c=>{setAppointmentPrefill(c);setPage('appointments')}} onAddMedia={x=>{setMediaPrefill(x);setPage('media')}}/>
 else if(page==='inventory')content=<Inventory/>
 else if(page==='payments')content=<Payments/>
 else if(page==='media')content=<Media prefill={mediaPrefill}/>
 else if(page==='activity')content=<Activity/>
 else content=<Settings profile={profile}/>
 return <Layout page={page} setPage={p=>{setAppointmentPrefill(null);setServicePrefill(null);setMediaPrefill(null);go(p)}} profile={profile} onLogout={()=>supabase.auth.signOut()}>{content}</Layout>
}
