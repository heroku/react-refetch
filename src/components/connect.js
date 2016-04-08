import React, { Component } from 'react'
import isPlainObject from '../utils/isPlainObject'
import shallowEqual from '../utils/shallowEqual'
import handleResponse from '../utils/handleResponse'
import buildRequest from '../utils/buildRequest'
import checkTypes from '../utils/checkTypes'
import PromiseState from '../PromiseState'
import hoistStatics from 'hoist-non-react-statics'
import invariant from 'invariant'
import warning from 'warning'

const defaultMapPropsToRequestsToProps = () => ({})

function getDisplayName(WrappedComponent) {
  return WrappedComponent.displayName || WrappedComponent.name || 'Component'
}

// Helps track hot reloading.
let nextVersion = 0

function connectFactory(defaults = {}, options = {}) {
  function connectImpl(map, deprecatedOptionsArgument = {}) {
    let finalOptions = options
    if ('withRef' in deprecatedOptionsArgument) {
      warning(false, 'The options argument is deprecated in favor of `connect.options()`. In a future release, support will be removed.')
      finalOptions = Object.assign({}, options, { withRef: deprecatedOptionsArgument.withRef })
    }

    warning(!(Function.prototype.isPrototypeOf(defaults.buildRequest) &&
      Function.prototype.isPrototypeOf(defaults.Request)),
      'Both buildRequest and Request were provided in `connect.defaults()`. ' +
      'However, this custom Request would only be used in the default buildRequest.'
    )

    return connect(map, defaults, finalOptions)
  }

  connectImpl.defaults = function (overrides = {}) {
    checkTypes(overrides)
    return connectFactory(Object.assign(
      {},
      defaults,
      overrides,
      { headers: Object.assign({}, defaults.headers, overrides.headers) }
    ), options)
  }

  connectImpl.options = function (overrides = {}) {
    return connectFactory(defaults, Object.assign({}, options, overrides))
  }

  return connectImpl
}

export default connectFactory({
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  }
})

