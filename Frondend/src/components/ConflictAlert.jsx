export default function ConflictAlert({ message, onClose }) {
  if (!message) return null;
  return (
    <div className="bg-red-900/50 border border-red-500 text-red-300 px-4 py-3 rounded-lg mb-4 flex justify-between items-start">
      <span className="text-sm">{message}</span>
      <button onClick={onClose} className="ml-4 text-red-400 hover:text-red-200">✕</button>
    </div>
  );
}
