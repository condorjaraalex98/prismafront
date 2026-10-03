import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

export default function MapaSelector({ region, setRegion }: any) {
  // Generamos el HTML para el mapa interactivo en Web
  const mapHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        #map { height: 100vh; width: 100vw; margin: 0; cursor: crosshair; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var map = L.map('map').setView([${region.latitude}, ${region.longitude}], 16);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
        var marker = L.marker([${region.latitude}, ${region.longitude}], {draggable: true}).addTo(map);
        
        // Al hacer clic, movemos el marcador y avisamos a React
        map.on('click', function(e) {
          marker.setLatLng(e.latlng);
          window.parent.postMessage({lat: e.latlng.lat, lng: e.latlng.lng}, '*');
        });

        // Al arrastrar el marcador también avisamos
        marker.on('dragend', function(e) {
          var pos = marker.getLatLng();
          window.parent.postMessage({lat: pos.lat, lng: pos.lng}, '*');
        });
      </script>
    </body>
    </html>
  `;

  useEffect(() => {
    const handleMessage = (event: any) => {
      if (event.data.lat && event.data.lng) {
        setRegion({
          ...region,
          latitude: event.data.lat,
          longitude: event.data.lng
        });
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [region, setRegion]);

  return (
    <View style={styles.container}>
      <iframe 
        srcDoc={mapHtml} 
        style={{ border: '2px solid #024885', borderRadius: 15, width: '100%', height: '100%' }} 
      />
    </View>
  );
}

const styles = StyleSheet.create({ container: { flex: 1, minHeight: 450 } });