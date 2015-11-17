import 'whatwg-fetch'
import React, { Component } from 'react'
import isPlainObject from '../utils/isPlainObject'
import deepValue from '../utils/deepValue'
import shallowEqual from '../utils/shallowEqual'
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

  function mappingToRequest(m) {
    return new window.Request(m.url, {
      method: m.method || 'GET',
      headers: m.headers || {},
      body: m.body || null,
      credentials: m.credentials || 'same-origin'
    })
  }

  function coerceMappings(rawMappings) {
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
    if (Function.prototype.isPrototypeOf(mapping)) {
      return mapping
    } else if (typeof mapping === 'string') {
      return { url: mapping }
    } else if (isPlainObject(mapping)) {
      invariant(mapping.url, 'Mapping for `%s` of type Object must have `url` attribute.', prop)
      return mapping
    } else if (Array.isArray(mapping)) {
      invariant(false, 'Mapping as array no longer supported. Use a plain object instead with the first element as the `url` attribute.')
    } else if (mapping instanceof window.Request) {
      invariant(false, 'Request object no longer supported. Use a plain object instead with first argument as the `url` attribute.')
    } else {
      invariant(false, 'Mapping for `%s` must be either a string or a plain object. Instead received %s', prop, mapping)
    }
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
        this.state = { mappings: {}, startedAts: {}, data: {}, refreshTimeouts: {} }
      }

      componentWillMount() {
        this.refetchDataFromProps()
      }

      componentWillReceiveProps(nextProps) {
        this.refetchDataFromProps(nextProps)
      }

      componentWillUnmount() {
        this.clearAllRefreshTimeouts()
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

      refetchDataFromProps(props = this.props) {
        this.refetchDataFromMappings(finalMapPropsToRequestsToProps(props) || {})
      }

      refetchDataFromMappings(mappings) {
        mappings = coerceMappings(mappings)
        Object.keys(mappings).forEach(prop => {
          const mapping = mappings[prop]

          if (Function.prototype.isPrototypeOf(mapping)) {
            this.setAtomicState(prop, new Date(), mapping, (...args) => {
              this.refetchDataFromMappings(mapping(...args || {}))
            })
            return
          }

          const prev = this.state.mappings[prop]
          const comp = [ 'url', 'method', 'headers' ]
          const same = comp.every(c => shallowEqual(deepValue(prev, c), deepValue(mapping, c)))

          if (!same) {
            this.refetchDatum(prop, mapping, false)
          } else if (prev.refreshInterval !== mapping.refreshInterval) {
            this.refetchDatum(prop, mapping, true)
          }
        })
      }

      refetchDatum(prop, mapping, refreshing) {
        const startedAt = new Date()

        if (this.state.refreshTimeouts[prop]) {
          window.clearTimeout(this.state.refreshTimeouts[prop])
        }

        this.setAtomicState(prop, startedAt, mapping, new PromiseState({
          pending: !refreshing,
          refreshing: refreshing,
          fulfilled: refreshing,
          value: refreshing ? this.state.data[prop].value : null
        }), null)

        window.fetch(mappingToRequest(mapping))
          .then(handleResponse)
          .then(response => {
            let refreshTimeout = null
            if (mapping.refreshInterval > 0) {
              refreshTimeout = window.setTimeout(() => {
                this.refetchDatum(prop, mapping, true)
              }, mapping.refreshInterval)
            }
            this.setAtomicState(prop, startedAt, mapping, new PromiseState({
              fulfilled: true,
              value: response
            }), refreshTimeout)
          })
          .catch(error => {
            this.setAtomicState(prop, startedAt, mapping, new PromiseState({
              rejected: true,
              reason: error
            }), null)
          })
      }

      setAtomicState(prop, startedAt, mapping, datum, refreshTimeout) {
        this.setState((prevState) => {
          if (startedAt < prevState.startedAts[prop]) {
            return {}
          }

          return {
            startedAts: Object.assign(
              prevState.startedAts, {
                [prop]: startedAt
              }),
            mappings: Object.assign(
              prevState.mappings, {
                [prop]: mapping
              }),
            data: Object.assign(
              prevState.data, {
                [prop]: datum
              }),
            refreshTimeouts: Object.assign(
              prevState.refreshTimeouts, {
                [prop]: refreshTimeout
              })
          }

        })
      }

      clearAllRefreshTimeouts() {
        Object.keys(this.state.refreshTimeouts).forEach((prop) => {
          clearTimeout(this.state.refreshTimeouts[prop])
        })
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
        this.clearAllRefreshTimeouts()
        this.refetchDataFromProps()
      }
    }

    return hoistStatics(RefetchConnect, WrappedComponent)
  }
}
