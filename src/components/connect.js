import 'whatwg-fetch'
import React, { Component } from 'react'
import isPlainObject from '../utils/isPlainObject'
import hoistStatics from 'hoist-non-react-statics'
import invariant from 'invariant'

const defaultMapPropsToRequests = () => ({})

function getDisplayName(WrappedComponent) {
  return WrappedComponent.displayName || WrappedComponent.name || 'Component'
}

// Helps track hot reloading.
let nextVersion = 0

export default function connect(mapPropsToRequests, options = {}) {
  const finalMapPropsToRequests = mapPropsToRequests || defaultMapPropsToRequests
  const { withRef = false } = options

  // Helps track hot reloading.
  const version = nextVersion++

  function computeRequests(props) {
    const urlsOrRequests = finalMapPropsToRequests(props) || {}

    invariant(
      isPlainObject(urlsOrRequests),
      '`mapPropsToRequests` must return an object. Instead received %s.',
      urlsOrRequests
    )

    const requests = {}
    Object.keys(urlsOrRequests).forEach(prop => {
      const urlOrRequest = urlsOrRequests[prop]
      if (typeof urlOrRequest === 'string') {
        requests[prop] = new window.Request(urlOrRequest, { credentials: 'same-origin' })
      } else if (urlOrRequest instanceof window.Request) {
        requests[prop] = urlOrRequest
      } else {
        invariant(false, 'Value of `%s` must be either a string or Request. Instead received %s', prop, urlOrRequest)
      }
    })

    return requests
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
        this.state = { requests: {}, data: {} }
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
        const nextRequests = computeRequests(props)
        Object.keys(nextRequests).forEach((prop) => {
          const prev = this.state.requests[prop]
          const next = nextRequests[prop]
          const comp = [ 'url', 'method' ]
          const same = prev && next && comp.every(c => prev[c] === next[c])

          if (!same) {
            this.refreshDatum(prop, next)
          }
        })
      }

      refreshDatum(prop, request) {
        this.setPromiseState(prop, request, {
          'pending': true,
          'fulfilled': false,
          'rejected': false,
          'settled': false,
          'value': null,
          'reason': null
        })

        window.fetch(request)
          .then(handleResponse)
          .then(value => {
            this.setPromiseState(prop, request, {
              'pending': false,
              'fulfilled': true,
              'rejected': false,
              'settled': true,
              'value': value,
              'reason': null
            })
          })
          .catch(error => {
            this.setPromiseState(prop, request, {
              'pending': false,
              'fulfilled': false,
              'rejected': true,
              'settled': false,
              'value': null,
              'reason': error
            })
          })
      }

      setPromiseState(prop, request, promiseState) {
        this.setState((prevState) => ({
          requests: Object.assign(
            prevState.requests, {
              [prop]: request
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
