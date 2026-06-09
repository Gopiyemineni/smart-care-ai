import React, { useState, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Animated, ActivityIndicator, Alert, Share,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { StackNavigationProp } from "@react-navigation/stack";
import { RouteProp } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import * as ImagePicker from "expo-image-picker";
import { COLORS, RADIUS } from "../constants/theme";
import { ENDPOINTS } from "../constants/api";
import { RootStackParamList, PatientData, PrescriptionSummary } from "../App";

type HomeNavigationProp = StackNavigationProp<RootStackParamList, "Home">;
type HomeRouteProp = RouteProp<RootStackParamList, "Home">;

// Tiny 1x1 PNG base64 for demo upload
const MOCK_REPORT_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

export default function HomeScreen({ navigation, route }: { navigation: HomeNavigationProp; route: HomeRouteProp }) {
  const { patient } = route.params;
  const [patientState, setPatientState] = useState<any>(patient);
  const [activeTab, setActiveTab] = useState<"prescription" | "appointments" | "reports">("prescription");
  const [language, setLanguage] = useState<"telugu" | "english">("english");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const summary: PrescriptionSummary | null = patientState.prescription_summary;

  const fetchDetails = async () => {
    setRefreshing(true);
    try {
      const res = await axios.get(ENDPOINTS.details(patientState.token));
      if (res.data.success) {
        setPatientState(res.data.patient);
      }
    } catch (e) {
      console.log("Failed to refresh details", e);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, []);

  const handleLogout = async () => {
    await AsyncStorage.removeItem("patient_session");
    navigation.replace("Login");
  };

  const handleBookAppointment = async () => {
    setLoading(true);
    try {
      const res = await axios.post(ENDPOINTS.bookAppointment(patientState.token), {
        date: patientState.follow_up_date || ""
      });
      if (res.data.success) {
        Alert.alert("Success", "📅 Appointment Booked Automatically by AI!");
        fetchDetails();
      }
    } catch (e) {
      Alert.alert("Error", "Could not schedule appointment. Check server connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleUploadReport = async (useCamera: boolean) => {
    try {
      const permissionResult = useCamera 
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (permissionResult.granted === false) {
        Alert.alert("Permission Denied", `Please allow access to your ${useCamera ? "camera" : "gallery"} to upload medical reports.`);
        return;
      }

      const pickerResult = useCamera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.8,
            base64: true,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.8,
            base64: true,
          });

      if (pickerResult.canceled || !pickerResult.assets || pickerResult.assets.length === 0) {
        return;
      }

      const asset = pickerResult.assets[0];
      if (!asset.base64) {
        Alert.alert("Error", "Could not read image file data.");
        return;
      }

      setLoading(true);
      const filename = asset.fileName || `report_${Date.now()}.jpg`;
      
      const res = await axios.post(ENDPOINTS.uploadReport(patientState.token), {
        filename,
        image_base64: asset.base64
      });

      if (res.data.success) {
        Alert.alert("Success", "📊 Lab report uploaded and analyzed by AI successfully!");
        fetchDetails();
      } else {
        throw new Error();
      }

    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Could not upload report. Make sure the file is an image and backend is reachable.");
    } finally {
      setLoading(false);
    }
  };

  const triggerUploadSelection = () => {
    Alert.alert(
      "Upload Lab Report",
      "Choose how you want to upload your document:",
      [
        { text: "📷 Take Photo", onPress: () => handleUploadReport(true) },
        { text: "🖼️ Select from Gallery", onPress: () => handleUploadReport(false) },
        { text: "Cancel", style: "cancel" }
      ]
    );
  };

  const priorityColor = () => {
    const token = patientState.token?.toUpperCase() || "";
    if (token.startsWith("EMG")) return { color: COLORS.emergency, bg: "rgba(239,68,68,0.1)", label: "🚨 EMERGENCY" };
    if (token.startsWith("HPR")) return { color: COLORS.high, bg: "rgba(245,158,11,0.1)", label: "⚡ HIGH PRIORITY" };
    return { color: COLORS.success, bg: "rgba(16,185,129,0.1)", label: "✅ NORMAL" };
  };
  const pCfg = priorityColor();

  const getStatusColor = (status: string) => {
    if (status === "critical") return COLORS.emergency;
    if (status === "abnormal" || status === "warning") return COLORS.high;
    return COLORS.success;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={["#0a1628", "#020817"]} style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.welcomeText}>Welcome back 👋</Text>
            <Text style={styles.patientName}>{patientState.name}</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={[styles.langToggle, { borderColor: COLORS.primaryBorder }]}
              onPress={() => setLanguage(l => l === "english" ? "telugu" : "english")}
            >
              <Text style={styles.langToggleText}>{language === "english" ? "🇬🇧 EN" : "🇮🇳 TE"}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Token Badge */}
        <View style={[styles.tokenBadge, { backgroundColor: pCfg.bg, borderColor: pCfg.color + "55" }]}>
          <Text style={[styles.tokenLabel, { color: pCfg.color }]}>{pCfg.label}</Text>
          <Text style={[styles.tokenNumber, { color: pCfg.color }]}>{patientState.token}</Text>
        </View>

        {/* Tab Bar */}
        <View style={styles.tabBar}>
          {[
            { id: "prescription", label: "💊 Advice" },
            { id: "appointments", label: "📅 Appointments" },
            { id: "reports", label: "📊 Reports" }
          ].map(t => (
            <TouchableOpacity
              key={t.id}
              style={[styles.tab, activeTab === t.id && styles.activeTab]}
              onPress={() => setActiveTab(t.id as any)}
            >
              <Text style={[styles.tabText, activeTab === t.id && styles.activeTabText]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </LinearGradient>

      {/* Loading Overlay */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>AI is processing your request...</Text>
        </View>
      )}

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        
        {/* TAB 1: Prescription & Advice */}
        {activeTab === "prescription" && (
          <View style={styles.tabContent}>
            {!summary ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyIcon}>⏳</Text>
                <Text style={styles.emptyTitle}>Waiting for Doctor's Notes</Text>
                <Text style={styles.emptySubtitle}>
                  Your prescription will appear here after your doctor completes the consultation.
                </Text>
                <View style={styles.symptomBox}>
                  <Text style={styles.symptomLabel}>Your reported symptoms:</Text>
                  <Text style={styles.symptomText}>{patientState.symptoms || "Not recorded"}</Text>
                </View>
              </View>
            ) : (
              <>
                {/* Doctor's Summary */}
                <View style={styles.sectionCard}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionIcon}>📋</Text>
                    <Text style={styles.sectionTitle}>Doctor's Advice</Text>
                  </View>
                  <View style={styles.summaryBox}>
                    <Text style={styles.summaryText}>{summary.summary}</Text>
                  </View>
                </View>

                {/* Medications */}
                {summary.medications && summary.medications.length > 0 && (
                  <View style={styles.sectionCard}>
                    <View style={styles.sectionHeader}>
                      <Text style={styles.sectionIcon}>💊</Text>
                      <Text style={styles.sectionTitle}>Medicines</Text>
                    </View>
                    {summary.medications.map((med, i) => (
                      <View key={i} style={styles.medCard}>
                        <View style={styles.medLeft}>
                          <View style={styles.medDot} />
                        </View>
                        <View style={styles.medContent}>
                          <Text style={styles.medName}>{med.name}</Text>
                          <Text style={styles.medDosage}>{med.dosage}</Text>
                          <View style={styles.medTagRow}>
                            {med.timing && <View style={styles.medTag}><Text style={styles.medTagText}>⏰ {med.timing}</Text></View>}
                            {med.duration && <View style={styles.medTag}><Text style={styles.medTagText}>📅 {med.duration}</Text></View>}
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {/* Diet */}
                {summary.diet_advice && summary.diet_advice.length > 0 && (
                  <View style={styles.sectionCard}>
                    <View style={styles.sectionHeader}>
                      <Text style={styles.sectionIcon}>🥗</Text>
                      <Text style={styles.sectionTitle}>Diet & Food</Text>
                    </View>
                    {summary.diet_advice.map((d, i) => {
                      const isAvoid = d.toLowerCase().includes("avoid") || d.toLowerCase().includes("no ") || d.toLowerCase().includes("don't");
                      return (
                        <View key={i} style={styles.dietRow}>
                          <Text style={[styles.dietBullet, { color: isAvoid ? COLORS.emergency : COLORS.success }]}>
                            {isAvoid ? "✗" : "✓"}
                          </Text>
                          <Text style={styles.dietText}>{d}</Text>
                        </View>
                      );
                    })}
                  </View>
                )}

                {/* Activity */}
                {summary.activity && (
                  <View style={styles.sectionCard}>
                    <View style={styles.sectionHeader}>
                      <Text style={styles.sectionIcon}>🛌</Text>
                      <Text style={styles.sectionTitle}>Rest & Activity</Text>
                    </View>
                    <Text style={styles.activityText}>{summary.activity}</Text>
                  </View>
                )}

                {/* Emergency Signs */}
                {summary.emergency_signs && summary.emergency_signs.length > 0 && (
                  <View style={[styles.sectionCard, styles.emergencyCard]}>
                    <View style={styles.sectionHeader}>
                      <Text style={styles.sectionIcon}>🚨</Text>
                      <Text style={[styles.sectionTitle, { color: COLORS.emergency }]}>Go to Hospital Immediately If:</Text>
                    </View>
                    {summary.emergency_signs.map((s, i) => (
                      <View key={i} style={styles.emergencyRow}>
                        <Text style={styles.emergencyBullet}>⚠️</Text>
                        <Text style={styles.emergencyText}>{s}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}
          </View>
        )}

        {/* TAB 2: Appointments & Reminders */}
        {activeTab === "appointments" && (
          <View style={styles.tabContent}>
            {/* Follow-up Pending Warning Banner */}
            {patientState.follow_up_date && !patientState.appointment_booked && (
              <LinearGradient colors={["rgba(124, 58, 237, 0.25)", "rgba(2, 8, 23, 0.9)"]} style={styles.reminderBanner}>
                <View style={styles.reminderHeader}>
                  <Text style={styles.reminderIcon}>⚠️</Text>
                  <Text style={styles.reminderTitle}>AI Care Assistant Reminder</Text>
                </View>
                <Text style={styles.reminderText}>
                  Your follow-up appointment is recommended in **2 days** (on or around **{patientState.follow_up_date}**).
                </Text>
                <TouchableOpacity style={styles.bookBtn} onPress={handleBookAppointment}>
                  <Text style={styles.bookBtnText}>📅 Confirm & Book Appointment with AI</Text>
                </TouchableOpacity>
              </LinearGradient>
            )}

            {/* Notification logs (Hourly alerts simulation) */}
            {patientState.notifications && patientState.notifications.length > 0 && (
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionIcon}>🔔</Text>
                  <Text style={styles.sectionTitle}>Reminder Alert Logs (Simulated Hourly)</Text>
                </View>
                {patientState.notifications.map((n: any, i: number) => (
                  <View key={i} style={styles.notiRow}>
                    <Text style={styles.notiTime}>
                      {new Date(n.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    <Text style={styles.notiMessage}>{n.message}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Upcoming Appointments */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionIcon}>📅</Text>
                <Text style={styles.sectionTitle}>Upcoming Scheduled Visits</Text>
              </View>
              {patientState.appointments && patientState.appointments.length > 0 ? (
                patientState.appointments.map((app: any) => (
                  <View key={app.id} style={styles.appointmentCard}>
                    <View style={styles.appRow}>
                      <Text style={styles.appNameText}>{app.doctor_name}</Text>
                      <View style={styles.badgeScheduled}><Text style={styles.badgeText}>CONFIRMED</Text></View>
                    </View>
                    <Text style={styles.appDate}>Scheduled Date: {app.date}</Text>
                    <Text style={styles.appReason}>Reason: {app.reason}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.noDataText}>No upcoming visits scheduled. Click the confirm button above to book.</Text>
              )}
            </View>

            {/* Appointment History */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionIcon}>📜</Text>
                <Text style={styles.sectionTitle}>Appointment History</Text>
              </View>
              {patientState.history && patientState.history.length > 0 ? (
                patientState.history.map((h: any, i: number) => (
                  <View key={i} style={styles.historyCard}>
                    <View style={styles.appRow}>
                      <Text style={styles.historyDoctor}>{h.doctor_name}</Text>
                      <View style={styles.badgeDone}><Text style={styles.badgeText}>COMPLETED</Text></View>
                    </View>
                    <Text style={styles.historyDate}>Date: {h.date}</Text>
                    <Text style={styles.historyReason}>Notes: {h.reason}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.noDataText}>No past history available.</Text>
              )}
            </View>
          </View>
        )}

        {/* TAB 3: Reports & AI Analytics */}
        {activeTab === "reports" && (
          <View style={styles.tabContent}>
            {/* Upload Section */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionIcon}>📤</Text>
                <Text style={styles.sectionTitle}>Upload Lab Reports</Text>
              </View>
              <Text style={styles.uploadDesc}>
                Upload scan images or laboratory PDF reports here. AI will scan them and compare them for clinical trends.
              </Text>
              
              <TouchableOpacity style={styles.uploadBtn} onPress={triggerUploadSelection}>
                <Text style={styles.uploadBtnText}>📸 Upload Medical Report (Camera/Gallery)</Text>
              </TouchableOpacity>
            </View>

            {/* List of Reports */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionIcon}>📊</Text>
                <Text style={styles.sectionTitle}>Your Lab Documents</Text>
              </View>
              {patientState.reports && patientState.reports.length > 0 ? (
                patientState.reports.map((rep: any) => (
                  <View key={rep.id} style={styles.reportCard}>
                    <View style={styles.reportHeader}>
                      <Text style={styles.reportFilename}>{rep.filename}</Text>
                      <View style={[styles.badgeStatus, { backgroundColor: getStatusColor(rep.analysis.status) + "22" }]}>
                        <Text style={[styles.badgeStatusText, { color: getStatusColor(rep.analysis.status) }]}>
                          {rep.analysis.status?.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.reportDate}>Uploaded: {rep.uploaded_at}</Text>
                    <Text style={styles.reportSummary}>{rep.analysis.summary}</Text>

                    {/* Key Markers */}
                    {rep.analysis.key_markers && rep.analysis.key_markers.length > 0 && (
                      <View style={styles.markerContainer}>
                        {rep.analysis.key_markers.map((m: any, index: number) => (
                          <View key={index} style={styles.markerTag}>
                            <Text style={styles.markerName}>{m.name}: </Text>
                            <Text style={[styles.markerValue, { color: getStatusColor(m.status) }]}>{m.value}</Text>
                            <Text style={styles.markerRange}> ({m.range})</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                ))
              ) : (
                <Text style={styles.noDataText}>No reports uploaded yet. Please upload a report using the button above.</Text>
              )}
            </View>
          </View>
        )}

      </ScrollView>

      {/* Floating Chat Button */}
      <View style={styles.fabContainer}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => navigation.navigate("NurseChat", { patient: patientState, language })}
        >
          <LinearGradient
            colors={["#00d4ff", "#7c3aed"]}
            style={styles.fab}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          >
            <Text style={styles.fabIcon}>🤱</Text>
            <Text style={styles.fabText}>Ask Your AI Nurse</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgDeep },
  header: { paddingTop: 55, paddingBottom: 12, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  welcomeText: { fontSize: 13, color: COLORS.textMuted },
  patientName: { fontSize: 24, fontWeight: "800", color: COLORS.textPrimary, marginTop: 2 },
  langToggle: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.full, borderWidth: 1, backgroundColor: COLORS.bgCard },
  langToggleText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: "600" },
  logoutBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border },
  logoutText: { fontSize: 12, color: COLORS.textMuted },
  tokenBadge: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderRadius: RADIUS.md, padding: 12, borderWidth: 1, marginBottom: 12 },
  tokenLabel: { fontSize: 13, fontWeight: "700" },
  tokenNumber: { fontSize: 18, fontWeight: "800", fontFamily: "monospace", letterSpacing: 1 },

  // Tabs
  tabBar: { flexDirection: "row", gap: 6, marginTop: 4 },
  tab: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: RADIUS.sm, backgroundColor: "rgba(255,255,255,0.03)" },
  activeTab: { backgroundColor: "rgba(0,212,255,0.15)" },
  tabText: { fontSize: 12, color: COLORS.textMuted, fontWeight: "600" },
  activeTabText: { color: COLORS.primary, fontWeight: "700" },

  scroll: { flex: 1, padding: 16 },
  tabContent: { gap: 12 },

  // Empty State
  emptyCard: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.xl, padding: 28, alignItems: "center", borderWidth: 1, borderColor: COLORS.border, marginTop: 8 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 20, fontWeight: "700", color: COLORS.textPrimary, marginBottom: 8, textAlign: "center" },
  emptySubtitle: { fontSize: 14, color: COLORS.textSecondary, textAlign: "center", lineHeight: 20, marginBottom: 20 },
  symptomBox: { width: "100%", backgroundColor: COLORS.primaryDim, borderRadius: RADIUS.md, padding: 14, borderWidth: 1, borderColor: COLORS.primaryBorder },
  symptomLabel: { fontSize: 12, color: COLORS.primary, fontWeight: "600", marginBottom: 4 },
  symptomText: { fontSize: 14, color: COLORS.textSecondary },

  // Cards & Layout
  sectionCard: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.xl, padding: 18, borderWidth: 1, borderColor: COLORS.border },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  sectionIcon: { fontSize: 20 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: COLORS.textPrimary },

  summaryBox: { backgroundColor: COLORS.primaryDim, borderRadius: RADIUS.md, padding: 14, borderLeftWidth: 3, borderLeftColor: COLORS.primary },
  summaryText: { fontSize: 15, color: COLORS.textPrimary, lineHeight: 22 },

  medCard: { flexDirection: "row", marginBottom: 12, gap: 12 },
  medLeft: { paddingTop: 6 },
  medDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary },
  medContent: { flex: 1 },
  medName: { fontSize: 16, fontWeight: "700", color: COLORS.textPrimary },
  medDosage: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  medTagRow: { flexDirection: "row", gap: 6, marginTop: 6, flexWrap: "wrap" },
  medTag: { backgroundColor: COLORS.bgCardLight, borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1, borderColor: COLORS.border },
  medTagText: { fontSize: 11, color: COLORS.textSecondary },

  dietRow: { flexDirection: "row", gap: 10, alignItems: "flex-start", marginBottom: 8 },
  dietBullet: { fontSize: 16, fontWeight: "700", width: 20 },
  dietText: { fontSize: 14, color: COLORS.textSecondary, flex: 1, lineHeight: 20 },

  activityText: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 22 },
  emergencyCard: { borderColor: "rgba(239,68,68,0.3)", borderWidth: 1.5, backgroundColor: "rgba(239,68,68,0.05)" },
  emergencyRow: { flexDirection: "row", gap: 8, alignItems: "flex-start", marginBottom: 6 },
  emergencyBullet: { fontSize: 14 },
  emergencyText: { fontSize: 14, color: "#fca5a5", flex: 1, lineHeight: 20 },

  // Reminders
  reminderBanner: { borderRadius: RADIUS.xl, padding: 20, borderWidth: 1.5, borderColor: COLORS.secondary + "88", marginBottom: 6 },
  reminderHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  reminderIcon: { fontSize: 22 },
  reminderTitle: { fontSize: 17, fontWeight: "800", color: "#fff" },
  reminderText: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 20, marginBottom: 16 },
  bookBtn: { backgroundColor: COLORS.secondary, paddingVertical: 12, borderRadius: RADIUS.md, alignItems: "center", elevation: 4 },
  bookBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  notiRow: { borderLeftWidth: 2, borderLeftColor: COLORS.primary, paddingLeft: 12, paddingVertical: 8, marginBottom: 8 },
  notiTime: { fontSize: 11, color: COLORS.primary, fontWeight: "700" },
  notiMessage: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2, lineHeight: 18 },

  // Appointments List
  appointmentCard: { backgroundColor: COLORS.bgCardLight, borderRadius: RADIUS.md, padding: 14, borderLeftWidth: 4, borderLeftColor: COLORS.success, marginBottom: 8 },
  appRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  appNameText: { fontSize: 15, fontWeight: "700", color: COLORS.textPrimary },
  badgeScheduled: { backgroundColor: "rgba(16,185,129,0.15)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.success },
  badgeText: { fontSize: 10, color: COLORS.success, fontWeight: "700" },
  appDate: { fontSize: 13, color: COLORS.textSecondary },
  appReason: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  noDataText: { fontSize: 13, color: COLORS.textMuted, textAlign: "center", paddingVertical: 12 },

  // History List
  historyCard: { backgroundColor: COLORS.bgCardLight, borderRadius: RADIUS.md, padding: 14, borderLeftWidth: 4, borderLeftColor: COLORS.border, marginBottom: 8 },
  historyDoctor: { fontSize: 15, fontWeight: "700", color: COLORS.textSecondary },
  badgeDone: { backgroundColor: "rgba(255,255,255,0.08)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
  historyDate: { fontSize: 13, color: COLORS.textMuted },
  historyReason: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },

  // Reports Tab
  uploadDesc: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 18, marginBottom: 14 },
  presetTitle: { fontSize: 12, color: COLORS.primary, fontWeight: "700", marginBottom: 8 },
  presetContainer: { flexDirection: "column", gap: 8, marginBottom: 12 },
  presetBtn: { backgroundColor: "rgba(0,212,255,0.08)", borderHorizontalWidth: 1, borderWidth: 1, borderColor: "rgba(0,212,255,0.25)", paddingVertical: 10, paddingHorizontal: 14, borderRadius: RADIUS.md },
  presetBtnText: { color: COLORS.primary, fontSize: 13, fontWeight: "600" },
  uploadBtn: { borderStyle: "dashed", borderWidth: 1.5, borderColor: COLORS.border, paddingVertical: 14, borderRadius: RADIUS.md, alignItems: "center", marginTop: 4 },
  uploadBtnText: { color: COLORS.textMuted, fontWeight: "600", fontSize: 13 },

  reportCard: { backgroundColor: COLORS.bgCardLight, borderRadius: RADIUS.md, padding: 16, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: COLORS.primary },
  reportHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  reportFilename: { fontSize: 15, fontWeight: "700", color: COLORS.textPrimary },
  badgeStatus: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
  badgeStatusText: { fontSize: 10, fontWeight: "700" },
  reportDate: { fontSize: 12, color: COLORS.textMuted, marginBottom: 8 },
  reportSummary: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 18, marginBottom: 10 },
  markerContainer: { flexDirection: "row", gap: 6, flexWrap: "wrap", borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.05)", paddingTop: 8 },
  markerTag: { flexDirection: "row", backgroundColor: "rgba(255,255,255,0.03)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: "rgba(255,255,255,0.05)" },
  markerName: { fontSize: 11, color: COLORS.textSecondary, fontWeight: "500" },
  markerValue: { fontSize: 11, fontWeight: "700" },
  markerRange: { fontSize: 11, color: COLORS.textMuted },

  // Floating button
  fabContainer: { position: "absolute", bottom: 24, left: 20, right: 20 },
  fab: { borderRadius: RADIUS.full, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, elevation: 10 },
  fabIcon: { fontSize: 22 },
  fabText: { fontSize: 16, fontWeight: "700", color: "#fff" },

  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(2,8,23,0.85)", justifyContent: "center", alignItems: "center", zIndex: 1000 },
  loadingText: { color: COLORS.primary, marginTop: 14, fontWeight: "600", fontSize: 14 }
});
