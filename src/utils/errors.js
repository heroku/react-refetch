export default function newError(cause) {
  const e = new Error(parse(cause))
  e.cause = cause
  return e
}

function parse(cause) {
  const { error, message } = cause

  if (error) {
    return error
  } else if (message) {
    return message
  } else {
    return ''
  }
}
