import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import { useMap } from 'react-leaflet';
import { useEffect } from 'react';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
});

L.Marker.prototype.options.icon = DefaultIcon;

const createCustomIcon = (color) => {
    return L.divIcon({
        className: 'custom-pin',
        html: `
            <div style="position: relative; width: 22px; height: 22px;">
                <div style="background-color: ${color}; width: 100%; height: 100%; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); position: relative; z-index: 10;"></div>
                <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 44px; height: 44px; background-color: ${color}; border-radius: 50%; opacity: 0.4; animation: ping-slow 2s cubic-bezier(0, 0, 0.2, 1) infinite; z-index: 1; pointer-events: none;"></div>
            </div>
        `,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
    });
};

function MapCenterer({ location }) {
    const map = useMap();
    useEffect(() => {
        if (location) {
            map.flyTo(location, 12, { animate: true, duration: 1 });
        }
    }, [location, map]);
    return null;
}

export default function TrialMap({ trials = [], patientLat, patientLng, trialColors = {}, focusedLocation }) {
    const center = patientLat && patientLng ? [patientLat, patientLng] : [20.5937, 78.9629];
    const zoom = patientLat ? 5 : 4;

    return (
        <div className="w-full h-[600px] rounded-2xl overflow-hidden border border-slate-200 shadow-sm relative z-0">
            <MapContainer center={center} zoom={zoom} style={{ height: '100%', width: '100%', zIndex: 0 }}>
                <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                    attribution='&copy; OpenStreetMap contributors'
                />
                
                {focusedLocation && <MapCenterer location={focusedLocation} />}

                {trials.map((t, index) => {
                    let lat = t.site_info?.lat;
                    let lng = t.site_info?.lng;
                    if (!lat || !lng) return null;
                    
                    // Add a tiny deterministic jitter so markers at the exact same hospital don't perfectly overlap
                    lat = lat + (index * 0.0001) - 0.0004;
                    lng = lng + (index * 0.0001) - 0.0004;
                    
                    const markerColor = trialColors[t.trial_id] || '#0D9488';
                    const customIcon = createCustomIcon(markerColor);
                    
                    return (
                        <Marker key={t.trial_id} position={[lat, lng]} icon={customIcon}>
                            <Popup>
                                <div className="p-1 min-w-[200px] font-sans">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: markerColor }}></div>
                                        <div className="px-2 py-1 rounded bg-slate-100 text-slate-800 font-bold text-xs">
                                            {t.match_score} / 100
                                        </div>
                                        <span className="text-xs font-semibold text-slate-600">{t.trial_id}</span>
                                    </div>
                                    <p className="font-bold text-sm text-slate-800">{t.site_info.location}</p>
                                    <p className="text-xs text-slate-500">{t.site_info.city}, {t.site_info.state}</p>
                                    {t.site_info.distance_miles !== null && (
                                        <p className="text-xs font-medium text-teal-600 mt-1 flex items-center gap-1">
                                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/></svg>
                                            {t.site_info.distance_miles} miles away
                                        </p>
                                    )}
                                </div>
                            </Popup>
                        </Marker>
                    );
                })}
            </MapContainer>
        </div>
    );
}
