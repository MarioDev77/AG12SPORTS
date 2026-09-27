# Pitch Futebol — Hardening de Segurança

## Resumo das proteções aplicadas

---

## 1. SQL Injection

### O que foi feito
- **100% queries parametrizadas** com `?` placeholders (mysql2) — zero interpolação de string em SQL.
- `multipleStatements: false` no pool (já existia — mantido).
- `parsePositiveInt()` em `utils/security.js` valida IDs antes de qualquer query.
- **Whitelist de colunas para ORDER BY** via `SORT_MAP` — impede injeção via parâmetro `sort`.
- **Whitelist de categorias** via `Set` — qualquer valor fora do set vira `'all'` antes de chegar ao SQL.
- UPDATE dinâmico no admin constrói a query com campos fixos hardcoded (`name = ?`), nunca com o nome do campo vindo do cliente.

### Antes (vulnerável)
```js
// sort era interpolado diretamente
const sql = `SELECT ... ORDER BY ${req.query.sort}`;
```

### Depois (seguro)
```js
const SORT_MAP = { price_asc: 'price ASC', ... };
const orderClause = SORT_MAP[sort] || SORT_MAP.newest; // whitelist
```

---

## 2. XSS (Cross-Site Scripting)

### O que foi feito
- `utils/security.js` → `escapeHtml()` e `sanitizeObject()` disponíveis para uso em qualquer handler.
- **Helmet** com CSP restritiva: `defaultSrc: ["'none'"]`, `scriptSrc: ["'self'"]`, `objectSrc: ["'none'"]`, `frameAncestors: ["'none'"]`.
- `X-Content-Type-Options: nosniff` em todas as respostas.
- `referrerPolicy: no-referrer`.
- Dados do usuário persistidos via queries parametrizadas (mysql2 escapa automaticamente).
- Respostas são JSON puro — o Express serializa strings corretamente.
- Cache desabilitado: `Cache-Control: no-store` — impede reflexão de dados em cache.

### CSP aplicada
```
default-src 'none'
script-src 'self'
connect-src 'self'
img-src 'self' data:
style-src 'self'
object-src 'none'
frame-ancestors 'none'
base-uri 'none'
form-action 'self'
upgrade-insecure-requests
```

---

## 3. IDOR (Insecure Direct Object Reference)

### O que foi feito

#### Rota `GET /api/orders/:id`
- **Ownership check**: busca o pedido e compara `order.user_id` com `req.user.sub` (do JWT).
- Admin (`role === 'admin'`) tem acesso irrestrito.
- Se o usuário não é dono **E** não é admin → retorna **404** (não 403) para não confirmar existência do recurso.

#### Utilitário `requireOwnerOrAdmin(getOwnerId)`
- Middleware factory em `utils/security.js` para reutilizar o padrão em qualquer rota nova.

#### Preços IDOR (Mass Assignment / Price Tampering)
- `unitPrice` e `totals` enviados pelo cliente são **ignorados completamente**.
- O servidor busca o preço real no DB por `productId` e recalcula subtotal/desconto/total.
- Isso elimina a vulnerabilidade de um cliente enviar `unitPrice: 0.01`.

#### Tokens de ownership (opcional, utilitário incluído)
- `generateOwnershipToken()` / `verifyOwnershipToken()` em `utils/security.js`.
- HMAC-SHA256 com comparação em tempo constante (`timingSafeEqual`).

---

## 4. Rotas de Admin Ocultas

### O que foi feito
- Rotas admin montadas em **`/api/manage`** (configurável via `ADMIN_ROUTE_PREFIX` no `.env`).
- **Nunca** montado em `/api/admin`, `/api/administrator`, `/dashboard`, etc.
- Todos os caminhos óbvios de admin retornam **404** explicitamente em `routes/index.js`:
  ```
  /admin, /administrator, /wp-admin, /dashboard, /panel, /backoffice, /cp, /controlpanel
  ```
- `requireRole('admin')` aplicado via `router.use()` no router inteiro de admin — impossível esquecer numa rota nova.
- Erros de role retornam **403 genérico** — não confirmam se a rota existe.

---

## 5. Proteções Anti-Pentest Gerais

### Brute Force / Credential Stuffing
- Rate limiting reforçado em `/api/auth`: **10 req / 15 min** (vs 150 global).
- Rate limit por IP em `/api/auth`; não bloqueie uma conta por falhas de terceiros usando seu username.
- bcrypt sempre executado (mesmo para username inválido) — elimina timing attack por short-circuit.
- Comparação de username com **`crypto.timingSafeEqual`**.

