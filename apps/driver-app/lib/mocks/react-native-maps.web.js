const React = require('react');
const { View } = require('react-native');

function MapView(props) {
  return React.createElement(View, {
    ...props,
    style: [{ backgroundColor: '#E5E7EB' }, props.style],
  });
}

function Marker(props) {
  return React.createElement(View, {
    ...props,
    style: [{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#F25C2A' }, props.style],
  });
}

function Polyline(props) {
  return React.createElement(View, props);
}

module.exports = {
  __esModule: true,
  default: MapView,
  Marker,
  Polyline,
  PROVIDER_GOOGLE: 'google',
};
