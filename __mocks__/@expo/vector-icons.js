// Jest mock for @expo/vector-icons
// expo-font / FontLoader cannot resolve in the Jest environment.
// All icon sets are stubbed as plain Views — tests only care about
// the surrounding UI, not which icon glyph is rendered.
const React = require("react");
const { View } = require("react-native");

const createIconStub = (displayName) => {
  const Icon = ({ testID, ...props }) =>
    React.createElement(View, { testID: testID ?? displayName, ...props });
  Icon.displayName = displayName;
  return Icon;
};

// Named exports for every icon set your code uses
const Ionicons = createIconStub("Ionicons");
const MaterialIcons = createIconStub("MaterialIcons");
const AntDesign = createIconStub("AntDesign");
const Feather = createIconStub("Feather");
const FontAwesome = createIconStub("FontAwesome");
const FontAwesome5 = createIconStub("FontAwesome5");

module.exports = {
  Ionicons,
  MaterialIcons,
  AntDesign,
  Feather,
  FontAwesome,
  FontAwesome5,
  // Catch-all for any other icon set via default import
  default: new Proxy(
    {},
    {
      get(_, name) {
        return createIconStub(String(name));
      },
    },
  ),
};
