React Refetch
=========================

A simple, declarative, and composable way to fetch data for React components.

[![build status](https://img.shields.io/travis/heroku/react-refetch/master.svg?style=flat-square)](https://travis-ci.org/heroku/react-refetch) [![npm version](https://img.shields.io/npm/v/react-refetch.svg?style=flat-square)](https://www.npmjs.com/package/react-refetch)
[![npm downloads](https://img.shields.io/npm/dm/react-refetch.svg?style=flat-square)](https://www.npmjs.com/package/react-refetch)

## Installation

Requires **React 0.14 or later.**

```
npm install --save react-refetch
```

This assumes that you’re using [npm](http://npmjs.com/) package manager with a module bundler like [Webpack](http://webpack.github.io) or [Browserify](http://browserify.org/) to consume [CommonJS modules](http://webpack.github.io/docs/commonjs.html).

## Introduction

See [Introducing React Refetch](https://engineering.heroku.com/blogs/2015-12-16-react-refetch/) on the [Heroku Engineering Blog](https://engineering.heroku.com/) for background and a quick introduction to this project.

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

![react-refetch-flow](https://engineering.heroku.com/assets/images/react-refetch-flow.svg)

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
      url: `/users/${props.userId}/likes`
      method: 'POST'
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
    andThen: foo => {
      barFetch: `/bar-for-foos-by-id/${foo.id}`
    }
  }
}))
```

This is also helpful for cases where a fetch function is changing data that is in some other fetch that is a collection. For example, if you have a list of `foo`s and you create a new `foo` and the list needs to be refreshed:

```jsx
 connect(({ name }) => ({
    foosFetch: '/foos',
    createFoo: name => {
      method: 'POST',
      url: '/foos',
      andThen: () => {
        foosFetch: {
          url: '/foos',
          refreshing: true
        }
      }
    }
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
- [`PromiseState(iterable)`](https://github.com/heroku/react-refetch/blob/master/docs/api.md#promisestate)

## Support

This software is provided "as is", without warranty or support of any kind, express or implied. See [license](https://github.com/heroku/react-refetch/blob/master/LICENSE.md) for details.

## License

[MIT](https://github.com/heroku/react-refetch/blob/master/LICENSE.md)
