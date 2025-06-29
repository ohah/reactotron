import React, { useCallback, useEffect, useState } from "react"
import styled from "styled-components"
import { GoGear as SettingsIcon } from "react-icons/go"
import { MdCompareArrows as ReverseTunnelIcon } from "react-icons/md"
import { CgSmartphoneShake as ShakeDeviceIcon } from "react-icons/cg"
import { IoReloadOutline as ReloadAppIcon } from "react-icons/io5"
import { EmptyState, Tooltip } from "reactotron-core-ui"
import { FaAndroid } from "react-icons/fa"
import { ItemContainer, ItemIconContainer } from "../SharedStyles"
import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"

const Container = styled.div`
  margin: 50px 0px;
`

const TitleContainer = styled.div`
  display: flex;
  margin: 10px 0;
  padding-bottom: 10px;
  border-bottom: 1px solid ${(props) => props.theme.highlight};
  justify-content: space-between;
  align-items: baseline;
  gap: 20px;
`

const Title = styled.div`
  font-size: 18px;
  color: ${(props) => props.theme.foregroundLight};
`
const AndroidDeviceListContainer = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  margin-top: 10px;
  color: ${(props) => props.theme.foreground};
`

const AndroidDeviceButtonsContainer = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  margin-top: 0px;
`
const Text = styled.div`
  margin-right: 4px;
  color: ${(props) => props.theme.foregroundDark};
`
const DeviceID = styled.div`
  font-size: 16px;
  margin-top: 15px;
  margin-bottom: 0px;
  color: ${(props) => props.theme.tag};
`
const HighlightedText = styled.div`
  display: inline-block;
  border-radius: 5px;
  border: 1px solid ${(props) => props.theme.highlight};
  padding: 2px;
  color: ${(props) => props.theme.tag};
  background-color: ${(props) => props.theme.line};
`
const PortSettingsTitle = styled.div`
  font-size: 18px;
  margin: 10px 0;
  padding-bottom: 2px;
  color: ${(props) => props.theme.foregroundLight};
  border-bottom: 1px solid ${(props) => props.theme.highlight};
`
const PortSettingsContainer = styled.div`
  display: flex;
  flex-direction: column;
  margin-bottom: 10px;
  padding: 10px;
  border-radius: 5px;
  border: 1px solid ${(props) => props.theme.chromeLine};
  background-color: ${(props) => props.theme.chrome};
`
const PortArgsContainer = styled.div`
  display: flex;
  flex-direction: row;
  margin-top: 10px;
`
const ArgContainer = styled.div`
  &:not(:last-child) {
    margin-right: 12px;
  }
`
const ArgName = styled.div`
  margin-bottom: 8px;
`
const ArgInput = styled.input`
  padding: 10px 12px;
  outline: none;
  border-radius: 4px;
  width: 100px;
  border: none;
  font-size: 16px;
`
const PortSettingsIconContainer = styled.div`
  color: ${(props) => props.theme.foregroundLight};
`

