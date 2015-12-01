## API

### `connect([mapPropsToRequestsToProps], [options])`

Connects a React component to data from one or more URLs.

It does not modify the component class passed to it.  
Instead, it *returns* a new, connected component class, for you to use.

#### Arguments

* [`mapPropsToRequestsToProps(props): { prop: request, ... }`] *(Function)*: A pure function of props that specifies the requests to fetch data and the props to which to assign the results. This function is called every time props change, and if the requests materially change, the data will be refetched. Requests can be specified as plain URL strings, request objects, or functions. Plain URL strings are the most common and preferred format, but only support GET URLs with default options. For more advanced options, specify the request as an object the the following keys:

 - `url` *(String)*: Required. HTTP URL from which to fetch the data.
 - `method` *(String)*: HTTP method. Defaults to `GET`.
 - `headers` *(Object)*: HTTP headers as simple key-value pairs. Defaults to `Accept` and `Content-Type` set to `application/json`.
 - `credentials` *(String)*: Policy for credential to include with request. One of `omit`, `same-origin`, `include`. Defaults to `same-origin`. See [`Request.credentials`](https://developer.mozilla.org/en-US/docs/Web/API/Request/credentials) for details.
 - `body`: Any body that you want to add to your request; however, it must be replayable (i.e. not a one time use stream). Note that a request using the `GET` or `HEAD` method cannot have a body.
 - `refreshInterval` *(Integer)*: Interval in milliseconds to poll for new data from the URL.
 - `refreshing` *(Boolean)*: If true, the request is treated as a refresh. This is generally only used when overwriting an existing `PromiseState` and it is desired that the existing `value` not be cleared or changing into the `pending` state while the request is in flight. If no previous request was fulfilled, both `pending` and `refreshing` will be set.
 - `force` *(Boolean)*: Forces the data to be always fetched when new props are received. Takes precedence over `comparison`.
 - `comparison` *(Any)*: Custom value for comparing this request and the previous request when the props change. If the `comparison` values are *not* strictly equal, the data will be fetched again. In general, it is preferred to rely on the default that compares material changes to the request (i.e. URL, headers, body, etc); however, this is helpful in cases where the request should or should not be fetched again based on some other value. If `force` is true, `comparison` is not considered.

Requests specified as functions are not fetched immediately when props are received, but rather bound to the props and injected into the component to be called at a later time in response to user actions. Functions should be pure and return the same format as `mapPropsToRequestsToProps` itself. If a function maps a request to the same name as an existing prop, the prop will be overwritten. This is commonly used for taking some action that updates an existing `PromiseState`. Consider setting `refreshing: true` in such it situation. 

* [`options`] *(Object)* If specified, further customizes the behavior of the connector.
  * [`withRef = false`] *(Boolean)*: If true, stores a ref to the wrapped component instance and makes it available via `getWrappedInstance()` method. *Defaults to `false`.*

#### Returns

A React component class that injects the synchronous state of the resulting data promises into the component as [`PromiseState`](#promisestate) objects with the following properties:

For any requests specified as functions, bound functions are injected into the component. When called, new `PromiseState` objects are injected as props.

##### Static Properties'

* `WrappedComponent` *(Component)*: The original component class passed to `connect()`.

##### Static Methods

All the original static methods of the component are hoisted.

##### Instance Methods

###### `getWrappedInstance(): ReactComponent`

Returns the wrapped component instance. Only available if you pass `{ withRef: true }` as part of the `connect()`’s second `options` argument.

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
