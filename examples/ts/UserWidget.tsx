import React from 'react'
import { connect, PromiseState } from '../../src'
import { User } from './types'

interface Props {
    user_id: string,
    userFetch: PromiseState<User>
}

class UserWidget extends React.Component<Props> {
  render() {
    return null // TODO
  }
}

export default connect((props: Props) => ({
  userFetch: `/users/${props.user_id}`
}))(UserWidget)
