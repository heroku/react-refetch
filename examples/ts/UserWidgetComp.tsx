import React from 'react'
import { connect, PromiseState } from '../../src'
import { User } from './types'

interface OuterProps {
    userId: string
}

interface InnerProps extends OuterProps {
    userFetch: PromiseState<User>
}

class UserWidgetComp extends React.Component<InnerProps> {
  render() {
    return (
      <ul>
        <li>{ this.props.userId }</li>
        <li>{ this.props.userFetch.fulfilled && this.props.userFetch.value.name }</li>
      </ul>
    )
  }
}

export default connect<OuterProps, InnerProps>((props) => ({
  userFetch: `/users/${props.userId}`
}))(UserWidgetComp)
