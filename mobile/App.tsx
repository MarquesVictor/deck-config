import { useRef, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, View } from "react-native";
import { ConnectScreen } from "./src/screens/ConnectScreen";
import { ControlScreen } from "./src/screens/ControlScreen";
import { AgentClient, type AgentInfo } from "./src/services/websocketClient";

export default function App() {
  const clientRef = useRef<AgentClient>(new AgentClient());
  const [agent, setAgent] = useState<AgentInfo | null>(null);

  return (
    <View style={styles.container}>
      {agent ? (
        <ControlScreen
          client={clientRef.current}
          agent={agent}
          onDisconnect={() => {
            clientRef.current.disconnect();
            setAgent(null);
          }}
        />
      ) : (
        <ConnectScreen client={clientRef.current} onConnected={(info) => setAgent(info)} />
      )}
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111318",
  },
});
