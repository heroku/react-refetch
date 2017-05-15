import newError from './errors'

export default function handleResponse(response) {
  if (response.headers.get('content-length') === '0' || response.status === 204) {
    return
  }

  if (response.status >= 200 && response.status < 300) { // TODO: support custom acceptable statuses
    return response.json() // TODO: support other response types
  } else {
    return Promise.reject(newError(response.statusText))
  }
}
