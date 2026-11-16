# Liga em Rede — Portal Oficial de Associados e Parceiros LPCS

Plataforma oficial **Liga em Rede** da **Liga Portuguesa Contra a SIDA (LPCS)** (IPSS · NIPC 502 665 548 · Praça Carlos Fabião, Loja 3A, 1600-316 Lisboa).

## Funcionalidades Principais
- **Área de Associados (`/registar`, `/dashboard`)**: Cartão digital de associado, controlo de quotas, emissão de códigos seguros de desconto (TOTP HMAC-SHA256 rotativos de 6 dígitos + QR Code ou Código Único) com controlo de limite de utilizações e validade.
- **Catálogo de Parceiros & Descontos (`/parceiros`)**: Diretório pesquisável de empresas parceiras com logótipos e galeria de serviços.
- **Registo e Área Privada de Entidades Parceiras (`/parceria`, `/validar`)**:
  - Geração e edição do **Protocolo de Cooperação "A LIGA EM REDE"** exclusivamente na Área Privada da Entidade Parceira.
  - Upload do protocolo assinado pelo Segundo Outorgante e disponibilização do protocolo assinado por ambas as partes pela LPCS (condição de entrada em vigor da parceria).
  - Validador comercial de códigos QR e códigos manuais de 6 dígitos.
- **Gestão Administrativa (`/admin`)**: Gestão de associados, parceiros, propostas de parceria, consulta/upload de protocolos assinados (Empresa e LPCS), auditoria RGPD e notificações automáticas para `info@ligacontrasida.org`.

## Integração com Supabase (PostgreSQL)
1. Crie um projeto no **Supabase** (região recomendada: **EU — Frankfurt / Ireland** para conformidade RGPD).
2. No **SQL Editor** do Supabase, execute o script de migração:
   - [`supabase/migrations/20261116000001_liga_em_rede_schema.sql`](./supabase/migrations/20261116000001_liga_em_rede_schema.sql)
3. Configure as variáveis no ficheiro `.env` (com base em `.env.example`):
   ```env
   SUPABASE_URL="https://SEU-PROJETO.supabase.co"
   SUPABASE_ANON_KEY="SUA_ANON_KEY"
   SUPABASE_SERVICE_ROLE_KEY="SUA_SERVICE_ROLE_KEY"
   ```
4. Na área de administração (`/admin`), ou através do endpoint `POST /api/admin/supabase-sync`, pode sincronizar todos os dados existentes para o Supabase.

## Executar Localmente
```bash
npm install
npm run dev
```
O servidor fica disponível em `http://localhost:3000`.
