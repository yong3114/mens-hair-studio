import { supabase } from './supabase'

const ok = (r) => { if (r.error) throw r.error; return r.data }

export async function getProfile(userId) { return ok(await supabase.from('profiles').select('*').eq('id', userId).single()) }

export async function getDashboard(userId=null) {
  const start = new Date(); start.setHours(0,0,0,0)
  const [leads, customers, appts, systems, consumables, payments, services, consultations, deals, notifications] = await Promise.all([
    supabase.from('leads').select('id,name,whatsapp_name,phone,stage,follow_up_date'),
    supabase.from('customers').select('id,lifecycle_stage'),
    supabase.from('appointments').select('id,customer_id,lead_id,assigned_user_id,scheduled_at,duration_min,status,service_type,location_type,customers(name,whatsapp_name),leads(name,whatsapp_name,phone),profiles!appointments_assigned_user_id_fkey(full_name)').gte('scheduled_at', start.toISOString()).order('scheduled_at').limit(100),
    supabase.from('hair_systems').select('id,status'),
    supabase.from('consumables').select('id,qty,min_qty,name,unit'),
    supabase.from('payments').select('id,amount,status,type,paid_at,created_at'),
    supabase.from('services').select('id,customer_id,status,service_type,started_at,completed_at,next_maintenance_date,customers(name,whatsapp_name)').eq('status','completed').not('next_maintenance_date','is',null).order('completed_at',{ascending:false}).limit(500),
    supabase.from('consultations').select('id,status,outcome,follow_up_date,lead_id,customer_id,appointment_id').order('created_at',{ascending:false}).limit(100),
    supabase.from('deals').select('id,status,customer_id,final_price,deposit_amount,balance_amount,signed_at').order('signed_at',{ascending:false}).limit(100),
    userId ? supabase.from('notifications').select('*').eq('recipient_user_id',userId).is('read_at',null).order('created_at',{ascending:false}).limit(20) : Promise.resolve({data:[],error:null})
  ])
  ;[leads,customers,appts,systems,consumables,payments,services,consultations,deals,notifications].forEach(ok)
  return { leads:leads.data, customers:customers.data, appts:appts.data, systems:systems.data, consumables:consumables.data, payments:payments.data, services:services.data, consultations:consultations.data, deals:deals.data, notifications:notifications.data }
}

export async function listLeads(){ return ok(await supabase.from('leads').select('*').order('created_at',{ascending:false})) }
export async function saveLead(payload,id){ return ok(id ? await supabase.from('leads').update(payload).eq('id',id).select().single() : await supabase.from('leads').insert(payload).select().single()) }
export async function deleteLead(id){
  // Testing-friendly cleanup: remove linked consultation bookings first so deleted leads do not leave orphan calendar records.
  const appts = await supabase.from('appointments').select('id').eq('lead_id',id); ok(appts)
  if(appts.data?.length){ const ids=appts.data.map(x=>x.id); ok(await supabase.from('consultations').delete().in('appointment_id',ids)); ok(await supabase.from('appointments').delete().in('id',ids)) }
  ok(await supabase.from('consultations').delete().eq('lead_id',id))
  return ok(await supabase.from('leads').delete().eq('id',id))
}
export async function convertLead(leadId, customerName=null){ const { data, error } = await supabase.rpc('convert_lead_to_customer_v2',{ p_lead_id: leadId, p_customer_name: customerName || null }); if(error) throw error; return data }

