'use strict';

// ─── GeoService ───────────────────────────────────────────────────────────
// Responsabilidade única: converter coordenadas (lat/lon) obtidas da
// Geolocation API do navegador em um endereço aproximado (cidade, UF,
// bairro, CEP quando disponível), pra pré-preencher o passo 1 do checkout.
//
// Usa o Nominatim (OpenStreetMap), que é gratuito mas exige:
//  - um User-Agent identificando a aplicação (política de uso do serviço);
//  - não fazer requisições em volume — por isso o rate limit dedicado em
//    index.js (ver GEO_ROUTE_PREFIX) além do limite global da API.
// Nada no frontend chama o Nominatim diretamente — sempre passa por aqui,
// via GET /api/geo/reverse, do mesmo jeito que o CepService faz com o ViaCEP.
//
// Resultado é sempre "sugestão": o cliente confirma/edita os campos no
// checkout antes de continuar — nunca usamos isso pra preencher e enviar
// um pedido sem revisão humana.

const NOMINATIM_TIMEOUT_MS = 6000;

function isValidCoord(lat, lon) {
  return (
    Number.isFinite(lat) && Number.isFinite(lon) &&
    lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180
  );
}

// Nominatim não retorna a sigla da UF diretamente: vem em
// address['ISO3166-2-lvl4'] como "BR-BA", ou só o nome por extenso em
// address.state ("Bahia"). Cobrimos os dois casos.
const STATE_NAME_TO_UF = {
  acre: 'AC', alagoas: 'AL', amapa: 'AP', amazonas: 'AM', bahia: 'BA',
  ceara: 'CE', 'distrito federal': 'DF', 'espirito santo': 'ES', goias: 'GO',
  maranhao: 'MA', 'mato grosso': 'MT', 'mato grosso do sul': 'MS',
  'minas gerais': 'MG', para: 'PA', paraiba: 'PB', parana: 'PR',
  pernambuco: 'PE', piaui: 'PI', 'rio de janeiro': 'RJ',
  'rio grande do norte': 'RN', 'rio grande do sul': 'RS', rondonia: 'RO',
  roraima: 'RR', 'santa catarina': 'SC', 'sao paulo': 'SP', sergipe: 'SE',
  tocantins: 'TO',
};

function normalizeStateName(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // remove acentos
}

function resolveUf(address) {
  const isoField = address['ISO3166-2-lvl4'] || '';
  const isoUf = isoField.includes('-') ? isoField.split('-')[1] : '';
  if (isoUf && isoUf.length === 2) return isoUf.toUpperCase();
  return STATE_NAME_TO_UF[normalizeStateName(address.state)] || '';
}

/**
 * Consulta o Nominatim pra descobrir o endereço aproximado de uma coordenada.
 * Retorna { logradouro, bairro, cidade, uf, cep } — qualquer campo que o
 * Nominatim não tiver vem como string vazia (nunca undefined).
 * Lança erro com .status apropriado em coordenada inválida, fora do Brasil,
 * timeout ou indisponibilidade do serviço.
 */
async function reverseGeocode(latRaw, lonRaw) {
  const lat = Number(latRaw);
  const lon = Number(lonRaw);

  if (!isValidCoord(lat, lon)) {
    const err = new Error('Coordenadas inválidas.');
    err.status = 400;
    throw err;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), NOMINATIM_TIMEOUT_MS);

  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1&accept-language=pt-BR`;

  let response;
  try {
    response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        // Exigido pela política de uso do Nominatim — identifica a aplicação.
        'User-Agent': 'AG12Sports/1.0 (checkout-geolocalizacao)',
      },
    });
  } catch (e) {
    const err = new Error(
      e.name === 'AbortError'
        ? 'A busca de localização demorou demais. Tente novamente ou preencha o CEP manualmente.'
        : 'Serviço de localização indisponível no momento. Preencha o CEP manualmente.'
    );
    err.status = 503;
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const err = new Error('Serviço de localização indisponível no momento. Preencha o CEP manualmente.');
    err.status = 503;
    throw err;
  }

  let data;
  try {
    data = await response.json();
  } catch {
    const err = new Error('Resposta inválida do serviço de localização.');
    err.status = 503;
    throw err;
  }

  const address = (data && data.address) || {};

  if ((address.country_code || '').toLowerCase() !== 'br') {
    const err = new Error('Localização fora do Brasil — o endereço precisa ser preenchido manualmente.');
    err.status = 422;
    throw err;
  }

  const cepRaw = (address.postcode || '').replace(/\D/g, '');

  return {
    logradouro: address.road || '',
    bairro: address.suburb || address.neighbourhood || '',
    cidade: address.city || address.town || address.village || address.municipality || '',
    uf: resolveUf(address),
    cep: cepRaw.length === 8 ? `${cepRaw.slice(0, 5)}-${cepRaw.slice(5)}` : '',
  };
}

/**
 * Geocodificação direta: converte um endereço em texto (rua, número,
 * cidade, UF) em coordenadas aproximadas. Usado só no cadastro de
 * depósitos/origens no admin — nunca falha o cadastro, só retorna
 * { latitude: null, longitude: null } quando não encontra nada, pra não
 * travar o admin cadastrando um endereço menos comum.
 */
async function forwardGeocode(addressText) {
  const query = String(addressText || '').trim();
  if (!query) return { latitude: null, longitude: null };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), NOMINATIM_TIMEOUT_MS);

  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(query)}&countrycodes=br&limit=1`;

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'AG12Sports/1.0 (admin-cadastro-origem)',
      },
    });
    if (!response.ok) return { latitude: null, longitude: null };

    const data = await response.json();
    const first = Array.isArray(data) ? data[0] : null;
    if (!first) return { latitude: null, longitude: null };

    const lat = Number(first.lat);
    const lon = Number(first.lon);
    if (!isValidCoord(lat, lon)) return { latitude: null, longitude: null };

    return { latitude: lat, longitude: lon };
  } catch {
    // Timeout, rede fora, resposta inválida — não trava o cadastro por isso.
    return { latitude: null, longitude: null };
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { reverseGeocode, forwardGeocode };
