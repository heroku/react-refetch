import 'whatwg-fetch'
import React, { Component } from 'react'
import isPlainObject from '../utils/isPlainObject'
import PromiseState from '../PromiseState'
import hoistStatics from 'hoist-non-react-statics'
import invariant from 'invariant'

const defaultMapPropsToRequestsToProps = () => ({})

function getDisplayName(WrappedComponent) {
  return WrappedComponent.displayName || WrappedComponent.name || 'Component'
}

// Helps track hot reloading.
let nextVersion = 0

export default function connect(mapPropsToRequestsToProps, options = {}) {
  const finalMapPropsToRequestsToProps = mapPropsToRequestsToProps || defaultMapPropsToRequestsToProps
  const { withRef = false } = options

  // Helps track hot reloading.
  const version = nextVersion++

  function computeMappings(props) {
    const rawMappings = finalMapPropsToRequestsToProps(props) || {}

    invariant(
      isPlainObject(rawMappings),
      '`mapPropsToRequestsToProps` must return an object. Instead received %s.',
      rawMappings
    )

    const mappings = {}
    Object.keys(rawMappings).forEach(prop => {
      mappings[prop] = coerceMapping(prop, rawMappings[prop])
    })
    return mappings
  }

  function coerceMapping(prop, mapping) {
    if (Array.isArray(mapping)) {
      return Object.assign({ request: coerceRequest(prop, mapping[0]) }, coerceOpts(prop, mapping[1]))
    } else {
      return { request: coerceRequest(prop, mapping) }
    }
  }

  function coerceRequest(prop, stringOrRequest) {
    if (typeof stringOrRequest === 'string') {
      return new window.Request(stringOrRequest, { credentials: 'same-origin' })
    } else if (stringOrRequest instanceof window.Request) {
      return stringOrRequest
    } else {
      invariant(false, 'Value of first argument of `%s` must be either a string or Request. Instead received %s', prop, stringOrRequest)
    }
  }

  function coerceOpts(prop, opts) {
    if (opts && !isPlainObject(opts)) {
      invariant(false, 'Value of second argument of `%s` must be a plain object. Instead received %s', prop, opts)
    }
    return opts || {}
  }

  function handleResponse(response) {
    if (response.status >= 200 && response.status < 300) {
      return response.json()
    } else {
      return response.json().then((errorJson) => {
        const { id, error, message } = errorJson
        if (error) {
          throw new Error(error, id)
        } else if (message) {
          throw new Error(message, id)
        } else {
          throw new Error(errorJson)
        }
      })
    }
  }

  return function wrapWithConnect(WrappedComponent) {
    class RefetchConnect extends Component {
      constructor(props, context) {
        super(props, context)
        this.version = version
        this.state = { mappings: {}, intervals: {}, data: {} }
      }

      componentWillMount() {
        this.refreshData()
      }

      componentWillReceiveProps(nextProps) {
        this.refreshData(nextProps)
      }

      render() {
        const ref = withRef ? 'wrappedInstance' : null
        return (
          <WrappedComponent { ...this.state.data } { ...this.props } ref={ref}/>
        )
      }

      getWrappedInstance() {
        invariant(withRef,
          `To access the wrapped instance, you need to specify ` +
          `{ withRef: true } as the fourth argument of the connect() call.`
        )

        return this.refs.wrappedInstance
      }

      refreshData(props = this.props) {
        const nextMappings = computeMappings(props)
        Object.keys(nextMappings).forEach(prop => {
          const prev = this.state.mappings[prop]
          const next = nextMappings[prop]
          const comp = [ 'url', 'method' ]
          const same = prev && next && prev.request && next.request && comp.every(c => prev.request[c] === next.request[c])

          if (!same) {
            this.refreshDatum(prop, next)
          }
        })
      }

      refreshDatum(prop, mapping) {
        this.setPromiseState(prop, mapping, new PromiseState({
          pending: true
        }))

        window.fetch(mapping.request)
          .then(handleResponse)
          .then(value => {
            this.setPromiseState(prop, mapping, new PromiseState({
              fulfilled: true,
              value: value
            }))
          })
          .catch(error => {
            this.setPromiseState(prop, mapping, new PromiseState({
              rejected: true,
              reason: error
            }))
          })
      }

      setPromiseState(prop, mapping, promiseState) {
        this.setState((prevState) => ({
          mappings: Object.assign(
            prevState.mappings, {
              [prop]: mapping
            }),
          data: Object.assign(
            prevState.data, {
              [prop]: promiseState
            })
        }))
      }
    }

    RefetchConnect.displayName = `Refetch.connect(${getDisplayName(WrappedComponent)})`
    RefetchConnect.WrappedComponent = WrappedComponent

    if (process.env.NODE_ENV !== 'production') {
      RefetchConnect.prototype.componentWillUpdate = function componentWillUpdate() {
        if (this.version === version) {
          return
        }

        // We are hot reloading!
        this.version = version

        this.refreshData()
      }
    }

    return hoistStatics(RefetchConnect, WrappedComponent)
  }
}
