import React from 'react'
import { connect, PromiseState } from '../../src'
import { User } from './types'

interface FetchProps {
    userFetch: PromiseState<User>
}

interface CompProps extends FetchProps {
    userId: string
}

class UserWidget extends React.Component<CompProps> {
  render() {
    return (
      <ul>
        <li>{ this.props.userId }</li>
        <li>{ this.props.userFetch.fulfilled && this.props.userFetch.value.name }</li>
      </ul>
    )
  }
}

export default connect<FetchProps, CompProps>((props) => ({
  userFetch: `/users/${props.userId}`
}))(UserWidget)
