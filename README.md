React Refetch
=========================

**EXPERIMENTAL: Use with caution**

React bindings for URL data. 

[![build status](https://img.shields.io/travis/heroku/react-refetch/master.svg?style=flat-square)](https://travis-ci.org/heroku/react-refetch) [![npm version](https://img.shields.io/npm/v/react-refetch.svg?style=flat-square)](https://www.npmjs.com/package/react-refetch)
[![npm downloads](https://img.shields.io/npm/dm/react-refetch.svg?style=flat-square)](https://www.npmjs.com/package/react-refetch)

This project was inspired by (and forked from) [react-redux](https://github.com/rackt/react-redux). Redux/Flux is a wonderful library/pattern for applications that need to maintain complicated client-side state; however, if your application is just fetching and rendering read-only data from a server, it can over-complicate the architecture to fetch data in actions, reduce it into the store, only to select it back out again. The other approach of fetching data [inside](https://facebook.github.io/react/tips/initial-ajax.html) the component and dumping it in local state is also messy and makes components smarter and more mutable than they need to be. This module allows you to wrap a component in a `connect()` decorator like react-redux, but instead of mapping state to props, this let's you map props to URLs (or `Request`s) to props. 

For example, if you have a component called `Profile` that has a `userId` prop, you can wrap it in `connect()` to map `userId` to one or more URLs and assigned to new props called `userFetch` and `likesFetch`:

    connect(props => {
     return {
       userFetch:  `/users/${props.userId}`,
       likesFetch: `/likes/${props.userId}/likes`
     }
    })(Profile)
 
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

When new props are received, the URLs are re-calculated, and if they changed, the data is refetched and passed into the component as new `PromiseState`s. When refetching, the `PromiseState` will be `pending` and the `value` will be `null`.

If the `refreshInterval` option is provided with a URL, the data will be refreshed at the provided interval in milliseconds. In this example, `likesFetch` will be refreshed every minute:

    connect(props => {
     return {
       userFetch:  `/users/${props.userId}`,
       likesFetch: [`/likes/${props.userId}/likes`, { refreshInterval: 60000 }]
     }
    })(Profile)
 
When refreshing, the `PromiseState` will be `refreshing`, `pending` will be `false`, and its `value` will still be set to the previously fulfilled value. Data will only be refreshed after a successful fulfillment. If a fetch is rejected, it will not be refreshed or otherwise retried.
 
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
