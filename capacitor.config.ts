const config = {
  appId: 'com.kwiklist.app',
  appName: 'KwikList',
  webDir: 'dist',
  server: {
    // En desarrollo local, apuntar a tu IP de red local o URL de ngrok.
    // En producción, cambiar por la URL del VPS (ej. https://kwiklist.tudominio.com).
    // Descomenta la siguiente línea y pon tu URL cuando despliegues:
    // url: 'https://TU-DOMINIO-O-IP',
    androidScheme: 'https',
  },
};

export default config;
