export default function deepValue(obj, path) {
  for (let i = 0, spath = path.split('.'), len = spath.length; i < len; i++) {
    if (obj === undefined) {
      return obj
    }
    obj = obj[spath[i]]
  }
  return obj
}
