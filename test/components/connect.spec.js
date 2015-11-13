import expect from 'expect'
import React, { createClass, Component } from 'react'
import TestUtils from 'react-addons-test-utils'
import { connect, PromiseState } from '../../src/index'

describe('React', () => {
  describe('connect', () => {

    before(() => {
      window.fetch = () => {
        return new Promise((resolve) => {
          resolve(new window.Response('{}', { status: 200 }))
        })
      }
    })

    class Passthrough extends Component {
      render() {
        return <div {...this.props} />
      }
    }

    it('should props and promise state to the given component', () => {
      const props = ({
        foo: 'bar',
        baz: 42
      })

      @connect(({ foo, baz }) => ({ testFetch: `/${foo}/${baz}` }))
      class Container extends Component {
        render() {
          return <Passthrough {...this.props} />
        }
      }

      const container = TestUtils.renderIntoDocument(
        <Container {...props} />
      )

      const stub = TestUtils.findRenderedComponentWithType(container, Passthrough)
      expect(stub.props.foo).toEqual('bar')
      expect(stub.props.baz).toEqual(42)
      expect(stub.props.testFetch).toEqual({ fulfilled: false, pending: true, refreshing: false, reason: null, rejected: false, settled: false, value: null })
      expect(stub.props.testFetch.constructor).toEqual(PromiseState)
      expect(() =>
        TestUtils.findRenderedComponentWithType(container, Container)
      ).toNotThrow()
    })

    it('should create default Request and empty options if just URL is provided', () => {
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
      expect(decorated.state.mappings.testFetch.request.method).toEqual('GET')
      expect(decorated.state.mappings.testFetch.request.url).toEqual('/example')
      expect(decorated.state.mappings.testFetch.request.credentials).toEqual('same-origin')
    })

    it('should use provided Request with empty options if custom Request is provided', () => {
      @connect(() => ({ testFetch: new window.Request('/example', { method: 'POST' }) }))
      class Container extends Component {
        render() {
          return <Passthrough {...this.props} />
        }
      }

      const container = TestUtils.renderIntoDocument(
        <Container />
      )

      const decorated = TestUtils.findRenderedComponentWithType(container, Container)
      expect(Object.keys(decorated.state.mappings.testFetch).length).toEqual(1)
      expect(decorated.state.mappings.testFetch.request.method).toEqual('POST')
      expect(decorated.state.mappings.testFetch.request.url).toEqual('/example')
      expect(decorated.state.mappings.testFetch.request.credentials).toEqual('omit')
    })

    it('should create default Request with provided options if custom options are provided', () => {
      @connect(() => ({ testFetch: [ `/example`, { anOption: true, anotherOption: 'blue' } ] }))
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
      expect(decorated.state.mappings.testFetch.request.method).toEqual('GET')
      expect(decorated.state.mappings.testFetch.request.url).toEqual('/example')
      expect(decorated.state.mappings.testFetch.request.credentials).toEqual('same-origin')
      expect(decorated.state.mappings.testFetch.anOption).toEqual(true)
      expect(decorated.state.mappings.testFetch.anotherOption).toEqual('blue')
    })

    it('should use provided Request with provided options if custom Request and options are provided', () => {
      @connect(() => ({ testFetch: [ new window.Request(`/example`), { anOption: true, anotherOption: 'blue' } ] }))
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
      expect(decorated.state.mappings.testFetch.request.method).toEqual('GET')
      expect(decorated.state.mappings.testFetch.request.url).toEqual('/example')
      expect(decorated.state.mappings.testFetch.request.credentials).toEqual('omit')
      expect(decorated.state.mappings.testFetch.anOption).toEqual(true)
      expect(decorated.state.mappings.testFetch.anotherOption).toEqual('blue')
    })

    it('should set refreshTimeouts when refreshInterval is provided', (done) => {
      @connect(() => ({ testFetch: [ `/example`, { refreshInterval: 10000 } ] }))
      class Container extends Component {
        render() {
          return <Passthrough {...this.props} />
        }
      }

      const container = TestUtils.renderIntoDocument(
        <Container />
      )

      const decoratedPending = TestUtils.findRenderedComponentWithType(container, Container)
      expect(Object.keys(decoratedPending.state.mappings.testFetch).length).toEqual(2)
      expect(decoratedPending.state.mappings.testFetch.request.method).toEqual('GET')
      expect(decoratedPending.state.mappings.testFetch.request.url).toEqual('/example')
      expect(decoratedPending.state.mappings.testFetch.request.credentials).toEqual('same-origin')
      expect(decoratedPending.state.mappings.testFetch.refreshInterval).toEqual(10000)

      setImmediate(() => {
        const decoratedFulfilled = TestUtils.findRenderedComponentWithType(container, Container)
        expect(decoratedFulfilled.state.refreshTimeouts.testFetch).toBeTruthy()
        clearTimeout(decoratedFulfilled.state.refreshTimeouts.testFetch)
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

    it('should shallowly compare the Requests to prevent unnecessary updates', () => {
      const spy = expect.createSpy(() => ({}))
      function render() {
        spy()
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

      expect(spy.calls.length).toBe(1)
      outerComponent.setFoo('BAR')
      expect(spy.calls.length).toBe(2)
      outerComponent.setFoo('BAR')
      expect(spy.calls.length).toBe(3) // TODO: don't need to update here
      outerComponent.setFoo('BAZ')
      expect(spy.calls.length).toBe(4)
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
