import React from "react"
import styled from "styled-components"
import { reactotronLogo } from "../../images"
import { EmptyState } from "reactotron-core-ui"
import { shell } from "../../util/ipc"

const WelcomeText = styled.div`
  font-size: 1.25em;
`

const Container = styled.div`
  display: flex;
  padding: 4px 8px;
  margin: 20px 0px 50px;
  border-radius: 4px;
  cursor: pointer;
  background-color: ${(props) => props.theme.backgroundLighter};
  color: ${(props) => props.theme.foreground};
  align-items: center;
  justify-content: center;
  text-align: center;
`

function openDocs() {
  shell.openExternal("https://docs.infinite.red/reactotron/")
}

function Welcome() {
  return (
    <EmptyState image={reactotronLogo} title="Welcome to Reactotron!">
      <WelcomeText>Connect a device or simulator to get started.</WelcomeText>
      <WelcomeText>Need to set up your app to use Reactotron?</WelcomeText>
      <Container onClick={openDocs}>Check out the docs here!</Container>
    </EmptyState>
  )
}

export default Welcome
