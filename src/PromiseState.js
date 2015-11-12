export default function PromiseState({pending = false, fulfilled = false, rejected = false, value = null, reason = null}) {
  this.pending = pending
  this.fulfilled = fulfilled
  this.rejected = rejected
  this.settled = fulfilled || rejected
  this.value = value
  this.reason = reason
}
