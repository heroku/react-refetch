React Refetch
=========================

**EXPERIMENTAL: Use with caution**

React bindings for URL data. 

[![build status](https://img.shields.io/travis/heroku/react-refetch/master.svg?style=flat-square)](https://travis-ci.org/heroku/react-refetch) [![npm version](https://img.shields.io/npm/v/react-refetch.svg?style=flat-square)](https://www.npmjs.com/package/react-refetch)
[![npm downloads](https://img.shields.io/npm/dm/react-refetch.svg?style=flat-square)](https://www.npmjs.com/package/react-refetch)

## Motivation

This project was inspired by (and forked from) [react-redux](https://github.com/rackt/react-redux). Redux/Flux is a wonderful library/pattern for applications that need to maintain complicated client-side state; however, if your application is mostly fetching and rendering read-only data from a server, it can over-complicate the architecture to fetch data in actions, reduce it into the store, only to select it back out again. The other approach of fetching data [inside](https://facebook.github.io/react/tips/initial-ajax.html) the component and dumping it in local state is also messy and makes components smarter and more mutable than they need to be. This module allows you to wrap a component in a `connect()` decorator like react-redux, but instead of mapping state to props, this let's you map props to URLs to props. This lets you keep your components completely stateless, describe data sources in a declarative manner, and delegate the complexities of data fetching to this library. Advanced options are also supported to lazy load data, poll for new data, and post data to the server.

## Example

If you have a component called `Profile` that has a `userId` prop, you can wrap it in `connect()` to map `userId` to one or more URLs and assigned to new props called `userFetch` and `likesFetch`:

    connect((props) => ({
      userFetch:  `/users/${props.userId}`,
      likesFetch: `/users/${props.userId}/likes`
    }))(Profile)
 
When the component mounts, the URLs will be calculated, fetched, and the result will be passed into the component as the props specified. The result is represented as a `PromiseState`, which is a synchronous representation of the fetch `Promise`. It will either be `pending`, `fulfilled`, or `rejected`. This makes it simple to reason about the fetch state at the point in time the component is rendered:

    render() {
      const { userFetch, likesFetch } = this.props 
    
      if (userFetch.pending) {
        return <LoadingAnimation/>
      } else if (userFetch.rejected) {
        return <Error error={userFetch.reason}/>
      } else if (userFetch.fulfilled) {
        return <User data={userFetch.value}/>
      }
      
      // similar for `likesFetch`
    }

## Refetching

When new props are received, the URLs are re-calculated, and if they changed, the data is *refetched* and passed into the component as new `PromiseState`s. When refetching (not to be confused with *refreshing* explained below), the `PromiseState` will be reset to `pending` with the `value` set to `null`.

## Automatic Refreshing

If the `refreshInterval` option is provided along with a URL, the data will be refreshed that many milliseconds after the last successful response. If a request was ever rejected, it will not be refreshed or otherwise retried. In this example, `likesFetch` will be refreshed every minute. Note, this is using the request object syntax for `likeFetch` instead of just a plain URL string. This syntax allows for more advanced options. See the [API documentation](https://github.com/heroku/react-refetch/blob/master/docs/api.md) for details.

    connect((props) => ({
      userFetch:  `/users/${props.userId}`,
      likesFetch: { url: `/users/${props.userId}/likes`, refreshInterval: 60000 }
    }))(Profile)
 
When refreshing, the `PromiseState` will be the same as a the previous `fulfilled` state, but with the `refreshing` attribute set. That is, `pending` will remain unset and the existing `value` will be left in tact. When the refresh completes, `refreshing` will be unset and the `value` will be updated with the latest data. If the refresh is rejected, the `PromiseState` will move into a `rejected` and not attempt to refresh again. 

## Fetch Functions
 
Instead of mapping the props directly to a URL string or request object, you can also map the props to a function that returns a URL string or request object. When the component receives props, instead of the data being fetched immediately and injected as a `PromiseState`, the function is bound to the props and injected into the component as functional prop to be called later (usually in response to a user action). This can be used to either lazy load data, post data to the server, or refresh data. These are best shown with examples:

### Lazy Loading

Here is a simple example of lazy loading the `likesFetch` with a function:

    connect((props) => ({
      userFetch:  `/users/${props.userId}`,
      lazyFetchLikes: (max) => ({
        likesFetch: `/users/${props.userId}/likes?max=${max}`
      })
    }))(Profile)

In this example, `userFetch` is fetched normally when the component receives  props, but `lazyFetchLikes` is a function that returns `likesFetch`, so nothing is fetched immediately. Instead `fetchLikes` is injected into the component as a function to be called later inside the component:

    this.props.lazyFetchLikes(10)
    
When this function is called, the request is calculated using both the bound props and any passed in arguments, and the `likesFetch` result is injected into the component normally as a `PromiseState`.

### Posting Data

Functions can also be used for post data to the server in response to a user action. For example:

    connect((props) => ({
      postLike: (subject) => ({
        postLikeResponse: {
          url: `/users/${props.userId}/likes`
          method: 'POST'
          body: JSON.stringify({subject: subject})
        }
      })
    }))(Profile)
     
The `postLike` function is injected in as a prop, which can then be tied to a button:

    <button onClick={() => { this.props.postLike(someSubject) }}>Like!</button>
     
When the user clicks the button, `someSubject` is posted to the URL and the response is injected as a new `postLikeResponse` prop as a `PromiseState` to show progress and feedback to the user.
     
### Manually Refreshing Data

Functions can also be used to manually refresh data by overwriting an existing `PromiseState`:

    connect((props) => ({
      userFetch: `/users/${props.userId}`,
      refreshUser: () => ({
        userFetch: `/users/${props.userId}`
      })
    }))(Profile)

The `userFetch` data is first loaded normally when the component receives props, but the `refreshUser` function is also injected into the component. When `this.props.refreshUser()` is called, the data is fetched again and overwrites the existing `userFetch`. Note, you may wish to set the `refreshing: true` option to avoid the existing `PromiseState` being cleared while refresh is in progress. This should generally only be used for user-invoked refreshes; see above for [automatically refreshing on an interval](#automatic-refreshing).

### Posting + Refreshing Data

The two examples above can be combined to post data to the server and refresh an existing `PromiseState`. This is a common pattern when a responding to a user action to update a resource and reflect that update in the component. For example, if `PATCH /users/:user_id` responds with the updated user, it can be used to overwrite the existing `userFetch` when the user updates her name:

    connect((props) => ({
      userFetch: `/users/${props.userId}`,
      updateUser: (firstName, lastName) => ({
        userFetch: {
           url: `/users/${props.userId}`
           method: 'PATCH'
           body: JSON.stringify({firstName: firstName, lastName: lastName})
         }
       })
    }))(Profile)

     
## Installation

Requires **React 0.14 or later.**

```
npm install --save react-refetch
```

This assumes that you’re using [npm](http://npmjs.com/) package manager with a module bundler like [Webpack](http://webpack.github.io) or [Browserify](http://browserify.org/) to consume [CommonJS modules](http://webpack.github.io/docs/commonjs.html).

## Documentation

- [API](https://github.com/heroku/react-refetch/blob/master/docs/api.md)
    - [`connect([mapPropsToRequestsToProps])`](https://github.com/heroku/react-refetch/blob/master/docs/api.md#connectmappropstorequeststoprops)

## License

[MIT](https://github.com/heroku/react-refetch/blob/master/LICENSE.md)
