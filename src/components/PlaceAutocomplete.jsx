import React, { useEffect, useRef, useState } from 'react'
import { MapPin, ExternalLink } from 'lucide-react'
import { googleMapsApiKey } from '../lib/supabase'
import { mapsUrl, wazeUrl } from '../lib/utils'

let googlePromise
function loadGoogle() {
  if (!googleMapsApiKey) return Promise.reject(new Error('Google Maps API key is missing'))
  if (window.google?.maps?.importLibrary) return Promise.resolve(window.google)
  if (googlePromise) return googlePromise
  googlePromise = new Promise((resolve, reject) => {
    const callback = `__hairStudioGoogleInit_${Date.now()}`
    window[callback] = () => { resolve(window.google); delete window[callback] }
    const s = document.createElement('script')
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(googleMapsApiKey)}&libraries=places&v=weekly&callback=${callback}`
    s.async = true; s.defer = true; s.onerror = () => reject(new Error('Unable to load Google Maps'))
    document.head.appendChild(s)
  })
  return googlePromise
}

export default function PlaceAutocomplete({ value, onChange, label='Search address', compact=false }) {
  const host = useRef(null)
  const [status,setStatus]=useState('idle')
  useEffect(()=>{
    let alive=true, element
    if(!googleMapsApiKey){ setStatus('missing'); return }
    setStatus('loading')
    loadGoogle().then(async google=>{
      const { PlaceAutocompleteElement } = await google.maps.importLibrary('places')
      if(!alive || !host.current) return
      host.current.innerHTML=''
      element = new PlaceAutocompleteElement()
      element.placeholder = value?.formatted_address || value?.address || 'Start typing an address...'
      element.includedRegionCodes = ['my']
      element.locationBias = { center:{ lat:1.4927, lng:103.7414 }, radius:70000 }
      element.style.width='100%'
      element.addEventListener('gmp-select', async (event)=>{
        const place = event.placePrediction.toPlace()
        await place.fetchFields({ fields:['id','displayName','formattedAddress','location'] })
        const lat=place.location?.lat(), lng=place.location?.lng()
        onChange?.({
          place_name: place.displayName || '',
          formatted_address: place.formattedAddress || '',
          google_place_id: place.id || '',
          lat, lng,
          google_maps_url: lat && lng ? mapsUrl({lat,lng}) : mapsUrl({address:place.formattedAddress})
        })
      })
      host.current.appendChild(element); setStatus('ready')
    }).catch(()=> alive && setStatus('error'))
    return ()=>{ alive=false; if(host.current) host.current.innerHTML='' }
  },[])

  const data=value||{}
  return <div className={compact?'place-block compact':'place-block'}>
    <div className="field-label">{label}</div>
    <div ref={host} className="google-place-host" />
    {status==='missing' && <div className="hint warning">Google Maps key not configured. You can still type the address manually below.</div>}
    {status==='error' && <div className="hint warning">Google address search could not load. Check the API key / Places API.</div>}
    {data.formatted_address && <div className="selected-place">
      <div><MapPin size={17}/><div><strong>{data.place_name || 'Saved location'}</strong><span>{data.formatted_address}</span></div></div>
      <div className="inline-actions">
        <a className="btn btn-ghost btn-sm" target="_blank" rel="noreferrer" href={mapsUrl(data)}><ExternalLink size={15}/>Google Maps</a>
        <a className="btn btn-ghost btn-sm" target="_blank" rel="noreferrer" href={wazeUrl(data)}>Waze</a>
      </div>
    </div>}
  </div>
}
