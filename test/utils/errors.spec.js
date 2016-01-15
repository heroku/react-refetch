import expect from 'expect'
import newError from '../../src/utils/errors'

describe('Utils', () => {
  describe('newError', () => {
    it('parses error with message', () => {
      const e = newError({ message: 'm' })
      expect(e.message).toBe('m')
      expect(e.cause).toIncludeKeyValues({ message: 'm' })
    })

    it('parses error with error', () => {
      const e = newError({ error: 'm' })
      expect(e.message).toBe('m')
      expect(e.cause).toIncludeKeyValues({ error: 'm' })
    })

    it('parses error without error or message to empty string ', () => {
      const e = newError({ other: 'm' })
      expect(e.message).toBe('')
      expect(e.cause).toIncludeKeyValues({ other: 'm' })
    })
  })
})
