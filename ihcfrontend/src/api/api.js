export const API_URL = "http://localhost:3000/api/v1";

export async function api(path, options = {}, autoRedirect = true) {
  const token = localStorage.getItem("token");

  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401 && autoRedirect) {
    localStorage.removeItem("token");
    window.location.href = "/login";
    return;
  }
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw {
      status: res.status,
      ...errorBody,
    };
  }

  return res.json();
}
