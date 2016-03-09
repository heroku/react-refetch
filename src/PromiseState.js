export default class PromiseState {

  // creates a new PromiseState that is pending
  static create(meta) {
    return new PromiseState({
      pending: true,
      meta: meta
    })
  }

  // creates as PromiseState that is refreshing
  // can be called without a previous PromiseState and will be both pending and refreshing
  static refresh(previous, meta) {
    const ps = previous || PromiseState.create(meta)
    ps.refreshing = true
    return ps
  }

  // creates a PromiseState that is resolved with the given value
  static resolve(value, meta) {
    return new PromiseState({
      fulfilled: true,
      value: value,
      meta: meta
    })
  }

  // creates a PromiseState that is rejected with the given reason
  static reject(reason, meta) {
    return new PromiseState({
      rejected: true,
      reason: reason,
      meta: meta
    })
  }

  // The PromiseState.all(iterable) method returns a PromiseState
  // that resolves when all of the PromiseStates in the iterable
  // argument have resolved, or rejects with the reason of the
  // first passed PromiseState that rejects.
  static all(iterable) {
    if (!Array.isArray(iterable)) {
      iterable = Array.from(iterable)
    }

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

  // The PromiseState.race(iterable) method returns a PromiseState
  // that resolves or rejects as soon as one of the PromiseStates in
  // the iterable resolves or rejects, with the value or reason
  // from that PromiseState.
  static race(iterable) {
    if (!Array.isArray(iterable)) {
      iterable = Array.from(iterable)
    }

    const winner = iterable.find(ps => ps.settled)

    return new PromiseState({
      pending: !winner && iterable.some(ps => ps.pending),
      refreshing: !winner && iterable.some(ps => ps.refreshing),
      fulfilled: winner && winner.fulfilled,
      rejected: winner && winner.rejected,
      value: winner && winner.value,
      reason: winner && winner.reason,
      meta: winner && winner.meta
    })
  }

  // Constructor for creating a raw PromiseState. DO NOT USE DIRECTLY. Instead, use PromiseState.create() or other static constructors
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

  // Appends and calls fulfillment and rejection handlers on the PromiseState,
  // and returns a new PromiseState resolving to the return value of the called handler,
  // or to its original settled value if the promise was not handled.
  // The handler functions take the value/reason and meta as parameters.
  // (i.e. if the relevant handler onFulfilled or onRejected is undefined).
  // Note, unlike Promise.then(), these handlers are called immediately.
  then(onFulFilled, onRejected) {
    if (this.fulfilled && onFulFilled) {
      return this._mapFlatMapValue(onFulFilled(this.value, this.meta))
    }

    if (this.rejected && onRejected) {
      return this._mapFlatMapValue(onRejected(this.reason, this.meta))
    }

    return this
  }

  // Appends and calls a rejection handler callback to the PromiseState,
  // and returns a new PromiseState resolving to the return value of the
  // callback if it is called, or to its original fulfillment value if
  // the PromiseState is instead fulfilled. The handler function take
  // the reason and meta as parameters. Note, unlike Promise.catch(),
  // this handlers is called immediately.
  catch(onRejected) {
    return this.then(undefined, onRejected)
  }

  _mapFlatMapValue(value) {
    if (value instanceof PromiseState) {
      return value
    } else {
      return PromiseState.resolve(value, this.meta)
    }
  }
}
