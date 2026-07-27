import React from 'react';
import { Text, Linking, Alert } from 'react-native';

/**
 * Turns URLs inside a chat message into tappable links.
 *
 * Shared by the 1:1 chat (ChatScreen) and the event group chat (EventChatScreen)
 * so both behave identically (#12).
 *
 * NOTE on the two regexes: `SPLIT_RE` carries the /g flag because String.split
 * needs it to keep the captured URLs. It must NOT be reused for `.test()` — a
 * global regex keeps `lastIndex` between calls, so testing several segments in a
 * row returns alternating true/false and silently drops links. `TEST_RE` is a
 * separate, non-global, fully-anchored expression used for the per-segment check.
 */
const SPLIT_RE = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
const TEST_RE = /^(https?:\/\/[^\s]+|www\.[^\s]+)$/i;

// Bare "www.x" needs a scheme before Linking will open it.
const normalize = (url) => (/^https?:\/\//i.test(url) ? url : `https://${url}`);

export const renderTextWithLinks = (text, linkStyle) => {
  const str = String(text ?? '');
  if (!str) return str;

  return str.split(SPLIT_RE).map((part, i) => {
    if (!part) return null;
    if (!TEST_RE.test(part)) return part;

    // Trailing sentence punctuation shouldn't be swallowed into the URL.
    const m = part.match(/^(.*?)([.,;:!?)\]]*)$/);
    const url = m && m[1] ? m[1] : part;
    const tail = m ? m[2] : '';

    return (
      <React.Fragment key={i}>
        <Text
          style={linkStyle}
          onPress={() =>
            Linking.openURL(normalize(url)).catch(() =>
              Alert.alert('Could not open link', 'No app on this device can open that address.')
            )
          }
        >
          {url}
        </Text>
        {tail}
      </React.Fragment>
    );
  });
};

// Blue link colours (#12). Two shades so links stay legible on BOTH the light
// incoming bubble and the accent-coloured outgoing bubble.
export const LINK_BLUE = '#1B6EF3';
export const LINK_BLUE_ON_ACCENT = '#CFE2FF';
