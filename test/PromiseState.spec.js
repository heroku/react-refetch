import expect from 'expect'
import PromiseState from '../src/PromiseState'

describe('PromiseState', () => {

  const onFulFilled = (v) => `F[${v}]`
  const onRejected  = (r) => `R[${r}]`

  const onFulFilledToPromiseState = (v) => PromiseState.resolve(`F[${v}]`)
  const onRejectedToPromiseState  = (r) => PromiseState.resolve(`R[${r}]`)

  describe('then', () => {
    it('pending', () => {
      const ps = PromiseState.create().then(onFulFilled, onRejected)
      expect(ps.pending).toBe(true)
      expect(ps.value).toBe(null)
    })

    it('fulfilled (undefined)', () => {
      const ps = PromiseState.resolve('v').then(undefined, undefined)
      expect(ps.pending).toBe(false)
      expect(ps.fulfilled).toBe(true)
      expect(ps.value).toBe('v')
    })

    it('fulfilled (map)', () => {
      const ps = PromiseState.resolve('v').then(onFulFilled, onRejected)
      expect(ps.pending).toBe(false)
      expect(ps.fulfilled).toBe(true)
      expect(ps.value).toBe('F[v]')
    })

    it('fulfilled (map with meta)', () => {
      const ps = PromiseState.resolve('v', 'm').then((v, m) => `F[${v}:${m}]`, onRejected)
      expect(ps.pending).toBe(false)
      expect(ps.fulfilled).toBe(true)
      expect(ps.value).toBe('F[v:m]')
      expect(ps.meta).toBe('m')
    })

    it('fulfilled (flatMap)', () => {
      const ps = PromiseState.resolve('v').then(onFulFilledToPromiseState, onRejectedToPromiseState)
      expect(ps.pending).toBe(false)
      expect(ps.fulfilled).toBe(true)
      expect(ps.value).toBe('F[v]')
    })

    it('rejected', () => {
      const ps = PromiseState.reject('r').then(onFulFilled, onRejected)
      expect(ps.pending).toBe(false)
      expect(ps.fulfilled).toBe(true)
      expect(ps.rejected).toBe(false)
      expect(ps.value).toBe('R[r]')
      expect(ps.reason).toBe(null)
    })

    it('rejected (chained)', () => {
      const ps = PromiseState.reject('r').then(onFulFilled, onRejected).then(onFulFilled, onRejected)
      expect(ps.pending).toBe(false)
      expect(ps.fulfilled).toBe(true)
      expect(ps.rejected).toBe(false)
      expect(ps.value).toBe('F[R[r]]')
      expect(ps.reason).toBe(null)
    })
  })

  describe('catch', () => {
    it('pending', () => {
      const ps = PromiseState.create().catch(onRejected)
      expect(ps.pending).toBe(true)
      expect(ps.value).toBe(null)
    })

    it('fulfilled', () => {
      const ps = PromiseState.resolve('v').catch(onRejected)
      expect(ps.pending).toBe(false)
      expect(ps.value).toBe('v')
    })

    it('rejected', () => {
      const ps = PromiseState.reject('r').catch(onRejected)
      expect(ps.pending).toBe(false)
      expect(ps.value).toBe('R[r]')
    })


    it('fulfilled (with meta)', () => {
      const ps = PromiseState.reject('r', 'm').catch((v, m) => `R[${v}:${m}]`)
      expect(ps.pending).toBe(false)
      expect(ps.value).toBe('R[r:m]')
    })
  })

  describe('all', () => {
    it('pending', () => {
      expect(PromiseState.all([
        new PromiseState({ pending: true }),
        new PromiseState({ pending: false })
      ]).pending).toBe(true)
      
      expect(PromiseState.all([
        new PromiseState({ pending: false }),
        new PromiseState({ pending: false })
      ]).pending).toBe(false)
    })

    it('refreshing', () => {
      expect(PromiseState.all([
        new PromiseState({ refreshing: true }),
        new PromiseState({ refreshing: false })
      ]).refreshing).toBe(true)

      expect(PromiseState.all([
        new PromiseState({ refreshing: false }),
        new PromiseState({ refreshing: false })
      ]).refreshing).toBe(false)
    })

    it('fulfilled', () => {
      expect(PromiseState.all([
        new PromiseState({ fulfilled: true }),
        new PromiseState({ fulfilled: false })
      ]).fulfilled).toBe(false)

      expect(PromiseState.all([
        new PromiseState({ fulfilled: true }),
        new PromiseState({ fulfilled: true })
      ]).fulfilled).toBe(true)
    })

    it('value', () => {
      expect(PromiseState.all([
        new PromiseState({ value: 'A' }),
        new PromiseState({ value: 'B' })
      ]).value).toEqual([ 'A', 'B' ])
    })

    it('reason', () => {
      expect(PromiseState.all([
        new PromiseState({ reason: null }),
        new PromiseState({ reason: 'B' }),
        new PromiseState({ reason: 'C' })
      ]).reason).toEqual('B')

      expect(PromiseState.all([
        new PromiseState({ reason: null }),
        new PromiseState({ reason: null })
      ]).reason).toEqual(null)
    })

    it('meta', () => {
      expect(PromiseState.all([
        new PromiseState({ meta: 'A' }),
        new PromiseState({ meta: 'B' })
      ]).meta).toEqual([ 'A', 'B' ])
    })
  })
  
  describe('race', () => {
    it('pending', () => {
      expect(PromiseState.race([
        new PromiseState({ pending: true }),
        new PromiseState({ pending: false })
      ]).pending).toBe(true)
      
      expect(PromiseState.race([
        new PromiseState({ pending: false }),
        new PromiseState({ pending: false })
      ]).pending).toBe(false)
    })

    it('refreshing', () => {
      expect(PromiseState.race([
        new PromiseState({ refreshing: true }),
        new PromiseState({ refreshing: false })
      ]).refreshing).toBe(true)

      expect(PromiseState.race([
        new PromiseState({ refreshing: false }),
        new PromiseState({ refreshing: false })
      ]).refreshing).toBe(false)
    })

    it('fulfilled', () => {
      expect(PromiseState.race([
        new PromiseState({ fulfilled: false }),
        new PromiseState({ fulfilled: false })
      ]).fulfilled).toBe(false)

      expect(PromiseState.race([
        new PromiseState({ fulfilled: true }),
        new PromiseState({ fulfilled: false })
      ]).fulfilled).toBe(true)

      expect(PromiseState.race([
        new PromiseState({ fulfilled: true }),
        new PromiseState({ fulfilled: true })
      ]).fulfilled).toBe(true)
    })

    it('value', () => {
      expect(PromiseState.race([
        new PromiseState({ fulfilled: true, value: 'A' }),
        new PromiseState({ fulfilled: true, value: 'B' })
      ]).value).toEqual('A')

      expect(PromiseState.race([
        new PromiseState({ fulfilled: false }),
        new PromiseState({ fulfilled: true, value: 'B' })
      ]).value).toEqual('B')

      expect(PromiseState.race([
        new PromiseState({ fulfilled: false }),
        new PromiseState({ fulfilled: false })
      ]).value).toEqual(null)
    })

    it('reason', () => {
      expect(PromiseState.race([
        new PromiseState({ rejected: false }),
        new PromiseState({ rejected: true, reason: 'B' }),
        new PromiseState({ rejected: true, reason: 'C' })
      ]).reason).toEqual('B')

      expect(PromiseState.race([
        new PromiseState({ rejected: false }),
        new PromiseState({ rejected: false })
      ]).reason).toEqual(null)
    })

    it('meta', () => {
      expect(PromiseState.race([
        new PromiseState({ meta: 'A' }),
        new PromiseState({ meta: 'B' })
      ]).meta).toEqual({})

      expect(PromiseState.race([
        new PromiseState({ meta: 'A' }),
        new PromiseState({ fulfilled: true, meta: 'B' })
      ]).meta).toEqual('B')
    })
  })
})

