export default function PromiseState({ pending = false, refreshing = false, fulfilled = false, rejected = false, value = null, reason = null, meta = {} }) {
  this.pending = pending
  this.refreshing = refreshing
  this.fulfilled = fulfilled
  this.rejected = rejected
  this.settled = fulfilled || rejected
  this.value = value
  this.reason = reason
  this.meta = meta
}
