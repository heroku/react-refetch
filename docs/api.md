## API

### `connect([mapPropsToRequestsToProps])`

Connects a React component to data from one or more URLs.

It does not modify the component class passed to it.  
Instead, it *returns* a new, connected component class, for you to use.

#### Arguments

* [`mapPropsToRequestsToProps(props, context): { prop: request, ... }`] *(Function)*: A pure function of props (and context, if the wrapped component defines contextTypes) that specifies the requests to fetch data and the props to which to assign the results. This function is called every time props or context materially change, and if the specified requests materially change, the data will be refetched. Requests can be specified as plain URL strings, request objects, or functions. Plain URL strings are the most common and preferred format, but only support GET URLs with default options. For more advanced options, specify the request as an object with the following keys:

     - `url` *(String)*: Required. HTTP URL from which to fetch the data.
     - `method` *(String)*: HTTP method. Defaults to `GET`.
     - `headers` *(Object)*: HTTP headers as simple key-value pairs. Does _not_ support the [`Headers`](https://developer.mozilla.org/en-US/docs/Web/API/Headers) object format. The headers will be merged with the default ones. _After the merge_, any header with a falsy value will be discarded; for example, to remove the `Accept` header, set it to `false`. Defaults to `Accept` and `Content-Type` set to `application/json`.
     - `credentials` *(String)*: Policy for credential to include with request. One of `omit`, `same-origin`, `include`. See [`Request.credentials`](https://developer.mozilla.org/en-US/docs/Web/API/Request/credentials) for details. Defaults to `same-origin`.
     - `body`: Any body that you want to add to your request; however, it must be replayable (i.e. not a one time use stream). Note that a request using the `GET` or `HEAD` method cannot have a body.
     - `redirect` *(String)*: The redirect mode to use: `follow`, `error`, or `manual`. See [`Request.redirect`](https://developer.mozilla.org/en-US/docs/Web/API/Request/redirect) for details. Defaults to `follow`.
     - `refreshInterval` *(Integer)*: Interval in milliseconds to poll for new data from the URL. Defaults to `0`, which disables it.
     - `refreshing` *(Boolean | Function)*: If true, the request is treated as a refresh. This is generally only used when overwriting an existing `PromiseState` and it is desired that the existing `value` not be cleared or changing into the `pending` state while the request is in flight. If no previous request was fulfilled, both `pending` and `refreshing` will be set. If `refreshing` is a function — `refreshing: value -> value` — then before the new request starts the value of the existing mapping will be replaced by the return value of this function, which is called with the existing value as its sole argument. This is useful to support optimistic updates with eg. `refreshing: value => ({...value, ...body})`.
     - `force` *(Boolean)*: Forces the data to be always fetched when new props are received. Takes precedence over `comparison`.
     - `comparison` *(Any)*: Custom value for comparing this request and the previous request when the props change. If the `comparison` values are *not* strictly equal, the data will be fetched again. In general, it is preferred to rely on the default that compares material changes to the request (i.e. URL, headers, body, etc); however, this is helpful in cases where the request should or should not be fetched again based on some other value. If `force` is true, `comparison` is not considered.
     - `then(value, meta): request` *(Function)*: returns a request to fetch after fulfillment of this request and replaces this request. Takes the `value` and `meta` of this request as arguments. Return `undefined` in `then` to do side-effects after a successful request, leaving the request as is.
     - `catch(reason, meta): request` *(Function)*: returns a request to fetch after rejection of this request and replaces this request. Takes the `value` and `meta` of this request as arguments. Return `undefined` in `catch` to do side-effects after a rejected request, leaving the request as is.
     - `andThen(value, meta): { prop: request, ... }` *(Function)*: returns an object of request mappings to fetch after fulfillment of this request but does not replace this request. Takes the `value` and `meta` of this request as arguments.
     - `andCatch(reason, meta): { prop: request, ... }` *(Function)*: returns an object of request mappings to fetch after rejection of this request but does not replace this request. Takes the `value` and `meta` of this request as arguments.
     - `value` *(Any)*: Data to passthrough directly to `PromiseState` as an alternative to providing a URL. If given a `Promise`, the `PromiseState` will be pending until the `value` or `reason` is settled; otherwise, the `PromiseState` will be resolved immediately. This is an advanced option used for static data and data transformations. Also consider setting `meta`.
     - `meta` *(Object)*: Metadata to passthrough directly to `PromiseState`. Keys `request`, `response`, `component`, and future keys may be overwritten.
     
   The arguments `then`, `andThen`, `catch`, `andCatch` above take  `value`/`reason` and `meta` as arguments. These coorespond to the properties of the `PromiseState` described below. `meta` contains a `component` property that is equal to the component being wrapped. You can use it to create side effects on promise fulfillment. e.g. `then(value, meta) { meta.component.onDataLoaded(value); }`. Note, `component` is only set if `withRef: true` in options; otherwise, it will be `undefined`.

  The following keys may also be defined on an individual request (see their description below at `connect.defaults()`):
     - `fetch`
     - `Request`
     - `buildRequest`
     - `handleResponse`

Requests specified as functions are not fetched immediately when props are received, but rather bound to the props and injected into the component to be called at a later time in response to user actions. Functions should be pure and return the same format as `mapPropsToRequestsToProps` itself. If a function maps a request to the same name as an existing prop, the prop will be overwritten. This is commonly used for taking some action that updates an existing `PromiseState`. Consider setting `refreshing: true` in such a situation.

#### Returns

A React component class that injects the synchronous state of the resulting data promises into the component as [`PromiseState`](#promisestate) objects.

For any requests specified as functions, bound functions are injected into the component. When called, new `PromiseState` objects are injected as props.

##### Static Properties

* `WrappedComponent` *(Component)*: The original component class passed to `connect()`.

##### Static Methods

All the original static methods of the component are hoisted.

##### Instance Methods

###### `getWrappedInstance(): ReactComponent`

Returns the wrapped component instance. Only available if you set `connect.options({ withRef: true })`.

### `connect.defaults([newDefaults])`

Returns a new `connect` which will have `newDefaults` merged into its defaults.
It does not change the defaults of the original `connect` it was called on.

Defaults define the default value of each of the keys that an individual request can define.
Any key specified on an individual request takes precedence over the default value.

Calls to `.defaults()` can be chained. If latter keys conflict with earlier ones, the latter ones will be used:

```js
const a = connect.defaults({ refreshInterval: 5000 })
// Defaults are as documented, except `refreshInterval` which is `5000`

const b = a.defaults({ method: 'POST' })
// ...`refreshInterval` is `5000`, `method` is `POST`

const c = b.defaults({ refreshInterval: 10000 })
// ...`refreshInterval` is `10000`, `method` is still `POST`
```

#### Arguments

* `[newDefaults = {}]` *(Object)*: An object with any of the following keys. They are all inherited from the parent request in chains:
     - `buildRequest(mapping): Request` *(Function)*: Takes a mapping and returns a `Request`. If setting this, make sure it interoperates with either the default `fetch` and `Request` or the `fetch` and `Request` you've provided. The `mapping` will always be an Object, even if the URL-only short form is used. Defaults to the internal implementation, see the source for details.
     - `fetch(url|Request, options): Promise<Request>` *(Function)*: The function to use when performing requests. It should conform to the [`Fetch` API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API). If setting this, make sure it interoperates with either the default `Request` or the `Request` you've provided. Defaults to the global `fetch`, if available, checking on `window`, `global`, and `self` in that order.
     - `handleResponse(Response): Promise<Object>` *(Function)*: Takes a `Response` (the [native one](https://developer.mozilla.org/en-US/docs/Web/API/Response) or whatever is returned by your custom `fetch`) and returns a `Promise` that resolves to an object representation of the response. If setting this, make sure it interoperates with either the default `fetch` and `Request` or the `fetch` and `Request` you've provided. Defaults to the internal implementation, see the source for details.
     - `Request(url, options): Request` *(Function)*: The constructor to use when building requests. It should conform to the [`Request` API](https://developer.mozilla.org/en-US/docs/Web/API/Request). If setting this, make sure it interoperates with either the default `fetch` or the `fetch` you've provided. Defaults to the global `Request`, if available, checking on `window`, `global`, and `self` in that order.

  as well as any of the following keys as described above in `connect()`'s API:
     - `url`
     - `method`
     - `headers`
     - `credentials`
     - `body`
     - `redirect`
     - `refreshing`
     - `refreshInterval`
     - `force`
     - `comparison`
     - `andCatch`
     - `andThen` (except in chains)
     - `catch`
     - `then` (except in chains)
     - `value`
     - `meta`

### `connect.options([newOptions])`

Returns a new `connect` which will have `newOptions` merged into its options.
It does not change the options of the original `connect` it was called on.

Calls to `.options()` can be chained. If latter keys conflict with earlier ones, the latter ones will be used:

```js
const a = connect.defaults({ withRef: true })
// Options are as documented, except `withRef` which is `true`

const b = a.defaults({ withRef: false })
// `withRef` is `false` (back to default value)
```

#### Arguments

* `[newOptions = {}]` *(Object)*: An object with any of the following keys:
    - `withRef` *(Boolean)*: If `true`, the connector will store a ref to the wrapped component instance and make it available via the `getWrappedInstance()` method. Defaults to `false`.
    - `pure` *(Boolean)*: If `true`, the connector will treat the wrapped component and the mapPropsToRequestsToProps function as pure, recomputing requests and re-rendering only when props are shallowly different. If `false`, recompute and re-render every time props change. Defaults to `true`.

### `PromiseState`

A synchronous representation of a [`Promise`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise) with the following properties:

  - `pending`: true if data is still being loaded for the first time
  - `refreshing`: true if data was successfully loaded and is being refreshed
  - `fulfilled`: true if data was loaded successfully
  - `rejected`: true if data was loaded unsuccessfully
  - `settled`: true if the data load completed, if successfully or unsuccessfully
  - `value`: value of successfully loaded data; otherwise, null
  - `reason`: error of unsuccessfully loaded data; otherwise, null
  - `meta`: arbitrary metadata not tied to a particular state. Contains raw HTTP request or response for access to status and headers, the wrapped component, and other values passed in my the application.

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
