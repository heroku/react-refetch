import { jsdom } from 'jsdom'
import expect from 'expect'

global.document = jsdom('<!doctype html><html><body></body></html>')
global.window = document.defaultView
global.navigator = global.window.navigator
global.self = document.defaultView

expect.extend({
  toIncludeKeyValues(expected) {
    Object.keys(expected).forEach(key => {
      if (expected[key] && typeof expected[key] === 'object') {
        return expect(this.actual[key]).toIncludeKeyValues(expected[key])
      }

      expect.assert(
        this.actual[key] === expected[key],
        'expected %s to include { %s: %s }',
        this.actual, key, expected[key]
      )
    })
  }
})
