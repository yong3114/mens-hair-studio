import { addDays, combineLocalDateTime, localDateKey, localTimeValue, startOfWeek } from './utils'

export const serviceTypes=['Free Home Consultation','Studio Consultation','New System Installation','Maintenance','Cleaning + Rebond','Haircut / Adjustment','Hairline Touch-up','Other']
export const serviceDurations={'Free Home Consultation':30,'Studio Consultation':30,'New System Installation':180,'Maintenance':90,'Cleaning + Rebond':120,'Haircut / Adjustment':45,'Hairline Touch-up':45,'Other':60}
export const SLOT_START=8
export const SLOT_END=22
export const SLOT_MINUTES=30

export const appointmentBlank = (when = new Date(Date.now()+86400000)) => ({
  customer_id:'',service_type:'Maintenance',date:localDateKey(when),time:localTimeValue(when),duration_min:90,assigned_user_id:'',location_type:'studio',address:'',place_name:'',google_place_id:'',lat:null,lng:null,google_maps_url:'',status:'confirmed',notes:'',travel_buffer_before:0,travel_buffer_after:0
})
export const appointmentToForm = (x) => ({...appointmentBlank(new Date(x.scheduled_at)),...x,customer_id:x.customer_id||'',assigned_user_id:x.assigned_user_id||'',date:localDateKey(x.scheduled_at),time:localTimeValue(x.scheduled_at)})
export const formToAppointment = (f) => ({...f,scheduled_at:combineLocalDateTime(f.date,f.time),duration_min:Number(f.duration_min||60),travel_buffer_before:Number(f.travel_buffer_before||0),travel_buffer_after:Number(f.travel_buffer_after||0),assigned_user_id:f.assigned_user_id||null,customer_id:f.customer_id||null})

export function monthCells(cursor){
  const first=new Date(cursor.getFullYear(),cursor.getMonth(),1)
  const start=startOfWeek(first,true)
  return Array.from({length:42},(_,i)=>addDays(start,i))
}
export function weekDays(cursor){const s=startOfWeek(cursor,true);return Array.from({length:7},(_,i)=>addDays(s,i))}
export function slotTimes(){const out=[];for(let h=SLOT_START;h<SLOT_END;h++){out.push(`${String(h).padStart(2,'0')}:00`,`${String(h).padStart(2,'0')}:30`)}return out}
export function slotIndex(value){const d=value instanceof Date?value:new Date(value);return ((d.getHours()-SLOT_START)*60+d.getMinutes())/SLOT_MINUTES}
export function eventHeight(duration){return Math.max(1,Number(duration||30)/SLOT_MINUTES)}
export function moveAppointmentTo(appointment,date,time=null){return {...appointment,scheduled_at:combineLocalDateTime(localDateKey(date),time||localTimeValue(appointment.scheduled_at))}}
export function rangeForView(view,cursor){
  if(view==='month'){const start=new Date(cursor.getFullYear(),cursor.getMonth()-1,1);const end=new Date(cursor.getFullYear(),cursor.getMonth()+2,1);return[start,end]}
  if(view==='week'){const start=startOfWeek(cursor,true);const end=addDays(start,7);return[start,end]}
  const start=new Date(cursor);start.setHours(0,0,0,0);const end=addDays(start,1);return[start,end]
}
