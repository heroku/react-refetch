import newError from './errors'

export default function handleResponse(response) {
  if (response.headers.get('content-length') === '0' || response.status === 204) {
    return
  }

  const json = response.json() // TODO: support other response types

  if (response.status >= 200 && response.status < 300) { // TODO: support custom acceptable statuses
    return json
  } else {
    return json.then(cause => Promise.reject(newError(cause)))
  }
}
