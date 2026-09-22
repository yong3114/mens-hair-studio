export const appointmentStatus=value=>typeof value==='string'?value:value?.status
export const canMoveAppointment=value=>!['in_progress','completed'].includes(appointmentStatus(value))
export const hairSystemStatus=value=>typeof value==='string'?value:value?.status
export const canDirectInstallHairSystem=value=>hairSystemStatus(value)==='available'
