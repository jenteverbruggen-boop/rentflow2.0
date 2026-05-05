import { useEffect, useState } from 'react';
import api from '../api/client';
import { format, eachDayOfInterval, startOfWeek, endOfWeek, addWeeks, subWeeks, isSameDay } from 'date-fns';
import { nl } from 'date-fns/locale';

export default function Planning() {
  const [projects, setProjects] = useState([]);
  const [week,     setWeek]     = useState(new Date());

  useEffect(() => {
    api.get('/projects').then(r => setProjects(r.data));
  }, []);

  const days = eachDayOfInterval({
    start: startOfWeek(week, { weekStartsOn: 1 }),
    end:   endOfWeek(week,   { weekStartsOn: 1 })
  });

  const projectsOnDay = day =>
    projects.filter(p =>
      new Date(p.startDate) <= day && new Date(p.endDate) >= day
    );

  const statusColor = s => ({
    concept:    'bg-gray-700',
    bevestigd:  'bg-blue-800',
    actief:     'bg-green-800',
    afgerond:   'bg-purple-800',
    geannuleerd:'bg-red-900',
  }[s] || 'bg-gray-700');

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Planning</h2>
        <div className="flex items-center gap-3">
          <button onClick={() => setWeek(subWeeks(week, 1))}
            className="bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg text-sm">← Vorige</button>
          <span className="text-sm text-gray-400">
            {format(days[0], 'd MMM', { locale: nl })} – {format(days[6], 'd MMM yyyy', { locale: nl })}
          </span>
          <button onClick={() => setWeek(addWeeks(week, 1))}
            className="bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg text-sm">Volgende →</button>
          <button onClick={() => setWeek(new Date())}
            className="bg-blue-700 hover:bg-blue-600 px-3 py-1.5 rounded-lg text-sm">Vandaag</button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {days.map(day => {
          const dayProjects = projectsOnDay(day);
          const isToday     = isSameDay(day, new Date());

          return (
            <div key={day.toISOString()}
              className={`bg-gray-900 border rounded-xl p-3 min-h-32 ${
                isToday ? 'border-blue-500' : 'border-gray-800'
              }`}
            >
              <p className={`text-xs font-semibold mb-2 ${isToday ? 'text-blue-400' : 'text-gray-500'}`}>
                {format(day, 'EEE d', { locale: nl })}
              </p>
              <div className="space-y-1">
                {dayProjects.map(p => (
                  <div key={p.id}
                    className={`${statusColor(p.status)} rounded px-2 py-1`}
                    title={`${p.name} · ${p.people.length} personen · ${p.materials.length} materialen`}
                  >
                    <p className="text-xs font-medium truncate">{p.name}</p>
                    {p.location && <p className="text-xs text-gray-400 truncate">{p.location}</p>}
                    <div className="flex gap-1 mt-0.5">
                      {p.people.length > 0 && (
                        <span className="text-xs text-gray-400">👥 {p.people.length}</span>
                      )}
                      {p.materials.length > 0 && (
                        <span className="text-xs text-gray-400">📦 {p.materials.length}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Projectenlijst onder kalender */}
      <div className="mt-8 bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="font-semibold mb-4 text-gray-300">Alle projecten deze week</h3>
        {days.flatMap(day => projectsOnDay(day))
          .filter((p, i, arr) => arr.findIndex(x => x.id === p.id) === i)
          .length === 0 ? (
          <p className="text-gray-600 text-sm">Geen projecten deze week</p>
        ) : (
          <div className="space-y-2">
            {days.flatMap(day => projectsOnDay(day))
              .filter((p, i, arr) => arr.findIndex(x => x.id === p.id) === i)
              .map(p => (
                <div key={p.id} className="flex justify-between items-center py-2 border-b border-gray-800 last:border-0">
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-gray-500">{p.client} · {p.location}</p>
                  </div>
                  <div className="text-xs text-gray-500 text-right">
                    <p>👥 {p.people.length} personen</p>
                    <p>📦 {p.materials.length} materialen</p>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
