const API_BASE_URL = process.env.API_BASE_URL || "http://127.0.0.1:8080";

export async function fetchAdminMetrics(token: string) {
  const resp = await fetch(`${API_BASE_URL}/v1/admin/metrics`, {
    headers: {
      Authorization: `Bearer ${token}`
    },
    cache: "no-store"
  });
  if (!resp.ok) {
    throw new Error(`metrics_failed: ${resp.status}`);
  }
  return resp.json();
}

async function fetchAdminJson(path: string, token: string) {
  const resp = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`
    },
    cache: "no-store"
  });
  if (!resp.ok) {
    throw new Error(`admin_request_failed: ${resp.status}`);
  }
  return resp.json();
}

export function fetchAdminOrders(token: string) {
  return fetchAdminJson("/v1/admin/orders?limit=100", token);
}

export function fetchAdminTickets(token: string) {
  return fetchAdminJson("/v1/admin/tickets?limit=100", token);
}

export function fetchAdminEntitlements(token: string) {
  return fetchAdminJson("/v1/admin/entitlements?limit=200", token);
}
