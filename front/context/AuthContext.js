'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';
import { jwtExpiryMs } from '@/lib/jwt.mjs';

/**
 * AuthContext — réplica do padrão authToken/adminToken do front vanilla.
 *
 * DECISÃO CONFIRMADA COM O USUÁRIO: o token vive só em React state
 * (useState), nunca em localStorage/sessionStorage. Isso significa que
 * recarregar a página (F5) desloga o usuário — comportamento idêntico ao
 * atual, mantido de propósito por motivos de segurança (reduz superfície
 * de roubo de token via XSS). Não "corrigir" isso sem confirmar de novo.
 */
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);

  const clearSession = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  // Expiração: o JWT dura 2h. Quando vence, encerra a sessão em memória
  // (em vez de deixar a tela "logada" com requisições falhando em 401).
  // Só lê o campo exp para agendar; quem valida o token é sempre o servidor.
  useEffect(() => {
    if (!token) return undefined;
    const expMs = jwtExpiryMs(token);
    if (!expMs) return undefined;
    const wait = Math.max(0, expMs - Date.now());
    const id = setTimeout(() => { setToken(null); setUser(null); }, Math.min(wait, 2147483647));
    return () => clearTimeout(id);
  }, [token]);

  /**
   * Login direto (usado no painel admin e em telas de login dedicadas).
   * Mesmo endpoint do front vanilla: POST /auth/login { username, password }.
   */
  const login = useCallback(async (username, password) => {
    const data = await apiRequest('/auth/login', { method: 'POST', body: { username, password } });
    setToken(data.token);
    setUser(data.user || null);
    return data;
  }, []);

  /**
   * Registro (cliente novo no checkout).
   */
  const register = useCallback(async (payload) => {
    const data = await apiRequest('/auth/register', { method: 'POST', body: payload });
    setToken(data.token);
    setUser(data.user || null);
    return data;
  }, []);

  const logout = useCallback(() => {
    clearSession();
  }, [clearSession]);

  /**
   * Atualiza os dados do usuário em memória (ex: depois de editar o perfil
   * em /conta) — não mexe no token, só no snapshot local de `user`.
   */
  const updateUser = useCallback((freshUser) => {
    setUser(freshUser);
  }, []);

  const value = { token, user, login, register, logout, clearSession, updateUser, isAuthenticated: !!token };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>');
  return ctx;
}
