import React, { useState } from 'react';

// Simple modal overlay component
export default function NewPatientModal({ isOpen, onClose, onSubmit }) {
    const [formData, setFormData] = useState({
        patient_id: '',
        patient_name: '',
        age: '',
        gender: '',
        zip_code: '',
        lat: '',
        lng: '',
        diagnoses: '',
        lab_values: '',
        medications: '',
        clinical_history: ''
    });

    if (!isOpen) return null;

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        
        let parsedLabs = {};
        try {
            if (formData.lab_values.trim()) {
                parsedLabs = JSON.parse(formData.lab_values);
            }
        } catch (err) {
            console.warn("Could not parse lab_values as JSON. Sending as empty.");
        }

        // Convert to the exact format expected by the backend `Patient` pydantic model
        const processedData = {
            patient_id: formData.patient_id,
            patient_name: formData.patient_name,
            age: parseInt(formData.age, 10) || 0,
            gender: formData.gender,
            zip_code: formData.zip_code,
            lat: parseFloat(formData.lat) || 0.0,
            lng: parseFloat(formData.lng) || 0.0,
            diagnoses: formData.diagnoses.split(',').map(d => d.trim()).filter(Boolean),
            medications: formData.medications.split(',').map(m => m.trim()).filter(Boolean),
            labs: parsedLabs,
            history_text: formData.clinical_history // Map clinical_history field to backend history_text
        };
        
        onSubmit(processedData);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                
                {/* Header */}
                <div className="bg-gradient-to-r from-[#0D9488] to-emerald-500 px-6 py-5 flex items-center justify-between text-white shrink-0">
                    <div>
                        <h2 className="text-xl font-black tracking-tight">Create New Patient Profile</h2>
                        <p className="text-teal-50 text-sm font-medium mt-0.5">Enter clinical data to run against the TrialSync engine</p>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
                        ✕
                    </button>
                </div>

                {/* Body / Form */}
                <div className="p-6 overflow-y-auto max-h-[70vh]">
                    <form id="new-patient-form" onSubmit={handleSubmit} className="space-y-6">
                        
                        {/* Section 1: Demographics */}
                        <div className="space-y-4">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">Demographics & Location</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <label className="block">
                                    <span className="text-sm font-bold text-slate-700 block mb-1.5">Patient ID</span>
                                    <input required type="text" name="patient_id" value={formData.patient_id} onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 font-mono text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all" placeholder="e.g. PT-1001" />
                                </label>
                                <label className="block">
                                    <span className="text-sm font-bold text-slate-700 block mb-1.5">Full Name</span>
                                    <input required type="text" name="patient_name" value={formData.patient_name} onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all" placeholder="e.g. John Doe" />
                                </label>
                            </div>
                            <div className="grid grid-cols-5 gap-4">
                                <label className="col-span-1 block">
                                    <span className="text-sm font-bold text-slate-700 block mb-1.5">Age</span>
                                    <input required type="number" name="age" value={formData.age} onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all" placeholder="0" />
                                </label>
                                <label className="col-span-2 block">
                                    <span className="text-sm font-bold text-slate-700 block mb-1.5">Gender</span>
                                    <select name="gender" value={formData.gender} onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all">
                                        <option value="">Select...</option>
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </label>
                                <label className="col-span-2 block">
                                    <span className="text-sm font-bold text-slate-700 block mb-1.5">Zip Code</span>
                                    <input type="text" name="zip_code" value={formData.zip_code} onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all" placeholder="e.g. 10001" />
                                </label>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <label className="block">
                                    <span className="text-sm font-bold text-slate-700 block mb-1.5">Latitude (Optional)</span>
                                    <input type="text" name="lat" value={formData.lat} onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 font-mono text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all" placeholder="e.g. 40.7128" />
                                </label>
                                <label className="block">
                                    <span className="text-sm font-bold text-slate-700 block mb-1.5">Longitude (Optional)</span>
                                    <input type="text" name="lng" value={formData.lng} onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 font-mono text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all" placeholder="e.g. -74.0060" />
                                </label>
                            </div>
                        </div>

                        {/* Section 2: Clinical Data */}
                        <div className="space-y-4">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2 mt-4">Clinical Data</h3>
                            <label className="block">
                                <span className="text-sm font-bold text-slate-700 block mb-1.5">Diagnoses (comma separated)</span>
                                <input required type="text" name="diagnoses" value={formData.diagnoses} onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all" placeholder="e.g. Breast Cancer, Type 2 Diabetes" />
                            </label>
                            <label className="block">
                                <span className="text-sm font-bold text-slate-700 block mb-1.5">Lab Values (JSON or text summary)</span>
                                <input type="text" name="lab_values" value={formData.lab_values} onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all font-mono text-xs" placeholder='e.g. {"HbA1c": 6.5, "eGFR": 90}' />
                            </label>
                            <label className="block">
                                <span className="text-sm font-bold text-slate-700 block mb-1.5">Medications (comma separated)</span>
                                <input type="text" name="medications" value={formData.medications} onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all" placeholder="e.g. Metformin, Insulin" />
                            </label>
                            <label className="block">
                                <span className="text-sm font-bold text-slate-700 block mb-1.5">Clinical History Notes</span>
                                <textarea name="clinical_history" value={formData.clinical_history} onChange={handleChange} rows={3} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all" placeholder="Free text notes about prior treatments, surgeries, or exclusions..." />
                            </label>
                        </div>
                    </form>
                </div>

                {/* Footer / Actions */}
                <div className="bg-slate-50 border-t border-slate-100 px-6 py-4 flex items-center justify-end gap-3 shrink-0">
                    <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition-colors">
                        Cancel
                    </button>
                    <button type="submit" form="new-patient-form" className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-slate-900 border-2 border-slate-700 shadow-md hover:bg-teal-600 hover:border-teal-500 transition-all flex items-center gap-2">
                        <span>🚀</span> Run Engine
                    </button>
                </div>

            </div>
        </div>
    );
}
