import { localDateKey } from './utils'
import { supabase } from './supabase'

const ok = (r) => { if (r.error) throw r.error; return r.data }

export async function getProfile(userId) {
  return ok(await supabase.from('profiles').select('*').eq('id', userId).single())
}
export async function getDashboard() {
  const start = new Date(); start.setHours(0,0,0,0)
  const maintenanceFrom = new Date(); maintenanceFrom.setDate(maintenanceFrom.getDate()-14)
  const maintenanceTo = new Date(); maintenanceTo.setDate(maintenanceTo.getDate()+14)
  const [leads, customers, appts, systems, consumables, payments, services] = await Promise.all([
    supabase.from('leads').select('id,name,whatsapp_name,phone,stage,follow_up_date'),
    supabase.from('customers').select('id'),
    supabase.from('appointments').select('id,customer_id,scheduled_at,duration_min,status,service_type,location_type,customers(name,whatsapp_name),profiles!appointments_assigned_user_id_fkey(full_name)').gte('scheduled_at', start.toISOString()).order('scheduled_at').limit(60),
    supabase.from('hair_systems').select('id,status'),
    supabase.from('consumables').select('id,qty,min_qty,name,unit'),
    supabase.from('payments').select('id,amount,status,type,paid_at,created_at'),
    supabase.from('services').select('id,customer_id,status,service_type,started_at,completed_at,next_maintenance_date,customers(name,whatsapp_name)').gte('next_maintenance_date', localDateKey(maintenanceFrom)).lte('next_maintenance_date', localDateKey(maintenanceTo)).order('next_maintenance_date')
  ])
  ;[leads,customers,appts,systems,consumables,payments,services].forEach(ok)
  return { leads:leads.data, customers:customers.data, appts:appts.data, systems:systems.data, consumables:consumables.data, payments:payments.data, services:services.data }
}
export async function listLeads(){ return ok(await supabase.from('leads').select('*').order('created_at',{ascending:false})) }
export async function saveLead(payload,id){ return ok(id ? await supabase.from('leads').update(payload).eq('id',id).select().single() : await supabase.from('leads').insert(payload).select().single()) }
export async function deleteLead(id){ return ok(await supabase.from('leads').delete().eq('id',id)) }
export async function convertLead(leadId, customerName=null){
  const { data, error } = await supabase.rpc('convert_lead_to_customer_v2',{ p_lead_id: leadId, p_customer_name: customerName || null })
  if(error) throw error; return data
}
export async function listCustomers(){ return ok(await supabase.from('customers').select('*').order('created_at',{ascending:false})) }
export async function getCustomer(id){
  const [c,a,s,h,p,cr,m] = await Promise.all([
    supabase.from('customers').select('*').eq('id',id).single(),
    supabase.from('appointments').select('*,profiles!appointments_assigned_user_id_fkey(full_name)').eq('customer_id',id).order('scheduled_at',{ascending:false}),
    supabase.from('services').select('*,profiles!services_technician_id_fkey(full_name)').eq('customer_id',id).order('created_at',{ascending:false}),
    supabase.from('hair_systems').select('*').eq('customer_id',id).order('installed_date',{ascending:false}),
    supabase.from('payments').select('*').eq('customer_id',id).order('created_at',{ascending:false}),
    supabase.from('credit_transactions').select('*').eq('customer_id',id).order('created_at',{ascending:false}),
    supabase.from('media').select('*').eq('customer_id',id).order('created_at',{ascending:false})
  ]); [c,a,s,h,p,cr,m].forEach(ok)
  return {customer:c.data, appointments:a.data, services:s.data, systems:h.data, payments:p.data, credits:cr.data, media:m.data}
}
export async function saveCustomer(payload,id){ return ok(id ? await supabase.from('customers').update(payload).eq('id',id).select().single() : await supabase.from('customers').insert(payload).select().single()) }
export async function listProfiles(){ return ok(await supabase.from('profiles').select('id,full_name,role,active').eq('active',true).order('full_name')) }
export async function listAppointments(start,end){
  let q=supabase.from('appointments').select('*,customers(id,name,whatsapp_name,phone),profiles!appointments_assigned_user_id_fkey(id,full_name)').order('scheduled_at')
  if(start) q=q.gte('scheduled_at',start); if(end) q=q.lt('scheduled_at',end)
  return ok(await q)
}
export async function saveAppointment(payload,id){ return ok(id ? await supabase.from('appointments').update(payload).eq('id',id).select().single() : await supabase.from('appointments').insert(payload).select().single()) }
export async function listServices(limit=300){ return ok(await supabase.from('services').select('*,customers(id,name,whatsapp_name,phone),appointments(id,scheduled_at,duration_min,status),profiles!services_technician_id_fkey(id,full_name)').order('created_at',{ascending:false}).limit(limit)) }
export async function startService(payload){
  const {data,error}=await supabase.rpc('start_service',{p_customer_id:payload.customer_id,p_appointment_id:payload.appointment_id||null,p_service_type:payload.service_type,p_technician_id:payload.technician_id||null,p_started_at:payload.started_at||new Date().toISOString()})
  if(error)throw error; return data
}
export async function completeService(payload,consumptions=[]){
  const { data, error } = await supabase.rpc('complete_service', { p_payload: payload, p_consumptions: consumptions })
  if(error) throw error; return data
}
export async function listHairSystems(){ return ok(await supabase.from('hair_systems').select('*,customers(name,whatsapp_name)').order('created_at',{ascending:false})) }
export async function saveHairSystem(payload,id){ return ok(id ? await supabase.from('hair_systems').update(payload).eq('id',id).select().single() : await supabase.from('hair_systems').insert(payload).select().single()) }
export async function installHairSystem(systemId,customerId,serviceId=null){ const {data,error}=await supabase.rpc('install_hair_system',{p_system_id:systemId,p_customer_id:customerId,p_service_id:serviceId}); if(error)throw error; return data }
export async function listConsumables(){ return ok(await supabase.from('consumables').select('*').order('name')) }
export async function saveConsumable(payload,id){ return ok(id ? await supabase.from('consumables').update(payload).eq('id',id).select().single() : await supabase.from('consumables').insert(payload).select().single()) }
export async function adjustConsumable(id,qty,reason){ const {data,error}=await supabase.rpc('adjust_consumable',{p_consumable_id:id,p_delta:qty,p_reason:reason}); if(error)throw error; return data }
export async function createPayment(payload){ return ok(await supabase.from('payments').insert(payload).select().single()) }
export async function updatePayment(id,payload){ return ok(await supabase.from('payments').update(payload).eq('id',id).select().single()) }
export async function createCredit(payload){ return ok(await supabase.from('credit_transactions').insert(payload).select().single()) }
export async function listPayments(){ return ok(await supabase.from('payments').select('*,customers(name,whatsapp_name)').order('created_at',{ascending:false}).limit(500)) }
export async function listActivity(){ return ok(await supabase.from('activity_log').select('*,profiles(full_name)').order('created_at',{ascending:false}).limit(300)) }
export async function listMedia(){ return ok(await supabase.from('media').select('*,customers(id,name,whatsapp_name),services(id,service_type,completed_at)').order('created_at',{ascending:false}).limit(400)) }
export async function signedMedia(path){ const {data,error}=await supabase.storage.from('customer-media').createSignedUrl(path,3600); if(error)throw error; return data.signedUrl }
export async function uploadMedia(file, customerId, serviceId, kind, consent){
  const ext=file.name.split('.').pop()?.toLowerCase() || 'jpg'; const path=`${customerId}/${Date.now()}-${crypto.randomUUID()}.${ext}`
  let r=await supabase.storage.from('customer-media').upload(path,file,{upsert:false}); ok(r)
  return ok(await supabase.from('media').insert({customer_id:customerId,service_id:serviceId||null,kind,consent,storage_path:path}).select().single())
}
export async function deleteMedia(row){
  const storage = await supabase.storage.from('customer-media').remove([row.storage_path]); ok(storage)
  return ok(await supabase.from('media').delete().eq('id',row.id))
}
export async function exportAll(){
  const tables=['profiles','leads','customers','appointments','services','hair_systems','consumables','inventory_movements','payments','credit_transactions','media','activity_log']
  const out={exported_at:new Date().toISOString(),version:'2.1.0',data:{}}
  for(const t of tables){ const r=await supabase.from(t).select('*'); out.data[t]=ok(r) }
  return out
}
