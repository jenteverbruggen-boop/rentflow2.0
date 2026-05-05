import { useEffect, useState } from 'react';
import api from '../api/client';

const emptyForm = { name: '', role: '', email: '', phone: '' };

export default function People() {
  const [people,   setPeople]   = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form,     setForm]     = useState(emptyForm);
  const [editId,   setEditId]   = useState(null);

  const load = () => api.get('/people').then(r => setPeople(r.data));
  useEffect(() => { load(); }, []);

  const submit = async e => {
    e.preventDefault();
    if (editId) {
      await api.put(`/people/${editId}`, form);
    } else {
      await api.post('/people', form);
    }
    setShowForm(false);
    setForm(emptyForm);
    setEditId(null);
    load();
  };

  const startEdit = p => {
    setForm({ name: p.name, role: p.role || '', email: p.email || '', phone: p.phone || '' });
    setEditId(p.id);
    setShowForm(true);
  };

  const remove = async id => {
    if (!confirm('Persoon verwijderen?')) return;
    await api.delete(`/people/${id}`);
    load();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Personen</h2>
        <button
          onClick={() => { setShowForm(true); setEditId(null); setForm(emptyForm); }}
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm"
        >
          + Nieuwe persoon
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <form onSubmit={submit}
            className="bg-gray-900 border border-gray-800 rounded-xl p-6 w-full max-w-md space-y-3">
            <h3 className="font-semibold mb-2">{editId ? 'Persoon bewerken' : 'Nieuwe persoon'}</h3>
            {[
              ['name',  'Naam *',     'text',  true],
              ['role',  'Functie',    'text',  false],
              ['email', 'Email',      'email', false],
              ['phone', 'Telefoon',   'tel',   false],
            ].map(([field, placeholder, type, req]) => (
              <input
                key={field} type={type} placeholder={placeholder}
                value={form[field]}
                onChange={e => setForm({ ...form, [field]: e.target.value })}
                required={req}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              />
            ))}
            <div className="flex gap-3 pt-2">
              <button type="submit"
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-2 text-sm">
                {editId ? 'Opslaan' : 'Aanmaken'}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setEditId(null); }}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg py-2 text-sm">
                Annuleren
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {people.map(p => (
          <div key={p.id} className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4 flex justify-between items-start">
            <div>
              <p className="font-medium">{p.name}</p>
              <p className="text-sm text-gray-500">{p.role}</p>
              <p className="text-xs text-gray-600">{p.email}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => startEdit(p)} className="text-gray-500 hover:text-white text-sm">✏️</button>
              <button onClick={() => remove(p.id)} className="text-gray-500 hover:text-red-400 text-sm">🗑️</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
