import React from 'react';
import { Modal, View, TouchableOpacity, StyleSheet } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';

/**
 * #3 — in-app full-screen video player (form-check clips), styled to match the
 * app instead of bouncing out to the system browser. Mount it only while a URI
 * is set so the player hook initializes with the source and auto-plays.
 *
 * Usage: {videoUri && <VideoPlayerModal uri={videoUri} onClose={() => setVideoUri(null)} />}
 */
const VideoPlayerModal = ({ uri, onClose }) => {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.play();
  });

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <VideoView
          player={player}
          style={styles.video}
          contentFit="contain"
          nativeControls
          allowsFullscreen
        />
        <TouchableOpacity style={styles.close} onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', alignItems: 'center', justifyContent: 'center' },
  video: { width: '100%', height: '75%' },
  close: {
    position: 'absolute',
    top: 48,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default VideoPlayerModal;
