import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';

export default function MapaSelector({ region, setRegion }: any) {
  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={region}
        onRegionChangeComplete={(r) => setRegion(r)}
      />
      <View style={styles.markerFixed} pointerEvents="none">
        <Ionicons name="location" size={45} color="#F44336" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  markerFixed: { position: 'absolute', top: '50%', left: '50%', marginLeft: -22.5, marginTop: -45 }
});