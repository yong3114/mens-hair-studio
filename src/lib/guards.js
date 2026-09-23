export const appointmentStatus=value=>typeof value==='string'?value:value?.status
export const canMoveAppointment=value=>!['in_progress','completed'].includes(appointmentStatus(value))
export const hairSystemStatus=value=>typeof value==='string'?value:value?.status
export const canDirectInstallHairSystem=value=>hairSystemStatus(value)==='available'

export function collapseConsultationJobs(rows=[]){
  const ordered=[...rows].sort((a,b)=>{
    const pa=a?.status==='in_progress'?0:1
    const pb=b?.status==='in_progress'?0:1
    return pa-pb || new Date(a?.scheduled_at||0)-new Date(b?.scheduled_at||0)
  })
  const seen=new Set()
  return ordered.filter(row=>{
    if(!String(row?.service_type||'').includes('Consultation'))return true
    const key=row?.lead_id?('lead:'+row.lead_id):row?.customer_id?('customer:'+row.customer_id):null
    if(!key)return true
    if(seen.has(key))return false
    seen.add(key)
    return true
  })
}