function AndroidDeviceHelp() {
  const [androidDevices, setAndroidDevices] = useState([])
  const [portsVisible, setPortsVisible] = useState(false)
  const [reactotronPort, setReactotronPort] = useState("9090")
  const [metroPort, setMetroPort] = useState("8081")

  // When the page loads, get the list of devices from ADB to help users debug android issues.
  useEffect(() => {
    const deviceListListener = listen("device_list", (event) => {
      let arg = event.payload as string
      arg = arg?.replace(/(\r\n|\n|\r)/gm, "\n").trim() // Fix newlines
      const rawDevices = arg.split("\n")
      rawDevices.shift() // Remove the first line
      const devices = rawDevices.map((device) => {
        const [id, state] = device.split("\t")
        return { id, state }
      })
      setAndroidDevices(devices)
    })

    invoke("get_device_list")

    return () => {
      deviceListListener.then((listener) => listener())
    }
  }, [])

  const TitleComponent = useCallback(() => {
    return (
      <Title>
        {androidDevices.length} Android Device{androidDevices.length !== 1 ? "s" : ""} Connected via
        USB:
      </Title>
    )
  }, [androidDevices.length])

  return (
    <Container>
      <TitleContainer>
        <TitleComponent />
        <PortSettingsIconContainer
          data-tip="Advanced Port Settings"
          data-for="port-settings"
          onClick={() => setPortsVisible(!portsVisible)}
        >
          <SettingsIcon size={20} />
          <Tooltip id="port-settings" />
        </PortSettingsIconContainer>
      </TitleContainer>
      <Text>
        This shows all android devices connected to your machine via the{" "}
        <HighlightedText>adb devices</HighlightedText> command.
      </Text>
      <Text>
        Android devices can sometimes be tricky to connect to Reactotron. Many issues can be
        resolved by clicking <HighlightedText>Reverse Tunnel</HighlightedText> and then{" "}
        <HighlightedText>Reload App</HighlightedText>.
      </Text>
      <AndroidDeviceListContainer>
        {portsVisible && (
          <PortSettingsContainer>
            <PortSettingsTitle>Advanced Reverse Tunneling Settings:</PortSettingsTitle>
            <Text>
              Adjust these values to the ports you are using for Reactotron and Metro. Most users
              will not need to change these values.
            </Text>
            <PortArgsContainer>
              <ArgContainer key="reactotron-port">
                <ArgName>Reactotron Port:</ArgName>
                <ArgInput
                  type="text"
                  placeholder={reactotronPort}
                  value={reactotronPort}
                  onChange={(e) => setReactotronPort(e.target.value)}
                />
              </ArgContainer>
              <ArgContainer key="metro-port">
                <ArgName>Metro Port:</ArgName>
                <ArgInput
                  type="text"
                  placeholder={metroPort}
                  value={metroPort}
                  onChange={(e) => setMetroPort(e.target.value)}
                />
              </ArgContainer>
            </PortArgsContainer>
          </PortSettingsContainer>
        )}
        {androidDevices.length === 0 ? (
          <EmptyState icon={FaAndroid}>No Android devices connected via USB.</EmptyState>
        ) : (
          <AndroidDeviceList
            devices={androidDevices}
            reactotronPort={reactotronPort}
            metroPort={metroPort}
          />
        )}
      </AndroidDeviceListContainer>
    </Container>
  )
}

const AndroidDeviceList = ({
  devices,
  reactotronPort,
  metroPort,
}: {
  devices: any[]
  reactotronPort: string
  metroPort: string
}) => {
  return (
    <>
      {devices.map((device) => (
        <div key={device.id}>
          <DeviceID>{device.id}</DeviceID>
          <AndroidDeviceButtonsContainer>
            <ItemContainer
              onClick={() =>
                invoke("reverse_tunnel_device", {
                  deviceId: device.id,
                  reactotronPort: parseInt(reactotronPort),
                  metroPort: parseInt(metroPort)
                })
              }
              data-tip={`This will allow reactotron to connect to your device via USB<br />by running adb reverse tcp:${reactotronPort} tcp:${reactotronPort}<br /><br />Reload your React Native app after pressing this.`}
              data-for="reverse-tunnel"
            >
              <ItemIconContainer>
                <ReverseTunnelIcon size={40} />
              </ItemIconContainer>
              Reverse Tunnel
              <Tooltip id="reverse-tunnel" multiline />
            </ItemContainer>
            <ItemContainer
              onClick={() => invoke("reload_app", { deviceId: device.id })}
              data-tip="This will reload the React Native app currently running on this device.<br />If you get the React Native red screen, relaunch the app from the build process."
              data-for="reload-app"
            >
              <ItemIconContainer>
                <ReloadAppIcon size={40} />
              </ItemIconContainer>
              Reload App
              <Tooltip id="reload-app" multiline />
            </ItemContainer>
            <ItemContainer
              onClick={() => invoke("shake_device", { deviceId: device.id })}
              data-tip="This will shake the device to bring up<br /> the React Native developer menu."
              data-for="shake-device"
            >
              <ItemIconContainer>
                <ShakeDeviceIcon size={40} />
              </ItemIconContainer>
              Shake
              <Tooltip id="shake-device" multiline />
            </ItemContainer>
          </AndroidDeviceButtonsContainer>
        </div>
      ))}
    </>
  )
}

export default AndroidDeviceHelp
