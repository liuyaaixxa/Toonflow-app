import { getBaseUrl } from "../setup";

/** Login with default admin credentials and return the JWT token */
export async function getAuthToken(): Promise<string> {
  const res = await fetch(`${getBaseUrl()}/other/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "admin123" }),
  });
  const body = await res.json();
  return body.data.token; // "Bearer xxx"
}

/** Make an authenticated POST request */
export async function authPost(path: string, body?: any) {
  const token = await getAuthToken();
  const res = await fetch(`${getBaseUrl()}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
}

/** Make an authenticated GET request */
export async function authGet(path: string) {
  const token = await getAuthToken();
  const res = await fetch(`${getBaseUrl()}${path}`, {
    method: "GET",
    headers: { Authorization: token },
  });
  return { status: res.status, body: await res.json() };
}

/** Make an unauthenticated POST request */
export async function post(path: string, body?: any) {
  const res = await fetch(`${getBaseUrl()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
}
