import React, { useState, useEffect, useRef } from 'react';

// ─── Snap radius values ───────────────────────────────────────────────────────
// 9999 = internal sentinel for 'Any' distance (no radius constraint)
const RADIUS_SNAPS = [10, 25, 50, 100, 250, 9999];
const RADIUS_LABELS = ['10mi', '25mi', '50mi', '100mi', '250mi', 'Any'];

function snapIndexToMiles(idx) { return RADIUS_SNAPS[idx] ?? 50; }
function milesToSnapIndex(miles) {
    const idx = RADIUS_SNAPS.indexOf(miles);
    return idx === -1 ? 2 : idx; // default 50mi
}

const DEFAULT_FILTERS = { zip: '10001', radius_miles: 50, hpsa_only: false };
function isValidZip(z) { return /^\d{5}$/.test(z); }
function sliderFill(index) {
    return Math.round((index / (RADIUS_SNAPS.length - 1)) * 100);
}

export default function GeographyFilter({
    // Produces { zip, radius_miles, hpsa_only } forwarded by Dashboard to POST /match
    onFilterChange = () => { },
}) {
    const [zip, setZip] = useState(DEFAULT_FILTERS.zip);
    const [sliderIdx, setSliderIdx] = useState(milesToSnapIndex(DEFAULT_FILTERS.radius_miles));
    const [hpsaOnly, setHpsaOnly] = useState(DEFAULT_FILTERS.hpsa_only);
    const debounceRef = useRef(null);

    const validZip = isValidZip(zip);
    const zipEmpty = zip.trim() === '';
    const radiusMiles = snapIndexToMiles(sliderIdx);
    const filtersActive = validZip;
    const fill = sliderFill(sliderIdx);

    // Teal-to-teal gradient for slider track
    const trackColor = `linear-gradient(to right, #0D9488 0%, #14B8A6 ${fill}%, #CCFBF1 ${fill}%)`;

    useEffect(() => {
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            onFilterChange({
                zip: validZip ? zip : '',
                radius_miles: radiusMiles,
                hpsa_only: hpsaOnly,
            });
        }, 300);
        return () => clearTimeout(debounceRef.current);
    }, [zip, sliderIdx, hpsaOnly]);

    const summaryText = (() => {
        if (!validZip && !zipEmpty) return { text: 'Enter a valid ZIP code to filter by location', cls: 'text-slate-400 italic' };
        if (zipEmpty) return { text: 'Enter ZIP to enable location filtering', cls: 'text-slate-400 italic' };
        if (hpsaOnly) return { text: `HPSA-priority trials near ${zip} ⭐`, cls: 'text-amber-600 font-medium' };
        const dist = radiusMiles === 9999 ? 'any distance' : `${radiusMiles} miles`;
        return { text: `Trials within ${dist} of ${zip}`, cls: 'text-teal-700 font-medium' };
    })();

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-teal-50 p-4">
            <style>{`
        .geo-slider { -webkit-appearance:none; appearance:none; height:6px; border-radius:9999px; outline:none; cursor:pointer; width:100%; transition:opacity .2s; }
        .geo-slider::-webkit-slider-thumb { -webkit-appearance:none; appearance:none; width:18px; height:18px; border-radius:50%; background:#0D9488; border:2px solid #fff; box-shadow:0 1px 4px rgba(0,0,0,.2); cursor:pointer; transition:transform .15s; }
        .geo-slider::-webkit-slider-thumb:hover { transform:scale(1.25); }
        .geo-slider::-moz-range-thumb { width:18px; height:18px; border-radius:50%; background:#0D9488; border:2px solid #fff; cursor:pointer; }
        @keyframes scaleIn { from{opacity:0;transform:scale(.6)} to{opacity:1;transform:scale(1)} }
        .anim-scale { animation:scaleIn .15s ease-out forwards; }
      `}</style>

            {/* ── Header ── */}
            <h3 className="text-[#0F766E] font-bold text-sm flex items-center gap-1.5 mb-3">
                📍 Location Filter
            </h3>

            {/* ── ZIP Input ── */}
            <div className="relative flex items-center mb-1">
                <span className="absolute left-3 text-teal-400 text-sm pointer-events-none">📍</span>
                <input
                    type="text"
                    value={zip}
                    onChange={e => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
                    placeholder="ZIP Code"
                    maxLength={5}
                    className={`w-full bg-white border-2 rounded-xl pl-9 pr-9 py-2.5 text-slate-800 text-sm outline-none transition-all duration-200 placeholder-slate-300
            focus:ring-4
            ${!zipEmpty && !validZip
                            ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
                            : validZip
                                ? 'border-teal-400 focus:border-[#0D9488] focus:ring-teal-100'
                                : 'border-slate-200 focus:border-[#0D9488] focus:ring-teal-100'}`}
                />
                {!zipEmpty && (
                    <span className="absolute right-3 anim-scale text-sm pointer-events-none">
                        {validZip ? '✅' : <span className="text-red-500 font-bold">✗</span>}
                    </span>
                )}
            </div>

            {/* ── Controls locked until ZIP valid ── */}
            <div className={`transition-opacity duration-200 ${!filtersActive ? 'opacity-40 pointer-events-none' : ''}`}>

                {/* ── Radius Slider ── */}
                <div className={`mt-4 ${hpsaOnly ? 'opacity-40 pointer-events-none' : ''}`}>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-slate-500 text-xs font-semibold">Search Radius</span>
                        <span className="text-[#0D9488] text-xs font-bold tabular-nums">
                            {radiusMiles === 9999 ? 'Any' : `${radiusMiles} mi`}
                        </span>
                    </div>

                    {/* Slider with floating bubble */}
                    <div className="relative pt-6 mb-1">
                        <div
                            className="absolute top-0 text-[10px] font-bold bg-[#0D9488] text-white rounded px-1.5 py-0.5 pointer-events-none shadow-sm"
                            style={{ left: `calc(${fill}% - ${fill * 0.28}px)` }}
                        >
                            {radiusMiles === 9999 ? 'Any' : `${radiusMiles}mi`}
                        </div>
                        <input
                            type="range"
                            min={0} max={RADIUS_SNAPS.length - 1} step={1}
                            value={sliderIdx}
                            onChange={e => setSliderIdx(Number(e.target.value))}
                            className="geo-slider"
                            style={{ background: hpsaOnly ? '#CCFBF1' : trackColor }}
                            title={hpsaOnly ? 'HPSA mode ignores radius' : undefined}
                        />
                    </div>

                    {/* Quick pills */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                        {RADIUS_LABELS.map((label, idx) => (
                            <button
                                key={label}
                                onClick={() => setSliderIdx(idx)}
                                className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-all duration-150
                  ${sliderIdx === idx
                                        ? 'bg-[#0D9488] border-[#0D9488] text-white shadow-sm'
                                        : 'bg-white border-teal-100 text-slate-500 hover:border-teal-300 hover:text-teal-700'}`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── HPSA Toggle ── */}
                <div className={`flex items-center justify-between mt-4 p-3 rounded-xl border transition-all duration-200
          ${hpsaOnly
                        ? 'bg-amber-50 border-amber-200 shadow-sm shadow-amber-100'
                        : 'bg-slate-50 border-slate-100'}`}
                >
                    <div>
                        <span className="text-slate-700 text-sm font-semibold flex items-center gap-1.5">
                            ⭐ HPSA Priority
                        </span>
                        <span className="text-slate-400 text-[10px]">Underserved area bonus weighting</span>
                    </div>
                    <button
                        onClick={() => setHpsaOnly(h => !h)}
                        className={`relative w-11 h-6 rounded-full transition-all duration-200 focus:outline-none
              ${hpsaOnly
                                ? 'bg-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.35)]'
                                : 'bg-slate-200'}`}
                        aria-checked={hpsaOnly}
                        role="switch"
                    >
                        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-md text-[10px] flex items-center justify-center transition-transform duration-200
              ${hpsaOnly ? 'translate-x-5' : 'translate-x-1'}`}>
                            {hpsaOnly ? '⭐' : ''}
                        </span>
                    </button>
                </div>

                {/* ── Summary chip ── */}
                <div className={`mt-3 rounded-xl px-3 py-2 text-xs ${hpsaOnly ? 'bg-amber-50 border border-amber-100' : 'bg-teal-50 border border-teal-100'}`}>
                    <p className={summaryText.cls}>{summaryText.text}</p>
                </div>
            </div>
        </div>
    );
}
