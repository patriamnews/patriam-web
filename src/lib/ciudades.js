// Ciudades de España con sus coordenadas, para situar las sedes en el mapa sin tener que escribirlas.
// Si una ciudad no está aquí, en el panel se puede marcar el punto pulsando sobre el mapa.
export const CIUDADES = {
  'A Coruña': [43.37, -8.4], Albacete: [38.99, -1.86], Alicante: [38.35, -0.48], Almería: [36.84, -2.46],
  Ávila: [40.66, -4.7], Badajoz: [38.88, -6.97], Barcelona: [41.39, 2.17], Bilbao: [43.26, -2.93],
  Burgos: [42.34, -3.7], Cáceres: [39.47, -6.37], Cádiz: [36.53, -6.29], Cartagena: [37.6, -0.98],
  Castellón: [39.99, -0.05], 'Ciudad Real': [38.99, -3.93], Córdoba: [37.89, -4.78], Cuenca: [40.07, -2.13],
  Gerona: [41.98, 2.82], Gijón: [43.54, -5.66], Granada: [37.18, -3.6], Guadalajara: [40.63, -3.17],
  Huelva: [37.26, -6.95], Huesca: [42.14, -0.41], Jaén: [37.78, -3.79], 'Jerez de la Frontera': [36.69, -6.14],
  León: [42.6, -5.57], Lérida: [41.62, 0.62], Logroño: [42.47, -2.45], Lugo: [43.01, -7.56],
  Madrid: [40.42, -3.7], Málaga: [36.72, -4.42], Murcia: [37.99, -1.13], Orense: [42.34, -7.86],
  Oviedo: [43.36, -5.85], Palencia: [42.01, -4.53], 'Palma de Mallorca': [39.57, 2.65], Pamplona: [42.81, -1.64],
  Pontevedra: [42.43, -8.65], Salamanca: [40.97, -5.66], 'San Sebastián': [43.32, -1.98], Santander: [43.46, -3.8],
  'Santiago de Compostela': [42.88, -8.54], Segovia: [40.95, -4.12], Sevilla: [37.39, -5.98], Soria: [41.77, -2.46],
  Tarragona: [41.12, 1.25], Teruel: [40.34, -1.11], Toledo: [39.86, -4.02], Valencia: [39.47, -0.38],
  Valladolid: [41.65, -4.72], Vigo: [42.24, -8.72], Vitoria: [42.85, -2.67], Zamora: [41.5, -5.75], Zaragoza: [41.65, -0.89],
}

const OTROS_NOMBRES = { girona: 'Gerona', lleida: 'Lérida', ourense: 'Orense', donostia: 'San Sebastián', gasteiz: 'Vitoria', 'la coruna': 'A Coruña', coruna: 'A Coruña', palma: 'Palma de Mallorca', castello: 'Castellón', jerez: 'Jerez de la Frontera', santiago: 'Santiago de Compostela' }
const limpio = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

// Devuelve [lat, lon] de una ciudad conocida, o null
export function buscarCiudad(nombre) {
  const n = limpio(nombre)
  if (!n) return null
  if (OTROS_NOMBRES[n]) return CIUDADES[OTROS_NOMBRES[n]]
  const k = Object.keys(CIUDADES).find((c) => limpio(c) === n)
  return k ? CIUDADES[k] : null
}
