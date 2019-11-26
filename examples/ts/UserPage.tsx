import React from 'react'
import UserWidget from './UserWidget'

interface Props {
    user_id: string,
}

export default class UserPage extends React.Component<Props> {
  render() {
    return (
      <div>
        <UserWidget user_id={this.props.user_id}/>
      </div>
    )
  }
}
