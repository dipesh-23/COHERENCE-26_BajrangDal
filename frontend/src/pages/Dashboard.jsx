import React, { useState } from 'react';
import PatientUploader from '../components/PatientUploader';
import MatchReport from '../components/MatchReport';

const Dashboard = () => {
  const [results, setResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // This function sends data to your FastAPI backend
  const handleFindMatches = async (patientData) => {
    setIsLoading(true);
    try {
      const response = await fetch("http://127.0.0.1:8000/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patientData)
      });
      
      const data = await response.json();
      setResults(data.matches);
    } catch (error) {
      console.error("Error connecting to backend:", error);
      alert("Failed to connect to backend. Is FastAPI running?");
    }
    setIsLoading(false);
  };

  return (
    <div style={{ display: 'flex', gap: '2rem', padding: '2rem', fontFamily: 'sans-serif' }}>
      {/* Left Column: Input */}
      <div style={{ flex: 1, backgroundColor: '#f8f9fa', padding: '1.5rem', borderRadius: '8px' }}>
        <PatientUploader onFindMatches={handleFindMatches} isLoading={isLoading} />
      </div>

      {/* Right Column: Results */}
      <div style={{ flex: 1, padding: '1.5rem' }}>
        {isLoading ? (
          <h2>⏳ Searching 10,000+ Trials...</h2>
        ) : results ? (
          <MatchReport results={results} />
        ) : (
          <h2>Waiting for patient data...</h2>
        )}
      </div>
    </div>
  );
};

export default Dashboard;