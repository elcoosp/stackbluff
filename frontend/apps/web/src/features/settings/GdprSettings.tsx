import type React from 'react';
import { useState } from 'react';

export const GdprSettings: React.FC = () => {
  const [status, setStatus] = useState<string>('active');
  const [showModal, setShowModal] = useState(false);
  const [password, setPassword] = useState('');

  const handleDelete = async () => {
    const res = await fetch('/api/users/me', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      setStatus('pending');
      setShowModal(false);
    } else {
      alert('Failed to request deletion. Check your password.');
    }
  };

  const handleExport = async () => {
    const res = await fetch('/api/users/me/data');
    if (res.ok) {
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'user_data.json';
      a.click();
    }
  };

  return (
    <div className="p-6 border rounded-lg mt-8">
      <h2 className="text-xl font-bold mb-4">Data & Privacy</h2>
      {status === 'pending' && (
        <p className="text-yellow-600 mb-4">
          Your deletion request is pending. Data will be anonymised within 30 days.
        </p>
      )}
      <button onClick={handleExport} className="bg-blue-600 text-white px-4 py-2 rounded mr-4">
        Download my data
      </button>
      <button
        onClick={() => setShowModal(true)}
        className="bg-red-600 text-white px-4 py-2 rounded"
      >
        Delete my account
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg">
            <h3 className="text-lg font-bold mb-2">Confirm Deletion</h3>
            <p className="mb-4">
              This will permanently delete your account and anonymise all your personal data. This
              action cannot be undone.
            </p>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password to confirm"
              className="border p-2 mb-4 w-full"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowModal(false)} className="px-4 py-2">
                Cancel
              </button>
              <button onClick={handleDelete} className="bg-red-600 text-white px-4 py-2 rounded">
                Delete Forever
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
