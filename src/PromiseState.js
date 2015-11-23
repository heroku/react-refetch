export default class PromiseState {

  // The PromiseState.all(iterable) method returns a PromiseState
  // that resolves when all of the PromiseStates in the iterable
  // argument have resolved, or rejects with the reason of the
  // first passed PromiseState that rejects.
  static all(iterable) {
    return new PromiseState({
      pending: iterable.some(ps => ps.pending),
      refreshing: iterable.some(ps => ps.refreshing),
      fulfilled: iterable.every(ps => ps.fulfilled),
      rejected: iterable.some(ps => ps.rejected),
      value: iterable.map(ps => ps.value),
      reason: (iterable.find(ps => ps.reason) || {}).reason,
      meta: iterable.map(ps => ps.meta)
    })
  }

  constructor({ pending = false, refreshing = false, fulfilled = false, rejected = false, value = null, reason = null, meta = {} }) {
    this.pending = pending
    this.refreshing = refreshing
    this.fulfilled = fulfilled
    this.rejected = rejected
    this.settled = fulfilled || rejected
    this.value = value
    this.reason = reason
    this.meta = meta
  }
}
