// Thin wrappers around the backend. Every call throws on a non-2xx response
// so callers can handle failure in one place.

async function request(url, options) {
  const res = await fetch(url, options);
  let body = null;
  try {
    body = await res.json();
  } catch (e) {
    // no/invalid JSON body
  }
  if (!res.ok) {
    const message = (body && body.error) || `Request failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return body;
}

const jsonPost = (url, payload) =>
  request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

export const api = {
  createPair: () => jsonPost("/api/pair", {}),
  lookupPair: (code) => request(`/api/pair?code=${encodeURIComponent(code)}`),

  saveProfile: (pairId, name, avatar) => jsonPost("/api/profile", { pairId, name, avatar }),
  fetchProfiles: (pairId) => request(`/api/profile?pairId=${encodeURIComponent(pairId)}`),

  postSignal: (pairId, name, kind) => jsonPost("/api/signal", { pairId, name, kind }),
  fetchSignals: (pairId) => request(`/api/signals?pairId=${encodeURIComponent(pairId)}`),

  postMessage: (pairId, name, text) => jsonPost("/api/message", { pairId, name, text }),
  fetchMessages: (pairId) => request(`/api/messages?pairId=${encodeURIComponent(pairId)}`),

  subscribePush: (pairId, name, subscription) =>
    jsonPost("/api/subscribe", { pairId, name, subscription }),
};
