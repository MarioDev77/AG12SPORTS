# Auditoria de Segurança — AG12 Sports (front Next.js + API Express)

Data: 17/10/2026 · Escopo: código do `front/` e do `server/` enviados. O site publicado
(https://ag-12-sports.vercel.app/) **não foi testado em produção**: nenhum teste foi feito contra ele.
Nenhum valor de segredo é citado neste relatório.

## 1. Mapeamento
- Front: Next 16 (App Router) + React 19, sem dependências extras. Rotas: loja `/`, `/produtos`, `/produto/[id]`, `/checkout`, `/conta`, `/privacidade`, painel `/admin/*`.
- API: Express 4 + MySQL (mysql2), JWT HS256 (2h), bcrypt, zod, helmet, express-rate-limit. Hospedagem: front na Vercel, API no Railway (há também `render.yaml`).
- Autenticação: JWT guardado **só em memória** (React state). Não vai para localStorage/cookie → sem CSRF e menor risco de roubo por XSS. Reload do navegador desloga (decisão já documentada no projeto).
- Única variável exposta ao cliente: `NEXT_PUBLIC_API_BASE` (URL pública da API, não é segredo). Nenhum `.env` real no zip; `.gitignore` cobre `.env*`. Nenhuma credencial/chave encontrada no código, nos arquivos de config ou no build. Build de produção gera **0 source maps**.

## 2. Achados e status

| # | Severidade | Achado | Status |
|---|---|---|---|
| 1 | Crítica | `next` com vulnerabilidade crítica conhecida (16.2.11) | **Corrigido** → 16.4.2 (`npm audit fix`) |
| 2 | Alta | Servidor: `nodemailer` (5 advisories), `express`/`qs`/`body-parser`, `compression`/`proxy-addr` (crítica), `sharp`, `mysql2` | **Corrigido** (`npm audit fix` + nodemailer 10.x). `npm audit` do servidor: 0 vulnerabilidades |
| 3 | Alta | **XSS por URL `javascript:`** no link de rastreio: o admin podia gravar `javascript:...` (`z.string().url()` aceita) e o cliente clicava em `/conta` | **Corrigido** nas duas pontas: API só aceita http(s) (`isHttpUrl`); front só renderiza o link se `safeHttpUrl()` aprovar |
| 4 | Média | Sem CSP e sem HSTS no front | **Adicionado** (ver seção 3) |
| 5 | Média | `Permissions-Policy: geolocation=()` bloqueava a geolocalização usada no checkout para refinar o frete (bug funcional) | **Corrigido** (`geolocation=(self)`) |
| 6 | Média | Sessão não expirava na tela: após 2h o token vencia e a interface seguia "logada" com erros 401 | **Implementado**: logout automático no vencimento do JWT (`AuthContext`). Verificado só o leitor de `exp` (teste unitário); o temporizador **não foi testado em navegador** |
| 7 | Baixa | `X-Powered-By` do Next ativo | **Desativado** |
| 8 | Baixa | Links externos com `rel="noopener"` apenas | Rastreio agora usa `noopener noreferrer` (o `Referrer-Policy` já cobre os demais) |
| 9 | Baixa | 5 advisories "high" restantes no front, todos em `eslint-config-next` (**só desenvolvimento**, não vão para o bundle). O "fix" sugerido é um downgrade para Next 14 | **Não aplicado** de propósito. Resolver quando sair um `eslint-config-next` 16.x corrigido |

## 3. Cabeçalhos (front, `next.config.mjs`)
`Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `Referrer-Policy: strict-origin-when-cross-origin`, `Cross-Origin-Opener-Policy`, `Permissions-Policy` e CSP.

**CSP em modo "Report-Only" por padrão**, para não quebrar nada sem teste em navegador (imagens do Railway, ícones do Iconify, Google Fonts, checkout). Ela só registra avisos no console. Para passar a bloquear:
1. Faça o deploy, navegue por loja, produto, carrinho, checkout, conta e `/admin` com o DevTools aberto.
2. Se não houver avisos de "Content Security Policy", defina `CSP_ENFORCE=true` na Vercel e refaça o deploy.
3. Se aparecer algum aviso, inclua a origem na lista em `next.config.mjs`.

Limitação: `script-src` e `style-src` mantêm `'unsafe-inline'` (o Next injeta scripts de hidratação e o projeto usa muitos `style={{}}`). Remover isso exige CSP com nonce, uma mudança maior. Mesmo assim a CSP bloqueia scripts, conexões, frames e formulários de origens não listadas.

## 4. Integração com o backend (revisado, sem falhas encontradas)
- **Preço/desconto/estoque/frete**: o servidor ignora `unitPrice` e totais do cliente e recalcula pelo banco (`orders.service`). Quantidade ≤ 10 por linha, ≤ 20 itens.
- **IDOR**: `GET /orders/:id` confere dono ou admin e devolve 404 para terceiros; `/addresses` filtra por `user_id` em toda query; `/orders` lista só os pedidos do próprio usuário.
- **Admin**: `requireRole('admin')` em todo o router (`/api/manage`, prefixo configurável). Esconder o prefixo é só ofuscação — a proteção real é o papel no JWT, revalidado no banco a cada request.
- **Auth**: HS256 fixo, comparação em tempo constante, bcrypt sempre executado, mensagens genéricas, rate limit de 10 tentativas/15 min por IP em `/auth`, 600/15 min na API, 8 pedidos/30 min.
- **CORS**: lista de origens (sem `*`), `credentials:false`. **Confirme** que `CORS_ORIGIN` no Railway contém `https://ag-12-sports.vercel.app`. O `render.yaml` cita `VERCEL_PREVIEW_PREFIX`, mas o `index.js` não usa essa variável.
- **CSRF**: não se aplica (token em header Authorization, sem cookies de sessão).

## 5. Pontos de atenção (decisões suas)
- **Logout não revoga o token no servidor** (JWT sem estado, validade 2h). Contas de usuário desativadas/rebaixadas são barradas na hora; o admin do `.env` não. Se quiser revogação imediata, é preciso uma lista de tokens revogados ou sessões no banco.
- **Pedido sem cadastro** é permitido (limitado por rate limit por IP). Quem quiser pode criar pedidos falsos que reservam estoque; vale ter rotina para cancelar pedidos pendentes antigos.
- **Rotação de segredos**: como `JWT_SECRET`, `CPF_PEPPER` e a senha do admin nunca apareceram no código, não há exigência de rotação. Se algum deles já foi colado em chat, e-mail ou repositório público, rotacione.

## 6. Arquivos modificados
**Front:** `next.config.mjs` (cabeçalhos, CSP, sem source maps/X-Powered-By) · `context/AuthContext.js` (expiração) · `app/(loja)/conta/page.js` (link de rastreio) · `package.json` e `package-lock.json` (Next atualizado, script de teste) · novos: `lib/safeUrl.mjs`, `lib/jwt.mjs`, `tests/*`, e os arquivos de cookies (`lib/consent.js`, `context/ConsentContext.js`, `components/CookieBanner.js`, `components/CookiePrefsButton.js`, `app/(loja)/privacidade/page.js`, alterações em `Providers.js`, `Footer.js` e `ag12-theme.css`).
**Servidor:** `src/routes/admin.js` (validação da URL de rastreio) · `src/utils/security.js` (`isHttpUrl`) · `package.json` e `package-lock.json` (dependências, script de teste) · novo: `tests/security.test.js`.
**Hospedagem:** não há `vercel.json`; os cabeçalhos ficam no `next.config.mjs`, que a Vercel respeita. Nenhuma configuração de painel da Vercel/Railway foi vista ou alterada.

## 7. Testes
- `front`: `npm test` — 7 testes, todos passaram (bloqueio de `javascript:`/`data:`/`//evil`, leitura segura de `exp` do JWT, consentimento de cookies).
- `server`: `npm test` — 3 testes, todos passaram ( `isHttpUrl`, tentativas de SQL injection em `parsePositiveInt`, `escapeHtml`).
- `npm run build` do front passa; `npm audit` do servidor: 0.
- O `npm run lint` do front tem erros que **já existiam** (regra `set-state-in-effect` em `CartContext`, `WishContext`, `ToastContext`, `conta/page.js` e `lib/useProducts.js`) e não foram alterados.
- **Não executado**: teste em navegador real e teste contra o banco/API ao vivo. Fluxos de pedido/IDOR foram revisados no código, não exercitados.
