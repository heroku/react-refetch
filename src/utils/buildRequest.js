export default function buildRequest(mapping) {
  return new mapping.Request(mapping.url, {
    method: mapping.method,
    headers: mapping.headers,
    credentials: mapping.credentials,
    redirect: mapping.redirect,
    mode: mapping.mode,
    body: mapping.body
  })
}