export async function listCustomers(){ return ok(await supabase.from('customers').select('*').order('created_at',{ascending:false})) }
export async function getCustomer(id){
  const [c,a,s,h,p,cr,m,d] = await Promise.all([
    supabase.from('customers').select('*').eq('id',id).single(),
    supabase.from('appointments').select('*,profiles!appointments_assigned_user_id_fkey(full_name)').eq('customer_id',id).order('scheduled_at',{ascending:false}),
    supabase.from('services').select('*,profiles!services_technician_id_fkey(full_name)').eq('customer_id',id).order('created_at',{ascending:false}),
    supabase.from('hair_systems').select('*').eq('customer_id',id).order('installed_date',{ascending:false}),
    supabase.from('payments').select('*').eq('customer_id',id).order('created_at',{ascending:false}),
    supabase.from('credit_transactions').select('*').eq('customer_id',id).order('created_at',{ascending:false}),
    supabase.from('media').select('*').eq('customer_id',id).order('created_at',{ascending:false}),
    supabase.from('deals').select('*,hair_systems(code,status)').eq('customer_id',id).order('signed_at',{ascending:false})
  ]); [c,a,s,h,p,cr,m,d].forEach(ok)
  return {customer:c.data, appointments:a.data, services:s.data, systems:h.data, payments:p.data, credits:cr.data, media:m.data, deals:d.data}
}
export async function saveCustomer(payload,id){ return ok(id ? await supabase.from('customers').update(payload).eq('id',id).select().single() : await supabase.from('customers').insert(payload).select().single()) }
export async function deleteTestCustomer(id){
  const c = ok(await supabase.from('customers').select('id,source_lead_id').eq('id',id).single())
  const media = ok(await supabase.from('media').select('storage_path').eq('customer_id',id)) || []
  if(media.length){ const paths=media.map(x=>x.storage_path).filter(Boolean); if(paths.length) ok(await supabase.storage.from('customer-media').remove(paths)) }
  const appts = ok(await supabase.from('appointments').select('id').eq('customer_id',id)) || []
  if(appts.length){ const ids=appts.map(x=>x.id); ok(await supabase.from('consultations').delete().in('appointment_id',ids)); ok(await supabase.from('appointments').delete().in('id',ids)) }
  ok(await supabase.from('consultations').delete().eq('customer_id',id))
  ok(await supabase.from('hair_systems').update({customer_id:null,status:'available',reserved_at:null,installed_date:null}).eq('customer_id',id))
  ok(await supabase.from('customers').delete().eq('id',id))
  if(c?.source_lead_id){
    ok(await supabase.from('consultations').delete().eq('lead_id',c.source_lead_id))
    ok(await supabase.from('appointments').delete().eq('lead_id',c.source_lead_id))
    ok(await supabase.from('leads').delete().eq('id',c.source_lead_id))
  }
  return true
}

export async function listProfiles(){ return ok(await supabase.from('profiles').select('id,full_name,role,active,email').eq('active',true).order('full_name')) }
export async function listAppointments(start,end){
  let q=supabase.from('appointments').select('*,customers(id,name,whatsapp_name,phone,lifecycle_stage),leads(id,name,whatsapp_name,phone,stage),profiles!appointments_assigned_user_id_fkey(id,full_name)').order('scheduled_at')
  if(start) q=q.gte('scheduled_at',start); if(end) q=q.lt('scheduled_at',end)
  return ok(await q)
}
export async function saveAppointment(payload,id){ return ok(id ? await supabase.from('appointments').update(payload).eq('id',id).select().single() : await supabase.from('appointments').insert(payload).select().single()) }
export async function deleteAppointment(id){
  // Only use for bookings that have not progressed into a completed technical record.
  ok(await supabase.from('consultations').delete().eq('appointment_id',id))
  return ok(await supabase.from('appointments').delete().eq('id',id))
}

export async function listConsultations(limit=300){ return ok(await supabase.from('consultations').select('*,appointments(id,scheduled_at,service_type,status),leads(id,name,whatsapp_name,phone,stage),customers(id,name,whatsapp_name,phone,lifecycle_stage),profiles!consultations_consultant_id_fkey(id,full_name)').order('created_at',{ascending:false}).limit(limit)) }
export async function startConsultation(appointmentId,consultantId=null){ const {data,error}=await supabase.rpc('start_consultation',{p_appointment_id:appointmentId,p_consultant_id:consultantId||null}); if(error)throw error; return data }
export async function completeConsultation(consultationId,outcome,payload={}){ const {data,error}=await supabase.rpc('complete_consultation',{p_consultation_id:consultationId,p_outcome:outcome,p_payload:payload}); if(error)throw error; return data }
export async function listDeals(limit=300){ return ok(await supabase.from('deals').select('*,customers(id,name,whatsapp_name,phone,lifecycle_stage),hair_systems(id,code,status)').order('signed_at',{ascending:false}).limit(limit)) }

