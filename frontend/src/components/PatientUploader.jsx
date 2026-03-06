import React, { useState } from 'react';

const PatientUploader = ({ onFindMatches, isLoading }) => {
  // Pre-filled with our working test data!
  const [patient, setPatient] = useState({
    patient_id: "PT-UI-001",
    age: 55,
    gender: "Male",
    zip_code: "94103",
    medical_history: "55-year-old male presenting with a 4-year history of Type 2 Diabetes Mellitus and essential hypertension. Currently poorly controlled on Metformin."
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // We format the data to perfectly match your Pydantic model before sending
    const payload = {
      ...patient,
      ethnicity: "Unknown",
      diagnoses: { "E11.9": "2020-05-15", "I10": "2018-10-01" },
      labs: { HbA1c: { value: 8.2, unit: "%", observation_date: "2026-02-10" } },
      medications: ["Metformin", "Lisinopril"]
    };
    
    onFindMatches(payload);
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <h2>🧬 Patient Profile</h2>
      
      <label>Age</label>
      <input type="number" value={patient.age} onChange={e => setPatient({...patient, age: parseInt(e.target.value)})} required />

      <label>Gender</label>
      <select value={patient.gender} onChange={e => setPatient({...patient, gender: e.target.value})}>
        <option>Male</option>
        <option>Female</option>
        <option>Other</option>
      </select>

      <label>ZIP Code</label>
      <input type="text" value={patient.zip_code} onChange={e => setPatient({...patient, zip_code: e.target.value})} required />

      <label>Clinical Narrative (Doctor's Note)</label>
      <textarea 
        rows="5" 
        value={patient.medical_history} 
        onChange={e => setPatient({...patient, medical_history: e.target.value})} 
        required 
      />

      <button 
        type="submit" 
        disabled={isLoading}
        style={{ padding: '10px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
      >
        {isLoading ? "Matching..." : "🔎 Find Eligible Trials"}
      </button>
    </form>
  );
};

export default PatientUploader;