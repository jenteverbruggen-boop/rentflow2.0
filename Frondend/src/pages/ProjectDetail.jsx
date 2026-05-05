import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/client';
import ConflictAlert from '../components/ConflictAlert';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';

export default function ProjectDetail() {
  const { id }       = useParams();
  const navigate     = useNavigate();
  const [project,   setProject]   = useState(null);
  const [people,    setPeople]    = useState([]);
  const [materials, setMaterials] = useState([]);
  const [conflict,  setConflict]  = useState('');

  const [personForm,   setPersonForm]   = useState({ personId: '', role: '', startDate: '', endDate: '' });
  const [materialForm, setMaterialForm] = useState({ materialId: '', quantity: 1, startDate: '', endDate: '' });

  const load = () => api.get(`/projects/${id}`).then(r => setProject(r.data));

  useEffect(() => {
    load();
    api.get('/people').then(r    => setPeople(r.data));
    api.get('/materials').then(r => setMaterials(r.data));
  }, [id]);

  const addPerson = async e => {
    e.preventDefault();
    setConflict('');
    try {
      await api.post('/bookings/person', { projectId: id, ...personForm });
      setPersonForm({ personId: '', role: '', startDate: '', endDate: '' });
      load();
    } catch (err) {
      setConflict(err.response?.data?.error || 'Conflict gedetecteerd');
    }
  };

  const addMaterial = async e => {
    e.preventDefault();
    setConflict('');
    try {
      await api.post('/bookings/material', { projectId: id, ...materialForm });
      setMaterialForm({ materialId: '', quantity: 1, startDate: '', endDate: '' });
      load();
    } catch (err) {
      setConflict(err.response?.data?.error || 'Conflict gedetecteerd');
    }
  };

  const removePerson   = async bid => { await api.delete(`/bookings/person/${bid}`);   load(); };
  const removeMaterial = async bid => { await api.delete(`/bookings/material/${bid}`); load(); };

  if (!project) return <div className="text-gray-500">Laden...</div>;

  return (
    <div className="max-w-3xl">
      <button onClick={() => navigate('/projects')} className="text-gray-500 hover:text-white text-sm mb-4">
        ← Terug
      </button>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
        <h2 className="text-2xl font-bold mb-1">{project.name}</h2>
        <p className="text-gray-500 text-sm">
          {project.client} · {project.location}
        </p>
        <p className="text-gray-500 text-sm">
          {format(new Date(project.startDate), 'd MMM yyyy', { locale: nl })} –{' '}
          {format(new Date(project.endDate),   'd MMM yyyy', { locale: nl })}
        </p>
        {project.notes && <p className="mt-3 text-sm text-gray-400">{project.notes}</p>}
      </div>

      <ConflictAlert message={conflict} onClose={() => setConflict('')} />

      {/* Personen */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
        <h3 className="font-semibold mb-4">👥 Personen</h3>

        <form onSubmit={addPerson} className="grid grid-cols-2 gap-2 mb-4">
          <select
            value={personForm.personId}
            onChange={e => setPersonForm({ ...personForm, personId: e.target.value })}
            required
            className="col-span-2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          >
            <option value="">Selecteer persoon</option>
            {people.map(p => <option key={p.id} value={p.id}>{p.name} {p.role ? `(${p.role})` : ''}</option>)}
          </select>
          <input
            type="text" placeholder="Rol (optioneel)"
            value={personForm.role}
            onChange={e => setPersonForm({ ...personForm, role: e.target.value })}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          />
          <div />
          <div>
            <label className="text-xs text-gray-500 block mb-1">Van</label>
            <input type="date" value={personForm.startDate}
              onChange={e => setPersonForm({ ...personForm, startDate: e.target.value })}
              required className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Tot</label>
            <input type="date" value={personForm.endDate}
              onChange={e => setPersonForm({ ...personForm, endDate: e.target.value })}
              required className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
          </div>
          <button type="submit"
            className="col-span-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-2 text-sm">
            Persoon toevoegen
          </button>
        </form>

        <div className="space-y-2">
          {project.people.map(pp => (
            <div key={pp.id} className="flex justify-between items-center bg-gray-800 rounded-lg px-4 py-2">
              <div>
                <p className="text-sm font-medium">{pp.person.name}</p>
                <p className="text-xs text-gray-500">{pp.role || pp.person.role}</p>
              </div>
              <div className="flex items-center gap-3">
                {pp.startDate && (
                  <span className="text-xs text-gray-500">
                    {format(new Date(pp.startDate), 'd MMM', { locale: nl })} –{' '}
                    {format(new Date(pp.endDate),   'd MMM', { locale: nl })}
                  </span>
                )}
                <button onClick={() => removePerson(pp.id)} className="text-gray-500 hover:text-red-400 text-sm">✕</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Materialen */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h3 className="font-semibold mb-4">📦 Materialen</h3>

        <form onSubmit={addMaterial} className="grid grid-cols-2 gap-2 mb-4">
          <select
            value={materialForm.materialId}
            onChange={e => setMaterialForm({ ...materialForm, materialId: e.target.value })}
            required
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          >
            <option value="">Selecteer materiaal</option>
            {materials.map(m => <option key={m.id} value={m.id}>{m.name} (voorraad: {m.totalStock})</option>)}
          </select>
          <input
            type="number" min="1" placeholder="Aantal"
            value={materialForm.quantity}
            onChange={e => setMaterialForm({ ...materialForm, quantity: e.target.value })}
            required
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          />
          <div>
            <label className="text-xs text-gray-500 block mb-1">Van</label>
            <input type="date" value={materialForm.startDate}
              onChange={e => setMaterialForm({ ...materialForm, startDate: e.target.value })}
              required className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Tot</label>
            <input type="date" value={materialForm.endDate}
              onChange={e => setMaterialForm({ ...materialForm, endDate: e.target.value })}
              required className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
          </div>
          <button type="submit"
            className="col-span-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-2 text-sm">
            Materiaal toevoegen
          </button>
        </form>

        <div className="space-y-2">
          {project.materials.map(pm => (
            <div key={pm.id} className="flex justify-between items-center bg-gray-800 rounded-lg px-4 py-2">
              <div>
                <p className="text-sm font-medium">{pm.material.name}</p>
                <p className="text-xs text-gray-500">{pm.material.category} · {pm.quantity}x</p>
              </div>
              <div className="flex items-center gap-3">
                {pm.startDate && (
                  <span className="text-xs text-gray-500">
                    {format(new Date(pm.startDate), 'd MMM', { locale: nl })} –{' '}
                    {format(new Date(pm.endDate),   'd MMM', { locale: nl })}
                  </span>
                )}
                <button onClick={() => removeMaterial(pm.id)} className="text-gray-500 hover:text-red-400 text-sm">✕</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
