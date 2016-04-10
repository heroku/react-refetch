import 'whatwg-fetch'
import expect from 'expect'
import React, { createClass, Component } from 'react'
import TestUtils from 'react-addons-test-utils'
import { connect, PromiseState } from '../../src/index'
import buildRequest from '../../src/utils/buildRequest'
import handleResponse from '../../src/utils/handleResponse'

describe('React', () => {
  describe('connect', () => {

    const fetchSpies = []
    before(() => {
      window.fetch = (request) => {
        fetchSpies.forEach((spy) => spy())
        return new Promise((resolve) => {
          if (request.url == '/error') {
            resolve(new window.Response(JSON.stringify({ error: 'e', id: 'not_found' }), { status: 404 }))
          } else {
            resolve(new window.Response(JSON.stringify({ T: 't' }), { status: 200, headers: { A: 'a', B: 'b' } }))
          }
        })
      }
    })

    class Passthrough extends Component {
      render() {
        return <div {...this.props} />
      }
    }

    it('should should props and promise state to the given component', (done) => {
      const props = ({
        foo: 'bar',
        baz: 42
      })

      @connect(({ foo, baz }) => ({
        testFetch: {
          url: `/${foo}/${baz}`,
          meta: {
            test: 'voodoo'
          }
        },
        errorFetch: `/error`,
        testFunc: (arg1, arg2) => ({
          deferredFetch: `/${foo}/${baz}/deferred/${arg1}/${arg2}`
        })
      }))
      class Container extends Component {
        render() {
          return <Passthrough {...this.props} />
        }
      }

      const container = TestUtils.renderIntoDocument(
        <Container {...props} />
      )

      const stubPending = TestUtils.findRenderedComponentWithType(container, Passthrough)
      expect(stubPending.props.foo).toEqual('bar')
      expect(stubPending.props.baz).toEqual(42)
      expect(stubPending.props.testFetch).toIncludeKeyValues({
        fulfilled: false, pending: true, refreshing: false, reason: null, rejected: false, settled: false, value: null, meta: { test: 'voodoo' }
      })
      expect(stubPending.props.testFetch.constructor).toEqual(PromiseState)

      expect(stubPending.props.errorFetch).toIncludeKeyValues({
        fulfilled: false, pending: true, refreshing: false, reason: null, rejected: false, settled: false, value: null, meta: {}
      })
      expect(stubPending.props.errorFetch.constructor).toEqual(PromiseState)

      expect(stubPending.props.testFunc).toBeA('function')
      expect(stubPending.props.deferredFetch).toEqual(undefined)
      stubPending.props.testFunc('A', 'B')
      expect(stubPending.props.deferredFetch).toIncludeKeyValues({
        fulfilled: false, pending: true, refreshing: false, reason: null, rejected: false, settled: false, value: null, meta: {}
      })

      expect(() =>
        TestUtils.findRenderedComponentWithType(container, Container)
      ).toNotThrow()

      setImmediate(() => {
        const stubFulfilled = TestUtils.findRenderedComponentWithType(container, Passthrough)
        expect(stubFulfilled.props.testFetch).toIncludeKeyValues({
          fulfilled: true, pending: false, refreshing: false, reason: null, rejected: false, settled: true, value: { T: 't' }
        })
        expect(stubFulfilled.props.testFetch.meta.test).toEqual('voodoo')
        expect(stubFulfilled.props.testFetch.meta.request.headers.get('Accept')).toEqual('application/json')
        expect(stubFulfilled.props.testFetch.meta.request.headers.get('Accept')).toEqual('application/json')
        expect(stubFulfilled.props.testFetch.meta.response.headers.get('A')).toEqual('a')
        expect(stubFulfilled.props.testFetch.meta.response.status).toEqual(200)
        expect(stubFulfilled.props.testFetch.meta.response.bodyUsed).toEqual(true)


        expect(stubFulfilled.props.errorFetch).toIncludeKeyValues({
          fulfilled: false, pending: false, refreshing: false, reason: { message: 'e', cause: { error: 'e', id: 'not_found' } }, rejected: true, settled: true, value: null
        })
        expect(stubFulfilled.props.errorFetch.meta.request.headers.get('Accept')).toEqual('application/json')
        expect(stubFulfilled.props.errorFetch.meta.response.status).toEqual(404)
        expect(stubFulfilled.props.errorFetch.meta.response.bodyUsed).toEqual(true)

        done()
      })
    })

    it('should support refreshing on before first fulfillment', (done) => {
      @connect(() => ({ testFetch: { url: `/example`, refreshing: true } }))
      class Container extends Component {
        render() {
          return <Passthrough {...this.props} />
        }
      }

      const container = TestUtils.renderIntoDocument(
        <Container />
      )

      const init = TestUtils.findRenderedComponentWithType(container, Container)
      expect(init.state.data.testFetch).toIncludeKeyValues(
        { fulfilled: false, pending: true, reason: null, refreshing: true, rejected: false, settled: false, value: null }
      )
      setImmediate(() => {
        const fulfilled = TestUtils.findRenderedComponentWithType(container, Container)
        expect(fulfilled.state.data.testFetch).toIncludeKeyValues(
          { fulfilled: true, pending: false, reason: null, refreshing: false, rejected: false, settled: true, value: { T: 't' } }
        )
        done()
      })
    })

    it('should set startedAt', (done) => {
      @connect(() => ({ testFetch: `/example` }))
      class Container extends Component {
        render() {
          return <Passthrough {...this.props} />
        }
      }

      const container = TestUtils.renderIntoDocument(
        <Container />
      )

      const pending = TestUtils.findRenderedComponentWithType(container, Container)
      const startedAt = pending.state.startedAts.testFetch
      expect(startedAt.getTime()).toBeLessThan(new Date().getTime())
      setImmediate(() => {
        const fulfilled = TestUtils.findRenderedComponentWithType(container, Container)
        expect(fulfilled.state.startedAts.testFetch).toEqual(startedAt)
        done()
      })
    })

    it('should create default mapping and empty options if just URL is provided', () => {
      @connect(() => ({ testFetch: `/example` }))
      class Container extends Component {
        render() {
          return <Passthrough {...this.props} />
        }
      }

      const container = TestUtils.renderIntoDocument(
        <Container />
      )

      const decorated = TestUtils.findRenderedComponentWithType(container, Container)
      expect(decorated.state.mappings.testFetch.url).toEqual('/example')
    })

    it('should use provided mapping object with applied defaults', () => {
      @connect(() => ({ testFetch: {
        url: '/example',
        method: 'POST',
        headers: {
          'Content-Type': 'overwrite-default',
          'X-Foo': 'custom-foo'
        }
      } }))
      class Container extends Component {
        render() {
          return <Passthrough {...this.props} />
        }
      }

      const container = TestUtils.renderIntoDocument(
        <Container />
      )

      const decorated = TestUtils.findRenderedComponentWithType(container, Container)
      expect(Object.keys(decorated.state.mappings.testFetch).length).toEqual(14)
      expect(decorated.state.mappings.testFetch.method).toEqual('POST')
      expect(decorated.state.mappings.testFetch.headers).toEqual({ Accept: 'application/json', 'Content-Type': 'overwrite-default', 'X-Foo': 'custom-foo' })
      expect(decorated.state.mappings.testFetch.credentials).toEqual('same-origin')
      expect(decorated.state.mappings.testFetch.redirect).toEqual('follow')
      expect(decorated.state.mappings.testFetch.url).toEqual('/example')
      expect(decorated.state.mappings.testFetch.equals).toBeA('function')
    })

    it('should passthrough value of identity requests', () => {
      @connect(() => ({ testFetch: { value: 'foo', meta: { test: 'voodoo' } } }))
      class Container extends Component {
        render() {
          return <Passthrough {...this.props} />
        }
      }

      const container = TestUtils.renderIntoDocument(
        <Container />
      )

      const decorated = TestUtils.findRenderedComponentWithType(container, Container)
      expect(decorated.state.mappings.testFetch.value).toEqual('foo')

      const stub = TestUtils.findRenderedComponentWithType(container, Passthrough)
      expect(stub.props.testFetch).toIncludeKeyValues({
        fulfilled: true, pending: false, refreshing: false, reason: null, rejected: false, settled: true, value: 'foo', meta: { test: 'voodoo' }
      })
    })

    it('should support falsey values in identity requests', () => {
      @connect(() => ({ testFetch: { value: null } }))
      class Container extends Component {
        render() {
          return <Passthrough {...this.props} />
        }
      }

      const container = TestUtils.renderIntoDocument(
        <Container />
      )

      const decorated = TestUtils.findRenderedComponentWithType(container, Container)
      expect(decorated.state.mappings.testFetch.value).toEqual(null)

      const stub = TestUtils.findRenderedComponentWithType(container, Passthrough)
      expect(stub.props.testFetch).toIncludeKeyValues({
        fulfilled: true, pending: false, refreshing: false, reason: null, rejected: false, settled: true, value: null
      })
    })

    it('identity requests should compose with identity responses', (done) => {
      @connect(() => ({
        testFetch: {
          value: 'foo',
          then: (r) => ({
            value: `[${r}]`
          })
        }
      }))
      class Container extends Component {
        render() {
          return <Passthrough {...this.props} />
        }
      }

      const container = TestUtils.renderIntoDocument(
        <Container />
      )

      setImmediate(() => {
        const stub = TestUtils.findRenderedComponentWithType(container, Passthrough)
        expect(stub.props.testFetch).toIncludeKeyValues({
          fulfilled: true, pending: false, refreshing: false, reason: null, rejected: false, settled: true, value: '[foo]'
        })
        done()
      })
    })

    it('identity requests should compose with url responses', (done) => {
      @connect(() => ({
        testFetch: {
          url: '/test',
          then: (r) => ({
            value: `[${Object.keys(r)[0]}]`
          })
        }
      }))
      class Container extends Component {
        render() {
          return <Passthrough {...this.props} />
        }
      }

      const container = TestUtils.renderIntoDocument(
        <Container />
      )

      setImmediate(() => {
        const stub = TestUtils.findRenderedComponentWithType(container, Passthrough)
        expect(stub.props.testFetch).toIncludeKeyValues({
          fulfilled: true, pending: false, refreshing: false, reason: null, rejected: false, settled: true, value: '[T]'
        })
        done()
      })
    })

    it('should allow functional mappings', () => {
      const props = ({
        foo: 'bar',
        baz: 42
      })

      @connect(({ foo, baz }) => ({
        testFunc: (arg1, arg2) => ({
          deferredFetch: `/${foo}/${baz}/deferred/${arg1}/${arg2}`
        })
      }))
      class Container extends Component {
        render() {
          return <Passthrough {...this.props} />
        }
      }

      const container = TestUtils.renderIntoDocument(
        <Container {...props} />
      )

      const decorated = TestUtils.findRenderedComponentWithType(container, Container)
      expect(decorated.state.mappings.testFunc).toBeA('function')
      expect(decorated.state.data.testFunc).toBeA('function')
      expect(decorated.state.data.deferredFetch).toEqual(undefined)

      decorated.state.data.testFunc('A', 'B')

      expect(decorated.state.mappings.deferredFetch.url).toEqual('/bar/42/deferred/A/B')
      expect(decorated.state.data.deferredFetch).toIncludeKeyValues(
        { fulfilled: false, pending: true, reason: null, refreshing: false, rejected: false, settled: false, value: null }
      )
    })

    it('should allow functional mappings to overwrite existing prop', () => {
      const props = ({
        foo: 'bar',
        baz: 42
      })

      @connect(({ foo, baz }) => ({
        testFetch: `/${foo}/${baz}/immediate`,
        testUpdate: (arg1, arg2) => ({
          testFetch: `/${foo}/${baz}/deferred/${arg1}/${arg2}`
        })
      }))
      class Container extends Component {
        render() {
          return <Passthrough {...this.props} />
        }
      }

      const container = TestUtils.renderIntoDocument(
        <Container {...props} />
      )

      const decorated = TestUtils.findRenderedComponentWithType(container, Container)
      expect(decorated.state.mappings.testFetch.url).toEqual('/bar/42/immediate')
      expect(decorated.state.data.testFetch).toIncludeKeyValues(
        { fulfilled: false, pending: true, reason: null, refreshing: false, rejected: false, settled: false, value: null }
      )
      expect(decorated.state.data.testUpdate).toBeA('function')

      decorated.state.data.testUpdate('A', 'B')

      expect(decorated.state.mappings.testFetch.url).toEqual('/bar/42/deferred/A/B')
      expect(decorated.state.data.testFetch).toIncludeKeyValues(
        { fulfilled: false, pending: true, reason: null, refreshing: false, rejected: false, settled: false, value: null }
      )
    })

    it('should call then mappings', (done) => {
      const props = ({
        foo: 'bar',
        baz: 42
      })

      @connect(({ foo, baz }) => ({
        firstFetch: {
          url: `/first/${foo}`,
          then: (v) => `/second/${baz}/${v['T']}`
        }
      }))
      class Container extends Component {
        render() {
          return <Passthrough {...this.props} />
        }
      }

      const container = TestUtils.renderIntoDocument(
        <Container {...props} />
      )

      const decorated = TestUtils.findRenderedComponentWithType(container, Container)
      expect(decorated.state.mappings.firstFetch.url).toEqual('/first/bar')
      expect(decorated.state.mappings.firstFetch.then).toBeA('function')
      expect(decorated.state.data.firstFetch).toIncludeKeyValues(
        { fulfilled: false, pending: true, reason: null, refreshing: false, rejected: false, settled: false, value: null }
      )

      setImmediate(() => {
        expect(decorated.state.mappings.firstFetch.url).toEqual('/second/42/t')
        expect(decorated.state.data.firstFetch).toIncludeKeyValues(
          { fulfilled: true, pending: false, reason: null, refreshing: false, rejected: false, settled: true, value: { 'T': 't' } }
        )

        done()
      })
    })

    it('should call catch mappings', (done) => {
      const props = ({
        baz: 42
      })

      @connect(({ baz }) => ({
        firstFetch: {
          url: `/error`,
          catch: (v) => `/second/${baz}/${v.cause.error}`
        }
      }))
      class Container extends Component {
        render() {
          return <Passthrough {...this.props} />
        }
      }

      const container = TestUtils.renderIntoDocument(
        <Container {...props} />
      )

      const decorated = TestUtils.findRenderedComponentWithType(container, Container)
      expect(decorated.state.mappings.firstFetch.url).toEqual('/error')
      expect(decorated.state.mappings.firstFetch.catch).toBeA('function')
      expect(decorated.state.data.firstFetch).toIncludeKeyValues(
        { fulfilled: false, pending: true, reason: null, refreshing: false, rejected: false, settled: false, value: null }
      )

      setImmediate(() => {
        expect(decorated.state.mappings.firstFetch.url).toEqual('/second/42/e')
        expect(decorated.state.data.firstFetch).toIncludeKeyValues(
          { fulfilled: true, pending: false, reason: null, refreshing: false, rejected: false, settled: true, value: { 'T': 't' } }
        )

        done()
      })
    })

    it('should call andThen mappings', (done) => {
      const props = ({
        foo: 'bar',
        baz: 42
      })

      @connect(({ foo, baz }) => ({
        firstFetch: {
          url: `/first/${foo}`,
          andThen: () => ({
            thenFetch: `/second/${baz}`
          })
        }
      }))
      class Container extends Component {
        render() {
          return <Passthrough {...this.props} />
        }
      }

      const container = TestUtils.renderIntoDocument(
        <Container {...props} />
      )

      const decorated = TestUtils.findRenderedComponentWithType(container, Container)
      expect(decorated.state.mappings.firstFetch.url).toEqual('/first/bar')
      expect(decorated.state.mappings.firstFetch.andThen).toBeA('function')
      expect(decorated.state.data.firstFetch).toIncludeKeyValues(
        { fulfilled: false, pending: true, reason: null, refreshing: false, rejected: false, settled: false, value: null }
      )

      expect(decorated.state.mappings.thenFetch).toEqual(undefined)
      expect(decorated.state.data.thenFetch).toEqual(undefined)

      setImmediate(() => {
        expect(decorated.state.data.firstFetch).toIncludeKeyValues(
          { fulfilled: true, pending: false, reason: null, refreshing: false, rejected: false, settled: true, value: { 'T': 't' } }
        )

        expect(decorated.state.mappings.thenFetch.url).toEqual('/second/42')
        expect(decorated.state.data.thenFetch).toIncludeKeyValues(
          { fulfilled: true, pending: false, reason: null, refreshing: false, rejected: false, settled: true, value: { 'T': 't' } }
        )

        done()
      })
    })

    it('should call andCatch mappings', (done) => {
      const props = ({
        baz: 42
      })

      @connect(({ baz }) => ({
        firstFetch: {
          url: `/error`,
          andCatch: () => ({
            catchFetch: `/second/${baz}`
          })
        }
      }))
      class Container extends Component {
        render() {
          return <Passthrough {...this.props} />
        }
      }

      const container = TestUtils.renderIntoDocument(
        <Container {...props} />
      )

      const decorated = TestUtils.findRenderedComponentWithType(container, Container)
      expect(decorated.state.mappings.firstFetch.url).toEqual('/error')
      expect(decorated.state.mappings.firstFetch.andCatch).toBeA('function')
      expect(decorated.state.data.firstFetch).toIncludeKeyValues(
        { fulfilled: false, pending: true, reason: null, refreshing: false, rejected: false, settled: false, value: null }
      )

      expect(decorated.state.mappings.catchFetch).toEqual(undefined)
      expect(decorated.state.data.catchFetch).toEqual(undefined)

      setImmediate(() => {
        expect(decorated.state.data.firstFetch).toIncludeKeyValues(
          { fulfilled: false, pending: false, refreshing: false, rejected: true, settled: true, value: null }
        )
        expect(decorated.state.data.firstFetch.reason).toBeA(Error)
        expect(decorated.state.data.firstFetch.reason.cause).toEqual({ error: 'e', id: 'not_found' })

        expect(decorated.state.mappings.catchFetch.url).toEqual('/second/42')
        expect(decorated.state.data.catchFetch).toIncludeKeyValues(
          { fulfilled: true, pending: false, reason: null, refreshing: false, rejected: false, settled: true, value: { 'T': 't' } }
        )

        done()
      })
    })

    it('should refresh when refreshInterval is provided', (done) => {
      const interval = 100000 // set sufficently far out to not happen during test

      @connect(() => ({ testFetch: { url: `/example`, refreshInterval: interval } }))
      class Container extends Component {
        render() {
          return <Passthrough {...this.props} />
        }
      }

      const container = TestUtils.renderIntoDocument(
        <Container />
      )

      const pending = TestUtils.findRenderedComponentWithType(container, Container)
      expect(pending.state.data.testFetch).toIncludeKeyValues({
        fulfilled: false, pending: true, reason: null, refreshing: false, rejected: false, settled: false, value: null
      })
      expect(pending.state.mappings.testFetch.refreshInterval).toEqual(interval)
      expect(pending.state.refreshTimeouts.testFetch).toEqual(undefined)

      setImmediate(() => {
        const fulfilled = TestUtils.findRenderedComponentWithType(container, Container)
        expect(fulfilled.state.data.testFetch).toIncludeKeyValues({
          fulfilled: true, pending: false, reason: null, refreshing: false, rejected: false, settled: true, value: { T: 't' }
        })
        expect(fulfilled.state.mappings.testFetch.refreshInterval).toEqual(interval)
        const refreshTimeout = fulfilled.state.refreshTimeouts.testFetch
        expect(refreshTimeout).toBeTruthy()

        // force refresh and cancel scheduled refresh
        refreshTimeout._onTimeout()
        clearTimeout(refreshTimeout)

        const refreshing = TestUtils.findRenderedComponentWithType(container, Container)
        expect(refreshing.state.data.testFetch).toIncludeKeyValues({
          fulfilled: true, pending: false, reason: null, refreshing: true, rejected: false, settled: true, value: { T: 't' }
        })
        expect(refreshing.state.mappings.testFetch.refreshInterval).toEqual(interval)
        expect(refreshing.state.refreshTimeouts.testFetch).toEqual(undefined)

        setImmediate(() => {
          const fulfilledAgain = TestUtils.findRenderedComponentWithType(container, Container)
          expect(fulfilledAgain.state.data.testFetch).toIncludeKeyValues({
            fulfilled: true, pending: false, reason: null, refreshing: false, rejected: false, settled: true, value: { T: 't' }
          })
          expect(fulfilledAgain.state.mappings.testFetch.refreshInterval).toEqual(interval)
          const refreshTimeout = fulfilledAgain.state.refreshTimeouts.testFetch
          expect(refreshTimeout).toBeTruthy()
          clearTimeout(refreshTimeout)

          done()
        })
      })
    })

    it('should not set refreshTimeouts when refreshInterval is not provided', (done) => {
      @connect(() => ({ testFetch: `/example` }))
      class Container extends Component {
        render() {
          return <Passthrough {...this.props} />
        }
      }

      const container = TestUtils.renderIntoDocument(
        <Container />
      )

      setImmediate(() => {
        const decoratedFulfilled = TestUtils.findRenderedComponentWithType(container, Container)
        expect(decoratedFulfilled.state.data.testFetch.fulfilled).toEqual(true)
        expect(decoratedFulfilled.state.refreshTimeouts.testFetch).toEqual(null)
        done()
      })
    })

    it('should remove undefined props', () => {
      let props = { x: true }
      let container

      @connect(() => ({}))
      class ConnectContainer extends Component {
        render() {
          return (
            <Passthrough {...this.props} />
          )
        }
      }

      class HolderContainer extends Component {
        render() {
          return (
            <ConnectContainer {...props} />
          )
        }
      }

      TestUtils.renderIntoDocument(
        <HolderContainer ref={instance => container = instance} />
      )

      const propsBefore = {
        ...TestUtils.findRenderedComponentWithType(container, Passthrough).props
      }

      props = {}
      container.forceUpdate()

      const propsAfter = {
        ...TestUtils.findRenderedComponentWithType(container, Passthrough).props
      }

      expect(propsBefore.x).toEqual(true)
      expect('x' in propsAfter).toEqual(false, 'x prop must be removed')
    })

    it('should invoke mapPropsToRequestsToProps if props changed', () => {
      let propsPassedIn
      let invocationCount = 0

      @connect((props) => {
        invocationCount++
        propsPassedIn = props
        return {}
      })
      class WithProps extends Component {
        render() {
          return <Passthrough {...this.props}/>
        }
      }

      class OuterComponent extends Component {
        constructor() {
          super()
          this.state = { foo: 'FOO' }
        }

        setFoo(foo) {
          this.setState({ foo })
        }

        render() {
          return (
            <div>
              <WithProps {...this.state} />
            </div>
          )
        }
      }

      let outerComponent
      TestUtils.renderIntoDocument(
        <OuterComponent ref={c => outerComponent = c} />
      )

      const obj = { blah: 2 }

      expect(invocationCount).toEqual(1)
      outerComponent.setFoo('BAR')
      expect(invocationCount).toEqual(2)
      outerComponent.setFoo('BAR')
      expect(invocationCount).toEqual(2)
      outerComponent.setFoo('BAZ')
      expect(invocationCount).toEqual(3)
      outerComponent.setFoo(obj)
      expect(invocationCount).toEqual(4)
      outerComponent.setFoo({ blah: 2 })
      expect(invocationCount).toEqual(5)

      expect(propsPassedIn).toEqual({
        foo: { blah: 2 }
      })
    })

    it("should not re-invoke mapPropsToRequestsToProps if it doesn't depend on props or context", () => {
      let invocationCount = 0

      @connect(() => {
        invocationCount++
        return {}
      })
      class WithProps extends Component {
        render() {
          return <Passthrough {...this.props}/>
        }
      }

      class OuterComponent extends Component {
        constructor() {
          super()
          this.state = { foo: 'FOO' }
        }

        setFoo(foo) {
          this.setState({ foo })
        }

        render() {
          return (
            <div>
              <WithProps {...this.state} />
            </div>
          )
        }
      }

      let outerComponent
      TestUtils.renderIntoDocument(
        <OuterComponent ref={c => outerComponent = c} />
      )

      expect(invocationCount).toEqual(1)
      outerComponent.setFoo('BAR')
      expect(invocationCount).toEqual(1)
    })

    it('should invoke mapPropsToRequestsToProps with context (used as decorator)', () => {
      let invocationCount = 0
      let contextPassedIn = []
      let propsPassedIn = []

      @connect((props, context) => {
        invocationCount++
        contextPassedIn.push(context)
        propsPassedIn.push(props)
        return {}
      })
      class InnerComponent extends Component {
        render() {
          return <div />
        }
      }
      InnerComponent.contextTypes = {
        foo: React.PropTypes.string
      }

      class OuterComponent extends Component {
        constructor(props) {
          super(props)
          this.state = {
            foo: 'bar',
            bar: 'foo'
          }
        }

        getChildContext() {
          return {
            foo: this.state.foo
          }
        }

        setContext(foo) {
          this.setState({ foo })
        }

        setProp(bar) {
          this.setState({ bar })
        }

        render() {
          return <InnerComponent bar={this.state.bar} />
        }
      }
      OuterComponent.childContextTypes = {
        foo: React.PropTypes.string
      }

      let outerComponent
      TestUtils.renderIntoDocument(
        <OuterComponent ref={c => outerComponent = c} />
      )

      expect(invocationCount).toEqual(1)
      outerComponent.setContext('baz')
      expect(invocationCount).toEqual(2)
      outerComponent.setContext('baz')
      expect(invocationCount).toEqual(2)
      outerComponent.setProp('baz')
      expect(invocationCount).toEqual(3)
      outerComponent.setProp('baz')
      expect(invocationCount).toEqual(3)

      expect(contextPassedIn).toEqual([
        {
          foo: 'bar'
        },
        {
          foo: 'baz'
        },
        {
          foo: 'baz'
        }
      ])

      expect(propsPassedIn).toEqual([
        {
          bar: 'foo'
        },
        {
          bar: 'foo'
        },
        {
          bar: 'baz'
        }
      ])
    })

    it('should invoke mapPropsToRequestsToProps with context (used as function)', () => {
      let invocationCount = 0
      let contextPassedIn = []
      let propsPassedIn = []

      class InnerComponent extends Component {
        render() {
          return <div />
        }
      }
      InnerComponent.contextTypes = {
        foo: React.PropTypes.string
      }
      InnerComponent = connect((props, context) => {
        invocationCount++
        contextPassedIn.push(context)
        propsPassedIn.push(props)
        return {}
      })(InnerComponent)

      class OuterComponent extends Component {
        constructor(props) {
          super(props)
          this.state = {
            foo: 'bar',
            bar: 'foo'
          }
        }

        getChildContext() {
          return {
            foo: this.state.foo
          }
        }

        setContext(foo) {
          this.setState({ foo })
        }

        setProp(bar) {
          this.setState({ bar })
        }

        render() {
          return <InnerComponent bar={this.state.bar} />
        }
      }
      OuterComponent.childContextTypes = {
        foo: React.PropTypes.string
      }

      let outerComponent
      TestUtils.renderIntoDocument(
        <OuterComponent ref={c => outerComponent = c} />
      )

      expect(invocationCount).toEqual(1)
      outerComponent.setContext('baz')
      expect(invocationCount).toEqual(2)
      outerComponent.setContext('baz')
      expect(invocationCount).toEqual(2)
      outerComponent.setProp('baz')
      expect(invocationCount).toEqual(3)
      outerComponent.setProp('baz')
      expect(invocationCount).toEqual(3)

      expect(contextPassedIn).toEqual([
        {
          foo: 'bar'
        },
        {
          foo: 'baz'
        },
        {
          foo: 'baz'
        }
      ])

      expect(propsPassedIn).toEqual([
        {
          bar: 'foo'
        },
        {
          bar: 'foo'
        },
        {
          bar: 'baz'
        }
      ])
    })

    it("should not re-invoke mapPropsToRequestsToProps when context changes if it doesn't depend on context", () => {
      let invocationCount = 0
      let propsPassedIn = []

      @connect((props) => {
        invocationCount++
        propsPassedIn.push(props)
        return {}
      })
      class InnerComponent extends Component {
        render() {
          return <div />
        }
      }
      InnerComponent.contextTypes = {
        foo: React.PropTypes.string
      }

      class OuterComponent extends Component {
        constructor(props) {
          super(props)
          this.state = {
            foo: 'bar',
            bar: 'foo'
          }
        }

        getChildContext() {
          return {
            foo: this.state.foo
          }
        }

        setContext(foo) {
          this.setState({ foo })
        }

        setProp(bar) {
          this.setState({ bar })
        }

        render() {
          return <InnerComponent bar={this.state.bar} />
        }
      }
      OuterComponent.childContextTypes = {
        foo: React.PropTypes.string
      }

      let outerComponent
      TestUtils.renderIntoDocument(
        <OuterComponent ref={c => outerComponent = c} />
      )

      expect(invocationCount).toEqual(1)
      outerComponent.setContext('baz')
      expect(invocationCount).toEqual(1)
      outerComponent.setContext('baz')
      expect(invocationCount).toEqual(1)
      outerComponent.setProp('baz')
      expect(invocationCount).toEqual(2)
      outerComponent.setProp('baz')
      expect(invocationCount).toEqual(2)

      expect(propsPassedIn).toEqual([
        {
          bar: 'foo'
        },
        {
          bar: 'baz'
        }
      ])
    })

    it('should shallowly compare the requests to prevent unnecessary fetches', (done) => {
      const fetchSpy = expect.createSpy(() => ({}))
      fetchSpies.push(fetchSpy)

      const renderSpy = expect.createSpy(() => ({}))
      function render() {
        renderSpy()
        return <Passthrough/>
      }

      @connect(({ foo }) => ({ testFetch: `/resource/${foo.FOO}` }))
      class WithProps extends Component {
        render() {
          return render(this.props)
        }
      }

      class OuterComponent extends Component {
        constructor() {
          super()
          this.state = {
            foo: {
              FOO: 'FOO'
            }
          }
        }

        setFoo(FOO) {
          this.setState({ foo: { FOO } })
        }

        render() {
          return (
            <div>
              <WithProps {...this.state} />
            </div>
          )
        }
      }

      let outerComponent
      TestUtils.renderIntoDocument(
        <OuterComponent ref={c => outerComponent = c} />
      )

      expect(renderSpy.calls.length).toBe(1)
      setImmediate(() => {
        expect(fetchSpy.calls.length).toBe(1)

        outerComponent.setFoo('BAR')
        expect(renderSpy.calls.length).toBe(3)
        setImmediate(() => {
          expect(fetchSpy.calls.length).toBe(2)

          // set BAR again, but will not be refetched
          // TODO: no need to re-render here
          outerComponent.setFoo('BAR')
          expect(renderSpy.calls.length).toBe(5)
          setImmediate(() => {
            expect(fetchSpy.calls.length).toBe(2)

            outerComponent.setFoo('BAZ')
            expect(renderSpy.calls.length).toBe(6)
            setImmediate(() => {
              expect(fetchSpy.calls.length).toBe(3)

              done()
            })
          })
        })
      })
    })

    it('should compare requests using provided comparison if provided', (done) => {
      const fetchSpy = expect.createSpy(() => ({}))
      fetchSpies.push(fetchSpy)

      const renderSpy = expect.createSpy(() => ({}))
      function render() {
        renderSpy()
        return <Passthrough/>
      }

      @connect(({ foo }) => ({
        testFetch: {
          url: '/resource-without-foo',
          comparison: foo.FOO
        }
      }))
      class WithProps extends Component {
        render() {
          return render(this.props)
        }
      }

      class OuterComponent extends Component {
        constructor() {
          super()
          this.state = {
            foo: {
              FOO: 'FOO'
            }
          }
        }

        setFoo(FOO) {
          this.setState({ foo: { FOO } })
        }

        render() {
          return (
            <div>
              <WithProps {...this.state} />
            </div>
          )
        }
      }

      let outerComponent
      TestUtils.renderIntoDocument(
        <OuterComponent ref={c => outerComponent = c} />
      )

      expect(renderSpy.calls.length).toBe(1)
      setImmediate(() => {
        expect(fetchSpy.calls.length).toBe(1)

        outerComponent.setFoo('BAR')
        expect(renderSpy.calls.length).toBe(3)
        setImmediate(() => {
          expect(fetchSpy.calls.length).toBe(2)

          // set BAR again, but will not be refetched
          // TODO: no need to re-render here
          outerComponent.setFoo('BAR')
          expect(renderSpy.calls.length).toBe(5)
          setImmediate(() => {
            expect(fetchSpy.calls.length).toBe(2)

            outerComponent.setFoo('BAZ')
            expect(renderSpy.calls.length).toBe(6)
            setImmediate(() => {
              expect(fetchSpy.calls.length).toBe(3)

              done()
            })
          })
        })
      })
    })

    it('should compare requests using provided comparison of parent request if then is also provided', (done) => {
      const fetchSpy = expect.createSpy(() => ({}))
      fetchSpies.push(fetchSpy)

      const renderSpy = expect.createSpy(() => ({}))

      function render() {
        renderSpy()
        return <Passthrough/>
      }

      @connect(({ foo }) => ({
        testFetch: {
          url: '/resource-without-foo',
          comparison: foo,
          then: (v, m) => ({ value: v, meta: m })
        }
      }))
      class WithProps extends Component {
        render() {
          return render(this.props)
        }
      }

      class OuterComponent extends Component {
        constructor() {
          super()
          this.state = { foo: 'FOO' }
        }

        setFoo(foo) {
          this.setState({ foo })
        }

        render() {
          return (
            <div>
              <WithProps {...this.state} />
            </div>
          )
        }
      }

      let outerComponent
      TestUtils.renderIntoDocument(
        <OuterComponent ref={c => outerComponent = c} />
      )

      expect(renderSpy.calls.length).toBe(1)
      setImmediate(() => {
        expect(fetchSpy.calls.length).toBe(1)

        outerComponent.setFoo('BAR')
        setImmediate(() => {
          expect(renderSpy.calls.length).toBe(4)
          setImmediate(() => {
            expect(fetchSpy.calls.length).toBe(2)

            // set BAR again, but will not be refetched
            // TODO: no need to re-render here
            outerComponent.setFoo('BAR')
            expect(renderSpy.calls.length).toBe(5)
            setImmediate(() => {
              expect(fetchSpy.calls.length).toBe(2)

              outerComponent.setFoo('BAZ')
              expect(renderSpy.calls.length).toBe(6)
              setImmediate(() => {
                expect(fetchSpy.calls.length).toBe(3)

                done()
              })
            })
          })
        })
      })
    })

    it('should throw an error if mapPropsToRequestsToProps returns anything but a plain object', () => {
      function makeContainer(mapPropsToRequestsToProps) {
        return React.createElement(
          connect(mapPropsToRequestsToProps)(
            class Container extends Component {
              render() {
                return <Passthrough />
              }
            }
          )
        )
      }

      function AwesomeMap() { }

      expect(() => {
        TestUtils.renderIntoDocument(
          makeContainer(() => 1)
        )
      }).toThrow(/mapPropsToRequestsToProps/)

      expect(() => {
        TestUtils.renderIntoDocument(
            makeContainer(() => 'hey')
        )
      }).toThrow(/mapPropsToRequestsToProps/)

      expect(() => {
        TestUtils.renderIntoDocument(
            makeContainer(() => new AwesomeMap())
        )
      }).toThrow(/mapPropsToRequestsToProps/)
    })

    it('should set the displayName correctly', () => {
      expect(connect(state => state)(
        class Foo extends Component {
          render() {
            return <div />
          }
        }
      ).displayName).toBe('Refetch.connect(Foo)')

      expect(connect(state => state)(
        createClass({
          displayName: 'Bar',
          render() {
            return <div />
          }
        })
      ).displayName).toBe('Refetch.connect(Bar)')

      expect(connect(state => state)(
        createClass({
          render() {
            return <div />
          }
        })
      ).displayName).toBe('Refetch.connect(Component)')
    })

    it('should expose the wrapped component as WrappedComponent', () => {
      class Container extends Component {
        render() {
          return <Passthrough />
        }
      }

      const decorator = connect(state => state)
      const decorated = decorator(Container)

      expect(decorated.WrappedComponent).toBe(Container)
    })

    it('should hoist non-react statics from wrapped component', () => {
      class Container extends Component {
        static howIsRedux = () => 'Awesome!';
        static foo = 'bar';

        render() {
          return <Passthrough />
        }
      }

      const decorator = connect(state => state)
      const decorated = decorator(Container)

      expect(decorated.howIsRedux).toBeA('function')
      expect(decorated.howIsRedux()).toBe('Awesome!')
      expect(decorated.foo).toBe('bar')
    })

    it('should throw when trying to access the wrapped instance if withRef is not specified', () => {
      class Container extends Component {
        render() {
          return <Passthrough />
        }
      }

      const decorator = connect(state => state)
      const Decorated = decorator(Container)

      const tree = TestUtils.renderIntoDocument(
        <Decorated />
      )

      const decorated = TestUtils.findRenderedComponentWithType(tree, Decorated)
      expect(() => decorated.getWrappedInstance()).toThrow(
        /To access the wrapped instance, you need to specify \{ withRef: true \} in \.options\(\)\./
      )
    })

    it('should return the instance of the wrapped component for use in calling child methods', () => {
      const someData = {
        some: 'data'
      }

      class Container extends Component {
        someInstanceMethod() {
          return someData
        }

        render() {
          return <Passthrough />
        }
      }

      const decorator = connect.options({ withRef: true })(() => {})
      const Decorated = decorator(Container)

      const tree = TestUtils.renderIntoDocument(
        <Decorated />
      )

      const decorated = TestUtils.findRenderedComponentWithType(tree, Decorated)

      expect(() => decorated.someInstanceMethod()).toThrow()
      expect(decorated.getWrappedInstance().someInstanceMethod()).toBe(someData)
      expect(decorated.refs.wrappedInstance.someInstanceMethod()).toBe(someData)
    })

    it('should not call setState if component is unmounted', (done) => {
      @connect(() => {
        return {
          testFetch: '/some/url'
        }
      })
      class WithProps extends Component {
        render() {
          return <Passthrough {...this.props}/>
        }
      }

      class OuterComponent extends Component {
        constructor() {
          super()
          this.state = { render: true }
        }

        setRender(render) {
          this.setState({ render })
        }

        render() {
          if (this.state.render) {
            return (
              <div>
                <WithProps {...this.state} />
              </div>
            )
          } else {
            return <div />
          }
        }
      }

      let outerComponent
      TestUtils.renderIntoDocument(
        <OuterComponent ref={c => outerComponent = c} />
      )

      outerComponent.setRender(false)

      const spy = expect.spyOn(console, 'error')
      setImmediate(() => {
        spy.destroy()
        expect(spy.calls.length).toBe(0)
        done()
      })

    })

    it('should not parse the body if response is a 204', (done) => {
      window.fetch = () => {
        return new Promise((resolve) => {
          resolve(new window.Response('', { status: 204 }))
        })
      }

      @connect(() => ({ testFetch: `/empty` }))
      class Container extends Component {
        render() {
          return <Passthrough {...this.props} />
        }
      }

      const container = TestUtils.renderIntoDocument(
        <Container />
      )

      const init = TestUtils.findRenderedComponentWithType(container, Container)
      expect(init.state.data.testFetch).toIncludeKeyValues(
        { fulfilled: false, pending: true, reason: null, refreshing: false, rejected: false, settled: false, value: null }
      )

      setImmediate(() => {
        const fulfilled = TestUtils.findRenderedComponentWithType(container, Container)
        expect(fulfilled.state.data.testFetch).toIncludeKeyValues(
          { fulfilled: true, pending: false, reason: null, refreshing: false, rejected: false, settled: true, value: null }
        )
        done()
      })
    })

    it('should not parse the body if response has Content-Length: 0', (done) => {
      window.fetch = () => {
        return new Promise((resolve) => {
          resolve(new window.Response('', { status: 200, headers: { 'Content-Length': 0 } }))
        })
      }

      @connect(() => ({ testFetch: `/empty` }))
      class Container extends Component {
        render() {
          return <Passthrough {...this.props} />
        }
      }

      const container = TestUtils.renderIntoDocument(
        <Container />
      )

      const init = TestUtils.findRenderedComponentWithType(container, Container)
      expect(init.state.data.testFetch).toIncludeKeyValues(
        { fulfilled: false, pending: true, reason: null, refreshing: false, rejected: false, settled: false, value: null }
      )

      setImmediate(() => {
        const fulfilled = TestUtils.findRenderedComponentWithType(container, Container)
        expect(fulfilled.state.data.testFetch).toIncludeKeyValues(
          { fulfilled: true, pending: false, reason: null, refreshing: false, rejected: false, settled: true, value: null }
        )
        done()
      })
    })

    it('should warn if the options argument is used', () => {
      const spy = expect.spyOn(console, 'error')
      @connect(() => ({}), { withRef: true })
      class Container extends Component {
        render() {
          return <Passthrough {...this.props} />
        }
      }

      expect(Container).toExist()
      expect(spy.calls.length).toEqual(1)
      expect(spy.calls[0].arguments[0]).toMatch(/The options argument is deprecated/)
      spy.restore()
    })

    // TODO
    //it('should not render the wrapped component when mapState does not produce change', () => {
    //  const store = createStore(stringBuilder)
    //  let renderCalls = 0
    //  let mapStateCalls = 0
    //
    //  @connect(() => {
    //    mapStateCalls++
    //    return {} // no change!
    //  })
    //  class Container extends Component {
    //    render() {
    //      renderCalls++
    //      return <Passthrough {...this.props} />
    //    }
    //  }
    //
    //  TestUtils.renderIntoDocument(
    //    <ProviderMock store={store}>
    //      <Container />
    //    </ProviderMock>
    //  )
    //
    //  expect(renderCalls).toBe(1)
    //  expect(mapStateCalls).toBe(2)
    //
    //  store.dispatch({ type: 'APPEND', body: 'a' })
    //
    //  // After store a change mapState has been called
    //  expect(mapStateCalls).toBe(3)
    //  // But render is not because it did not make any actual changes
    //  expect(renderCalls).toBe(1)
    //})

    context('.defaults', () => {
      // Escape characters that have special meaning in RegExps, then create a
      // RegExp from the passed string.
      function regexpify(str) {
        return new RegExp(str.replace(/([\[\]\{\}\(\)\.\-\,\+\?\*])/g, '\\$1'))
      }

      function typecheckCheck(name, expectedType, typeException = null) {
        typeException = typeException || function (type) {
          return regexpify(
            `${name} must be a ${expectedType}. Instead received a ${type}.`
          )
        }

        const checks = {
          boolean: [ true, false ],
          function: [ Date, () => {} ],
          number: [ 1337, 1.37e25, 0.123456789, Math.PI, -42, 0, NaN, Infinity ],
          object: [ null, [ 7.2, 'billion' ], new Date(), { obj: 'ect' } ],
          string: [ 'string', 'chaîne', '細線', '😀🌂🔗💯🆗' ],
          symbol: [ Symbol('hearts'), Symbol(), Symbol.iterator ],
          undefined: [ undefined, void 0 ]
        }

        for (let type in checks) {
          let values = checks[type]
          if (type === expectedType) { return }
          if (expectedType === 'plain object with string values' &&
            type === 'object') { values = values.slice(0, 3) }

          values.forEach(value => {
            expect(() => connect.defaults({ [name]: value })())
              .toThrow(typeException(type, value))
          })
        }
      }

      it('should throw unless a function is given as buildRequest', () => {
        typecheckCheck('buildRequest', 'function')
      })

      it('should throw unless a function is given as handleResponse', () => {
        typecheckCheck('handleResponse', 'function')
      })

      it('should throw unless a function is given as then', () => {
        typecheckCheck('then', 'function')
      })

      it('should throw unless a function is given as andThen', () => {
        typecheckCheck('andThen', 'function')
      })

      it('should throw unless a function is given as catch', () => {
        typecheckCheck('catch', 'function')
      })

      it('should throw unless a function is given as andCatch', () => {
        typecheckCheck('andCatch', 'function')
      })

      it('should throw unless a function is given as fetch', () => {
        typecheckCheck('fetch', 'function')
      })

      it('should throw unless a string is given as method', () => {
        typecheckCheck('method', 'string')
      })

      it('should throw unless a number >= 0 is given as refreshInterval', () => {
        typecheckCheck('refreshInterval', 'number')

        ;[ -0, 0, 1, 100, 1293, 1.23e5, 99e99 ].forEach(refreshInterval => {
          expect(() => connect.defaults({ refreshInterval })()).toNotThrow(/invariant/i)
        })

        ;[ -1, -100, -1293, -1.23e5, -99e99 ].forEach(refreshInterval => {
          expect(() => connect.defaults({ refreshInterval })()).toThrow(
            /refreshInterval must be positive or 0\./
          )
        })

        ;[ Infinity, 1e999 ].forEach(refreshInterval => {
          expect(() => connect.defaults({ refreshInterval })()).toThrow(
            /refreshInterval must not be Infinity\./
          )
        })
      })

      it('should throw unless a function is given as Request', () => {
        typecheckCheck('Request', 'function')
      })

      it('should throw unless a plain object is given as headers', () => {
        typecheckCheck('headers', 'plain object with string values')
      })

      it('should throw unless a correct value is given as credentials', () => {
        const allowed = [ 'omit', 'same-origin', 'include' ]

        typecheckCheck('credentials', 'enum', (type, value) => regexpify(
          `credentials must be one of ${allowed.join(', ')}. ` +
          `Instead got ${value ? value.toString() : value}.`
        ))

        allowed.forEach(credentials => {
          expect(() => connect.defaults({ credentials })()).toNotThrow(/invariant/i)
        })
      })

      it('should throw unless a correct value is given as redirect', () => {
        const allowed = [ 'follow', 'error', 'manual' ]

        typecheckCheck('redirect', 'enum', (type, value) => regexpify(
          `redirect must be one of ${allowed.join(', ')}. ` +
          `Instead got ${value ? value.toString() : value}.`
        ))

        allowed.forEach(redirect => {
          expect(() => connect.defaults({ redirect })()).toNotThrow(/invariant/i)
        })
      })

      it('should allow overriding further by chaining', () => {
        expect(connect.defaults({}).defaults({}).defaults({})).toBeA('function')
      })

      it('should throw if no fetch implementation is available', () => {
        let globalFetch
        if (typeof global !== 'undefined') {
          globalFetch = global.fetch
          global.fetch = undefined
        }

        let selfFetch
        if (typeof self !== 'undefined') {
          selfFetch = self.fetch
          self.fetch = undefined
        }

        let windowFetch
        if (typeof window !== 'undefined') {
          windowFetch = window.fetch
          window.fetch = undefined
        }

        // Sanity check
        expect(global.fetch).toNotExist('global.fetch should be unset')
        expect(self.fetch).toNotExist('self.fetch should be unset')
        expect(window.fetch).toNotExist('window.fetch should be unset')

        expect(() => connect()).toThrow(/fetch must be a function/)

        if (typeof globalFetch !== 'undefined') { global.fetch = globalFetch }
        if (typeof selfFetch !== 'undefined') { self.fetch = selfFetch }
        if (typeof windowFetch !== 'undefined') { window.fetch = windowFetch }
      })

      it('should throw if no Request implementation is available', () => {
        let globalRequest
        if (typeof global !== 'undefined') {
          globalRequest = global.Request
          global.Request = undefined
        }

        let selfRequest
        if (typeof self !== 'undefined') {
          selfRequest = self.Request
          self.Request = undefined
        }

        let windowRequest
        if (typeof window !== 'undefined') {
          windowRequest = window.Request
          window.Request = undefined
        }

        // Sanity check
        expect(global.Request).toNotExist('global.Request should be unset')
        expect(self.Request).toNotExist('self.Request should be unset')
        expect(window.Request).toNotExist('window.Request should be unset')

        expect(() => connect()).toThrow(/Request must be a function/)

        if (typeof globalRequest !== 'undefined') { global.Request = globalRequest }
        if (typeof selfRequest !== 'undefined') { self.Request = selfRequest }
        if (typeof windowRequest !== 'undefined') { window.Request = windowRequest }
      })

      it('should set the default fetch', (done) => {
        const customSpy = expect.createSpy(() => ({}))
        const customFetch = () => {
          customSpy()
          return new Promise((resolve) => {
            resolve(new window.Response(JSON.stringify({ T: 't' })))
          })
        }

        const custom = connect.defaults({ fetch: customFetch })

        const fetchSpy = expect.createSpy(() => ({}))
        fetchSpies.push(fetchSpy)

        @custom(() => ({ testFetch: `/example` }))
        class Container extends Component {
          render() {
            return <Passthrough {...this.props} />
          }
        }

        TestUtils.renderIntoDocument(<Container />)
        setImmediate(() => {
          expect(fetchSpy.calls.length).toBe(0)
          expect(customSpy.calls.length).toBe(1)
          done()
        })
      })

      it('should merge headers with the defaults', (done) => {
        const spy = expect.createSpy(() => {})
        const customFetch = (request) => {
          spy(request.headers)
          return new Promise((resolve) => {
            resolve(new window.Response(JSON.stringify({ T: 't' })))
          })
        }

        const headers = { 'X-Foo': 'bar' }
        const custom = connect.defaults({ fetch: customFetch, headers })
        @custom(() => ({ testFetch: `/example` }))
        class Container extends Component {
          render() {
            return <Passthrough {...this.props} />
          }
        }

        TestUtils.renderIntoDocument(<Container />)
        setImmediate(() => {
          expect(spy.calls.length).toBe(1)
          const headers = spy.calls[0].arguments[0]
          expect(headers).toBeA(window.Headers)
          expect(headers.get('Accept')).toBe('application/json')
          expect(headers.get('Content-Type')).toBe('application/json')
          expect(headers.get('X-Foo')).toBe('bar')
          done()
        })
      })

      it('should discard headers with falsy values', (done) => {
        const spy = expect.createSpy(() => {})
        const customFetch = (request) => {
          spy(request.headers)
          return new Promise((resolve) => {
            resolve(new window.Response(JSON.stringify({ T: 't' })))
          })
        }

        const headers = { 'X-Foo': 'bar', 'X-Baz': 'qux', 'X-xx': 'mordor' }
        const custom = connect
          .defaults({ fetch: customFetch, headers })
          .defaults({ headers: { 'Be': 'nice' } })
          .defaults({ headers: { 'X-Foo': false, 'X-Baz': 0, 'X-xx': '' } })
          .defaults({ headers: { 'Accept': null, 'Content-Type': undefined } })
        @custom(() => ({ testFetch: {
          url: `/example`,
          headers: {
            'Stay': 'there',
            'Be': null
          }
        } }))
        class Container extends Component {
          render() {
            return <Passthrough {...this.props} />
          }
        }

        TestUtils.renderIntoDocument(<Container />)
        setImmediate(() => {
          expect(spy.calls.length).toBe(1)
          const headers = spy.calls[0].arguments[0]
          expect(headers).toBeA(window.Headers)
          expect(headers.get('Accept')).toNotExist()
          expect(headers.get('Content-Type')).toNotExist()
          expect(headers.get('X-Foo')).toNotExist()
          expect(headers.get('X-Baz')).toNotExist()
          expect(headers.get('X-xx')).toNotExist()
          expect(headers.get('Be')).toNotExist()
          expect(headers.get('Stay')).toEqual('there')
          done()
        })
      })

      it('should set the default method', (done) => {
        const spy = expect.createSpy(() => {})
        const customFetch = (request) => {
          spy(request.method)
          return new Promise((resolve) => {
            resolve(new window.Response(JSON.stringify({ T: 't' })))
          })
        }

        const custom = connect.defaults({ fetch: customFetch, method: 'PUT' })
        @custom(() => ({ testFetch: `/example` }))
        class Container extends Component {
          render() {
            return <Passthrough {...this.props} />
          }
        }

        TestUtils.renderIntoDocument(<Container />)
        setImmediate(() => {
          expect(spy.calls.length).toBe(1)
          expect(spy.calls[0].arguments).toEqual([ 'PUT' ])
          done()
        })
      })

      it('should set the default Request', (done) => {
        const requestSpy = expect.createSpy(() => ({}))
        class Request extends window.Request {
          constructor() {
            super()
            requestSpy()
          }
        }

        const custom = connect.defaults({ Request })
        @custom(() => ({ testFetch: `/example` }))
        class Container extends Component {
          render() {
            return <Passthrough {...this.props} />
          }
        }

        TestUtils.renderIntoDocument(<Container />)
        setImmediate(() => {
          expect(requestSpy.calls.length).toBe(1)
          done()
        })
      })

      it('should set the default credentials', (done) => {
        const spy = expect.createSpy(() => {})
        class Request extends window.Request {
          constructor(url, options) {
            super(url, options)
            spy(options.credentials)
          }
        }

        const custom = connect.defaults({ Request, credentials: 'include' })
        @custom(() => ({ testFetch: `/example` }))
        class Container extends Component {
          render() {
            return <Passthrough {...this.props} />
          }
        }

        TestUtils.renderIntoDocument(<Container />)
        setImmediate(() => {
          expect(spy.calls.length).toBe(1)
          expect(spy.calls[0].arguments).toEqual([ 'include' ])
          done()
        })
      })

      it('should set the default redirect', (done) => {
        const spy = expect.createSpy(() => {})
        class Request extends window.Request {
          constructor(url, options) {
            super(url, options)
            spy(options.redirect)
          }
        }

        const custom = connect.defaults({ Request, redirect: 'error' })
        @custom(() => ({ testFetch: `/example` }))
        class Container extends Component {
          render() {
            return <Passthrough {...this.props} />
          }
        }

        TestUtils.renderIntoDocument(<Container />)
        setImmediate(() => {
          expect(spy.calls.length).toBe(1)
          expect(spy.calls[0].arguments).toEqual([ 'error' ])
          done()
        })
      })

      it('should set the default buildRequest', (done) => {
        const spy = expect.createSpy().andCall(buildRequest)

        const custom = connect.defaults({ buildRequest: spy })
        @custom(() => ({ testFetch: `/example` }))
        class Container extends Component {
          render() {
            return <Passthrough {...this.props} />
          }
        }

        TestUtils.renderIntoDocument(<Container />)
        setImmediate(() => {
          expect(spy.calls.length).toBe(1)
          done()
        })
      })

      it('should set the default handleResponse', (done) => {
        const spy = expect.createSpy().andCall(handleResponse)

        const custom = connect.defaults({ handleResponse: spy })
        @custom(() => ({ testFetch: `/example` }))
        class Container extends Component {
          render() {
            return <Passthrough {...this.props} />
          }
        }

        TestUtils.renderIntoDocument(<Container />)
        setImmediate(() => {
          expect(spy.calls.length).toBe(1)
          done()
        })
      })

      it('should set the default refreshInterval', () => {
        const interval = 100000 // set sufficently far out to not happen during test

        const custom = connect.defaults({ refreshInterval: interval })
        @custom(() => ({ testFetch: { url: `/example` } }))
        class Container extends Component {
          render() {
            return <Passthrough {...this.props} />
          }
        }

        const container = TestUtils.renderIntoDocument(
          <Container />
        )

        const pending = TestUtils.findRenderedComponentWithType(container, Container)
        expect(pending.state.data.testFetch).toIncludeKeyValues({
          fulfilled: false, pending: true, reason: null, refreshing: false, rejected: false, settled: false, value: null
        })
        expect(pending.state.mappings.testFetch.refreshInterval).toEqual(interval)
        expect(pending.state.refreshTimeouts.testFetch).toEqual(undefined)
      })

      it('should set the default refreshing', () => {
        const custom = connect.defaults({ refreshing: true })
        @custom(() => ({ testFetch: { url: `/example` } }))
        class Container extends Component {
          render() {
            return <Passthrough {...this.props} />
          }
        }

        const container = TestUtils.renderIntoDocument(<Container />)
        const init = TestUtils.findRenderedComponentWithType(container, Container)
        expect(init.state.data.testFetch).toIncludeKeyValues({ refreshing: true })
      })

      it('should set the default then', () => {
        const custom = connect.defaults({ then: (v) => `/second/${v['T']}` })
        @custom(({ foo }) => ({ firstFetch: `/first/${foo}` }))
        class Container extends Component {
          render() {
            return <Passthrough {...this.props} />
          }
        }

        const container = TestUtils.renderIntoDocument(<Container foo="bar" />)
        const decorated = TestUtils.findRenderedComponentWithType(container, Container)
        expect(decorated.state.mappings.firstFetch.then).toBeA('function')
      })

      it('should set the default andThen', () => {
        const custom = connect.defaults({ andThen: (v) => `/second/${v['T']}` })
        @custom(({ foo }) => ({ firstFetch: `/first/${foo}` }))
        class Container extends Component {
          render() {
            return <Passthrough {...this.props} />
          }
        }

        const container = TestUtils.renderIntoDocument(<Container foo="bar" />)
        const decorated = TestUtils.findRenderedComponentWithType(container, Container)
        expect(decorated.state.mappings.firstFetch.andThen).toBeA('function')
      })

      it('should set the default catch', () => {
        const custom = connect.defaults({ catch: (v) => `/second/${v['T']}` })
        @custom(({ foo }) => ({ firstFetch: `/first/${foo}` }))
        class Container extends Component {
          render() {
            return <Passthrough {...this.props} />
          }
        }

        const container = TestUtils.renderIntoDocument(<Container foo="bar" />)
        const decorated = TestUtils.findRenderedComponentWithType(container, Container)
        expect(decorated.state.mappings.firstFetch.catch).toBeA('function')
      })

      it('should set the default andCatch', () => {
        const custom = connect.defaults({ andCatch: (v) => `/second/${v['T']}` })
        @custom(({ foo }) => ({ firstFetch: `/first/${foo}` }))
        class Container extends Component {
          render() {
            return <Passthrough {...this.props} />
          }
        }

        const container = TestUtils.renderIntoDocument(<Container foo="bar" />)
        const decorated = TestUtils.findRenderedComponentWithType(container, Container)
        expect(decorated.state.mappings.firstFetch.andCatch).toBeA('function')
      })

      it('options defined on a mapping should take precedence over defaults', (done) => {
        const fetchDefault = expect.createSpy().andCall(window.fetch)
        const handleResponseDefault = expect.createSpy().andCall(handleResponse)
        const buildRequestDefault = expect.createSpy().andCall(buildRequest)

        const custom = connect.defaults({
          then: (v) => `/second/${v['T']}`,
          andThen: (v) => `/second/${v['T']}`,
          catch: (v) => `/second/${v['T']}`,
          andCatch: (v) => `/second/${v['T']}`,
          fetch: fetchDefault,
          handleResponse: handleResponseDefault,
          buildRequest: buildRequestDefault
        })

        const then = (v) => `/second/${v['T']}`
        const andThen = (v) => `/second/${v['T']}`
        const ccatch = (v) => `/second/${v['T']}`
        const andCatch = (v) => `/second/${v['T']}`

        const fetchSpy = expect.createSpy().andCall(window.fetch)
        const handleResponseSpy = expect.createSpy().andCall(handleResponse)
        const buildRequestSpy = expect.createSpy().andCall(buildRequest)

        @custom(({ foo }) => ({
          firstFetch: {
            url: `/first/${foo}`,
            then,
            andThen,
            catch: ccatch,
            andCatch,
            fetch: fetchSpy,
            handleResponse: handleResponseSpy,
            buildRequest: buildRequestSpy
          }
        }))
        class Container extends Component {
          render() {
            return <Passthrough {...this.props} />
          }
        }

        const container = TestUtils.renderIntoDocument(<Container />)
        const decorated = TestUtils.findRenderedComponentWithType(container, Container)
        const mapping = decorated.state.mappings.firstFetch
        expect(mapping.then).toBe(then)
        expect(mapping.andThen).toBe(andThen)
        expect(mapping.catch).toBe(ccatch)
        expect(mapping.andCatch).toBe(andCatch)
        setImmediate(() => {
          expect(fetchDefault.calls.length).toBe(0)
          expect(handleResponseDefault.calls.length).toBe(0)
          expect(buildRequestDefault.calls.length).toBe(0)
          expect(fetchSpy.calls.length).toBe(1)
          expect(handleResponseSpy.calls.length).toBe(1)
          expect(buildRequestSpy.calls.length).toBe(1)
          done()
        })
      })

      it('defaults provided in .defaults() should not affect original connect', () => {
        const then = (v) => `/second/${v['T']}`
        const withThen = connect.defaults({ then })

        @withThen(({ foo }) => ({
          firstFetch: `/first/${foo}`
        }))
        class WithDefaults extends Component {
          render() {
            return <Passthrough {...this.props} />
          }
        }

        @connect(({ foo }) => ({
          firstFetch: `/first/${foo}`
        }))
        class Original extends Component {
          render() {
            return <Passthrough {...this.props} />
          }
        }

        const containerForWithDefaults = TestUtils.renderIntoDocument(<WithDefaults />)
        const withDefaults = TestUtils.findRenderedComponentWithType(containerForWithDefaults, WithDefaults)
        expect(withDefaults.state.mappings.firstFetch.then).toBe(then)

        const containerForOriginal = TestUtils.renderIntoDocument(<Original />)
        const original = TestUtils.findRenderedComponentWithType(containerForOriginal, Original)
        expect(original.state.mappings.firstFetch.then).toBe(undefined)
      })

      it('should warn if both buildRequest and Request are customised', () => {
        const spy = expect.spyOn(console, 'error')
        @connect.defaults({
          buildRequest: () => {},
          Request: () => {}
        })()
        class Container extends Component {
          render() {
            return <Passthrough {...this.props} />
          }
        }

        spy.restore()
        expect(Container).toExist()
        expect(spy.calls.length).toEqual(1)
        expect(spy.calls[0].arguments[0]).toMatch(/Both buildRequest and Request were provided/)
      })
    })
  })
})
