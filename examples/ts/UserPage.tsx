import React from 'react'
import UserWidgetComp from './UserWidgetComp'
import UserWidgetFunc from './UserWidgetFunc'

interface Props {
    userId: string,
}

export default class UserPage extends React.Component<Props> {
  render() {
    return (
      <div>
        <UserWidgetComp userId={this.props.userId}/>
        <UserWidgetFunc userId={this.props.userId}/>
      </div>
    )
  }
}
