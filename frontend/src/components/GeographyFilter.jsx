import React, { useState, useEffect, useRef } from 'react';

// ─── Snap values ─────────────────────────────────────────────────────────────
// Value 9999 = 'Any' — no radius constraint sent to POST /match
const RADIUS_SNAPS = [10, 25, 50, 100, 250, 500, 9999];
const RADIUS_LABELS = ['10mi', '25mi', '50mi', '100mi', '250mi', '500mi', 'Any'];

function snapIndexToMiles(idx) { return RADIUS_SNAPS[idx] ?? 50; }
function milesToSnapIndex(miles) {
    const idx = RADIUS_SNAPS.indexOf(miles);
    return idx === -1 ? 2 : idx; // default 50mi
}
function isValidZip(z) { return /^\d{5}$/.test(z); }
function sliderFill(index) {
    return Math.round((index / (RADIUS_SNAPS.length - 1)) * 100);
}

const DEFAULT_FILTERS = { zip: '10001', radius_miles: 50, hpsa_only: false };

export default function GeographyFilter({
    // Exact output: { zip, radius_miles, hpsa_only } — forwarded by Dashboard to POST /match
    onFilterChange = () => { },
    userRole = 'doctor',  // 'doctor' | 'nurse'  (patient never sees this panel)
}) {
    const [zip, setZip] = useState(DEFAULT_FILTERS.zip);
    const [sliderIdx, setSliderIdx] = useState(milesToSnapIndex(DEFAULT_FILTERS.radius_miles));
    const [hpsaOnly, setHpsaOnly] = useState(DEFAULT_FILTERS.hpsa_only);
    const debounceRef = useRef(null);

    const validZip = isValidZip(zip);
    const zipEmpty = zip.trim() === '';
    const radiusMiles = snapIndexToMiles(sliderIdx);
    const fill = sliderFill(sliderIdx);

    // Teal gradient: left = #0D9488, right = #CCFBF1 (empty track)
    const trackGrad = `linear-gradient(to right, #0D9488 0%, #14B8A6 ${fill}%, #CCFBF1 ${fill}%)`;

    // ── Debounced emit ───────────────────────────────────────────────────────────
    useEffect(() => {
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            // EXACT shape consumed by Dashboard → POST /match `filters`
            onFilterChange({
                zip: validZip ? zip : '',
                radius_miles: radiusMiles,
                hpsa_only: hpsaOnly,
            });
        }, 300);
        return () => clearTimeout(debounceRef.current);
    }, [zip, sliderIdx, hpsaOnly]);

    // ── Summary text ─────────────────────────────────────────────────────────────
    const summary = (() => {
        if (!validZip) return { text: 'Enter ZIP to enable location filtering', cls: 'text-slate-400 italic' };
        if (hpsaOnly) return { text: `⭐ HPSA-priority trials near ${zip}`, cls: 'text-amber-700' };
        const dist = radiusMiles === 9999 ? 'any distance' : `${radiusMiles} miles`;
        return { text: `Showing trials within ${dist} of ${zip}`, cls: 'text-teal-700' };
    })();

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-teal-50 p-4">
            <style>{`
        .geo-slider { -webkit-appearance:none; appearance:none; height:6px; border-radius:9999px; outline:none; cursor:pointer; width:100%; }
        .geo-slider::-webkit-slider-thumb {
          -webkit-appearance:none; appearance:none;
          width:18px; height:18px; border-radius:50%;
          background:#0D9488; border:2.5px solid #fff;
          box-shadow:0 1px 5px rgba(13,148,136,0.4);
          cursor:pointer; transition:transform .15s;
        }
        .geo-slider::-webkit-slider-thumb:hover { transform:scale(1.25); }
        .geo-slider::-moz-range-thumb {
          width:18px; height:18px; border-radius:50%;
          background:#0D9488; border:2.5px solid #fff; cursor:pointer;
        }
        .geo-slider:disabled { opacity:0.35; cursor:not-allowed; }
        @keyframes scaleIn { from{opacity:0;transform:scale(.5)} to{opacity:1;transform:scale(1)} }
        .anim-scale { animation:scaleIn .15s ease-out forwards; }
      `}</style>

            {/* ── Section header ── */}
            <p className="text-[#0F766E] text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 mb-3">
                📍 Location Filter
            </p>

            {/* ── ZIP Input ── */}
            <div className="relative flex items-center mb-4">
                <span className="absolute left-3 text-teal-400 text-sm pointer-events-none">📍</span>
                <input
                    type="text"
                    value={zip}
                    onChange={e => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
                    placeholder="ZIP Code"
                    maxLength={5}
                    className={`w-full bg-white border-2 rounded-xl pl-9 pr-9 py-2.5 text-slate-800 text-sm outline-none
            placeholder-slate-300 transition-all duration-200 shadow-sm
            focus:ring-4
            ${!zipEmpty && !validZip
                            ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
                            : validZip
                                ? 'border-teal-300 focus:border-[#0D9488] focus:ring-[#0D9488]/10'
                                : 'border-teal-100 focus:border-[#0D9488] focus:ring-[#0D9488]/10'
                        }`}
                />
                {!zipEmpty && (
                    <span className="absolute right-3 anim-scale text-sm pointer-events-none">
                        {validZip
                            ? <span className="text-teal-500">✅</span>
                            : <span className="text-red-400 font-bold">✗</span>
                        }
                    </span>
                )}
            </div>

            {/* ── All controls locked until ZIP valid ── */}
            <div className={`space-y-4 transition-opacity duration-200 ${!validZip ? 'opacity-40 pointer-events-none' : ''}`}>

                {/* ── Radius Slider ── */}
                <div className={hpsaOnly ? 'opacity-40 pointer-events-none' : ''}>
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-slate-500 text-xs font-semibold">Search Radius</span>
                        <span className="text-[#0D9488] text-xs font-bold tabular-nums">
                            {radiusMiles === 9999 ? 'Any' : `${radiusMiles} mi`}
                        </span>
                    </div>

                    {/* Slider + floating bubble */}
                    <div className="relative pt-7">
                        <div
                            className="absolute top-0.5 text-[10px] font-semibold bg-[#0D9488] text-white rounded-full px-2 py-0.5 shadow-md pointer-events-none whitespace-nowrap transition-all duration-100"
                            style={{ left: `calc(${fill}% - ${fill * 0.22}px)` }}
                        >
                            {radiusMiles === 9999 ? 'Any' : `${radiusMiles}mi`}
                        </div>
                        <input
                            type="range"
                            min={0} max={RADIUS_SNAPS.length - 1} step={1}
                            value={sliderIdx}
                            onChange={e => setSliderIdx(Number(e.target.value))}
                            className="geo-slider"
                            style={{ background: hpsaOnly ? '#CCFBF1' : trackGrad }}
                            title={hpsaOnly ? 'HPSA mode searches all distances' : undefined}
                        />
                    </div>

                    {/* Quick-select pills */}
                    <div className="flex flex-wrap gap-1.5 mt-3">
                        {RADIUS_LABELS.map((label, idx) => (
                            <button
                                key={label}
                                onClick={() => setSliderIdx(idx)}
                                className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-all duration-150
                  ${sliderIdx === idx
                                        ? 'bg-[#0D9488] border-[#0D9488] text-white shadow-md shadow-[#0D9488]/30'
                                        : 'bg-white border-teal-100 text-slate-400 hover:border-teal-300 hover:text-teal-700'
                                    }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── HPSA Toggle ── */}
                <div className={`flex items-center justify-between p-3 rounded-xl border transition-all duration-200
          ${hpsaOnly ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-100'}`}
                >
                    <div>
                        <p className="text-slate-700 text-sm font-semibold">⭐ HPSA Priority</p>
                        <p className="text-slate-400 text-[10px] leading-tight mt-0.5">
                            {hpsaOnly ? 'Searches all distances' : 'Underserved area bonus weighting'}
                        </p>
                    </div>
                    <button
                        onClick={() => setHpsaOnly(h => !h)}
                        className={`relative w-11 h-6 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-400
              ${hpsaOnly ? 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.4)]' : 'bg-slate-200'}`}
                        role="switch"
                        aria-checked={hpsaOnly}
                    >
                        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow flex items-center justify-center text-[10px] transition-transform duration-200
              ${hpsaOnly ? 'translate-x-5' : 'translate-x-1'}`}>
                            {hpsaOnly ? '⭐' : ''}
                        </span>
                    </button>
                </div>

                {/* ── Filter Summary ── */}
                <div className={`rounded-xl px-3 py-2 border text-xs
          ${hpsaOnly
                        ? 'bg-amber-50 border-amber-100'
                        : 'bg-teal-50 border-teal-100'}`}
                >
                    <p className={summary.cls}>{summary.text}</p>
                </div>
            </div>
        </div>
    );
}
