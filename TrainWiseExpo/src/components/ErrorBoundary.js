import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';

/**
 * Catches render-time JS errors in its subtree and shows the message on screen
 * instead of crashing the whole app. Used to guard screens whose crash we can't
 * reproduce on the dev machine — the visible message is the diagnostic.
 *
 * props: { children, label }
 */
export default class ErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Also goes to logcat / Metro for anyone watching.
    console.log('[ErrorBoundary]', this.props.label || '', error?.message, info?.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (error) {
      // Compact inline fallback — used to guard a single card so a crash there
      // doesn't take down the whole screen (and names the culprit).
      if (this.props.inline) {
        return (
          <View style={styles.inlineWrap}>
            <Text style={styles.inlineTitle}>⚠️ {this.props.label || 'This section'} failed to load</Text>
            <Text style={styles.inlineMsg}>{String(error?.message || error)}</Text>
          </View>
        );
      }
      return (
        <ScrollView style={styles.wrap} contentContainerStyle={{ padding: 20 }}>
          <Text style={styles.title}>⚠️ This screen hit an error</Text>
          {this.props.label ? <Text style={styles.label}>{this.props.label}</Text> : null}
          <Text style={styles.msg}>{String(error?.message || error)}</Text>
          <Text style={styles.stack}>{String(error?.stack || '').slice(0, 1200)}</Text>
          <TouchableOpacity style={styles.btn} onPress={this.reset}>
            <Text style={styles.btnText}>Try again</Text>
          </TouchableOpacity>
        </ScrollView>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  inlineWrap: { backgroundColor: '#3a1220', borderRadius: 12, padding: 12, marginHorizontal: 16, marginVertical: 6, borderWidth: 1, borderColor: '#ff5252' },
  inlineTitle: { color: '#ff8a80', fontSize: 13, fontWeight: '800', marginBottom: 4 },
  inlineMsg: { color: '#fff', fontSize: 12 },
  wrap: { flex: 1, backgroundColor: '#13173d' },
  title: { color: '#ff5252', fontSize: 18, fontWeight: '900', marginBottom: 8 },
  label: { color: '#87ffd7', fontSize: 13, marginBottom: 8 },
  msg: { color: '#fff', fontSize: 14, fontWeight: '700', marginBottom: 12 },
  stack: { color: '#a0a0c0', fontSize: 11, lineHeight: 16 },
  btn: { marginTop: 18, backgroundColor: '#ff2d6f', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
