import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

export default function App() {
  const [drivers, setDrivers] = useState([
    { id: 'd-201', title: 'Tài xế 1', lat: 10.77, lng: 106.67 },
    { id: 'd-202', title: 'Tài xế 2', lat: 10.775, lng: 106.675 },
  ]);

  useEffect(() => {
    const timer = setInterval(() => {
      setDrivers((prev) =>
        prev.map((item) => ({
          ...item,
          lat: item.lat + (Math.random() - 0.5) * 0.001,
          lng: item.lng + (Math.random() - 0.5) * 0.001,
        }))
      );
    }, 2000);

    return () => clearInterval(timer);
  }, []);

  const region = useMemo(
    () => ({
      latitude: 10.77,
      longitude: 106.67,
      latitudeDelta: 0.08,
      longitudeDelta: 0.08,
    }),
    []
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Live Map</Text>
        <Text style={styles.subtitle}>Giám sát tài xế (mock)</Text>
      </View>
      <MapView style={styles.map} initialRegion={region}>
        {drivers.map((driver) => (
          <Marker
            key={driver.id}
            title={driver.title}
            coordinate={{ latitude: driver.lat, longitude: driver.lng }}
          />
        ))}
      </MapView>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingTop: 48,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 12,
    color: '#6b7280',
  },
  map: {
    flex: 1,
  },
});
