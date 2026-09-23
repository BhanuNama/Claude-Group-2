import { Trophy } from 'lucide-react';
import RankingCard from './RankingCard';

export default function RankingList({ ranking }) {
  if (!ranking || ranking.length === 0) return null;

  return (
    <div className="section-card animate-fade-in">
      <div className="section-header">
        <div className="section-title">
          <div className="section-title-icon">
            <Trophy size={18} className="text-primary" />
          </div>
          <span>Differential <em>Diagnosis</em></span>
        </div>
        <span className="badge badge-primary-subtle font-semibold">
          {ranking.length} Candidates Evaluated
        </span>
      </div>

      <div className="section-body stagger" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
        {ranking.map((disease, idx) => (
          <RankingCard
            key={disease.id}
            disease={disease}
            rank={idx + 1}
          />
        ))}
      </div>
    </div>
  );
}
