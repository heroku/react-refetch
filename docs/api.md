## API

### `connect([mapPropsToRequestsToProps], [options])`

Connects a React component to data from one or more URLs.

It does not modify the component class passed to it.  
Instead, it *returns* a new, connected component class, for you to use.

#### Arguments

* [`mapPropsToRequestsToProps(props, context): { prop: request, ... }`] *(Function)*: A pure function of props (and context, if the wrapped component defines contextTypes) that specifies the requests to fetch data and the props to which to assign the results. This function is called every time props or context change, and if the requests materially change, the data will be refetched. Requests can be specified as plain URL strings, request objects, or functions. Plain URL strings are the most common and preferred format, but only support GET URLs with default options. For more advanced options, specify the request as an object with the following keys:

     - `url` *(String)*: Required. HTTP URL from which to fetch the data.
     - `method` *(String)*: HTTP method. Defaults to `GET`.
     - `headers` *(Object)*: HTTP headers as simple key-value pairs. Does _not_ support the [`Headers`](https://developer.mozilla.org/en-US/docs/Web/API/Headers) object format. Defaults to `Accept` and `Content-Type` set to `application/json`.
     - `credentials` *(String)*: Policy for credential to include with request. One of `omit`, `same-origin`, `include`. See [`Request.credentials`](https://developer.mozilla.org/en-US/docs/Web/API/Request/credentials) for details. Defaults to `same-origin`.
     - `body`: Any body that you want to add to your request; however, it must be replayable (i.e. not a one time use stream). Note that a request using the `GET` or `HEAD` method cannot have a body.
     - `redirect` *(String)*: The redirect mode to use: `follow`, `error`, or `manual`. See [`Request.redirect`](https://developer.mozilla.org/en-US/docs/Web/API/Request/redirect) for details. Defaults to `follow`.
     - `refreshInterval` *(Integer)*: Interval in milliseconds to poll for new data from the URL. Defaults to `0`, which disables it.
     - `refreshing` *(Boolean)*: If true, the request is treated as a refresh. This is generally only used when overwriting an existing `PromiseState` and it is desired that the existing `value` not be cleared or changing into the `pending` state while the request is in flight. If no previous request was fulfilled, both `pending` and `refreshing` will be set.
     - `force` *(Boolean)*: Forces the data to be always fetched when new props are received. Takes precedence over `comparison`.
     - `comparison` *(Any)*: Custom value for comparing this request and the previous request when the props change. If the `comparison` values are *not* strictly equal, the data will be fetched again. In general, it is preferred to rely on the default that compares material changes to the request (i.e. URL, headers, body, etc); however, this is helpful in cases where the request should or should not be fetched again based on some other value. If `force` is true, `comparison` is not considered.
     - `then(value, meta): request` *(Function)*: returns a request to fetch after fulfillment of this request and replaces this request. Takes the `value` and `meta` of this request as arguments.
     - `catch(reason, meta): request` *(Function)*: returns a request to fetch after rejection of this request and replaces this request. Takes the `value` and `meta` of this request as arguments.
     - `andThen(value, meta): { prop: request, ... }` *(Function)*: returns an object of request mappings to fetch after fulfillment of this request but does not replace this request. Takes the `value` and `meta` of this request as arguments.
     - `andCatch(reason, meta): { prop: request, ... }` *(Function)*: returns an object of request mappings to fetch after rejection of this request but does not replace this request. Takes the `value` and `meta` of this request as arguments.
     - `value` *(Any)*: Data to passthrough directly to `PromiseState` as an alternative to providing a URL. This is an advanced option used for static data and data transformations. Also consider setting `meta`.
     - `meta` *(Object)*: Metadata to passthrough directly to `PromiseState`. Keys `request`, `response`, and future keys may be overwritten.

Requests specified as functions are not fetched immediately when props are received, but rather bound to the props and injected into the component to be called at a later time in response to user actions. Functions should be pure and return the same format as `mapPropsToRequestsToProps` itself. If a function maps a request to the same name as an existing prop, the prop will be overwritten. This is commonly used for taking some action that updates an existing `PromiseState`. Consider setting `refreshing: true` in such it situation. 

#### Returns

A React component class that injects the synchronous state of the resulting data promises into the component as [`PromiseState`](#promisestate) objects with the following properties:

For any requests specified as functions, bound functions are injected into the component. When called, new `PromiseState` objects are injected as props.

##### Static Properties

* `WrappedComponent` *(Component)*: The original component class passed to `connect()`.

##### Static Methods

All the original static methods of the component are hoisted.

##### Instance Methods

###### `getWrappedInstance(): ReactComponent`

Returns the wrapped component instance. Only available if you set `connect.defaults({ withRef: true })`.

### `connect.defaults([newDefaults])`

Returns a new `connect` which will have its defaults amended according to `newDefaults`.

Calls to `.defaults()` can be chained, each latter call overriding defaults set in previous ones:

```js
const withRef = connect.defaults({ withRef: true })
const withRefAndWithPost = withRef.defaults({ method: 'POST' })
const onlyWithPost = withRefAndWithPost.defaults({ withRef: false })
```

#### Arguments

* `[newDefaults = {}]` *(Object)*: An object with any of the following keys:
     - `buildRequest(mapping): Request` *(Function)*: Takes a mapping and returns a `Request`. If setting this, make sure it interoperates with either the default `fetch` and `Request` or the `fetch` and `Request` you've provided. Defaults to the internal implementation, see the source for details.
     - `fetch(url|Request, options): Promise<Request>` *(Function)*: The function to use when performing requests. It should conform to the [`window.fetch` API](https://developer.mozilla.org/en-US/docs/Web/API/GlobalFetch/fetch). If setting this, make sure it interoperates with either the default `Request` or the `Request` you've provided. Defaults to the global `fetch`, if available, checking on `window`, `global`, and `self` in that order.
     - `handleResponse(Response): Promise<Object>` *(Function)*: Takes a `Response` (the [global one](https://developer.mozilla.org/en-US/docs/Web/API/Response) or whatever is returned by your custom `fetch`) and returns a `Promise` that resolves to an object representation of the response. If setting this, make sure it interoperates with either the default `fetch` and `Request` or the `fetch` and `Request` you've provided. Defaults to the internal implementation, see the source for details.
     - `Request(url, options): Request` *(Function)*: The constructor to use when building requests. It should conform to the [`window.Request` API](https://developer.mozilla.org/en-US/docs/Web/API/Request). If setting this, make sure it interoperates with either the default `fetch` or the `fetch` you've provided. Defaults to the global `Request`, if available, checking on `window`, `global`, and `self` in that order.
     - `withRef` *(Boolean)*: If `true`, the connector will store a ref to the wrapped component instance and make it available via the `getWrappedInstance()` method. Defaults to `false`.

  as well as any of the following keys as described above in `connect()`'s API:
     - `andCatch`
     - `andThen`
     - `catch`
     - `credentials`
     - `headers`
     - `method`
     - `redirect`
     - `refreshing`
     - `refreshInterval`
     - `then`

### `PromiseState`

A synchronous representation of a [`Promise`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise) with the following properties:

  - `pending`: true if data is still being loaded for the first time
  - `refreshing`: true if data was successfully loaded and is being refreshed
  - `fulfilled`: true if data was loaded successfully
  - `rejected`: true if data was loaded unsuccessfully
  - `settled`: true if the data load completed, if successfully or unsuccessfully
  - `value`: value of successfully loaded data; otherwise, null
  - `reason`: error of unsuccessfully loaded data; otherwise, null
  - `meta`: arbitrary metadata not tied to a particular state. Contains raw HTTP request or response for access to status and headers.

Properties should be treated as read-only and immutable. If the `Promise` enters a new state, a new `PromiseState` object is created.

##### Static Methods

##### `create(meta): PromiseState`

##### `refresh(previous: PromiseState, meta): PromiseState`

##### `resolve(value, meta): PromiseState`

##### `reject(value, meta): PromiseState`

##### `race(iterable<PromiseState>): PromiseState`

##### `all(iterable<PromiseState>): PromiseState`


##### Instance Methods

###### `then(onFulfilled: Function, onRejected: Function): PromiseState`

###### `catch(onRejected: Function): PromiseState`
