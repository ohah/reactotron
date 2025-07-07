import React from "react"
import { Route, Routes, Link, useLocation } from "react-router-dom"
import styled from "styled-components"
import { MdStorage, MdMemory } from "react-icons/md"

import AsyncStorage from "./AsyncStorage"
import MMKV from "./MMKV"

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background-color: ${(props) => props.theme.background};
`

const Header = styled.div`
  display: flex;
  align-items: center;
  background-color: ${(props) => props.theme.backgroundSubtleDark};
`

const TabContainer = styled.div`
  display: flex;
  border-bottom: 1px solid ${(props) => props.theme.line};
  flex: 1;
  background-color: ${(props) => props.theme.backgroundSubtleDark};
`

const TabButton = styled(Link)<{ $isActive: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 15px 25px;
  flex: 1;
  text-decoration: none;
  color: ${(props) => (props.$isActive ? props.theme.foreground : props.theme.foregroundDark)};
  border-bottom: 2px solid ${(props) => (props.$isActive ? props.theme.foreground : "transparent")};
  background-color: ${(props) => (props.$isActive ? props.theme.background : "transparent")};
  transition: all 0.2s ease;
  font-weight: ${(props) => (props.$isActive ? "500" : "400")};

  &:hover {
    color: ${(props) => props.theme.foreground};
    background-color: ${(props) => props.theme.backgroundSubtle};
  }
`

const Content = styled.div`
  flex: 1;
  overflow: hidden;
`

function StorageTabs() {
  const location = useLocation()

  return (
    <TabContainer>
      <TabButton to="/storage/asyncstorage" $isActive={location.pathname === "/storage/asyncstorage"}>
        <MdStorage size={20} />
        AsyncStorage
      </TabButton>
      <TabButton to="/storage/mmkv" $isActive={location.pathname === "/storage/mmkv"}>
        <MdMemory size={20} />
        MMKV
      </TabButton>
    </TabContainer>
  )
}

function Storage() {
  return (
    <Container>
      <Header>
        <StorageTabs />
      </Header>
      
      <Content>
        <Routes>
          <Route path="/asyncstorage" element={<AsyncStorage />} />
          <Route path="/mmkv" element={<MMKV />} />
        </Routes>
      </Content>
    </Container>
  )
}

export default Storage 
