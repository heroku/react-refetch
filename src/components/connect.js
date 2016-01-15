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
    }

    if (typeof mapping === 'string') {
      mapping = { url: mapping }
    }

    invariant(isPlainObject(mapping), 'Request for `%s` must be either a string or a plain object. Instead received %s', prop, mapping)
    invariant(mapping.url || mapping.value, 'Request object for `%s` must have `url` (or `value`) attribute.', prop)
    invariant(!(mapping.url && mapping.value), 'Request object for `%s` must not have both `url` and `value` attributes.', prop)

    mapping.equals = function (that) {
      if (this.comparison !== undefined) {
        return this.comparison === that.comparison
      }

      return [ 'value', 'url', 'method', 'headers', 'body' ].every((c) => {
        return shallowEqual(deepValue(this, c), deepValue(that, c))
      })
    }.bind(mapping)

    return mapping
  }

  function buildRequest(mapping) {
    return new window.Request(mapping.url, {
      method: mapping.method || 'GET',
      headers: Object.assign({
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }, mapping.headers),
      credentials: mapping.credentials || 'same-origin',
      redirect: mapping.redirect || 'follow',
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

          if (mapping.force || !mapping.equals(this.state.mappings[prop] || {})) {
            this.refetchDatum(prop, mapping)
          }
        })
      }

      refetchDatum(prop, mapping) {
        const startedAt = new Date()

        if (this.state.refreshTimeouts[prop]) {
          window.clearTimeout(this.state.refreshTimeouts[prop])
        }

        return this.createPromise(prop, mapping, startedAt)
      }

      createPromise(prop, mapping, startedAt) {
        const onFulfillment = this.createPromiseStateOnFulfillment(prop, mapping, startedAt)
        const onRejection = this.createPromiseStateOnRejection(prop, mapping, startedAt)

        if (mapping.value) {
          const meta = {}
          return Promise.resolve(mapping.value).then(onFulfillment(meta), onRejection(meta))
        } else {
          const request = buildRequest(mapping)
          const meta = { request: request }
          const initPS = mapping.refreshing ? PromiseState.refresh(this.state.data[prop], meta) : PromiseState.create(meta)
          this.setAtomicState(prop, startedAt, mapping, initPS)

          const fetched = window.fetch(request)
          return fetched.then(response => {
            meta.response = response
            return fetched.then(handleResponse).then(onFulfillment(meta), onRejection(meta))
          })
        }
      }

      createPromiseStateOnFulfillment(prop, mapping, startedAt) {
        return (meta) => {
          return (value) => {
            let refreshTimeout = null
            if (mapping.refreshInterval > 0) {
              refreshTimeout = window.setTimeout(() => {
                this.refetchDatum(prop, Object.assign({}, mapping, { refreshing: true, force: true }))
              }, mapping.refreshInterval)
            }

            if (Function.prototype.isPrototypeOf(mapping.then)) {
              this.refetchDatum(prop, coerceMapping(null, mapping.then(value, meta)))
              return
            }

            this.setAtomicState(prop, startedAt, mapping, PromiseState.resolve(value, meta), refreshTimeout, () => {
              if (Function.prototype.isPrototypeOf(mapping.andThen)) {
                this.refetchDataFromMappings(mapping.andThen(value, meta))
              }
            })
          }
        }
      }

      createPromiseStateOnRejection(prop, mapping, startedAt) {
        return (meta) => {
          return (reason) => {
            if (Function.prototype.isPrototypeOf(mapping.catch)) {
              this.refetchDatum(coerceMapping(null, mapping.catch(reason, meta)))
              return
            }

            this.setAtomicState(prop, startedAt, mapping, PromiseState.reject(reason, meta), null, () => {
              if (Function.prototype.isPrototypeOf(mapping.andCatch)) {
                this.refetchDataFromMappings(mapping.andCatch(reason, meta))
              }
            })
          }
        }
      }

      setAtomicState(prop, startedAt, mapping, datum, refreshTimeout, callback) {
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

        }, callback)
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
