/**
 * Modalidades de venda de um produto (independentes; pode ter as duas):
 *  - pronta:    em estoque, compra direto pelo site (availableForOrder)
 *  - encomenda: "Disponível para pedidos", sob consulta no WhatsApp (availableOnRequest)
 * Compatibilidade: se a API ainda não enviar availableOnRequest, quem não é
 * pronta entrega continua sendo tratado como encomenda (comportamento antigo).
 * `known` = false quando a API nem informa availableForOrder (sem selo).
 */
export function fulfillmentOf(product) {
  const known = !!product && typeof product.availableForOrder === 'boolean';
  const pronta = known && product.availableForOrder === true;
  const encomenda = known
    ? (typeof product.availableOnRequest === 'boolean' ? product.availableOnRequest : !pronta)
    : false;
  return { known, pronta, encomenda };
}
