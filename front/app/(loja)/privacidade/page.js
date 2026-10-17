import Link from 'next/link';
import CookiePrefsButton from '@/components/CookiePrefsButton';

export const metadata = {
  title: 'Política de Privacidade e Cookies — AG12 Sports',
  description: 'Como a AG12 Sports trata seus dados pessoais e usa cookies.',
};

export default function PrivacidadePage() {
  return (
    <div className="ag-wrap ag-legal">
      <h1>Política de Privacidade e Cookies</h1>
      <p className="ag-legal-date">Última atualização: outubro de 2026</p>

      <h2>1. Quem somos</h2>
      <p>
        A AG12 Sports é a controladora dos dados tratados neste site. Para falar sobre seus dados,
        chame a gente pelo WhatsApp ou Instagram indicados no rodapé.
      </p>

      <h2>2. Dados que coletamos</h2>
      <p>
        Cadastro e compra: nome, e-mail, telefone, CPF, endereço de entrega e histórico de pedidos.
        Usamos esses dados para criar sua conta, calcular frete, entregar e dar suporte.
        O CPF é guardado de forma protegida (não em texto aberto).
      </p>

      <h2>3. Para que usamos (base legal)</h2>
      <p>
        Execução do contrato de compra, cumprimento de obrigações legais (como as fiscais) e
        legítimo interesse na segurança da loja. Cookies de estatística e marketing só com o seu consentimento.
      </p>

      <h2>4. Cookies e armazenamento local</h2>
      <div className="ag-legal-table">
        <table>
          <thead>
            <tr><th>Nome</th><th>Categoria</th><th>Para quê</th><th>Duração</th></tr>
          </thead>
          <tbody>
            <tr><td>ag12_consent</td><td>Necessário</td><td>Guarda a sua escolha de cookies</td><td>6 meses</td></tr>
            <tr><td>pitch_cart_v1</td><td>Necessário</td><td>Mantém os itens do carrinho neste aparelho</td><td>Até você limpar</td></tr>
            <tr><td>pitch_wish_v1 / pitch_wish_snap_v1</td><td>Necessário</td><td>Mantém seus favoritos neste aparelho</td><td>Até você limpar</td></tr>
            <tr><td>ag12-intro-seen</td><td>Necessário</td><td>Evita repetir a abertura da loja na mesma sessão</td><td>Sessão</td></tr>
          </tbody>
        </table>
      </div>
      <p>
        Hoje a loja não usa cookies de estatística nem de marketing. Se passarmos a usar, eles só serão
        ativados depois da sua permissão.
      </p>
      <p>
        <CookiePrefsButton className="ag-legal-link" />
      </p>

      <h2>5. Serviços de terceiros</h2>
      <p>
        Para exibir a página, o seu navegador carrega fontes do Google Fonts e ícones do Iconify, o que
        envia seu endereço IP a esses serviços. O frete usa consulta de CEP e localização. A finalização
        do pedido acontece pelo WhatsApp, que tem política própria.
      </p>

      <h2>6. Com quem compartilhamos</h2>
      <p>
        Apenas com quem é necessário para concluir a compra (transportadoras, meios de pagamento) e quando
        a lei exigir. Não vendemos seus dados.
      </p>

      <h2>7. Seus direitos (LGPD)</h2>
      <p>
        Você pode pedir confirmação do tratamento, acesso, correção, anonimização ou exclusão dos dados,
        portabilidade, informação sobre compartilhamento e revogar consentimentos. É só pedir pelo nosso
        atendimento. Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).
      </p>

      <h2>8. Segurança e retenção</h2>
      <p>
        Usamos conexão criptografada, controle de acesso e limites contra abuso. Guardamos os dados pelo
        tempo necessário para a compra, garantia e obrigações legais.
      </p>

      <p><Link href="/">← Voltar para a loja</Link></p>
    </div>
  );
}
