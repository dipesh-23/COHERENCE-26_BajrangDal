import React, { useState, useEffect, useRef } from 'react';

// ─── Snap radius values ───────────────────────────────────────────────────────
// Maps slider index (0-5) → actual miles value sent to POST /match filters.radius_miles
// 9999 = internal sentinel for 'Any' distance (no radius constraint)
const RADIUS_SNAPS = [10, 25, 50, 100, 250, 9999];
const RADIUS_LABELS = ['10mi', '25mi', '50mi', '100mi', '250mi', 'Any'];

function snapIndexToMiles(idx) { return RADIUS_SNAPS[idx] ?? 50; }
function milesToSnapIndex(miles) {
    const idx = RADIUS_SNAPS.indexOf(miles);
    return idx === -1 ? 2 : idx; // default to index 2 (50mi)
}

// ── Default filter shape — matches POST /match filters field ──────────────────
// Once the backend is live, Dashboard will forward this directly to
// POST /match as { patient_id, top_k, filters: { zip, radius_miles, hpsa_only } }
const DEFAULT_FILTERS = {
    zip: '10001',
    radius_miles: 50,
    hpsa_only: false,
};

// ─── ZIP validation ───────────────────────────────────────────────────────────
function isValidZip(z) { return /^\d{5}$/.test(z); }

// ─── Track fill % for slider gradient ────────────────────────────────────────
function sliderFill(index) {
    return Math.round((index / (RADIUS_SNAPS.length - 1)) * 100);
}

