import React from 'react'
import UserWidget from './UserWidget'

interface Props {
    userId: string,
}

export default class UserPage extends React.Component<Props> {
  render() {
    return (
      <div>
        <UserWidget userId={this.props.userId}/>
      </div>
    )
  }
}
