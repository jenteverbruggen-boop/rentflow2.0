import { useEffect, useState } from 'react';
import api from '../api/client';

const emptyForm = { name: '', category: '', totalStock: 1, notes: '' };

export default function Materials() {
  const [materials, setMaterials] = useState([]);
  const [showForm,  setShowForm]  = useState(false);
  const [form,      setForm]      = useState(emptyForm);
  const [editId,    setEditId]    = useState(null);

  const load = () => api.get('/materials').then(r => setMaterials(r.data));
  useEffect(() => { load(); }, []);

  const submit = async e => {
    e.preventDefault();
    if (editId) {
      await api.put(`/materials/${editId}`, form);
    } else {
      await api.post('/materials', form);
    }
    setShowForm(false);
    setForm(emptyForm);
    setEditId(null);
    load();
  };

  const startEdit = m => {
    setForm({ name: m.name, category: m.category || '', totalStock: m.totalStock, notes: m.notes || '' });
    setEditId(m.id);
    setShowForm(true);
  };

  const remove = async id => {
    if (!confirm('Materiaal verwijderen?')) return;
    await api.delete(`/materials/${id}`);
    load();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Materialen</h2>
        <button
          onClick={() => { setShowForm(true); setEditId(null); setForm(emptyForm); }}
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm"
        >
          + Nieuw materiaal
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <form onSubmit={submit}
            className="bg-gray-900 border border-gray-800 rounded-xl p-6 w-full max-w-md space-y-3">
            <h3 className="font-semibold mb-2">{editId ? 'Materiaal bewerken' : 'Nieuw materiaal'}</h3>
            <input type="text" placeholder="Naam *" required
              value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
            <input type="text" placeholder="Categorie"
              value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
            <div>
              <label className="text-xs text-gray-500 block mb-1">Totale voorraad</label>
              <input type="number" min="1"
                value={form.totalStock} onChange={e => setForm({ ...form, totalStock: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
            </div>
            <textarea placeholder="Notities" rows={2}
              value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
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
        {materials.map(m => (
          <div key={m.id} className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4 flex justify-between items-start">
            <div>
              <p className="font-medium">{m.name}</p>
              <p className="text-sm text-gray-500">{m.category}</p>
              <p className="text-xs text-gray-600">Voorraad: {m.totalStock}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => startEdit(m)} className="text-gray-500 hover:text-white text-sm">✏️</button>
              <button onClick={() => remove(m.id)} className="text-gray-500 hover:text-red-400 text-sm">🗑️</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
