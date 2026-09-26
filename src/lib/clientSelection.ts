/** Resolve URL selection without repeating the workspace access request. */
export function selectAuthorizedClient<T extends { id: string }>(clients: T[], requested: string | null, previous: string): T | null {
  return clients.find(client => client.id === requested)
    || clients.find(client => client.id === previous)
    || clients[0]
    || null;
}
