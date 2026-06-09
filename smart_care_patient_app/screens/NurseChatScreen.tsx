import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, KeyboardAvoidingView, Platform, ActivityIndicator,
  Animated,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { StackNavigationProp } from "@react-navigation/stack";
import { RouteProp } from "@react-navigation/native";
import axios from "axios";
import { COLORS, RADIUS } from "../constants/theme";
import { ENDPOINTS } from "../constants/api";
import { RootStackParamList } from "../App";

type NurseChatNavigationProp = StackNavigationProp<RootStackParamList, "NurseChat">;
type NurseChatRouteProp = RouteProp<RootStackParamList, "NurseChat">;

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

const QUICK_QUESTIONS_EN = [
  "When to take medicine?",
  "What should I eat?",
  "When is my follow-up?",
  "What are emergency signs?",
];
const QUICK_QUESTIONS_TE = [
  "మందు ఎప్పుడు వేసుకోవాలి?",
  "ఏమి తినాలి?",
  "మళ్ళీ డాక్టర్ ఎప్పుడు కలవాలి?",
  "Emergency signs ఏమిటి?",
];

export default function NurseChatScreen({ navigation, route }: { navigation: NurseChatNavigationProp; route: NurseChatRouteProp }) {
  const { patient, language: initLang } = route.params;
  const [language, setLanguage] = useState<"telugu" | "english">(initLang);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const dotAnim = useRef(new Animated.Value(0)).current;

  const quickQuestions = language === "english" ? QUICK_QUESTIONS_EN : QUICK_QUESTIONS_TE;

  // Greeting message
  useEffect(() => {
    const greeting = language === "english"
      ? `Hello ${patient.name}! 👋 I'm your personal AI nurse. I have access to your doctor's prescription and notes. How can I help you today?`
      : `నమస్కారం ${patient.name}! 👋 నేను మీ పర్సనల్ AI నర్స్ ని. మీ డాక్టర్ గారి prescription మరియు notes నాకు తెలుసు. ఏమి సహాయం కావాలి?`;
    setMessages([{
      id: "0",
      role: "assistant",
      content: greeting,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    }]);
  }, [language]);

  // Typing dots animation
  useEffect(() => {
    if (!loading) { dotAnim.setValue(0); return; }
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(dotAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(dotAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [loading]);

  const sendMessage = async (text?: string) => {
    const userText = (text || input).trim();
    if (!userText || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const apiMessages = updatedMessages
        .filter(m => m.id !== "0")
        .map(m => ({ role: m.role, content: m.content }));

      const res = await axios.post(ENDPOINTS.chat, {
        token: patient.token,
        messages: apiMessages,
        language,
      });

      const reply: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: res.data.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages(prev => [...prev, reply]);
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: language === "english"
          ? "Sorry, I couldn't connect to the server. Please check your WiFi and try again."
          : "క్షమించండి, server తో connect అవ్వలేకపోయాను. WiFi check చేసి మళ్ళీ try చేయండి.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      }]);
    } finally {
      setLoading(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 150);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === "user";
    return (
      <View style={[styles.msgRow, isUser && styles.msgRowUser]}>
        {!isUser && (
          <View style={styles.avatarBubble}>
            <Text style={styles.avatarText}>🤱</Text>
          </View>
        )}
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAI]}>
          <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>{item.content}</Text>
          <Text style={styles.timestamp}>{item.timestamp}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={["#0a1628", "#020817"]} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <View style={styles.nurseAvatar}>
              <Text style={styles.nurseAvatarText}>🤱</Text>
            </View>
            <View>
              <Text style={styles.headerTitle}>AI Personal Nurse</Text>
              <View style={styles.onlineRow}>
                <View style={styles.onlineDot} />
                <Text style={styles.onlineText}>Online • {patient.name}</Text>
              </View>
            </View>
          </View>
          <TouchableOpacity
            style={styles.langBtn}
            onPress={() => setLanguage(l => l === "english" ? "telugu" : "english")}
          >
            <Text style={styles.langText}>{language === "english" ? "🇮🇳 TE" : "🇬🇧 EN"}</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }} keyboardVerticalOffset={0}>

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={m => m.id}
          renderItem={renderMessage}
          style={styles.messageList}
          contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          ListFooterComponent={
            loading ? (
              <View style={styles.msgRow}>
                <View style={styles.avatarBubble}><Text style={styles.avatarText}>🤱</Text></View>
                <View style={styles.bubbleAI}>
                  <Animated.Text style={[styles.bubbleText, { opacity: dotAnim }]}>● ● ●</Animated.Text>
                </View>
              </View>
            ) : null
          }
        />

        {/* Quick Questions */}
        <View style={styles.quickContainer}>
          <FlatList
            data={quickQuestions}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(_, i) => i.toString()}
            contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.quickChip}
                onPress={() => sendMessage(item)}
                disabled={loading}
              >
                <Text style={styles.quickChipText}>{item}</Text>
              </TouchableOpacity>
            )}
          />
        </View>

        {/* Input Area */}
        <View style={styles.inputArea}>
          <TextInput
            style={styles.input}
            placeholder={language === "english" ? "Ask your nurse anything..." : "మీ ప్రశ్న టైప్ చేయండి..."}
            placeholderTextColor={COLORS.textMuted}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={() => sendMessage()}
          />
          <TouchableOpacity
            onPress={() => sendMessage()}
            disabled={loading || !input.trim()}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={loading || !input.trim() ? ["#334155", "#334155"] : ["#00d4ff", "#7c3aed"]}
              style={styles.sendBtn}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            >
              {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.sendIcon}>↑</Text>}
            </LinearGradient>
          </TouchableOpacity>
        </View>

      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgDeep },
  header: { paddingTop: 55, paddingBottom: 16, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backBtn: { padding: 8 },
  backText: { color: COLORS.primary, fontSize: 14, fontWeight: "600" },
  headerCenter: { flexDirection: "row", alignItems: "center", gap: 10 },
  nurseAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primaryDim, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: COLORS.primaryBorder },
  nurseAvatarText: { fontSize: 20 },
  headerTitle: { fontSize: 15, fontWeight: "700", color: COLORS.textPrimary },
  onlineRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.success },
  onlineText: { fontSize: 11, color: COLORS.textMuted },
  langBtn: { padding: 8, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border },
  langText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: "600" },

  messageList: { flex: 1 },
  msgRow: { flexDirection: "row", alignItems: "flex-end", marginBottom: 12, gap: 8 },
  msgRowUser: { justifyContent: "flex-end" },
  avatarBubble: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.primaryDim, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: COLORS.primaryBorder, flexShrink: 0 },
  avatarText: { fontSize: 16 },
  bubble: { maxWidth: "75%", borderRadius: RADIUS.lg, padding: 12 },
  bubbleAI: { backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, borderBottomLeftRadius: 4 },
  bubbleUser: { backgroundColor: COLORS.primary, borderBottomRightRadius: 4 },
  bubbleText: { fontSize: 14, color: COLORS.textPrimary, lineHeight: 20 },
  bubbleTextUser: { color: "#020817", fontWeight: "600" },
  timestamp: { fontSize: 10, color: COLORS.textMuted, marginTop: 4, alignSelf: "flex-end" },

  quickContainer: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: COLORS.border },
  quickChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.full, backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.primaryBorder },
  quickChipText: { fontSize: 12, color: COLORS.primary, fontWeight: "500" },

  inputArea: { flexDirection: "row", alignItems: "flex-end", gap: 10, padding: 12, paddingBottom: Platform.OS === "ios" ? 28 : 12, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.bgCard },
  input: { flex: 1, backgroundColor: COLORS.bgCardLight, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderLight, color: COLORS.textPrimary, fontSize: 14, padding: 12, maxHeight: 100 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  sendIcon: { fontSize: 20, color: "#fff", fontWeight: "700" },
});
