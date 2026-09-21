import React,{useEffect,useState} from 'react'
import { supabase, configured } from './lib/supabase'
import { getProfile } from './lib/api'
import { isConsultationType } from './lib/calendar'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Leads from './pages/Leads'
import Customers from './pages/Customers'
import CustomerDetail from './pages/CustomerDetail'
import CustomerPortalPreview from './pages/CustomerPortalPreview'
import Appointments from './pages/Appointments'
import Sales from './pages/Sales'
import Services from './pages/Services'
import Inventory from './pages/Inventory'
import Payments from './pages/Payments'
import Media from './pages/Media'
import Activity from './pages/Activity'
import Settings from './pages/Settings'

const initialHistoryState={hairStudio:true,page:'dashboard',customerId:null,portalCustomerId:null}

export default function App(){
 const[session,setSession]=useState(null),[profile,setProfile]=useState(null),[loading,setLoading]=useState(true)
 const[page,setPage]=useState(()=>window.history.state?.hairStudio?window.history.state.page:'dashboard')
 const[customerId,setCustomerId]=useState(()=>window.history.state?.hairStudio?window.history.state.customerId:null)
 const[portalCustomerId,setPortalCustomerId]=useState(()=>window.history.state?.hairStudio?window.history.state.portalCustomerId:null)
 const[appointmentPrefill,setAppointmentPrefill]=useState(null),[servicePrefill,setServicePrefill]=useState(null),[salesPrefill,setSalesPrefill]=useState(null),[mediaPrefill,setMediaPrefill]=useState(null)

 useEffect(()=>{if(!configured){setLoading(false);return} supabase.auth.getSession().then(({data})=>{setSession(data.session);setLoading(false)});const{data:{subscription}}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s));return()=>subscription.unsubscribe()},[])
 useEffect(()=>{if(session?.user?.id)getProfile(session.user.id).then(setProfile).catch(()=>setProfile({id:session.user.id,full_name:session.user.email?.split('@')[0],role:'admin'}));else setProfile(null)},[session?.user?.id])
 useEffect(()=>{if(!window.history.state?.hairStudio)window.history.replaceState(initialHistoryState,'');const onPop=e=>{const s=e.state?.hairStudio?e.state:initialHistoryState;setPage(s.page||'dashboard');setCustomerId(s.customerId||null);setPortalCustomerId(s.portalCustomerId||null);setAppointmentPrefill(null);setServicePrefill(null);setSalesPrefill(null);setMediaPrefill(null);requestAnimationFrame(()=>window.scrollTo({top:0,left:0,behavior:'auto'}))};window.addEventListener('popstate',onPop);return()=>window.removeEventListener('popstate',onPop)},[])
 useEffect(()=>{requestAnimationFrame(()=>window.scrollTo({top:0,left:0,behavior:'auto'}))},[page,customerId,portalCustomerId])

 if(loading)return <div className="app-loading">Loading...</div>
 if(!session)return <Login/>

 const navigate=(nextPage,{customer=null,portal=null,replace=false}={})=>{const next={hairStudio:true,page:nextPage,customerId:customer,portalCustomerId:portal};const same=page===nextPage&&customerId===customer&&portalCustomerId===portal;if(same){window.scrollTo({top:0,left:0,behavior:'smooth'});return}if(replace)window.history.replaceState(next,'');else window.history.pushState(next,'');setPage(nextPage);setCustomerId(customer);setPortalCustomerId(portal);setAppointmentPrefill(null);setServicePrefill(null);setSalesPrefill(null);setMediaPrefill(null)}
 const go=p=>navigate(p)
 const viewCustomer=id=>navigate('customers',{customer:id})
 const previewCustomer=id=>navigate('portal-preview',{portal:id})
 const openAppointment=a=>{if(isConsultationType(a.service_type)){navigate('sales');setSalesPrefill(a)}else{navigate('services');setServicePrefill({appointment:a,customer:a.customers||null})}}
 const bookFor=(record,kind='customer',service_type=null)=>{navigate('appointments');setAppointmentPrefill({kind,record,service_type})}

 if(page==='portal-preview'&&portalCustomerId)return <CustomerPortalPreview id={portalCustomerId} onExit={()=>window.history.back()} onBook={()=>alert('Customer self-booking is planned for V2.4. This is the customer UI preview for now.')}/>

 let content
 if(page==='dashboard')content=<Dashboard go={go} profile={profile} onStartService={openAppointment} onStartConsultation={openAppointment}/>
 else if(page==='leads')content=<Leads onBookConsultation={lead=>bookFor(lead,'lead','Studio Consultation')}/>
 else if(page==='customers')content=customerId?<CustomerDetail id={customerId} onBack={()=>window.history.back()} onBook={(c,type)=>bookFor(c,'customer',type)} onService={x=>{navigate('services');setServicePrefill(x)}} onPreviewPortal={()=>previewCustomer(customerId)}/>:<Customers onOpen={viewCustomer}/>
 else if(page==='appointments')content=<Appointments prefill={appointmentPrefill} onStartService={openAppointment} onStartConsultation={openAppointment}/>
 else if(page==='sales')content=<Sales prefill={salesPrefill} onDone={()=>setSalesPrefill(null)} onViewCustomer={viewCustomer} onBookInstallation={c=>bookFor(c,'customer','New System Installation')}/>
 else if(page==='services')content=<Services prefill={servicePrefill} onDone={()=>setServicePrefill(null)} onViewCustomer={viewCustomer} onBook={(c,type)=>bookFor(c,'customer',type)} onAddMedia={x=>{navigate('media');setMediaPrefill(x)}}/>
 else if(page==='inventory')content=<Inventory/>
 else if(page==='payments')content=<Payments/>
 else if(page==='media')content=<Media prefill={mediaPrefill}/>
 else if(page==='activity')content=<Activity/>
 else content=<Settings profile={profile}/>
 return <Layout page={page} setPage={p=>navigate(p)} profile={profile} onLogout={()=>supabase.auth.signOut()}>{content}</Layout>
}
