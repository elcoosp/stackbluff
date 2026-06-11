export interface CreateTableRequest {
  stake_level: string;
  max_players: number;
}

export async function fetchLobby() {
  const res = await fetch('/api/lobby');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function createTable(data: CreateTableRequest) {
  const res = await fetch('/api/tables', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
