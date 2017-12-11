React Refetch
=========================
A simple, declarative, and composable way to fetch data for React components.

![React Refetch Logo](logo.png)

## Installation

[![build status](https://img.shields.io/travis/heroku/react-refetch/master.svg?style=flat-square)](https://travis-ci.org/heroku/react-refetch) [![npm version](https://img.shields.io/npm/v/react-refetch.svg?style=flat-square)](https://www.npmjs.com/package/react-refetch)
[![npm downloads](https://img.shields.io/npm/dm/react-refetch.svg?style=flat-square)](https://www.npmjs.com/package/react-refetch)

Requires **React 0.14 or later.**

```
npm install --save react-refetch
```

This assumes that you’re using [npm](http://npmjs.com/) package manager with a module bundler like [Webpack](http://webpack.github.io) or [Browserify](http://browserify.org/) to consume [CommonJS modules](http://webpack.github.io/docs/commonjs.html).

The following ES6 functions are required:

- [`Object.assign`](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Object/assign)
- [`Promise`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)
- [`fetch`](https://developer.mozilla.org/en-US/docs/Web/API/GlobalFetch)
- [`Array.prototype.find`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/find)

Check the compatibility tables ([`Object.assign`](https://kangax.github.io/compat-table/es6/#test-Object_static_methods_Object.assign), [`Promise`](https://kangax.github.io/compat-table/es6/#test-Promise), [`fetch`](http://caniuse.com/#feat=fetch), [`Array.prototype.find`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/find)) to make sure all browsers and platforms you need to support have these, and include polyfills as necessary.

## Introduction

See [Introducing React Refetch](https://blog.heroku.com/react-refetch) on the [Heroku Engineering Blog](https://blog.heroku.com/engineering) for background and a quick introduction to this project.

## Motivation

This project was inspired by (and forked from) [React Redux](https://github.com/rackt/react-redux). Redux/Flux is a wonderful library/pattern for applications that need to maintain complicated client-side state; however, if your application is mostly fetching and rendering read-only data from a server, it can over-complicate the architecture to fetch data in actions, reduce it into the store, only to select it back out again. The other approach of fetching data [inside](https://facebook.github.io/react/tips/initial-ajax.html) the component and dumping it in local state is also messy and makes components smarter and more mutable than they need to be. This module allows you to wrap a component in a `connect()` decorator like react-redux, but instead of mapping state to props, this lets you map props to URLs to props. This lets you keep your components completely stateless, describe data sources in a declarative manner, and delegate the complexities of data fetching to this module. Advanced options are also supported to lazy load data, poll for new data, and post data to the server.

## Example

If you have a component called `Profile` that has a `userId` prop, you can wrap it in `connect()` to map `userId` to one or more requests and assign them to new props called `userFetch` and `likesFetch`:

```jsx
import React, { Component } from 'react'
import { connect, PromiseState } from 'react-refetch'

class Profile extends Component {
  render() {
    // see below
  }
}

export default connect(props => ({
  userFetch: `/users/${props.userId}`,
  likesFetch: `/users/${props.userId}/likes`
}))(Profile)
```

When the component mounts, the requests will be calculated, fetched, and the result will be passed into the component as the props specified. The result is represented as a `PromiseState`, which is a synchronous representation of the fetch [`Promise`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise). It will either be `pending`, `fulfilled`, or `rejected`. This makes it simple to reason about the fetch state at the point in time the component is rendered:

```jsx
render() {
  const { userFetch, likesFetch } = this.props

  if (userFetch.pending) {
    return <LoadingAnimation/>
  } else if (userFetch.rejected) {
    return <Error error={userFetch.reason}/>
  } else if (userFetch.fulfilled) {
    return <User user={userFetch.value}/>
  }

  // similar for `likesFetch`
}
```

See the [composing responses](#composing-responses) to see how to handle `userFetch` and `likesFetch` together. Although not included in this library because of application-specific defaults, see an example [`PromiseStateContainer`](https://gist.github.com/ryanbrainard/788c12c3811d3da13124#file-promisestatecontainer-jsx) and its example [usage](https://gist.github.com/ryanbrainard/7713b4a6f328ac4b71e2#file-profile-jsx) for a way to abstract and simplify the rendering of `PromiseState`s.

## Refetching

When new props are received, the requests are re-calculated, and if they changed, the data is *refetched* and passed into the component as new `PromiseState`s. Using something like [React Router](https://github.com/rackt/react-router) to derive the props from the URL in the browser, the application can control state changes just by changing the URL. When the URL changes, the props change, which recalculates the requests, new data is fetched, and it is reinjected into the components:

![react-refetch-flow](https://heroku-blog-files.s3.amazonaws.com/posts/1488278436-react-refetch-flow.svg)

By default, the requests are compared using their URL, headers, and body; however, if you want to use a custom value for the comparison, set the `comparison` attribute on the request. This can be helpful when the request should or should not be refetched in response to a prop change that is not in the request itself. A common situation where this occurs is when two different requests should be refetched together even though one of the requests does not actually include the prop. Note, this is using the request object syntax for `userStatsFetch` instead of just a plain URL string. This syntax allows for more advanced options. See the API documentation for details:

```jsx
connect(props => ({
  usersFetch:  `/users?status=${props.status}&page=${props.page}`,
  userStatsFetch: { url: `/users/stats`, comparison: `${props.status}:${props.page}` }
}))(UsersList)
```

In this example, `usersFetch` is refetched every time `props.status` or `props.page` changes because the URL is changed. However, `userStatsFetch` does not contain these props in its URL, so would not normally be refetched, but because we added `comparison: ${props.status}:${props.page}`, it will be refetched along with `usersFetch`. In general, you should only rely on changes to the requests themselves to control when data is refetched, but this technique can be helpful when finer-grained control is needed.

If you always want data to be refetched when any new props are received, set the `force: true` option on the request. This will take precedence over any custom `comparison` and the default request comparison. For example:

```jsx
connect(props => ({
  usersFetch: `/users?status=${props.status}&page=${props.page}`,
  userStatsFetch: { url: `/users/stats`, force: true }
}))(UsersList)
```

Setting `force: true` should be avoid if at all possible because it could result in extraneous data fetching and rendering of the component. Try to use the default comparison or custom `comparison` option instead.

## Automatic Refreshing

If the `refreshInterval` option is provided along with a URL, the data will be refreshed that many milliseconds after the last successful response. If a request was ever rejected, it will not be refreshed or otherwise retried. In this example, `likesFetch` will be refreshed every minute. Note, this is using the request object syntax for `likeFetch` instead of just a plain URL string. This syntax allows for more advanced options. See the [API documentation](https://github.com/heroku/react-refetch/blob/master/docs/api.md) for details.

```jsx
connect(props => ({
  userFetch:`/users/${props.userId}`,
  likesFetch: { url: `/users/${props.userId}/likes`, refreshInterval: 60000 }
}))(Profile)
```

When refreshing, the `PromiseState` will be the same as a the previous `fulfilled` state, but with the `refreshing` attribute set. That is, `pending` will remain unset and the existing `value` will be left in tact. When the refresh completes, `refreshing` will be unset and the `value` will be updated with the latest data. If the refresh is rejected, the `PromiseState` will move into a `rejected` and not attempt to refresh again.

## Fetch Functions

Instead of mapping the props directly to a URL string or request object, you can also map the props to a function that returns a URL string or request object. When the component receives props, instead of the data being fetched immediately and injected as a `PromiseState`, the function is bound to the props and injected into the component as functional prop to be called later (usually in response to a user action). This can be used to either lazy load data, post data to the server, or refresh data. These are best shown with examples:

### Lazy Loading

Here is a simple example of lazy loading the `likesFetch` with a function:

```jsx
connect(props => ({
  userFetch: `/users/${props.userId}`,
  lazyFetchLikes: max => ({
    likesFetch: `/users/${props.userId}/likes?max=${max}`
  })
}))(Profile)
```

In this example, `userFetch` is fetched normally when the component receives  props, but `lazyFetchLikes` is a function that returns `likesFetch`, so nothing is fetched immediately. Instead `lazyFetchLikes` is injected into the component as a function to be called later inside the component:

```jsx
this.props.lazyFetchLikes(10)
```

When this function is called, the request is calculated using both the bound props and any passed in arguments, and the `likesFetch` result is injected into the component normally as a `PromiseState`.

### Posting Data

Functions can also be used for post data to the server in response to a user action. For example:

```jsx
connect(props => ({
  postLike: subject => ({
    postLikeResponse: {
      url: `/users/${props.userId}/likes`,
      method: 'POST',
      body: JSON.stringify({ subject })
    }
  })
}))(Profile)
```

The `postLike` function is injected in as a prop, which can then be tied to a button:

```jsx
<button onClick={() => this.props.postLike(someSubject)}>Like!</button>
```

When the user clicks the button, `someSubject` is posted to the URL and the response is injected as a new `postLikeResponse` prop as a `PromiseState` to show progress and feedback to the user.

### Manually Refreshing Data

Functions can also be used to manually refresh data by overwriting an existing `PromiseState`:

```jsx
connect(props => {
 const url = `/users/${props.userId}`

 return {
   userFetch: url,
   refreshUser: () => ({
     userFetch: {
       url,
       force: true,
       refreshing: true
     }
   })
 }
})(Profile)
```

The `userFetch` data is first loaded normally when the component receives props, but the `refreshUser` function is also injected into the component. When `this.props.refreshUser()` is called, the request is calculated, and compared with the existing `userFetch` request. If the request changed (or `force: true`), the data is refetched and the existing `userFetch` `PromiseState` is overwritten.  This should generally only be used for user-invoked refreshes; see above for [automatically refreshing on an interval](#automatic-refreshing).

Note, the example above sets `force: true` and `refreshing: true` on the request returned by the `refreshUser()` function. These attributes are optional, but commonly used with manual refreshes. `force: true` avoids the default request comparison (e.g. `url`, `method`, `headers`, `body`) with the existing `userFetch` request so that every time `this.props.refreshUser()` is called, a fetch is performed. Because the request would not have changed from the last prop change in the example above, `force: true` is required in this case for the fetch to occur when `this.props.refreshUser()` is called. `refreshing: true` avoids the existing `PromiseState` from being cleared while fetch is in progress.

### Posting + Refreshing Data

The two examples above can be combined to post data to the server and refresh an existing `PromiseState`. This is a common pattern when a responding to a user action to update a resource and reflect that update in the component. For example, if `PATCH /users/:user_id` responds with the updated user, it can be used to overwrite the existing `userFetch` when the user updates her name:

```jsx
connect(props => ({
  userFetch: `/users/${props.userId}`,
  updateUser: (firstName, lastName) => ({
    userFetch: {
      url: `/users/${props.userId}`
      method: 'PATCH'
      body: JSON.stringify({ firstName, lastName })
     }
   })
}))(Profile)
```

## Composing Responses

If a component needs data from more than one URL, the `PromiseState`s can be combined with [`PromiseState.all()`](https://github.com/heroku/react-refetch/blob/master/docs/api.md#promisestate) to be `pending` until all the `PromiseState`s have been fulfilled. For example:

```jsx
render() {
  const { userFetch, likesFetch } = this.props

  // compose multiple PromiseStates together to wait on them as a whole
  const allFetches = PromiseState.all([userFetch, likesFetch])

  // render the different promise states
  if (allFetches.pending) {
    return <LoadingAnimation/>
  } else if (allFetches.rejected) {
    return <Error error={allFetches.reason}/>
  } else if (allFetches.fulfilled) {
    // decompose the PromiseState back into individual
    const [user, likes] = allFetches.value
    return (
      <div>
          <User data={user}/>
          <Likes data={likes}/>
      </div>
    )
  }
}
```

Similarly, `PromiseState.race()` can be used to return the first settled `PromiseState`. Like their asynchronous [`Promise`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise) counterparts, `PromiseStates` can be chained with `then()` and `catch()`; however, the handlers are run immediately to transform the existing state. This can be helpful to handle errors or transform values as part of a composition. For example, to provide a fallback value to `likesFetch` in the case of failure:

```jsx
PromiseState.all([userFetch, likesFetch.catch(reason => [])])
```

## Chaining Requests

Inside of `connect()`, requests can be chained using `then()`, `catch()`, `andThen()` and `andCatch()` to trigger additional requests after a previous request is fulfilled. These are not to be confused with the similar sounding functions on `PromiseState`, which are on the response side, are synchronous, and are executed for every change of the `PromiseState`.

`then()` is helpful for cases where multiple requests are required to get the data needed by the component and the subsequent request relies on data from the previous request. For example, if you need to make a request to `/foos/${name}` to look up `foo.id` and then make a second request to `/bar-for-foos-by-id/${foo.id}` and return the whole thing as `barFetch` (the component will not have access to the intermediate `foo`):

```jsx
connect(({ name }) => ({
  barFetch: {
    url: `/foos/${name}`,
    then: foo => `/bar-for-foos-by-id/${foo.id}`
  }
}))
```

`andThen()` is similar, but is intended for side effect requests where you still need access to the result of the first request and/or need to fanout to multiple requests:

```jsx
connect(({ name }) => ({
  fooFetch: {
    url: `/foos/${name}`,
    andThen: foo => ({
      barFetch: `/bar-for-foos-by-id/${foo.id}`
    })
  }
}))
```

This is also helpful for cases where a fetch function is changing data that is in some other fetch that is a collection. For example, if you have a list of `foo`s and you create a new `foo` and the list needs to be refreshed:

```jsx
 connect(({ name }) => ({
    foosFetch: '/foos',
    createFoo: name => ({
      fooCreation: {
        method: 'POST',
        url: '/foos',
        andThen: () => ({
          foosFetch: {
            url: '/foos',
            refreshing: true
          }
        })
      }
    })
  }))
```

`catch` and `andCatch` are similar, but for error cases.

## Identity Requests: Static Data & Transforming Responses

To support static data and response transformations, there is a special kind of request called an "identity request" that has a `value` instead of a `url`. The `value` is passed through directly to the `PromiseState` without actually fetching anything. In its pure form, it looks like this:

```jsx
connect(props => ({
  usersFetch: {
    value: [
      {
        id: 1,
        name: 'Jane Doe',
        verified: true
      },
      {
        id: 2,
        name: 'John Doe',
        verified: false
      }
    ]
  }
}))(Users)
```

In this case the `userFetch` `PromiseState` will be set to the provided list of users. The use case for identity requests by themselves is limited to mostly injecting static data during development and testing; however, they can be quite powerful when used with [request chaining](#chaining-requests). For example, it is possible to fetch data from the server, filter it within a `then` function, and return an identity request:

```jsx
connect(props => ({
  usersFetch: {
    url: `/users`,
    then: (users) => ({
      value: users.filter(u => u.verified)
    })
  }
}))(Users)
```

Note, this form of transformation is similar to what is possible on the `PromiseState` (i.e. `this.props.usersFetch.then(users => users.filter(u => u.verified))`); however, this has the advantage of only being called when `usersFetch` changes and keeps the logic out of the component.

**Identity requests can also be provided a `Promise` or thenable.** In this case, the `PromiseState` will be `pending` until the `Promise` is resolved. This can be helpful for asynchronous, non-fetch operations (e.g. file i/o) that want to use a similar pattern as fetch operations.

## Accessing Headers & Metadata

Both request and response headers and other metadata are accessible. Custom request headers can be set on the request as an object:

```jsx
connect(props => ({
  userFetch: {
    url: `/users/${props.userId}`,
    headers: {
      FOO: 'foo',
      BAR: 'bar'
    }
  }
}))(Profile)
```

The raw [`Request`](https://developer.mozilla.org/en-US/docs/Web/API/Request) and [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response) can be accessed via the `meta` attribute on the `PromiseState`. For example, to access the a response header:

```jsx
userFetch.meta.response.headers.get('FOO')
```

Do not attempt to read bodies directly from `meta.request` or `meta.response`. They are provided for metadata purposes only.

## Using context to define requests

You can also use `context` (in addition to props) to help define the requests your components need.
It's available as the second argument to the function you pass to `connect`.
Don't forget to define `contextTypes` on the component you're wrapping for context to be available.

Some use case examples are, eg. setting a URL prefix in a root component that all others use:
```js
connect((props, context) => {
  return {
    userFetch: `${context.apiPrefix}/user/${props.params.userId}`
  }
})(Profile)
```
or also, setting a common refresh interval used by all components that need it:
```js
connect((props, context) => {
  return {
    userFetch: `/user/${props.params.userId}`,
    likesFetch: {
      url: `/users/${props.userId}/likes`,
      refreshInterval: context.refreshInterval,
    }
  }
})(Profile)
```

This is a complete example of everything you need to use context with React Refetch:
```jsx
import React, { Component, PropTypes } from 'react'
import { connect, PromiseState } from 'react-refetch'

class App extends React.Component {
  static childContextTypes = {
    apiPrefix: PropTypes.string.isRequired,
  }

  getChildContext() {
    return {
      apiPrefix: '/api/v1'
    }
  }

  render() {
    return <Profile params={this.props.params} />
  }
}

class Profile extends React.Component {
  static propTypes = {
    userFetch: PropTypes.instanceOf(PromiseState).isRequired,
  }

  static contextTypes = {
    apiPrefix: PropTypes.string.isRequired,
  }

  render() {
    const { userFetch } = this.props

    if (userFetch.pending) {
      return <LoadingAnimation/>
    } else if (userFetch.rejected) {
      return <Error error={userFetch.reason}/>
    } else if (userFetch.fulfilled) {
      return <User data={userFetch.value}/>
    }
  }
}

export default connect((props, context) => {
  return {
    userFetch: `${context.apiPrefix}/user/${props.params.userId}`
  }
})(Profile)
```

## Setting defaults and hooking into internal processing

It is possible to modify the various defaults used by React Refetch, as well as substitute in custom implementations of internal functions. A simple use case would be to avoid repeating the same option for every fetch block:

```jsx
import { connect } from 'react-refetch'
const refetch = connect.defaults({
  credentials: 'include'
})

refetch(props => ({
  userFetch: `/users/${props.userId}`
}))(Profile)
```

A more advanced use case would be to replace the `buildRequest` internal function to, for example, modify headers on the fly based on the URL of the request, or using advanced [`Request`](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request) options:

```jsx
// api-connector.js
import { connect } from 'react-refetch'
import urlJoin from 'url-join'
import { getPrivateToken } from './api-tokens'

const baseUrl = 'https://api.example.com/'

export default connect.defaults({
  buildRequest: function (mapping) {
    const options = {
      method: mapping.method,
      cache: 'force-cache',
      referrer: 'https://example.com',
      headers: mapping.headers,
      credentials: mapping.credentials,
      redirect: mapping.redirect,
      mode: mapping.mode,
      body: mapping.body
    }

    if (mapping.url.match(/private/)) {
      options.headers['X-Api-Token'] = getPrivateToken()
    }

    if (mapping.url.match(/listOfServers.json$/)) {
      options.integrity = 'sha256-BpfBw7ivV8q2jLiT13fxDYAe2tJllusRSZ273h2nFSE='
    }

    return new Request(urlJoin(baseUrl, mapping.url), options)
  }
})

// ProfileComponent.js
import connect from './api-connector'
connect(props => ({
  userFetch: `/users/${props.userId}`,
  serversFetch: `/listOfServers.json`
}))(Profile)
```

You can also replace the `handleResponse` function, which takes a [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response), and should return a Promise that resolves to the value of the response, or rejects based on the body, headers, status code, etc. You can use it, for example, to parse CSV instead of JSON:

```jsx
// api-connector.js
import { connect } from 'react-refetch'
import { parse } from 'csv'

const csvConnector = connect.defaults({
  handleResponse: function (response) {
    if (response.headers.get('content-length') === '0' || response.status === 204) {
      return
    }

    const csv = response.text()

    if (response.status >= 200 && response.status < 300) {
      return csv.then(text => new Promise((resolve, reject) => {
        parse(text, (err, data) => {
          if (err) { reject(err) }
          resolve(data)
        })
      }))
    } else {
      return csv.then(cause => Promise.reject(new Error(cause)))
    }
  }
})

csvConnector(props => ({
  userFetch: `/users/${props.userId}.csv`
}))(Profile)
```

### On changing the `fetch` and `Request` implementations

Through this same API it is possible to change the internal `fetch` and `Request` implementations. This could be useful for a number of reasons, such as precise control over requests or customisation that is not possible with either `buildRequest` or `handleResponse`.

For example, here's a simplistic implementation of a "caching fetch," which will cache the result of successful requests for a minute, regardless of headers:

```jsx
import { connect } from 'react-refetch'

const cache = new Map()
function cachingFetch(input, init) {
  const req = new Request(input, init)
  const now = new Date().getTime()
  const inAMinute = 60000 + now
  const cached = cache.get(req.url)

  if (cached && cached.time < inAMinute) {
    return new Promise(resolve => resolve(cached.response.clone()))
  }

  return fetch(req).then(response => {
    cache.set(req.url, {
      time: now,
      response: response.clone()
    })

    return response
  })
}

connect.defaults({ fetch: cachingFetch })(props => ({
  userFetch: `/users/${props.userId}`
}))(Profile)
```

When using this feature, make sure to read the [`fetch` API and interface documentation](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) and all related topics. Notably, you need to keep in mind that the `body` of a `Response` can _only be consumed once_, so if you need to read it in your custom `fetch`, you also need to recreate a brand new `Response` (or a `.clone()` of the original one if you're not modifying the body) so React Refetch can work properly.

This is an _advanced feature_. Use existing declarative functionality wherever possible. Customise `buildRequest` or `handleResponse` if these can work instead. Please be aware that changing the `fetch` (or `Request`) implementation could conflict with built-in current or future functionality.

## Unit Testing Connected Components

For unit testing components connected, a non-default export of the unconnected component can be exposed to allow unit tests to inject their own `PromiseState`(s) as props. This allows for unit tests to test both success and error scenarios without having to deal with mocking HTTP, timing of responses, or other details about how the `PromiseState`(s) is fulfilled -- instead, they can just focus on asserting that the component itself renders the `PromiseState`(s) correctly in various scenarios. 

The recommended naming convention for the unconnected component is to prepend an underscore to the component name. For example, if there is a component called `Profile`, add a non-default export of `_Profile` before the default export with `connect`:

```jsx
class Profile extends React.Component {
  static propTypes = {
    userFetch: PropTypes.instanceOf(PromiseState).isRequired,
  }

  render() {
    const { userFetch } = this.props
    
    if (userFetch.pending) {
      return <LoadingAnimation/>
    } else if (userFetch.rejected) {
      return <ErrorBox error={userFetch.reason}/>
    } else if (userFetch.fulfilled) {
      return <User user={userFetch.value}/>
    }
  }
}

export { Profile as _Profile }

export default connect(props => ({
  userFetch: `/users/${props.userId}`
}))(Profile)
```

Now, unit tests can use the static methods on `PromiseState` to inject their own `PromiseState`(s) as props. For example, here is a unit test using [Enzyme](https://github.com/airbnb/enzyme) to shallow render the unconnected `_Profile` and provides a pending `PromiseState` and asserts that the `LoadingAnimation` is present:

```jsx
const c = shallow(
  <_Profile
    userFetch={PromiseState.create()}
  />
)

expect(wrapper.find(LoadingAnimation)).to.have.length(1)
```

Similarly, the rejected and fulfilled cases can be tested:

```jsx
const expectedError = new Error('boom')

const c = shallow(
  <_Profile
    userFetch={PromiseState.reject(expectedError)}
  />
)

expect(c.find(ErrorBox).first().prop().error).toEqual(expectedError)
```


```jsx
const user = new User()

const c = shallow(
  <_Profile
    userFetch={PromiseState.resolve(user)}
  />
)

expect(wrapper.find(User)).to.have.length(1)
```

## Complete Example

This is a complex example demonstrating various feature at once:

```jsx
import React, { Component, PropTypes } from 'react'
import { connect, PromiseState } from 'react-refetch'

class Profile extends React.Component {
  static propTypes = {
    params: PropTypes.shape({
      userId: PropTypes.string.isRequired,
    }).isRequired,
    userFetch: PropTypes.instanceOf(PromiseState).isRequired
    likesFetch: PropTypes.instanceOf(PromiseState).isRequired
    updateStatus: PropTypes.func.isRequired
    updateStatusResponse: PropTypes.instanceOf(PromiseState) // will not be set until after `updateStatus()` is called
  }

  render() {
    const { userFetch, likesFetch } = this.props

    // compose multiple PromiseStates together to wait on them as a whole
    const allFetches = PromiseState.all([userFetch, likesFetch])

    // render the different promise states
    if (allFetches.pending) {
      return <LoadingAnimation/>
    } else if (allFetches.rejected) {
      return <Error error={allFetches.reason}/>
    } else if (allFetches.fulfilled) {
      // decompose the PromiseState back into individual
      const [user, likes] = allFetches.value
      return (
        <div>
          <User data={user}/>
          <Likes data={likes}/>
        </div>
      )
    }

    // call `updateStatus()` on button click
    <button onClick={() => { this.props.updateStatus("Hello World")} }>Update Status</button>

    if (updateStatusResponse) {
      // render the different promise states, but will be `null` until `updateStatus()` is called
    }
  }
}

// declare the requests for fetching the data, assign them props, and connect to the component.
export default connect(props => {
  return {
    // simple GET from a URL injected as `userFetch` prop
    // if `userId` changes, data will be refetched
    userFetch: `/users/${props.params.userId}`,

    // similar to `userFetch`, but using object syntax
    // specifies a refresh interval to poll for new data
    likesFetch: {
      url: `/users/${props.userId}/likes`,
      refreshInterval: 60000
    },

    // declaring a request as a function
    // not immediately fetched, but rather bound to the `userId` prop and injected as `updateStatus` prop
    // when `updateStatus` is called, the `status` is posted and the response is injected as `updateStatusResponse` prop.
    updateStatus: status => ({
      updateStatusResponse: {
        url: `/users/${props.params.userId}/status`,
        method: 'POST',
        body: status
      }
    })
  }
})(Profile)
```

## API Documentation

- [`connect([mapPropsToRequestsToProps])`](https://github.com/heroku/react-refetch/blob/master/docs/api.md#connectmappropstorequeststoprops-options)
- [`connect.defaults([newDefaults])`](https://github.com/heroku/react-refetch/blob/master/docs/api.md#connectdefaultsnewdefaults)
- [`PromiseState(iterable)`](https://github.com/heroku/react-refetch/blob/master/docs/api.md#promisestate)

## Support

This software is provided "as is", without warranty or support of any kind, express or implied. See [license](https://github.com/heroku/react-refetch/blob/master/LICENSE.md) for details.

## License

[MIT](https://github.com/heroku/react-refetch/blob/master/LICENSE.md)
