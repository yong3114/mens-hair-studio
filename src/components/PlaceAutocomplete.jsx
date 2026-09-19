import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ExternalLink, LoaderCircle, MapPin, Search } from 'lucide-react'
import { googleMapsApiKey } from '../lib/supabase'
import { mapsUrl, wazeUrl } from '../lib/utils'

let googlePromise
function loadGoogle() {
  if (!googleMapsApiKey) return Promise.reject(new Error('Google Maps API key is missing'))
  if (window.google?.maps?.importLibrary) return Promise.resolve(window.google)
  if (googlePromise) return googlePromise

  googlePromise = new Promise((resolve, reject) => {
    const callback = `__hairStudioGoogleInit_${Date.now()}`
    window[callback] = () => {
      resolve(window.google)
      delete window[callback]
    }
    const s = document.createElement('script')
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(googleMapsApiKey)}&libraries=places&v=weekly&callback=${callback}`
    s.async = true
    s.defer = true
    s.onerror = () => reject(new Error('Unable to load Google Maps'))
    document.head.appendChild(s)
  })

  return googlePromise
}

function predictionText(prediction) {
  return prediction?.text?.toString?.() || prediction?.text || ''
}

export default function PlaceAutocomplete({ value, onChange, label='Search address', compact=false }) {
  const inputRef = useRef(null)
  const placesRef = useRef(null)
  const tokenRef = useRef(null)
  const requestIdRef = useRef(0)

  const initialAddress = value?.formatted_address || value?.address || ''
  const [query, setQuery] = useState(initialAddress)
  const [suggestions, setSuggestions] = useState([])
  const [status, setStatus] = useState(googleMapsApiKey ? 'loading' : 'missing')
  const [searching, setSearching] = useState(false)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [box, setBox] = useState(null)

  useEffect(() => {
    let alive = true
    if (!googleMapsApiKey) {
      setStatus('missing')
      return
    }

    loadGoogle()
      .then(async google => {
        const places = await google.maps.importLibrary('places')
        if (!alive) return
        placesRef.current = places
        tokenRef.current = new places.AutocompleteSessionToken()
        setStatus('ready')
      })
      .catch(error => {
        console.error('Google Places failed to load:', error)
        if (alive) setStatus('error')
      })

    return () => { alive = false }
  }, [])

  useEffect(() => {
    const address = value?.formatted_address || value?.address || ''
    if (address && address !== query && !open) setQuery(address)
    // Deliberately not depending on query: external saved value should update the field.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.formatted_address, value?.address])

  const updateBox = () => {
    const el = inputRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setBox({ left:r.left, top:r.bottom + 6, width:r.width })
  }

  useEffect(() => {
    if (!open) return
    updateBox()
    window.addEventListener('resize', updateBox)
    window.addEventListener('scroll', updateBox, true)
    return () => {
      window.removeEventListener('resize', updateBox)
      window.removeEventListener('scroll', updateBox, true)
    }
  }, [open])

  useEffect(() => {
    if (status !== 'ready' || !placesRef.current) return
    const text = query.trim()
    if (text.length < 2) {
      setSuggestions([])
      setOpen(false)
      return
    }

    const currentRequest = ++requestIdRef.current
    const timer = setTimeout(async () => {
      try {
        setSearching(true)
        const { AutocompleteSuggestion, AutocompleteSessionToken } = placesRef.current
        if (!tokenRef.current) tokenRef.current = new AutocompleteSessionToken()
        const { suggestions: result = [] } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: text,
          sessionToken: tokenRef.current,
          includedRegionCodes: ['my'],
          locationBias: { center: { lat: 1.4927, lng: 103.7414 }, radius: 70000 },
          region: 'my'
        })
        if (currentRequest !== requestIdRef.current) return
        const places = result.map(x => x.placePrediction).filter(Boolean).slice(0, 6)
        setSuggestions(places)
        setActiveIndex(-1)
        setOpen(true)
        setSearching(false)
        requestAnimationFrame(updateBox)
      } catch (error) {
        console.error('Google autocomplete request failed:', error)
        if (currentRequest === requestIdRef.current) {
          setSuggestions([])
          setOpen(false)
          setSearching(false)
          setStatus('error')
        }
      }
    }, 220)

    return () => clearTimeout(timer)
  }, [query, status])

  const selectSuggestion = async prediction => {
    try {
      setSearching(true)
      const place = prediction.toPlace()
      await place.fetchFields({ fields:['id','displayName','formattedAddress','location'] })
      const lat = place.location?.lat?.()
      const lng = place.location?.lng?.()
      const data = {
        place_name: place.displayName || predictionText(prediction),
        formatted_address: place.formattedAddress || predictionText(prediction),
        google_place_id: place.id || '',
        lat: Number.isFinite(lat) ? lat : null,
        lng: Number.isFinite(lng) ? lng : null,
        google_maps_url: Number.isFinite(lat) && Number.isFinite(lng)
          ? mapsUrl({lat,lng})
          : mapsUrl({address:place.formattedAddress || predictionText(prediction)})
      }
      setQuery(data.formatted_address)
      setSuggestions([])
      setOpen(false)
      setActiveIndex(-1)
      const { AutocompleteSessionToken } = placesRef.current
      tokenRef.current = new AutocompleteSessionToken()
      onChange?.(data)
      setSearching(false)
      setStatus('ready')
    } catch (error) {
      console.error('Google place details failed:', error)
      setSearching(false)
      setStatus('error')
    }
  }

  const keyDown = event => {
    if (!open || !suggestions.length) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex(i => Math.min(i + 1, suggestions.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex(i => Math.max(i - 1, 0))
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault()
      selectSuggestion(suggestions[activeIndex])
    } else if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  const data = value || {}
  const dropdown = useMemo(() => {
    if (!open || !box || !suggestions.length) return null
    return createPortal(
      <div className="place-suggestions" style={{left:box.left, top:box.top, width:box.width}} role="listbox">
        {suggestions.map((prediction, index) => (
          <button
            type="button"
            key={`${prediction.placeId || predictionText(prediction)}-${index}`}
            className={index === activeIndex ? 'active' : ''}
            onMouseDown={e => e.preventDefault()}
            onClick={() => selectSuggestion(prediction)}
            role="option"
            aria-selected={index === activeIndex}
          >
            <span className="place-result-icon"><MapPin size={17}/></span>
            <span className="place-result-copy">
              <strong>{predictionText(prediction)}</strong>
              <small>Google Maps result</small>
            </span>
          </button>
        ))}
        <div className="place-powered">Google Maps</div>
      </div>,
      document.body
    )
  }, [open, box, suggestions, activeIndex])

  return <div className={compact ? 'place-block compact' : 'place-block'}>
    <div className="field-label">{label}</div>
    <div className={`place-search ${status === 'error' ? 'has-error' : ''}`}>
      <Search size={19}/>
      <input
        ref={inputRef}
        value={query}
        onChange={e => {
          setQuery(e.target.value)
          if (status === 'error' && placesRef.current) setStatus('ready')
        }}
        onFocus={() => {
          if (suggestions.length) {
            setOpen(true)
            requestAnimationFrame(updateBox)
          }
        }}
        onBlur={() => setTimeout(() => setOpen(false), 140)}
        onKeyDown={keyDown}
        placeholder="Start typing: Bukit Indah, Eco Botanic..."
        autoComplete="off"
        spellCheck="false"
      />
      {(status === 'loading' || searching) && <LoaderCircle className="place-spinner" size={18}/>} 
    </div>
    {dropdown}
    {status === 'missing' && <div className="hint warning">Google Maps key not configured. You can still type the full address manually below.</div>}
    {status === 'error' && <div className="hint warning">Google address search is unavailable. Check Google API restrictions / billing, or use the manual address below.</div>}
    {data.formatted_address && <div className="selected-place">
      <div><MapPin size={17}/><div><strong>{data.place_name || 'Saved location'}</strong><span>{data.formatted_address}</span></div></div>
      <div className="inline-actions">
        <a className="btn btn-ghost btn-sm" target="_blank" rel="noreferrer" href={mapsUrl(data)}><ExternalLink size={15}/>Google Maps</a>
        <a className="btn btn-ghost btn-sm" target="_blank" rel="noreferrer" href={wazeUrl(data)}>Waze</a>
      </div>
    </div>}
  </div>
}
