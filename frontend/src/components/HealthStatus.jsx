import { useState, useEffect } from 'react';
import { Server, Database, Cpu } from 'lucide-react';
import { checkHealth } from '../utils/api';

const SERVICE_ICONS = {
  api: Server,
  neo4j: Database,
  llm: Cpu,
};

export default function HealthStatus() {
  const [health, setHealth] = useState({ api: 'unknown', neo4j: 'unknown', llm: 'unknown' });

  useEffect(() => {
    const check = () => checkHealth().then(setHealth);
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatus = (val) => {
    if (val === 'ok') return 'ok';
    if (val === 'unknown' || val === 'not configured') return 'unknown';
    return 'error';
  };

  return (
    <div className="health-status-container">
      {['api', 'neo4j', 'llm'].map(key => {
        const Icon = SERVICE_ICONS[key] || Server;
        const status = getStatus(health[key]);

        return (
          <div className="health-row" key={key}>
            <div className="flex items-center gap-xs">
              <Icon size={12} className="text-secondary" />
              <span className="health-label">{key.toUpperCase()}</span>
            </div>
            <div className="flex items-center gap-xs">
              <span className={`status-dot ${status}`} />
              <span className="health-status">{health[key]}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
