import expect from 'expect'

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

if (!global.document) { // to make mocha's watch mode work
  const jsdom = require('jsdom').jsdom
  global.document = jsdom('<!doctype html><html><body></body></html>')
  global.window = document.defaultView
  global.navigator = global.window.navigator
  global.self = document.defaultView

  require('whatwg-fetch')
}