export async function listServices(limit=300){ return ok(await supabase.from('services').select('*,customers(id,name,whatsapp_name,phone),appointments(id,scheduled_at,duration_min,status),profiles!services_technician_id_fkey(id,full_name)').order('created_at',{ascending:false}).limit(limit)) }
export async function startService(payload){ const {data,error}=await supabase.rpc('start_service',{p_customer_id:payload.customer_id,p_appointment_id:payload.appointment_id||null,p_service_type:payload.service_type,p_technician_id:payload.technician_id||null,p_started_at:payload.started_at||new Date().toISOString()}); if(error)throw error; return data }
export async function completeService(payload,consumptions=[]){ const { data, error } = await supabase.rpc('complete_service', { p_payload: payload, p_consumptions: consumptions }); if(error) throw error; return data }

export async function listHairSystems(){ return ok(await supabase.from('hair_systems').select('*,customers(name,whatsapp_name)').order('created_at',{ascending:false})) }
export async function saveHairSystem(payload,id){ return ok(id ? await supabase.from('hair_systems').update(payload).eq('id',id).select().single() : await supabase.from('hair_systems').insert(payload).select().single()) }
export async function installHairSystem(systemId,customerId,serviceId=null){ const {data,error}=await supabase.rpc('install_hair_system',{p_system_id:systemId,p_customer_id:customerId,p_service_id:serviceId}); if(error)throw error; return data }
export async function listConsumables(){ return ok(await supabase.from('consumables').select('*').order('name')) }
export async function saveConsumable(payload,id){ return ok(id ? await supabase.from('consumables').update(payload).eq('id',id).select().single() : await supabase.from('consumables').insert(payload).select().single()) }
export async function adjustConsumable(id,qty,reason){ const {data,error}=await supabase.rpc('adjust_consumable',{p_consumable_id:id,p_delta:qty,p_reason:reason}); if(error)throw error; return data }

export async function createPayment(payload){ return ok(await supabase.from('payments').insert(payload).select().single()) }
export async function updatePayment(id,payload){ return ok(await supabase.from('payments').update(payload).eq('id',id).select().single()) }
export async function deletePayment(id){ return ok(await supabase.from('payments').delete().eq('id',id)) }
export async function createCredit(payload){ return ok(await supabase.from('credit_transactions').insert(payload).select().single()) }
export async function listPayments(){ return ok(await supabase.from('payments').select('*,customers(name,whatsapp_name)').order('created_at',{ascending:false}).limit(500)) }

export async function listNotifications(userId){ return ok(await supabase.from('notifications').select('*').eq('recipient_user_id',userId).order('created_at',{ascending:false}).limit(50)) }
export async function markNotificationRead(id){ return ok(await supabase.from('notifications').update({read_at:new Date().toISOString()}).eq('id',id).select().single()) }
export async function markAllNotificationsRead(userId){ return ok(await supabase.from('notifications').update({read_at:new Date().toISOString()}).eq('recipient_user_id',userId).is('read_at',null).select()) }
export async function clearNotifications(userId){ return ok(await supabase.from('notifications').delete().eq('recipient_user_id',userId)) }

export async function listActivity(){ return ok(await supabase.from('activity_log').select('*,profiles(full_name)').order('created_at',{ascending:false}).limit(300)) }
export async function listMedia(){ return ok(await supabase.from('media').select('*,customers(id,name,whatsapp_name),services(id,service_type,completed_at)').order('created_at',{ascending:false}).limit(400)) }
export async function signedMedia(path){ const {data,error}=await supabase.storage.from('customer-media').createSignedUrl(path,3600); if(error)throw error; return data.signedUrl }
export async function uploadMedia(file, customerId, serviceId, kind, consent){
  const ext=file.name.split('.').pop()?.toLowerCase() || 'jpg'; const path=`${customerId}/${Date.now()}-${crypto.randomUUID()}.${ext}`
  let r=await supabase.storage.from('customer-media').upload(path,file,{upsert:false}); ok(r)
  return ok(await supabase.from('media').insert({customer_id:customerId,service_id:serviceId||null,kind,consent,storage_path:path}).select().single())
}
export async function deleteMedia(row){ const storage = await supabase.storage.from('customer-media').remove([row.storage_path]); ok(storage); return ok(await supabase.from('media').delete().eq('id',row.id)) }

export async function exportAll(){
  const tables=['profiles','leads','customers','appointments','consultations','deals','services','hair_systems','consumables','inventory_movements','payments','credit_transactions','media','notifications','activity_log']
  const out={exported_at:new Date().toISOString(),version:'2.3.1',data:{}}
  for(const t of tables){ const r=await supabase.from(t).select('*'); out.data[t]=ok(r) }
  return out
}
