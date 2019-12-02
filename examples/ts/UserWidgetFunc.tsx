import React from 'react'
import { connect, PromiseState } from '../../src'
import { User } from './types'

interface OuterProps {
    userId: string
}

interface InnerProps extends OuterProps {
    userFetch: PromiseState<User>
}

function UserWidgetFunc(props: InnerProps) {
  return (
    <ul>
      <li>{ props.userId }</li>
      <li>{ props.userFetch.fulfilled && props.userFetch.value.name }</li>
    </ul>
  )
}

export default connect<OuterProps, InnerProps>((props) => ({
  userFetch: `/users/${props.userId}`
}))(UserWidgetFunc)
