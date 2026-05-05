import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';

export default function Dashboard() {
  const [projects,  setProjects]  = useState([]);
  const [people,    setPeople]    = useState([]);
  const [materials, setMaterials] = useState([]);

  useEffect(() => {
    api.get('/projects').then(r  => setProjects(r.data));
    api.get('/people').then(r    => setPeople(r.data));
    api.get('/materials').then(r => setMaterials(r.data));
  }, []);

  const upcoming = projects
    .filter(p => new Date(p.startDate) >= new Date())
    .slice(0, 5);

  const statusColor = s => ({
    concept:    'bg-gray-700 text-gray-300',
    bevestigd:  'bg-blue-800 text-blue-200',
    actief:     'bg-green-800 text-green-200',
    afgerond:   'bg-purple-800 text-purple-200',
    geannuleerd:'bg-red-900 text-red-300',
  }[s] || 'bg-gray-700 text-gray-300');

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Dashboard</h2>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Projecten', value: projects.length,  icon: '📁' },
          { label: 'Personen',  value: people.length,    icon: '👥' },
          { label: 'Materialen',value: materials.length, icon: '📦' },
        ].map(s => (
          <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="text-2xl mb-1">{s.icon}</div>
            <div className="text-3xl font-bold">{s.value}</div>
            <div className="text-sm text-gray-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Aankomende projecten */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="font-semibold mb-4 text-gray-300">Aankomende projecten</h3>
        {upcoming.length === 0 ? (
          <p className="text-gray-600 text-sm">Geen aankomende projecten</p>
        ) : (
          <div className="space-y-3">
            {upcoming.map(p => (
              <Link
                key={p.id}
                to={`/projects/${p.id}`}
                className="flex items-center justify-between hover:bg-gray-800 px-3 py-2 rounded-lg transition-colors"
              >
                <div>
                  <p className="font-medium text-sm">{p.name}</p>
                  <p className="text-xs text-gray-500">
                    {p.client} · {p.location}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500">
                    {format(new Date(p.startDate), 'd MMM', { locale: nl })}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(p.status)}`}>
                    {p.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
