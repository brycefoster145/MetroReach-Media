/** Server environment helpers. */
export function getApiKey(): string {
  return process.env.MS_API_KEY ?? "";
}

export function requireApiKey(request: Request): Response | null {
  const key = request.headers.get("x-api-key");
  const expected = getApiKey();
  if (!key || !expected || key !== expected) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return null;
}
