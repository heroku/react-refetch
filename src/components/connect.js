import React, { Component } from 'react'
import isPlainObject from '../utils/isPlainObject'
import deepValue from '../utils/deepValue'
import shallowEqual from '../utils/shallowEqual'
import newError from '../utils/errors'
import PromiseState from '../PromiseState'
import hoistStatics from 'hoist-non-react-statics'
import invariant from 'invariant'

const defaultMapPropsToRequestsToProps = () => ({})

const top = (typeof window !== 'undefined'
  ? window
  : (typeof global !== 'undefined'
    ? global
    : (typeof self !== 'undefined'
      ? self
      : {}
    )
  )
)

function getDisplayName(WrappedComponent) {
  return WrappedComponent.displayName || WrappedComponent.name || 'Component'
}

// Helps track hot reloading.
let nextVersion = 0

function connectFactory(defaults = {}) {
  function connectImpl(map, options = {}) {
    /* eslint-disable no-console */
    if (Object.getOwnPropertyNames(options).length > 0 && console && console.warn) {
      console.warn('The options argument is deprecated in favor of `connect.defaults()` calls. In a future release, support will be removed.')
    }

    const finalOptions = Object.assign({}, defaults, options)

    if (Function.prototype.isPrototypeOf(finalOptions.buildRequest) &&
      Function.prototype.isPrototypeOf(finalOptions.Request) &&
      console && console.info) {
      console.info('Both buildRequest and Request were provided in `connect.defaults()`. However this custom Request would only be used in the default buildRequest.')
    }

    /* eslint-enable no-console */
    return connect(map, finalOptions)
  }

  connectImpl.defaults = function (overrides = {}) {
    return connectFactory(Object.assign({}, defaults, overrides))
  }

  return connectImpl
}

export default connectFactory()

function typecheck(type, name, obj) {
  invariant(
    typeof obj === type,
    `${name} must be a ${type}. Instead received a %s.`,
    typeof obj
  )
}

const checks = {
  buildRequest(fn) {
    typecheck('function', 'buildRequest', fn)
  },

  credentials(str) {
    const allowed = [ 'omit', 'same-origin', 'include' ]
    invariant(
      allowed.indexOf(str) !== -1,
      `credentials must be one of ${allowed.join(', ')}. Instead got %s.`,
      str ? str.toString() : str
    )
  },

  fetch(fn) {
    typecheck('function', 'fetch', fn)
  },

  handleResponse(fn) {
    typecheck('function', 'handleResponse', fn)
  },

  headers(obj) {
    invariant(
      isPlainObject(obj),
      'headers must be a plain object with string values. Instead received a %s.',
      typeof obj
    )
  },

  method(str) {
    typecheck('string', 'method', str)
  },

  redirect(str) {
    const allowed = [ 'follow', 'error', 'manual' ]
    invariant(
      allowed.indexOf(str) !== -1,
      `redirect must be one of ${allowed.join(', ')}. Instead got %s.`,
      str ? str.toString() : str
    )
  },

  refreshInterval(num) {
    typecheck('number', 'refreshInterval', num)
    invariant(num >= 0, 'refreshInterval must be positive or 0.')
    invariant(num !== Infinity, 'refreshInterval must not be Infinity.')
  },

  Request(fn) {
    typecheck('function', 'Request', fn)
  }
}

function connect(mapPropsToRequestsToProps, defaults) {
  const finalMapPropsToRequestsToProps = mapPropsToRequestsToProps || defaultMapPropsToRequestsToProps

  defaults = Object.assign({
    andCatch: undefined,
    andThen: undefined,
    buildRequest,
    catch: undefined,
    comparison: undefined,
    credentials: 'same-origin',
    fetch: top.fetch,
    force: false,
    handleResponse,
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    method: 'GET',
    redirect: 'follow',
    refreshing: false,
    refreshInterval: 0,
    Request: top.Request,
    then: undefined,
    withRef: false
  }, defaults)

  Object.keys(defaults).forEach(key => {
    if (checks[key]) {
      checks[key](defaults[key])
    }
  })

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

    mapping = assignDefaults(mapping, parent)

    invariant(isPlainObject(mapping.meta), 'meta for `%s` must be a plain object. Instead received %s', prop, mapping.meta)

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

  function assignDefaults(mapping, parent) {
    return Object.assign(
      { comparison: defaults.comparison },
      parent ? {
        comparison: parent.comparison
      } : {},
      {
        andCatch: defaults.andCatch,
        andThen: defaults.andThen,
        catch: defaults.catch,
        credentials: defaults.credentials,
        force: defaults.force,
        meta: {},
        method: defaults.method,
        redirect: defaults.redirect,
        refreshing: defaults.refreshing,
        refreshInterval: defaults.refreshInterval,
        then: defaults.then
      },
      mapping,
      { headers: Object.assign({}, defaults.headers, mapping.headers) }
    )
  }

  function buildRequest(mapping) {
    return new defaults.Request(mapping.url, {
      method: mapping.method,
      headers: mapping.headers,
      credentials: mapping.credentials,
      redirect: mapping.redirect,
      body: mapping.body
    })
  }

  function handleResponse(response) {
    if (response.headers.get('content-length') === '0' || response.status === 204) {
      return
    }

    const json = response.json() // TODO: support other response types

    if (response.status >= 200 && response.status < 300) { // TODO: support custom acceptable statuses
      return json
    } else {
      return json.then(cause => Promise.reject(newError(cause)))
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

      componentWillReceiveProps(nextProps, nextContext) {
        this.refetchDataFromProps(nextProps, nextContext)
      }

      componentWillUnmount() {
        this.clearAllRefreshTimeouts()
        this._unmounted = true
      }

      render() {
        const ref = defaults.withRef ? 'wrappedInstance' : null
        return (
          <WrappedComponent { ...this.state.data } { ...this.props } ref={ref}/>
        )
      }

      getWrappedInstance() {
        invariant(defaults.withRef,
          `To access the wrapped instance, you need to specify { withRef: true } ` +
          `in .defaults().`
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
        const meta = mapping.meta
        const initPS = this.createInitialPromiseState(prop, mapping)
        const onFulfillment = this.createPromiseStateOnFulfillment(prop, mapping, startedAt)
        const onRejection = this.createPromiseStateOnRejection(prop, mapping, startedAt)

        if (mapping.hasOwnProperty('value')) {
          return onFulfillment(meta)(mapping.value)
        } else {
          const request = defaults.buildRequest(mapping)
          meta.request = request
          this.setAtomicState(prop, startedAt, mapping, initPS(meta))

          const fetched = defaults.fetch(request)
          return fetched.then(response => {
            meta.response = response
            return fetched.then(defaults.handleResponse).then(onFulfillment(meta), onRejection(meta))
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

            if (Function.prototype.isPrototypeOf(mapping.then)) {
              this.refetchDatum(prop, coerceMapping(null, mapping.then(value, meta), mapping))
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
              this.refetchDatum(prop, coerceMapping(null, mapping.catch(reason, meta), mapping))
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
