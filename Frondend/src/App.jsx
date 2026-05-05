import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login       from './pages/Login';
import Dashboard   from './pages/Dashboard';
import Projects    from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import People      from './pages/People';
import Materials   from './pages/Materials';
import Planning    from './pages/Planning';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/projects" element={<ProtectedRoute><Projects /></ProtectedRoute>} />
          <Route path="/projects/:id" element={<ProtectedRoute><ProjectDetail /></ProtectedRoute>} />
          <Route path="/people" element={<ProtectedRoute><People /></ProtectedRoute>} />
          <Route path="/materials" element={<ProtectedRoute><Materials /></ProtectedRoute>} />
          <Route path="/planning" element={<ProtectedRoute><Planning /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
