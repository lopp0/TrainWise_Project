const { withMainActivity } = require('@expo/config-plugins');

const IMPORT_LINE =
  'import dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate';
const DELEGATE_CALL = 'HealthConnectPermissionDelegate.setPermissionDelegate(this)';

module.exports = function withHealthConnectPermissionDelegate(config) {
  return withMainActivity(config, (config) => {
    let contents = config.modResults.contents;

    if (!contents.includes(IMPORT_LINE)) {
      contents = contents.replace(
        /(import expo\.modules\.ReactActivityDelegateWrapper\n)/,
        `$1${IMPORT_LINE}\n`
      );
    }

    if (!contents.includes(DELEGATE_CALL)) {
      contents = contents.replace(
        /(super\.onCreate\(null\)\n)/,
        `$1    ${DELEGATE_CALL}\n`
      );
    }

    config.modResults.contents = contents;
    return config;
  });
};