export default function GeographyFilter({
    // Called whenever filters change — Dashboard feeds this directly to matchTrials()
    onFilterChange = () => { },
}) {
    const [zip, setZip] = useState(DEFAULT_FILTERS.zip);
    const [sliderIdx, setSliderIdx] = useState(milesToSnapIndex(DEFAULT_FILTERS.radius_miles));
    const [hpsaOnly, setHpsaOnly] = useState(DEFAULT_FILTERS.hpsa_only);

    const debounceRef = useRef(null);

    // ── Derived values ──
    const validZip = isValidZip(zip);
    const zipEmpty = zip.trim() === '';
    const radiusMiles = snapIndexToMiles(sliderIdx);
    const filtersActive = validZip; // controls disable state of sub-sections

    // ── Emit filter change with 300ms debounce ──
    useEffect(() => {
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            // ── BACKEND MERGE POINT ──────────────────────────────────────────────────
            // This exact shape is consumed by Dashboard → POST /match as `filters`
            // { zip, radius_miles, hpsa_only }
            onFilterChange({
                zip: validZip ? zip : '',
                radius_miles: radiusMiles,
                hpsa_only: hpsaOnly,
            });
            // ── END BACKEND MERGE POINT ──────────────────────────────────────────────
        }, 300);
        return () => clearTimeout(debounceRef.current);
    }, [zip, sliderIdx, hpsaOnly]);

    // ── Summary text ──
    const summaryText = (() => {
        if (!validZip && !zipEmpty) return { text: 'Enter a valid ZIP code to filter by location', style: 'italic text-slate-500' };
        if (zipEmpty) return { text: 'Enter ZIP to enable location filtering', style: 'italic text-slate-500' };
        if (hpsaOnly) return { text: `Showing HPSA-priority trials near ${zip} ⭐`, style: 'text-amber-400 font-medium' };
        const dist = radiusMiles === 9999 ? 'any distance' : `${radiusMiles} miles`;
        return { text: `Showing trials within ${dist} of ${zip}`, style: 'text-slate-300' };
    })();

    // ── Track gradient color: blue (low radius) → green (high) ──
    const fill = sliderFill(sliderIdx);
    const trackColor = `linear-gradient(to right, #3B82F6 0%, #10B981 ${fill}%, #334155 ${fill}%)`;

    return (
        <div className="flex flex-col">
            <style>{`
        /* Custom range input */
        .geo-slider { -webkit-appearance: none; appearance: none; height: 6px; border-radius: 9999px; outline: none; cursor: pointer; width: 100%; transition: opacity 0.2s; }
        .geo-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 18px; height: 18px; border-radius: 50%; background: #3B82F6; border: 2px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.3); cursor: pointer; transition: transform 0.15s; }
        .geo-slider::-webkit-slider-thumb:hover { transform: scale(1.2); }
        .geo-slider::-moz-range-thumb { width: 18px; height: 18px; border-radius: 50%; background: #3B82F6; border: 2px solid #fff; cursor: pointer; }
        @keyframes scaleIn { from { opacity:0; transform:scale(0.6); } to { opacity:1; transform:scale(1); } }
        .animate-scale-in { animation: scaleIn 0.15s ease-out forwards; }
      `}</style>

            {/* ── 1. Section Header ── */}
            <div className="border-t border-slate-700 pt-4 mt-2 mb-2">
                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5">
                    <span>📍</span> Location Filter
                </span>
            </div>

            {/* ── 2. ZIP Input ── */}
            <div className="relative flex items-center">
                <span className="absolute left-3 text-slate-500 text-sm pointer-events-none">📍</span>
                <input
                    type="text"
                    value={zip}
                    onChange={e => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
                    placeholder="ZIP Code"
                    maxLength={5}
                    className={`w-full bg-slate-800 border rounded-xl pl-9 pr-9 py-2.5 text-white text-sm outline-none transition-all duration-200
            focus:ring-2 focus:ring-blue-500/20
            ${!zipEmpty && !validZip ? 'border-red-500 focus:border-red-500' : validZip ? 'border-emerald-500 focus:border-emerald-500' : 'border-slate-600 focus:border-blue-500'}`}
                />
                {/* Validation icon */}
                {!zipEmpty && (
                    <span className="absolute right-3 animate-scale-in text-sm pointer-events-none">
                        {validZip ? '✅' : <span className="text-red-500 font-bold">✗</span>}
                    </span>
                )}
            </div>

            {/* ── Controls guarded by zip validity ── */}
            <div className={`transition-opacity duration-200 ${!filtersActive ? 'opacity-40 pointer-events-none' : ''}`}>

                {/* ── 3. Radius Slider ── */}
                <div className={`mt-4 ${hpsaOnly ? 'opacity-40 pointer-events-none' : ''}`}>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-slate-400 text-xs font-semibold">Radius</span>
                        <span className="text-blue-400 text-xs font-bold tabular-nums">
                            {radiusMiles === 9999 ? 'Any' : `${radiusMiles} mi`}
                        </span>
                    </div>
                    <div className="relative">
                        {/* Floating bubble above thumb */}
                        <div
                            className="absolute -top-7 text-[10px] font-bold text-white bg-blue-600 rounded px-1.5 py-0.5 pointer-events-none transition-all duration-150 shadow-sm"
                            style={{ left: `calc(${fill}% - ${fill * 0.28}px)` }}
                        >
                            {radiusMiles === 9999 ? 'Any' : `${radiusMiles}mi`}
                        </div>
                        <input
                            type="range"
                            min={0}
                            max={RADIUS_SNAPS.length - 1}
                            step={1}
                            value={sliderIdx}
                            onChange={e => setSliderIdx(Number(e.target.value))}
                            className="geo-slider"
                            style={{ background: hpsaOnly ? '#334155' : trackColor }}
                            title={hpsaOnly ? 'HPSA mode ignores radius' : undefined}
                        />
                    </div>

                    {/* ── 4. Radius Quick Pills ── */}
                    <div className="flex flex-wrap gap-1.5 mt-3">
                        {RADIUS_LABELS.map((label, idx) => (
                            <button
                                key={label}
                                onClick={() => setSliderIdx(idx)}
                                className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-all duration-150
                  ${sliderIdx === idx
                                        ? 'bg-blue-500 border-blue-400 text-white shadow-sm'
                                        : 'bg-transparent border-slate-600 text-slate-400 hover:border-slate-400 hover:text-slate-300'
                                    }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── 5. HPSA Toggle ── */}
                <div className="flex items-center justify-between mt-4">
                    <div className="flex flex-col">
                        <span className="text-slate-300 text-sm font-semibold flex items-center gap-1.5">
                            ⭐ HPSA Priority
                        </span>
                        <span className="text-slate-500 text-[10px] mt-0.5">Underserved area bonus weighting</span>
                    </div>

                    {/* Custom 36×20 toggle */}
                    <button
                        onClick={() => setHpsaOnly(h => !h)}
                        className={`relative w-[44px] h-[24px] rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500
              ${hpsaOnly
                                ? 'bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.4)] focus:ring-offset-slate-900'
                                : 'bg-slate-600 focus:ring-offset-slate-900'
                            }`}
                        aria-checked={hpsaOnly}
                        role="switch"
                    >
                        <span
                            className={`absolute top-1 flex items-center justify-center w-4 h-4 bg-white rounded-full shadow-md text-[10px] transition-transform duration-200
                ${hpsaOnly ? 'translate-x-5' : 'translate-x-0.5'}`}
                        >
                            {hpsaOnly ? '⭐' : ''}
                        </span>
                    </button>
                </div>

                {/* ── 6. Filter Summary ── */}
                <div className="bg-slate-800/50 rounded-xl px-3 py-2 mt-3">
                    <p className={`text-xs ${summaryText.style}`}>
                        {summaryText.text}
                    </p>
                </div>

            </div>
        </div>
    );
}
