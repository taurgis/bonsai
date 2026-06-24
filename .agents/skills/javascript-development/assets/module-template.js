export function createService({ baseUrl, fetchImpl = fetch }) {
  if (!baseUrl) {
    throw new Error('baseUrl is required');
  }

  return {
    async getJson(path) {
      const response = await fetchImpl(new URL(path, baseUrl));
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response.json();
    }
  };
}
