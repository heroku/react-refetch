import invariant from 'invariant'
import isPlainObject from './isPlainObject'

function typecheck(type, name, obj) {
  invariant(
    typeof obj === type,
    `${name} must be a ${type}. Instead received a %s.`,
    typeof obj
  )
}

const checks = {
  buildRequest(fn) {
    typecheck('function', 'buildRequest', fn)
  },

  credentials(str) {
    const allowed = [ 'omit', 'same-origin', 'include' ]
    invariant(
      allowed.indexOf(str) !== -1,
      `credentials must be one of ${allowed.join(', ')}. Instead got %s.`,
      str ? str.toString() : str
    )
  },

  fetch(fn) {
    typecheck('function', 'fetch', fn)
  },

  handleResponse(fn) {
    typecheck('function', 'handleResponse', fn)
  },

  headers(obj) {
    invariant(
      isPlainObject(obj),
      'headers must be a plain object with string values. Instead received a %s.',
      typeof obj
    )
  },

  method(str) {
    typecheck('string', 'method', str)
  },

  redirect(str) {
    const allowed = [ 'follow', 'error', 'manual' ]
    invariant(
      allowed.indexOf(str) !== -1,
      `redirect must be one of ${allowed.join(', ')}. Instead got %s.`,
      str ? str.toString() : str
    )
  },

  refreshInterval(num) {
    typecheck('number', 'refreshInterval', num)
    invariant(num >= 0, 'refreshInterval must be positive or 0.')
    invariant(num !== Infinity, 'refreshInterval must not be Infinity.')
  },

  Request(fn) {
    typecheck('function', 'Request', fn)
  },

  then(fn) {
    typecheck('function', 'then', fn)
  },

  andThen(fn) {
    typecheck('function', 'andThen', fn)
  },

  catch(fn) {
    typecheck('function', 'catch', fn)
  },

  andCatch(fn) {
    typecheck('function', 'andCatch', fn)
  }
}

export default function checkTypes(mapping) {
  Object.keys(mapping).forEach(key => {
    if (checks[key]) {
      checks[key](mapping[key])
    }
  })
}
