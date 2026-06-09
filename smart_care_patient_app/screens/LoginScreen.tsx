import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Animated,
  ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { StackNavigationProp } from "@react-navigation/stack";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { COLORS, RADIUS } from "../constants/theme";
import { ENDPOINTS } from "../constants/api";
import { RootStackParamList } from "../App";

type LoginNavigationProp = StackNavigationProp<RootStackParamList, "Login">;

export default function LoginScreen({ navigation }: { navigation: LoginNavigationProp }) {
  const [name, setName] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 50, friction: 8, useNativeDriver: true }),
    ]).start();
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  const handleLogin = async () => {
    if (!name.trim() || !token.trim()) {
      setError("Please enter your name and token number.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await axios.post(ENDPOINTS.login, {
        name: name.trim(),
        token: token.trim().toUpperCase(),
      });
      const patient = res.data.patient;
      await AsyncStorage.setItem("patient_session", JSON.stringify(patient));
      navigation.replace("Home", { patient });
    } catch (e: any) {
      if (e?.response?.status === 401) {
        setError("❌ Invalid name or token. Please check and try again.");
      } else {
        setError("⚠️ Cannot connect to server. Check WiFi connection.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={["#020817", "#0a1628", "#020817"]} style={styles.container}>
      <View style={styles.blobTop} />
      <View style={styles.blobBottom} />

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* Logo */}
          <Animated.View style={[styles.logoContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }, { scale: pulseAnim }] }]}>
            <LinearGradient colors={["#00d4ff", "#7c3aed"]} style={styles.logoGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <Text style={styles.logoIcon}>🏥</Text>
            </LinearGradient>
            <Text style={styles.appName}>Smart Care</Text>
            <Text style={styles.appSubtitle}>Patient Companion</Text>
            <View style={styles.taglineRow}>
              <View style={styles.taglineDot} />
              <Text style={styles.tagline}>Your AI Personal Nurse, 24/7</Text>
              <View style={styles.taglineDot} />
            </View>
          </Animated.View>

          {/* Login Card */}
          <Animated.View style={[styles.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <Text style={styles.cardTitle}>Patient Login</Text>
            <Text style={styles.cardSubtitle}>Enter your name and token from the hospital kiosk</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>👤 Patient Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Ravi Kumar"
                placeholderTextColor={COLORS.textMuted}
                value={name}
                onChangeText={(t) => { setName(t); setError(""); }}
                autoCapitalize="words"
                returnKeyType="next"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>🎫 Token Number</Text>
              <TextInput
                style={[styles.input, styles.tokenInput]}
                placeholder="e.g. NRM-342"
                placeholderTextColor={COLORS.textMuted}
                value={token}
                onChangeText={(t) => { setToken(t.toUpperCase()); setError(""); }}
                autoCapitalize="characters"
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <TouchableOpacity onPress={handleLogin} disabled={loading} activeOpacity={0.85}>
              <LinearGradient
                colors={loading ? ["#334155", "#334155"] : ["#00d4ff", "#0099bb"]}
                style={styles.loginButton}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.loginButtonText}>Login to My Care →</Text>}
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.infoBox}>
              <Text style={styles.infoText}>💡 Your token number was provided at the hospital kiosk during registration.</Text>
            </View>
          </Animated.View>

          {/* Feature list */}
          <Animated.View style={[styles.features, { opacity: fadeAnim }]}>
            {[
              { icon: "📋", text: "Doctor's advice in simple language" },
              { icon: "💬", text: "Chat with your AI Personal Nurse" },
              { icon: "💊", text: "Medicine & diet guidance" },
            ].map((f, i) => (
              <View key={i} style={styles.featureRow}>
                <Text style={styles.featureIcon}>{f.icon}</Text>
                <Text style={styles.featureText}>{f.text}</Text>
              </View>
            ))}
          </Animated.View>

        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: "center", padding: 24, paddingTop: 60, paddingBottom: 40 },
  blobTop: { position: "absolute", top: -100, right: -80, width: 300, height: 300, borderRadius: 150, backgroundColor: "rgba(0,212,255,0.05)" },
  blobBottom: { position: "absolute", bottom: -80, left: -60, width: 250, height: 250, borderRadius: 125, backgroundColor: "rgba(124,58,237,0.06)" },
  logoContainer: { alignItems: "center", marginBottom: 36 },
  logoGradient: { width: 80, height: 80, borderRadius: 24, alignItems: "center", justifyContent: "center", marginBottom: 16, elevation: 10 },
  logoIcon: { fontSize: 38 },
  appName: { fontSize: 32, fontWeight: "800", color: COLORS.textPrimary, letterSpacing: -0.5 },
  appSubtitle: { fontSize: 16, color: COLORS.primary, fontWeight: "600", marginTop: 2 },
  taglineRow: { flexDirection: "row", alignItems: "center", marginTop: 10, gap: 8 },
  taglineDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: COLORS.textMuted },
  tagline: { fontSize: 13, color: COLORS.textMuted },
  card: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.xl, padding: 24, borderWidth: 1, borderColor: COLORS.border, marginBottom: 24, elevation: 8 },
  cardTitle: { fontSize: 22, fontWeight: "700", color: COLORS.textPrimary, marginBottom: 4 },
  cardSubtitle: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 24 },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: "600", color: COLORS.textSecondary, marginBottom: 8 },
  input: { backgroundColor: COLORS.bgCardLight, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderLight, color: COLORS.textPrimary, fontSize: 16, padding: 14 },
  tokenInput: { fontFamily: "monospace", letterSpacing: 2, fontSize: 18, fontWeight: "700", color: COLORS.primary },
  errorBox: { backgroundColor: "rgba(239,68,68,0.1)", borderRadius: RADIUS.md, borderWidth: 1, borderColor: "rgba(239,68,68,0.3)", padding: 12, marginBottom: 16 },
  errorText: { fontSize: 13, color: "#f87171", textAlign: "center" },
  loginButton: { borderRadius: RADIUS.full, paddingVertical: 16, alignItems: "center", marginBottom: 16, elevation: 6 },
  loginButtonText: { fontSize: 16, fontWeight: "700", color: "#fff" },
  infoBox: { backgroundColor: COLORS.primaryDim, borderRadius: RADIUS.md, padding: 12, borderWidth: 1, borderColor: COLORS.primaryBorder },
  infoText: { fontSize: 12, color: COLORS.textSecondary, lineHeight: 18, textAlign: "center" },
  features: { gap: 12 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md, padding: 14, borderWidth: 1, borderColor: COLORS.border },
  featureIcon: { fontSize: 20 },
  featureText: { fontSize: 14, color: COLORS.textSecondary, flex: 1 },
});
