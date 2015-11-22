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
 - `force` *(Boolean)*: Forces the URL to be fetched again even if the URL is the request is the same. See `equals` for forcing conditionally.
 - `equals` *(Function)*: Custom function for testing equality of this request and previous request. The function will receive the previous request object in canonical form as its only argument and should return a boolean value. If there's no previous request, the argument will be an empty object. If false is returned, the data will be fetched again. In general, it is preferred to rely on the default equality function that tests for material changes to the request (i.e. URL, headers, body, etc); however, in cases where the same request should be refetched based on some other value or criterion, set a custom equality function. Be sure to use an ES5-style `function` (i.e. not an ES6 arrow function) so `this` is bound correctly. If `force` is true, `equals()` is not evaluated.

Requests specified as functions are not fetched immediately when props are received, but rather bound to the props and injected into the component to be called at a later time in response to user actions. Functions should be pure and return the same format as `mapPropsToRequestsToProps` itself. If a function maps a request to the same name as an existing prop, the prop will be overwritten. This is commonly used for taking some action that updates an existing `PromiseState`. Consider setting `refreshing: true` in such it situation. 

* [`options`] *(Object)* If specified, further customizes the behavior of the connector.
  * [`withRef = false`] *(Boolean)*: If true, stores a ref to the wrapped component instance and makes it available via `getWrappedInstance()` method. *Defaults to `false`.*

#### Returns

A React component class that injects the synchronous state of the resulting data promises into the component as `PromiseState` objects with the following properties:

  - `pending`: true if data is still being loaded for the first time
  - `refreshing`: true if data was successfully loaded and is being refreshed
  - `fulfilled`: true if data was loaded successfully
  - `rejected`: true if data was loaded unsuccessfully
  - `settled`: true if the data load completed, if successfully or unsuccessfully
  - `value`: value of successfully loaded data; otherwise, null
  - `reason`: error of unsuccessfully loaded data; otherwise, null
  - `meta`: arbitrary metadata not tied to a particular state. Contains raw HTTP request or response for access to status and headers. 

For any requests specified as functions, bound functions are injected into the component. When called, new `PromiseState` objects are injected as props.

##### Static Properties'

* `WrappedComponent` *(Component)*: The original component class passed to `connect()`.

##### Static Methods

All the original static methods of the component are hoisted.

##### Instance Methods

###### `getWrappedInstance(): ReactComponent`

Returns the wrapped component instance. Only available if you pass `{ withRef: true }` as part of the `connect()`’s second `options` argument.

#### Example

    // create a component that receives data as props
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
      
        // render the different promise states of user
        if (userFetch.pending) {
          return <LoadingAnimation/>
        } else if (userFetch.rejected) {
          return <Error error={userFetch.reason}/>
        } else if (userFetch.fulfilled) {
          return <User data={userFetch.value}/>
        }
        
        // similar for `likesFetch`
        
        // call `updateState()` on button click
        <button onClick={() => { this.props.updateStatus("Hello World")} }>Update Status</button>
        
        if (updateStatusResponse) {
          // render the different promise states, but will be `null` until `updateState()` is called
        }
      }
    }
    
    // declare the requests for fetching the data, assign them props, and connect to the component.
    export default connect((props) => {
      return {
        // simple GET from a URL injected as `userFetch` prop
        // if `userId` changes, data will be refetched
        userFetch: `/users/${props.params.userId}`,                             
        
        // similar to `userFetch`, but using object syntax 
        // specifies a refresh interval to poll for new data
        likesFetch: { 
          url: `/likes/${props.userId}/likes`, 
          refreshInterval: 60000 
        },
        
        // declaring a request as a function
        // not immediately fetched, but rather bound to the `userId` prop and injected as `updateStatus` prop
        // when `updateStatus` is called, the `status` is posted and the response is injected as `updateStatusResponse` prop.
        updateStatus: (status) => {
            updateStatusResponse: {
                url: `/users/${props.params.userId}/status`,
                method: 'POST',
                body: status
            }
        }
      }
    })(Profile)
