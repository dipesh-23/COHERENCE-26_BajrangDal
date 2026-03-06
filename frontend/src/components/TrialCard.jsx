import React from 'react';

const TrialCard = ({ trial }) => {
  const isEligible = trial.eligible;
  const scorePercent = (trial.score * 100).toFixed(0);

  return (
    <div style={{ 
      border: `2px solid ${isEligible ? '#28a745' : '#dc3545'}`, 
      borderRadius: '8px', 
      padding: '1rem', 
      marginBottom: '1rem',
      backgroundColor: 'white'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 'bold', color: '#6c757d' }}>{trial.trial_id}</span>
        <span style={{ 
          backgroundColor: isEligible ? '#d4edda' : '#f8d7da', 
          color: isEligible ? '#155724' : '#721c24',
          padding: '4px 8px', borderRadius: '12px', fontWeight: 'bold'
        }}>
          {isEligible ? `✅ ${scorePercent}% Match` : '❌ Ineligible'}
        </span>
      </div>
      
      <h3 style={{ margin: '0.5rem 0' }}>{trial.title}</h3>
      <p style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: '#495057' }}>{trial.sponsor} • {trial.phase}</p>

      {!isEligible && trial.reasons.length > 0 && (
        <div style={{ backgroundColor: '#fff3cd', padding: '8px', borderRadius: '4px', fontSize: '0.85rem' }}>
          <strong>Failed Criteria:</strong>
          <ul style={{ margin: '4px 0 0 0', paddingLeft: '20px' }}>
            {trial.reasons.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
};

// THIS is the line your file was missing! It exports the component.
export default TrialCard;