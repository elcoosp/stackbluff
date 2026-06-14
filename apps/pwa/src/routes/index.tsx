import { createFileRoute, Link } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  component: () => (
    <div style={{ padding: '2rem', color: 'white', background: '#131313', minHeight: '100vh' }}>
      <h1 style={{ fontSize: '3rem' }}>STACKBLUFF</h1>
      <p>Select a table:</p>
      <ul>
        <li><Link to="/table/1">Vegas Vault (200/400)</Link></li>
        <li><Link to="/table/2">Obsidian Room (500/1000)</Link></li>
        <li><Link to="/table/3">Emerald Lounge (100/200)</Link></li>
      </ul>
    </div>
  ),
});
