export const money = (v) => new Intl.NumberFormat('en-MY', { style:'currency', currency:'MYR', maximumFractionDigits:2 }).format(Number(v || 0))
export const shortDate = (v) => v ? new Intl.DateTimeFormat('en-MY', { day:'2-digit', month:'short', year:'numeric' }).format(new Date(v)) : '—'
export const dateTime = (v) => v ? new Intl.DateTimeFormat('en-MY', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }).format(new Date(v)) : '—'
export const timeOnly = (v) => v ? new Intl.DateTimeFormat('en-MY', { hour:'2-digit', minute:'2-digit' }).format(new Date(v)) : '—'
export const classNames = (...xs) => xs.filter(Boolean).join(' ')

export const localDateKey = (value = new Date()) => {
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
export const localTimeValue = (value = new Date()) => {
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}
export const isoLocalInput = (d = new Date()) => `${localDateKey(d)}T${localTimeValue(d)}`
export const combineLocalDateTime = (date, time='10:00') => {
  if(!date) return null
  const [y,m,day] = date.split('-').map(Number)
  const [hh,mm] = (time||'10:00').split(':').map(Number)
  const d = new Date(y,(m||1)-1,day||1,hh||0,mm||0,0,0)
  return d.toISOString()
}
export const startOfWeek = (value = new Date(), weekStartsMonday = true) => {
  const d = new Date(value); d.setHours(0,0,0,0)
  const day = d.getDay(); const diff = weekStartsMonday ? (day===0?-6:1-day) : -day
  d.setDate(d.getDate()+diff); return d
}
export const addDays = (value, days) => { const d=new Date(value); d.setDate(d.getDate()+days); return d }
export const addMinutes = (value, minutes) => { const d=new Date(value); d.setMinutes(d.getMinutes()+Number(minutes||0)); return d }
export const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
export const todayISO = () => localDateKey(new Date())
export const isSameLocalDay = (a,b) => localDateKey(a)===localDateKey(b)
export const leadLabel = (x={}) => x.whatsapp_name?.trim() || x.name?.trim() || x.phone?.trim() || 'Unnamed lead'
export const customerLabel = (x={}) => x.name?.trim() || x.whatsapp_name?.trim() || x.phone?.trim() || 'Customer'
export const initials = (x={}) => customerLabel(x).slice(0,1).toUpperCase() || 'C'
export const mapsUrl = ({lat,lng,address}) => lat && lng
  ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
  : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address || '')}`
export const wazeUrl = ({lat,lng,address}) => lat && lng
  ? `https://www.waze.com/ul?ll=${lat}%2C${lng}&navigate=yes`
  : `https://www.waze.com/ul?q=${encodeURIComponent(address || '')}&navigate=yes`
