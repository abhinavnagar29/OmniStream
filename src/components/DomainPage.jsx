import React, { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import Dashboard from './Dashboard';

function DomainPage({ recommendations, loading }) {
  const { domain } = useParams();

  const filtered = useMemo(() => {
    if (!domain) return recommendations;
    return (recommendations || []).filter((r) => r.domain === domain);
  }, [domain, recommendations]);

  return <Dashboard recommendations={filtered} loading={loading} />;
}

export default DomainPage;
