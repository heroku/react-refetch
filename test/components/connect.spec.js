import expect from 'expect'
import React, { createClass, Component } from 'react'
import TestUtils from 'react-addons-test-utils'
import { connect, PromiseState } from '../../src/index'

describe('React', () => {
  describe('connect', () => {

    const fetchSpies = []
    before(() => {
      window.fetch = () => {
        fetchSpies.forEach((spy) => spy())
        return new Promise((resolve) => {
          resolve(new window.Response(JSON.stringify({ T: 't' }), { status: 200, headers: { A: 'a', B: 'b' } }))
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
        testFetch: `/${foo}/${baz}`,
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
        fulfilled: false, pending: true, refreshing: false, reason: null, rejected: false, settled: false, value: null, meta: {}
      })
      expect(stubPending.props.testFetch.constructor).toEqual(PromiseState)

      expect(stubPending.props.testFunc).toBeA('function')
      expect(stubPending.props.deferredFetch).toEqual(null)
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
        expect(stubFulfilled.props.testFetch.meta.request.headers.get('Accept')).toEqual('application/json')
        expect(stubFulfilled.props.testFetch.meta.response.headers.get('A')).toEqual('a')
        expect(stubFulfilled.props.testFetch.meta.response.status).toEqual(200)
        expect(stubFulfilled.props.testFetch.meta.response.bodyUsed).toEqual(true)
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

    it('should use provided mapping object', () => {
      @connect(() => ({ testFetch: { url: '/example', method: 'POST' } }))
      class Container extends Component {
        render() {
          return <Passthrough {...this.props} />
        }
      }

      const container = TestUtils.renderIntoDocument(
        <Container />
      )

      const decorated = TestUtils.findRenderedComponentWithType(container, Container)
      expect(Object.keys(decorated.state.mappings.testFetch).length).toEqual(3)
      expect(decorated.state.mappings.testFetch.method).toEqual('POST')
      expect(decorated.state.mappings.testFetch.url).toEqual('/example')
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
      expect(decorated.state.data.deferredFetch).toEqual(null)

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
      expect(pending.state.refreshTimeouts.testFetch).toEqual(null)

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
        expect(refreshing.state.refreshTimeouts.testFetch).toEqual(null)

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

      @connect(() => ({}), () => ({}))
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

    it('should invoke mapPropsToRequestsToProps every time props are changed', () => {
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

      outerComponent.setFoo('BAR')
      outerComponent.setFoo('BAR')
      outerComponent.setFoo('BAZ')

      expect(invocationCount).toEqual(4)
      expect(propsPassedIn).toEqual({
        foo: 'BAZ'
      })
    })

    it('should shallowly compare the requests to prevent unnecessary fetches', (done) => {
      const fetchSpy = expect.createSpy(() => ({}))
      fetchSpies.push(fetchSpy)

      const renderSpy = expect.createSpy(() => ({}))
      function render() {
        renderSpy()
        return <Passthrough/>
      }

      @connect(({ foo }) => ({ testFetch: `/resource/${foo}` }))
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
          comparison: foo
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
        static howIsRedux = () => 'Awesome!'
        static foo = 'bar'

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
        /To access the wrapped instance, you need to specify \{ withRef: true \} as the fourth argument of the connect\(\) call\./
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

      const decorator = connect(() => {}, { withRef: true })
      const Decorated = decorator(Container)

      const tree = TestUtils.renderIntoDocument(
        <Decorated />
      )

      const decorated = TestUtils.findRenderedComponentWithType(tree, Decorated)

      expect(() => decorated.someInstanceMethod()).toThrow()
      expect(decorated.getWrappedInstance().someInstanceMethod()).toBe(someData)
      expect(decorated.refs.wrappedInstance.someInstanceMethod()).toBe(someData)
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
  })
})
