import React,{useEffect,useState} from 'react'
import { supabase, configured } from './lib/supabase'
import { getProfile } from './lib/api'
import { isConsultationType } from './lib/calendar'
import Layout from './components/Layout'
import Members from './pages/Members'
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
 return new URLSearchParams(window.location.search).has('member')?<Members/>:<StaffApp/>
}

function StaffApp(){
 const[session,setSession]=useState(null),[profile,setProfile]=useState(null),[loading,setLoading]=useState(true)
 const [access,setAccess]=useState(null),[attempt,setAttempt]=useState(0)
 const[page,setPage]=useState(()=>window.history.state?.hairStudio?window.history.state.page:'dashboard')
 const[customerId,setCustomerId]=useState(()=>window.history.state?.hairStudio?window.history.state.customerId:null)
 const[portalCustomerId,setPortalCustomerId]=useState(()=>window.history.state?.hairStudio?window.history.state.portalCustomerId:null)
 const[appointmentPrefill,setAppointmentPrefill]=useState(null),[servicePrefill,setServicePrefill]=useState(null),[salesPrefill,setSalesPrefill]=useState(null),[mediaPrefill,setMediaPrefill]=useState(null)

 useEffect(()=>{if(!configured){setLoading(false);return} supabase.auth.getSession().then(({data})=>{setSession(data.session);setLoading(false)});const{data:{subscription}}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s));return()=>subscription.unsubscribe()},[])
 useEffect(()=>{
  const id=session?.user?.id
  if(!id){setProfile(null);setAccess(null);return}
  let active=true,latest=0
  async function check(){
   const version=++latest
   try{
    const {data:role,error}=await supabase.rpc('studio_staff_role')
    if(error)throw error
    const next=role?await getProfile(id):null
    if(!active||latest!==version)return
    setProfile(next);setAccess({id,status:next?.active&&role===next.role?'allowed':'denied'})
   }catch{
    if(active&&latest===version){setProfile(null);setAccess({id,status:'error'})}
   }
  }
  check();const timer=setInterval(check,60000);window.addEventListener('focus',check)
  return()=>{active=false;clearInterval(timer);window.removeEventListener('focus',check)}
 },[session?.user?.id,attempt])

 useEffect(()=>{if(!window.history.state?.hairStudio)window.history.replaceState(initialHistoryState,'');const onPop=e=>{const s=e.state?.hairStudio?e.state:initialHistoryState;setPage(s.page||'dashboard');setCustomerId(s.customerId||null);setPortalCustomerId(s.portalCustomerId||null);setAppointmentPrefill(null);setServicePrefill(null);setSalesPrefill(null);setMediaPrefill(null);requestAnimationFrame(()=>window.scrollTo({top:0,left:0,behavior:'auto'}))};window.addEventListener('popstate',onPop);return()=>window.removeEventListener('popstate',onPop)},[])
 useEffect(()=>{requestAnimationFrame(()=>window.scrollTo({top:0,left:0,behavior:'auto'}))},[page,customerId,portalCustomerId])

 if(loading)return <div className="app-loading">Loading...</div>
 if(!session)return <Login/>
 if(access?.id!==session.user.id)return <div className="app-loading">Checking staff access…</div>
 if(access.status!=='allowed')return <div className="login-shell"><section className="login-card">
 <h1>{access.status==='error'?'Unable to check access':'Staff access required'}</h1>
 <p>{access.status==='error'?'Check your connection and try again.':'Contact the studio owner to activate your staff account.'}</p>
 <button className="btn btn-ghost" onClick={()=>setAttempt(v=>v+1)}>Retry</button>
 <button className="btn btn-primary" onClick={()=>supabase.auth.signOut()}>Sign out</button></section></div>
 const isAdmin=profile.role==='admin'

 const navigate=(nextPage,{customer=null,portal=null,replace=false}={})=>{const next={hairStudio:true,page:nextPage,customerId:customer,portalCustomerId:portal};const same=page===nextPage&&customerId===customer&&portalCustomerId===portal;if(same){window.scrollTo({top:0,left:0,behavior:'smooth'});return}if(replace)window.history.replaceState(next,'');else window.history.pushState(next,'');setPage(nextPage);setCustomerId(customer);setPortalCustomerId(portal);setAppointmentPrefill(null);setServicePrefill(null);setSalesPrefill(null);setMediaPrefill(null)}
 const go=p=>navigate(p)
 const viewCustomer=id=>navigate('customers',{customer:id})
 const previewCustomer=id=>navigate('portal-preview',{portal:id})
 const openAppointment=a=>{if(isConsultationType(a.service_type)){navigate('sales');setSalesPrefill(a)}else{navigate('services');setServicePrefill({appointment:a,customer:a.customers||null})}}
 const bookFor=(record,kind='customer',service_type=null)=>{navigate('appointments');setAppointmentPrefill({kind,record,service_type})}

 if(page==='portal-preview'&&portalCustomerId)return <CustomerPortalPreview id={portalCustomerId} onExit={()=>window.history.back()}/>

 let content
 if(page==='dashboard')content=<Dashboard go={go} profile={profile} onStartService={openAppointment} onStartConsultation={openAppointment}/>
 else if(page==='leads')content=<Leads isAdmin={isAdmin} onBookConsultation={lead=>bookFor(lead,'lead','Studio Consultation')}/>
 else if(page==='customers')content=customerId?<CustomerDetail isAdmin={isAdmin} id={customerId} onBack={()=>window.history.back()} onBook={(c,type)=>bookFor(c,'customer',type)} onService={x=>{navigate('services');setServicePrefill(x)}} onAppointmentAction={openAppointment} onPreviewPortal={()=>previewCustomer(customerId)} onDeleted={()=>navigate('customers',{replace:true})}/>:<Customers onOpen={viewCustomer}/>
 else if(page==='appointments')content=<Appointments isAdmin={isAdmin} prefill={appointmentPrefill} onStartService={openAppointment} onStartConsultation={openAppointment}/>
 else if(page==='sales')content=<Sales prefill={salesPrefill} onDone={()=>setSalesPrefill(null)} onViewCustomer={viewCustomer} onBookInstallation={c=>bookFor(c,'customer','New System Installation')}/>
 else if(page==='services')content=<Services prefill={servicePrefill} onDone={()=>setServicePrefill(null)} onViewCustomer={viewCustomer} onBook={(c,type)=>bookFor(c,'customer',type)} onAddMedia={x=>{navigate('media');setMediaPrefill(x)}}/>
 else if(page==='inventory')content=<Inventory/>
 else if(page==='payments')content=<Payments isAdmin={isAdmin}/>
 else if(page==='media')content=<Media isAdmin={isAdmin} prefill={mediaPrefill}/>
 else if(page==='activity')content=<Activity/>
 else content=<Settings profile={profile}/>
 return <Layout page={page} setPage={p=>navigate(p)} profile={profile} onLogout={()=>supabase.auth.signOut()}>{content}</Layout>
}
