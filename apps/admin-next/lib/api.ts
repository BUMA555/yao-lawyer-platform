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

