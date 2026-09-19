export const money = (v) => new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR', maximumFractionDigits: 2 }).format(Number(v || 0))
export const shortDate = (v) => v ? new Intl.DateTimeFormat('en-MY', { day:'2-digit', month:'short', year:'numeric' }).format(new Date(v)) : '—'
export const dateTime = (v) => v ? new Intl.DateTimeFormat('en-MY', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }).format(new Date(v)) : '—'
export const timeOnly = (v) => v ? new Intl.DateTimeFormat('en-MY', { hour:'2-digit', minute:'2-digit' }).format(new Date(v)) : '—'
export const isoLocalInput = (d = new Date()) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset()*60000)
  return z.toISOString().slice(0,16)
}
export const classNames = (...xs) => xs.filter(Boolean).join(' ')
export const mapsUrl = ({lat,lng,address}) => lat && lng
  ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
  : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address || '')}`
export const wazeUrl = ({lat,lng,address}) => lat && lng
  ? `https://www.waze.com/ul?ll=${lat}%2C${lng}&navigate=yes`
  : `https://www.waze.com/ul?q=${encodeURIComponent(address || '')}&navigate=yes`
export const todayISO = () => new Date().toISOString().slice(0,10)
export const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
