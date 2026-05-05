import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';

const statusColor = s => ({
  concept:    'bg-gray-700 text-gray-300',
  bevestigd:  'bg-blue-800 text-blue-200',
  actief:     'bg-green-800 text-green-200',
  afgerond:   'bg-purple-800 text-purple-200',
  geannuleerd:'bg-red-900 text-red-300',
}[s] || 'bg-gray-700 text-gray-300');

const emptyForm = {
  name: '', client: '', location: '',
  startDate: '', endDate: '', status: 'concept', notes: ''
};

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState(emptyForm);
  const [editId, setEditId]     = useState(null);

  const load = () => api.get('/projects').then(r => setProjects(r.data));
  useEffect(() => { load(); }, []);

  const submit = async e => {
    e.preventDefault();
    if (editId) {
      await api.put(`/projects/${editId}`, form);
    } else {
      await api.post('/projects', form);
    }
    setShowForm(false);
    setForm(emptyForm);
    setEditId(null);
    load();
  };

  const startEdit = p => {
    setForm({
      name: p.name, client: p.client || '', location: p.location || '',
      startDate: p.startDate.slice(0,10), endDate: p.endDate.slice(0,10),
      status: p.status, notes: p.notes || ''
    });
    setEditId(p.id);
    setShowForm(true);
  };

  const remove = async id => {
    if (!confirm('Project verwijderen?')) return;
    await api.delete(`/projects/${id}`);
    load();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Projecten</h2>
        <button
          onClick={() => { setShowForm(true); setEditId(null); setForm(emptyForm); }}
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm"
        >
          + Nieuw project
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <form
            onSubmit={submit}
            className="bg-gray-900 border border-gray-800 rounded-xl p-6 w-full max-w-lg space-y-3"
          >
            <h3 className="font-semibold mb-2">{editId ? 'Project bewerken' : 'Nieuw project'}</h3>

            {[
              ['name',     'Projectnaam *', 'text',   true],
              ['client',   'Klant',         'text',   false],
              ['location', 'Locatie',       'text',   false],
            ].map(([field, placeholder, type, req]) => (
              <input
                key={field}
                type={type}
                placeholder={placeholder}
                value={form[field]}
                onChange={e => setForm({ ...form, [field]: e.target.value })}
                required={req}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              />
            ))}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Startdatum *</label>
                <input type="date" value={form.startDate}
                  onChange={e => setForm({ ...form, startDate: e.target.value })}
                  required className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Einddatum *</label>
                <input type="date" value={form.endDate}
                  onChange={e => setForm({ ...form, endDate: e.target.value })}
                  required className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
              </div>
            </div>

            <select
              value={form.status}
              onChange={e => setForm({ ...form, status: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            >
              {['concept','bevestigd','actief','afgerond','geannuleerd'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            <textarea
              placeholder="Notities"
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              rows={3}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            />

            <div className="flex gap-3 pt-2">
              <button type="submit"
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-2 text-sm">
                {editId ? 'Opslaan' : 'Aanmaken'}
              </button>
              <button type="button"
                onClick={() => { setShowForm(false); setEditId(null); }}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg py-2 text-sm">
                Annuleren
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-3">
        {projects.map(p => (
          <div key={p.id} className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4 flex items-center justify-between">
            <Link to={`/projects/${p.id}`} className="flex-1 hover:opacity-80">
              <p className="font-medium">{p.name}</p>
              <p className="text-sm text-gray-500">
                {p.client} · {p.location} · {format(new Date(p.startDate), 'd MMM yyyy', { locale: nl })}
              </p>
            </Link>
            <div className="flex items-center gap-3">
              <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(p.status)}`}>
                {p.status}
              </span>
              <button onClick={() => startEdit(p)} className="text-gray-500 hover:text-white text-sm">✏️</button>
              <button onClick={() => remove(p.id)} className="text-gray-500 hover:text-red-400 text-sm">🗑️</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
