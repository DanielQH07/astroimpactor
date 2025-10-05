(function (global) {
  // Danh sách các thành phố lớn (rải đều các châu lục), tên + toạ độ
  const MAJOR_CITIES = [
    { name: 'New York', lat: 40.7128, lon: -74.0060 },
    { name: 'Los Angeles', lat: 34.0522, lon: -118.2437 },
    { name: 'Mexico City', lat: 19.4326, lon: -99.1332 },
    { name: 'São Paulo', lat: -23.5505, lon: -46.6333 },
    { name: 'Buenos Aires', lat: -34.6037, lon: -58.3816 },
    { name: 'Lima', lat: -12.0464, lon: -77.0428 },
    { name: 'Bogotá', lat: 4.7110, lon: -74.0721 },
    { name: 'London', lat: 51.5074, lon: -0.1278 },
    { name: 'Paris', lat: 48.8566, lon: 2.3522 },
    { name: 'Madrid', lat: 40.4168, lon: -3.7038 },
    { name: 'Rome', lat: 41.9028, lon: 12.4964 },
    { name: 'Berlin', lat: 52.5200, lon: 13.4050 },
    { name: 'Moscow', lat: 55.7558, lon: 37.6176 },
    { name: 'Istanbul', lat: 41.0082, lon: 28.9784 },
    { name: 'Cairo', lat: 30.0444, lon: 31.2357 },
    { name: 'Lagos', lat: 6.5244, lon: 3.3792 },
    { name: 'Nairobi', lat: -1.2921, lon: 36.8219 },
    { name: 'Johannesburg', lat: -26.2041, lon: 28.0473 },
    { name: 'Riyadh', lat: 24.7136, lon: 46.6753 },
    { name: 'Dubai', lat: 25.2048, lon: 55.2708 },
    { name: 'Tehran', lat: 35.6892, lon: 51.3890 },
    { name: 'Karachi', lat: 24.8607, lon: 67.0011 },
    { name: 'Delhi', lat: 28.7041, lon: 77.1025 },
    { name: 'Mumbai', lat: 19.0760, lon: 72.8777 },
    { name: 'Dhaka', lat: 23.8103, lon: 90.4125 },
    { name: 'Bangkok', lat: 13.7563, lon: 100.5018 },
    { name: 'Jakarta', lat: -6.2088, lon: 106.8456 },
    { name: 'Singapore', lat: 1.3521, lon: 103.8198 },
    { name: 'Manila', lat: 14.5995, lon: 120.9842 },
    { name: 'Hong Kong', lat: 22.3193, lon: 114.1694 },
    { name: 'Seoul', lat: 37.5665, lon: 126.9780 },
    { name: 'Tokyo', lat: 35.6895, lon: 139.6917 },
    { name: 'Osaka', lat: 34.6937, lon: 135.5023 },
    { name: 'Beijing', lat: 39.9042, lon: 116.4074 },
    { name: 'Shanghai', lat: 31.2304, lon: 121.4737 },
    { name: 'Sydney', lat: -33.8688, lon: 151.2093 },
    { name: 'Melbourne', lat: -37.8136, lon: 144.9631 },
    { name: 'Toronto', lat: 43.6532, lon: -79.3832 },
    { name: 'Montreal', lat: 45.5019, lon: -73.5674 }
  ];

  // Thêm lớp nhãn thành phố vào bản đồ Leaflet, font nhỏ-vừa
  function addMajorCities(map, L) {
    const layer = L.layerGroup();
    MAJOR_CITIES.forEach(c => {
      const marker = L.circleMarker([c.lat, c.lon], {
        radius: 0.1,
        opacity: 0,
        fillOpacity: 0
      }).addTo(layer);
      marker.bindTooltip(c.name, {
        permanent: true,
        direction: 'right',
        className: 'city-label'
      });
    });
    layer.addTo(map);
    return layer;
  }

  // KEEP: Leaflet helper
  global.addMajorCities = addMajorCities;

  // ADD: curated important cities (capitals/megacities + near popup locations)
  const IMPORTANT_CITIES = [
    // North America
    { name: 'New York', lat: 40.7128, lon: -74.0060 },
    { name: 'Washington, D.C.', lat: 38.9072, lon: -77.0369 },
    { name: 'Los Angeles', lat: 34.0522, lon: -118.2437 },
    { name: 'Chicago', lat: 41.8781, lon: -87.6298 },
    { name: 'Toronto', lat: 43.6532, lon: -79.3832 },
    { name: 'Mexico City', lat: 19.4326, lon: -99.1332 },


    // South America
    { name: 'Rio de Janeiro', lat: -22.9068, lon: -43.1729 },
    { name: 'Buenos Aires', lat: -34.6037, lon: -58.3816 },
    { name: 'Santiago', lat: -33.4489, lon: -70.6693 },
    { name: 'Lima', lat: -12.0464, lon: -77.0428 },
    { name: 'Bogotá', lat: 4.7110, lon: -74.0721 },

    // Europe
    { name: 'London', lat: 51.5074, lon: -0.1278 },
    { name: 'Paris', lat: 48.8566, lon: 2.3522 },
    { name: 'Madrid', lat: 40.4168, lon: -3.7038 },
    { name: 'Rome', lat: 41.9028, lon: 12.4964 },
    { name: 'Berlin', lat: 52.5200, lon: 13.4050 },
    { name: 'Moscow', lat: 55.7558, lon: 37.6176 },
    { name: 'Istanbul', lat: 41.0082, lon: 28.9784 },
    // Near Ries
    { name: 'Munich', lat: 48.1351, lon: 11.5820 },


    // Africa
    { name: 'Cairo', lat: 30.0444, lon: 31.2357 },
    { name: 'Lagos', lat: 6.5244, lon: 3.3792 },
    { name: 'Nairobi', lat: -1.2921, lon: 36.8219 },
    { name: 'Johannesburg', lat: -26.2041, lon: 28.0473 },
    { name: 'Pretoria', lat: -25.7479, lon: 28.2293 },

    // Middle East
    { name: 'Riyadh', lat: 24.7136, lon: 46.6753 },
    { name: 'Dubai', lat: 25.2048, lon: 55.2708 },
    { name: 'Tehran', lat: 35.6892, lon: 51.3890 },

    // South Asia
    { name: 'Karachi', lat: 24.8607, lon: 67.0011 },
    { name: 'Delhi', lat: 28.7041, lon: 77.1025 },
    { name: 'Mumbai', lat: 19.0760, lon: 72.8777 },
    { name: 'Dhaka', lat: 23.8103, lon: 90.4125 },

    // Southeast Asia (include requested)
    { name: 'Hanoi', lat: 21.0278, lon: 105.8342 },
    { name: 'Ho Chi Minh City', lat: 10.8231, lon: 106.6297 },
    { name: 'Bangkok', lat: 13.7563, lon: 100.5018 },
    { name: 'Jakarta', lat: -6.2088, lon: 106.8456 },
    { name: 'Singapore', lat: 1.3521, lon: 103.8198 },
    { name: 'Manila', lat: 14.5995, lon: 120.9842 },
    // Sulawesi area
    { name: 'Makassar', lat: -5.1477, lon: 119.4327 },

    // East Asia
    { name: 'Hong Kong', lat: 22.3193, lon: 114.1694 },
    { name: 'Seoul', lat: 37.5665, lon: 126.9780 },
    { name: 'Tokyo', lat: 35.6895, lon: 139.6917 },
    { name: 'Osaka', lat: 34.6937, lon: 135.5023 },
    { name: 'Beijing', lat: 39.9042, lon: 116.4074 },
    { name: 'Shanghai', lat: 31.2304, lon: 121.4737 },

    // Oceania
    { name: 'Sydney', lat: -33.8688, lon: 151.2093 },
    { name: 'Melbourne', lat: -37.8136, lon: 144.9631 },

    // Yucatán (Chicxulub)
    { name: 'Cancún', lat: 21.1619, lon: -86.8515 },

    // Russia (Tunguska / Chelyabinsk region)
    { name: 'Yekaterinburg', lat: 56.8389, lon: 60.6057 },
    { name: 'Krasnoyarsk', lat: 56.0153, lon: 92.8932 }
  ];

  // ADD: expose lists for Globe usage
  global.MAJOR_CITIES = MAJOR_CITIES;
  global.IMPORTANT_CITIES = IMPORTANT_CITIES;
})(window);