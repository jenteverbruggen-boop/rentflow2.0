import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const links = [
  { to: '/',          label: 'Dashboard',  icon: '🏠' },
  { to: '/projects',  label: 'Projecten',  icon: '📁' },
  { to: '/planning',  label: 'Planning',   icon: '📅' },
  { to: '/people',    label: 'Personen',   icon: '👥' },
  { to: '/materials', label: 'Materialen', icon: '📦' },
];

export default function Sidebar() {
  const { user, logout } = useAuth();

  return (
    <aside className="w-56 bg-gray-900 flex flex-col border-r border-gray-800">
      <div className="p-5 border-b border-gray-800">
        <h1 className="text-xl font-bold text-blue-400">RentFlow</h1>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {links.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            <span>{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-800">
        <p className="text-xs text-gray-500 mb-2">{user?.name}</p>
        <button
          onClick={logout}
          className="w-full text-left text-xs text-red-400 hover:text-red-300"
        >
          Uitloggen
        </button>
      </div>
    </aside>
  );
}
