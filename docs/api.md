## API

### `connect([mapPropsToRequests])`

Connects a React component to data from one or more URLs.

It does not modify the component class passed to it.  
Instead, it *returns* a new, connected component class, for you to use.

#### Arguments

* [`mapPropsToRequests(props): urlProps`] \(*Function*): If specified, the component will fetch data from the URLs. Any time props update, `mapPropsToRequests` will be called. Its result must be a plain object mapping prop keys to URL strings or `window.Request` objects. If the values changed, they will be passed to `window.fetch` and the synchronous state of the resulting promise will be serialized and merged into the component’s props. If you omit it, the component will not be connected to any URLs. 

* [`options`] *(Object)* If specified, further customizes the behavior of the connector.
  * [`withRef = false`] *(Boolean)*: If true, stores a ref to the wrapped component instance and makes it available via `getWrappedInstance()` method. *Defaults to `false`.*

#### Returns

A React component class that injects the synchronous state of the resulting data promises into your component as a `PromiseState` object with the following properties:

  *  - pending: true if data is still being loaded
  *  - fulfilled: true if data was loaded successfully
  *  - rejected: true if data was loaded unsuccessfully
  *  - settled: true if data was load completed, if successfully or unsuccessfully
  *  - value: value of successfully loaded data; otherwise, null
  *  - reason: error of unsuccessfully loaded data; otherwise, null

##### Static Properties

* `WrappedComponent` *(Component)*: The original component class passed to `connect()`.

##### Static Methods

All the original static methods of the component are hoisted.

##### Instance Methods

###### `getWrappedInstance(): ReactComponent`

Returns the wrapped component instance. Only available if you pass `{ withRef: true }` as part of the `connect()`’s fourth `options` argument.

#### Example

    // create a dumb component that receives data as props
    class Profile extends React.Component {
      static propTypes = {
        params: PropTypes.shape({
          userId: PropTypes.string.isRequired,
        }).isRequired,
        userFetch: PropTypes.instanceOf(PromiseState)
        likesFetch: PropTypes.instanceOf(PromiseState)
      }
      render() {
        // render the different promise states of user
        if (userFetch.pending) {
          return <LoadingAnimation/>
        } else if (userFetch.rejected) {
          return <Error error={userFetch.reason}/>
        } else if (userFetch.fulfilled) {
          return <User data={userFetch.value}/>
        }
        // similar for `likesFetch`
      }
    }
    
    // declare the URLs for fetching the data assigned to keys and connect the component.
    export default connect((props) => {
     return {
       userFetch:  `/users/${props.params.userId}`
       likesFetch: `/likes/${props.params.userId}/likes`
     }
    })(Profile)
