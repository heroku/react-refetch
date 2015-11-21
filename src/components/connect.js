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

  function didMappingChange(prev, next) {
    return ![ 'url', 'method', 'headers', 'body' ].every((c) => {
      return shallowEqual(deepValue(prev, c), deepValue(next, c))
    })
  }

  function buildRequest(mapping) {
    return new window.Request(mapping.url, {
      method: mapping.method || 'GET',
      headers: Object.assign({
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }, mapping.headers),
      credentials: mapping.credentials || 'same-origin',
      body: mapping.body
    })
  }

  function handleResponse(response) {
    const json = response.json() // TODO: support other response types
    if (response.status >= 200 && response.status < 300) { // TODO: support custom acceptable statuses
      return json
    } else {
      return json.then((errorJson) => {
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

          if (mapping.force || mapping.refreshing || didMappingChange(this.state.mappings[prop], mapping)) {
            this.refetchDatum(prop, mapping)
          }
        })
      }

      refetchDatum(prop, mapping) {
        const startedAt = new Date()

        if (this.state.refreshTimeouts[prop]) {
          window.clearTimeout(this.state.refreshTimeouts[prop])
        }

        const request = buildRequest(mapping)
        const meta = { request: request }

        this.setAtomicState(prop, startedAt, mapping, new PromiseState({
          pending: !mapping.refreshing,
          refreshing: !!mapping.refreshing,
          fulfilled: !!mapping.refreshing,
          value: mapping.refreshing && this.state.data[prop] ? this.state.data[prop].value : null,
          meta: meta
        }), null)

        window.fetch(request).then(response => {
          meta.response = response

          return Promise.resolve(response).then(handleResponse).then(value => {
            let refreshTimeout = null
            if (mapping.refreshInterval > 0) {
              refreshTimeout = window.setTimeout(() => {
                this.refetchDatum(prop, Object.assign({}, mapping, { refreshing: true }))
              }, mapping.refreshInterval)
            }

            this.setAtomicState(prop, startedAt, mapping, new PromiseState({
              fulfilled: true,
              value: value,
              meta: meta
            }), refreshTimeout)
          }).catch(reason => {
            this.setAtomicState(prop, startedAt, mapping, new PromiseState({
              rejected: true,
              reason: reason,
              meta: meta
            }), null)
          })
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