function connect(mapPropsToRequestsToProps, defaults, options) {
  const finalMapPropsToRequestsToProps = mapPropsToRequestsToProps || defaultMapPropsToRequestsToProps
  const dependsOnProps = finalMapPropsToRequestsToProps.length >= 1
  const dependsOnContext = finalMapPropsToRequestsToProps.length == 2

  let topFetch
  let topRequest
  if (typeof window !== 'undefined') {
    if (window.fetch) { topFetch = window.fetch.bind(window) }
    if (window.Request) { topRequest = window.Request.bind(window) }
  } else if (typeof global !== 'undefined') {
    if (global.fetch) { topFetch = global.fetch.bind(global) }
    if (global.Request) { topRequest = global.Request.bind(global) }
  } else if (typeof self !== 'undefined') {
    if (self.fetch) { topFetch = self.fetch.bind(self) }
    if (self.Request) { topRequest = self.Request.bind(self) }
  }

  defaults = Object.assign({
    buildRequest,
    credentials: 'same-origin',
    fetch: topFetch,
    force: false,
    handleResponse,
    method: 'GET',
    redirect: 'follow',
    refreshing: false,
    refreshInterval: 0,
    Request: topRequest
  }, defaults)

  checkTypes(defaults)

  options = Object.assign({
    withRef: false
  }, options)

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

  function coerceMapping(prop, mapping, parent) {
    if (Function.prototype.isPrototypeOf(mapping)) {
      return mapping
    }

    if (typeof mapping === 'string') {
      mapping = { url: mapping }
    }

    invariant(isPlainObject(mapping), 'Request for `%s` must be either a string or a plain object. Instead received %s', prop, mapping)
    invariant(mapping.hasOwnProperty('url') || mapping.hasOwnProperty('value'), 'Request object for `%s` must have `url` (or `value`) attribute.', prop)
    invariant(!(mapping.hasOwnProperty('url') && mapping.hasOwnProperty('value')), 'Request object for `%s` must not have both `url` and `value` attributes.', prop)

    checkTypes(mapping)

    mapping = assignDefaults(mapping, parent)

    invariant(isPlainObject(mapping.meta), 'meta for `%s` must be a plain object. Instead received %s', prop, mapping.meta)

    mapping.equals = function (that) {
      if (this.comparison !== undefined) {
        return this.comparison === that.comparison
      }

      return [ 'value', 'url', 'method', 'headers', 'body' ].every((c) => {
        return shallowEqual(this[c], that[c])
      })
    }.bind(mapping)

    return mapping
  }

  function assignDefaults(mapping, parent) {
    const rawHeaders = Object.assign({}, defaults.headers, mapping.headers)
    const headers = {}
    for (let key in rawHeaders) {
      // Discard headers with falsy values
      if (rawHeaders.hasOwnProperty(key) && rawHeaders[key]) {
        headers[key] = rawHeaders[key]
      }
    }

    return Object.assign(
      {
        meta: {}
      },
      defaults,
      parent ? { comparison: parent.comparison } : {},
      mapping,
      { headers }
    )
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

      componentWillReceiveProps(nextProps, nextContext) {
        if (
          (dependsOnProps && !shallowEqual(this.props, nextProps)) ||
          (dependsOnContext && !shallowEqual(this.context, nextContext))
        ) {
          this.refetchDataFromProps(nextProps, nextContext)
        }
      }

      componentWillUnmount() {
        this.clearAllRefreshTimeouts()
        this._unmounted = true
      }

      render() {
        const ref = options.withRef ? 'wrappedInstance' : null
        return (
          <WrappedComponent { ...this.state.data } { ...this.props } ref={ref}/>
        )
      }

      getWrappedInstance() {
        invariant(options.withRef,
          `To access the wrapped instance, you need to specify { withRef: true } in .options().`
        )

        return this.refs.wrappedInstance
      }

      refetchDataFromProps(props = this.props, context = this.context) {
        this.refetchDataFromMappings(finalMapPropsToRequestsToProps(props, context) || {})
      }

      refetchDataFromMappings(mappings) {
        mappings = coerceMappings(mappings)
        Object.keys(mappings).forEach(prop => {
          const mapping = mappings[prop]

          if (Function.prototype.isPrototypeOf(mapping)) {
            this.setAtomicState(prop, new Date(), mapping, (...args) => {
              this.refetchDataFromMappings(mapping(...args))
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
        const meta = mapping.meta
        const initPS = this.createInitialPromiseState(prop, mapping)
        const onFulfillment = this.createPromiseStateOnFulfillment(prop, mapping, startedAt)
        const onRejection = this.createPromiseStateOnRejection(prop, mapping, startedAt)

        if (mapping.hasOwnProperty('value')) {
          return onFulfillment(meta)(mapping.value)
        } else {
          const request = mapping.buildRequest(mapping)
          meta.request = request
          this.setAtomicState(prop, startedAt, mapping, initPS(meta))

          const fetched = mapping.fetch(request)
          return fetched.then(response => {
            meta.response = response
            return fetched.then(mapping.handleResponse)
              .then(onFulfillment(meta), onRejection(meta))
          })
        }
      }

      createInitialPromiseState(prop, mapping) {
        return (meta) => {
          return mapping.refreshing ? PromiseState.refresh(this.state.data[prop], meta) : PromiseState.create(meta)
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

            if (mapping.then) {
              this.refetchDatum(prop, coerceMapping(null, mapping.then(value, meta), mapping))
              return
            }

            this.setAtomicState(prop, startedAt, mapping, PromiseState.resolve(value, meta), refreshTimeout, () => {
              if (mapping.andThen) {
                this.refetchDataFromMappings(mapping.andThen(value, meta))
              }
            })
          }
        }
      }

      createPromiseStateOnRejection(prop, mapping, startedAt) {
        return (meta) => {
          return (reason) => {
            if (mapping.catch) {
              this.refetchDatum(prop, coerceMapping(null, mapping.catch(reason, meta), mapping))
              return
            }

            this.setAtomicState(prop, startedAt, mapping, PromiseState.reject(reason, meta), null, () => {
              if (mapping.andCatch) {
                this.refetchDataFromMappings(mapping.andCatch(reason, meta))
              }
            })
          }
        }
      }

      setAtomicState(prop, startedAt, mapping, datum, refreshTimeout, callback) {
        if (this._unmounted) {
          return
        }

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

    if (dependsOnContext && WrappedComponent.contextTypes) {
      RefetchConnect.contextTypes = WrappedComponent.contextTypes
    }

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
