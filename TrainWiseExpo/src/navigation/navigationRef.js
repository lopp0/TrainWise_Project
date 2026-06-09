import { createNavigationContainerRef } from '@react-navigation/native';

// Lets non-component code (e.g. the events poller / in-app banner) navigate.
export const navigationRef = createNavigationContainerRef();

export const navigate = (name, params) => {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name, params);
  }
};
