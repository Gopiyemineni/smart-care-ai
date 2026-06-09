import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import LoginScreen from "./screens/LoginScreen";
import HomeScreen from "./screens/HomeScreen";
import NurseChatScreen from "./screens/NurseChatScreen";

export type RootStackParamList = {
  Login: undefined;
  Home: { patient: PatientData };
  NurseChat: { patient: PatientData; language: "telugu" | "english" };
};

export type PatientData = {
  name: string;
  token: string;
  symptoms: string;
  prescription_summary: PrescriptionSummary | null;
};

export type PrescriptionSummary = {
  summary: string;
  medications: Array<{
    name: string;
    dosage: string;
    timing: string;
    duration: string;
  }>;
  diet_advice: string[];
  activity: string;
  follow_up: string;
  emergency_signs: string[];
};

const Stack = createStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#020817" }}>
      <StatusBar style="light" />
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            cardStyle: { backgroundColor: "#020817" },
            animationEnabled: true,
          }}
        >
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="NurseChat" component={NurseChatScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}
