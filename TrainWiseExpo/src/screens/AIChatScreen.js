import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { useThemedStyles } from '../theme/useThemedStyles';
import { getGPTResponse } from '../api/openai';

const SYSTEM_PROMPT = `You are TrainWise AI, a specialized fitness assistant built into the TrainWise training app.
You ONLY answer questions about workouts, training plans, exercise technique, injury prevention, and injury recovery.
If the user asks about anything unrelated to fitness, workouts, or injuries, politely decline and redirect them to ask a fitness-related question.
Keep responses concise, practical, and motivating. Use bullet points when listing multiple items.`;

const AIChatScreen = ({ navigation }) => {
  const styles = useThemedStyles(makeStyles);
  const [messages, setMessages] = useState([
    {
      id: '0',
      role: 'assistant',
      content: "Hi! I'm TrainWise AI 💪\nAsk me anything about your training, recovery, or injuries!",
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef(null);

  const sendMessage = useCallback(async () => {
    const text = inputText.trim();
    if (!text || loading) return;

    const userMsg = { id: String(Date.now()), role: 'user', content: text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInputText('');
    setLoading(true);

    const apiMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...updatedMessages.map(({ role, content }) => ({ role, content })),
    ];

    const aiContent = await getGPTResponse(apiMessages);
    setMessages((prev) => [
      ...prev,
      { id: String(Date.now() + 1), role: 'assistant', content: aiContent },
    ]);
    setLoading(false);
  }, [inputText, loading, messages]);

  const renderMessage = ({ item }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.msgRow, isUser ? styles.userRow : styles.aiRow]}>
        {!isUser && (
          <View style={styles.aiAvatar}>
            <Ionicons name="fitness" size={14} color={Colors.primary} />
          </View>
        )}
        <View style={[styles.bubble, isUser ? styles.userBubble : styles.aiBubble]}>
          <Text style={[styles.bubbleText, isUser ? styles.userBubbleText : styles.aiBubbleText]}>
            {item.content}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.headerIconCircle}>
            <Ionicons name="fitness" size={18} color="#fff" />
          </View>
          <Text style={styles.headerTitle}>TrainWise AI</Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
      >
        {/* Messages list */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
          showsVerticalScrollIndicator={false}
        />

        {/* Typing indicator */}
        {loading && (
          <View style={styles.typingRow}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={styles.typingText}>TrainWise AI is thinking...</Text>
          </View>
        )}

        {/* Input row */}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Ask about your training..."
            placeholderTextColor={Colors.textMuted}
            multiline
            maxLength={500}
            returnKeyType="default"
          />
          <TouchableOpacity
            style={[
              styles.sendBtn,
              (!inputText.trim() || loading) && styles.sendBtnDisabled,
            ]}
            onPress={sendMessage}
            disabled={!inputText.trim() || loading}
            activeOpacity={0.8}
          >
            <Ionicons name="send" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const makeStyles = (Colors) => StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: Colors.textPrimary,
    fontSize: 17,
    fontWeight: '800',
  },

  // Messages
  messageList: {
    paddingHorizontal: 14,
    paddingVertical: 16,
    gap: 12,
  },
  msgRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 4,
  },
  userRow: {
    justifyContent: 'flex-end',
  },
  aiRow: {
    justifyContent: 'flex-start',
    gap: 8,
  },
  aiAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.cardBackground,
    borderWidth: 1,
    borderColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  bubble: {
    maxWidth: '75%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  userBubble: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: Colors.cardBackgroundLight,
    borderWidth: 1,
    borderColor: Colors.border,
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 22,
  },
  userBubbleText: {
    color: '#fff',
  },
  aiBubbleText: {
    color: Colors.textPrimary,
  },

  // Typing indicator
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  typingText: {
    color: Colors.textMuted,
    fontSize: 13,
    fontStyle: 'italic',
  },

  // Input area
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.inputBackground,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: Colors.textPrimary,
    fontSize: 15,
    maxHeight: 120,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: Colors.cardBackgroundLight,
  },
});

export default AIChatScreen;
