import React from 'react'
import { connect, PromiseState } from '../../src'
import { User } from './types'

interface CompProps {
    userId: string
}

interface FetchProps extends CompProps {
    userFetch: PromiseState<User>
}

class UserWidget extends React.Component<FetchProps> {
  render() {
    return (
      <ul>
        <li>{ this.props.userId }</li>
        <li>{ this.props.userFetch.fulfilled && this.props.userFetch.value.name }</li>
      </ul>
    )
  }
}

export default connect<CompProps, FetchProps>((props) => ({
  userFetch: `/users/${props.userId}`
}))(UserWidget)
