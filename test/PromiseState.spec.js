import expect from 'expect'
import PromiseState from '../src/PromiseState'

describe('PromiseState', () => {
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
      ]).refreshing).toBe(false)

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
        new PromiseState({ reason: 'A' }),
        new PromiseState({ reason: 'B' })
      ]).reason).toEqual([ 'A', 'B' ])
    })

    it('meta', () => {
      expect(PromiseState.all([
        new PromiseState({ meta: 'A' }),
        new PromiseState({ meta: 'B' })
      ]).meta).toEqual([ 'A', 'B' ])
    })
  })
})

