import expect from 'expect'
import deepValue from '../../src/utils/deepValue'

describe('Utils', () => {
  describe('deepValue', () => {
    it('find deep value of nested objects', () => {
      expect(deepValue({ x: 1 }, 'x')).toBe(1)
      expect(deepValue({ x: { y: 2 } }, 'x.y')).toBe(2)
      expect(deepValue({ x: { y: 2 } }, 'x.y.z')).toBe(undefined)
    })
  })
})
