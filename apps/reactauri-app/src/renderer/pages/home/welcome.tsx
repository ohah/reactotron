import React from "react"
import styled from "styled-components"
import { reactauriLogo } from "../../images"
import { EmptyState } from "reactotron-core-ui"
import { openUrl } from '@tauri-apps/plugin-opener';


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
  openUrl("https://docs.infinite.red/reactotron/")
}

function Welcome() {
  return (
    <EmptyState image={reactauriLogo} title="Welcome to Reactauri!">
      <WelcomeText>Connect a device or simulator to get started.</WelcomeText>
      <WelcomeText>Need to set up your app to use Reactauri?</WelcomeText>
      <Container onClick={openDocs}>Check out the docs here!</Container>
    </EmptyState>
  )
}

export default Welcome