### JWT Hardening
- Algoritmo fixado em **`HS256`** — rejeita `none`, RS256, e qualquer outro.
- `issuer` e `audience` opcionais via env — ativa validação extra se definidos.
- Regex valida formato do token antes de `jwt.verify`.
- Mensagem de erro JWT: sempre `"Unauthorized"` — não vaza motivo (expirado, inválido, alg errado).
- Token incluído em payload mínimo (`sub`, `role`) — sem username, email etc.

### Fingerprinting / Recon
- `x-powered-by` desabilitado.
- `ETag` desabilitado.
- `Cache-Control: no-store` em todas as respostas.
- `/health` retorna apenas `200 OK` sem body — não vaza versão, DB status etc.
- Error handler em produção: nunca vaza stack trace, mensagem de DB, código SQL.
- Erros de constraint (mysql2 `ER_DUP_ENTRY`) → `409 Conflict` genérico.

### Headers de Segurança (Helmet completo)
| Header | Valor |
|---|---|
| HSTS | maxAge=31536000, includeSubDomains, preload |
| X-Frame-Options | DENY |
| X-Content-Type-Options | nosniff |
| Referrer-Policy | no-referrer |
| Permissions-Policy | geolocation=(), camera=(), microphone=() |
| Cross-Origin-Embedder-Policy | require-corp |
| Cross-Origin-Opener-Policy | same-origin |
| Cross-Origin-Resource-Policy | cross-origin (necessário para imagens servidas pela API consumidas pelo frontend) |

### CORS Restritivo
- `origin` validado contra whitelist (não usa `*`).
- Requests sem `Origin` são aceitos pelo middleware CORS; CORS é uma política de navegador, não um mecanismo de autenticação ou bloqueio de clientes diretos.
- `credentials: false` — sem cookies cross-origin.
- Métodos explícitos: `GET, POST, PUT, PATCH, DELETE`.
- O frontend também define `nosniff`, `DENY` para framing, política de referrer e permissões de câmera/microfone/geolocalização em `next.config.mjs`.

### Injeção via Content-Type
- Rejeita mutations sem `Content-Type: application/json` → `415 Unsupported Media Type`.
- Body parser com `strict: true` e limite de `50kb`.

### Validação de Env no Boot
- Variáveis críticas (`JWT_SECRET`, `DB_*`) verificadas na inicialização — processo encerra com `FATAL` se ausentes.
- `JWT_SECRET` com menos de 32 chars → encerra.
- `CPF_PEPPER` é obrigatório, não pode ser placeholder e precisa ter pelo menos 32 caracteres.
- Tokens de usuários são comparados ao papel/status atual no banco; desativar/rebaixar a conta invalida o token existente.
- Conexões para MySQL remoto usam TLS com validação de certificado; configure `DB_SSL_CA` se o provedor usar CA privada. `DB_SSL=false` remoto encerra o processo.

---

## 6. Arquivos Modificados / Criados

| Arquivo | O que mudou |
|---|---|
| `src/index.js` | Helmet completo, CORS restritivo, rate limiting por rota, validação de env no boot |
| `src/middlewares/authJwt.js` | Algoritmo fixado, regex de token, erros genéricos |
| `src/middlewares/requireRole.js` | **NOVO** — controle de role por rota |
| `src/utils/security.js` | **NOVO** — escapeHtml, parsePositiveInt, parseEnum, IDOR helpers |
| `src/routes/index.js` | Prefixo admin oculto, bloqueio de paths comuns |
| `src/routes/admin.js` | **NOVO** — CRUD admin completo, role obrigatória em todo o router |
| `src/routes/auth.js` | comparação segura do login admin, rate limit por IP, bcrypt sempre executado, payload mínimo |
| `src/routes/products.js` | parsePositiveInt, whitelist de query params |
| `src/routes/orders.js` | IDOR check, owner-or-admin, 404 em vez de 403 |
| `src/routes/errorHandler.js` | Sem stack em produção, erros DB opacos |
| `src/services/products.service.js` | SORT_MAP whitelist, paginação segura, colunas explícitas |
| `src/services/orders.service.js` | Preço do DB (não do cliente), check de estoque, discount server-side |
| `server/.env.example` | Novas vars: ADMIN_ROUTE_PREFIX, OWNERSHIP_TOKEN_SECRET, JWT_ISSUER/AUDIENCE |
