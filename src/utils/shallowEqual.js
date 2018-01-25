import shallowEqual from 'fbjs/lib/shallowEqual'

export default shallowEqual

// export default function shallowEqual(objA, objB) {
//   if (objA === objB) {
//     return true
//   }

//   if (typeof objA !== 'object' || typeof objB !== 'object' ||
//     objA === null || objB === null) {
//     return false
//   }

//   const keysA = Object.keys(objA)
//   const keysB = Object.keys(objB)

//   if (keysA.length !== keysB.length) {
//     return false
//   }

//   // Test for A's keys different from B.
//   const hasOwn = Object.prototype.hasOwnProperty
//   for (let i = 0; i < keysA.length; i++) {
//     if (!hasOwn.call(objB, keysA[i]) ||
//       objA[keysA[i]] !== objB[keysA[i]]) {
//       return false
//     }
//   }

//   return true
// }
