import TrialCard from './TrialCard';
import React from 'react';


const MatchReport = ({ results }) => {
    const eligibleCount = results.filter(r => r.eligible).length;
  
    return (
      <div>
        <h2>📋 Recommendation Report</h2>
        <p>Found <strong>{eligibleCount}</strong> eligible trials out of {results.length} total.</p>
        
        <div style={{ marginTop: '1.5rem' }}>
          {results.map(trial => (
            <TrialCard key={trial.trial_id} trial={trial} />
          ))}
        </div>
      </div>
    );
  };
  
  export default MatchReport;