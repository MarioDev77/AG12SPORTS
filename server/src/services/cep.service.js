'use strict';

// ─── CepService ───────────────────────────────────────────────────────────
// Responsabilidade única: consultar CEP, validar a resposta, normalizar o
// endereço, e tratar CEP inexistente / timeout / indisponibilidade da API.
// Nada no frontend chama a API de CEP diretamente — sempre passa por aqui,
// via GET /api/cep/:cep.

const VIACEP_TIMEOUT_MS = 5000;

function onlyDigits(str) {
  return String(str || '').replace(/\D/g, '');
}

function isValidCepFormat(cep) {
  return /^\d{8}$/.test(cep);
}

/**
 * Consulta o CEP no ViaCEP.
 * Retorna { cep, logradouro, bairro, cidade, uf } em caso de sucesso.
 * Lança erro com .status apropriado em caso de CEP inválido/inexistente
 * ou indisponibilidade do serviço.
 */
async function lookupCep(cepRaw) {
  const cep = onlyDigits(cepRaw);

  if (!isValidCepFormat(cep)) {
    const err = new Error('CEP inválido. Use o formato 00000-000.');
    err.status = 400;
    throw err;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VIACEP_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
  } catch (e) {
    const err = new Error(
      e.name === 'AbortError'
        ? 'A consulta de CEP demorou demais. Tente novamente.'
        : 'Serviço de CEP indisponível no momento. Tente novamente em instantes.'
    );
    err.status = 503;
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const err = new Error('Serviço de CEP indisponível no momento. Tente novamente em instantes.');
    err.status = 503;
    throw err;
  }

  let data;
  try {
    data = await response.json();
  } catch {
    const err = new Error('Resposta inválida do serviço de CEP.');
    err.status = 503;
    throw err;
  }

  // ViaCEP responde 200 com { erro: true } quando o CEP não existe.
  if (!data || data.erro) {
    const err = new Error('Não encontramos um endereço para este CEP. Verifique os números e tente novamente.');
    err.status = 404;
    throw err;
  }

  if (!data.logradouro && !data.bairro && !data.localidade) {
    // CEP "genérico" de faixa (só cidade, sem logradouro) — ainda é válido,
    // só não teremos como preencher rua/bairro automaticamente.
  }

  return {
    cep: `${cep.slice(0, 5)}-${cep.slice(5)}`,
    logradouro: data.logradouro || '',
    bairro: data.bairro || '',
    cidade: data.localidade || '',
    uf: data.uf || '',
  };
}

module.exports = { lookupCep, onlyDigits, isValidCepFormat };
