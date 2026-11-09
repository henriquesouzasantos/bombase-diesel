import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  calcularLiquidez, hashRegistro, horasEntre, jurosMultaAtraso, naturezaDe, pendenciasRN01, podeMudar, prazoDias, precoVenda,
  somarDiasUteis, totalOS, valorEfetivo, valorLiquido,
} from './regras';

test('RN02: valor líquido', () => {
  assert.equal(valorLiquido(6200, 150, 128.09, 2.9), 6175.19);
});

test('juros e multa de 2 dias de atraso', () => {
  assert.equal(jurosMultaAtraso(6200, 2), 128.09);
  assert.equal(jurosMultaAtraso(6200, 0), 0);
});

test('RN01: itens sem baixa', () => {
  assert.equal(pendenciasRN01([{ baixado: true }, { baixado: false }]).length, 1);
});

test('transições de status da OS', () => {
  assert.ok(podeMudar('QUALIDADE', 'CONCLUIDO'));
  assert.ok(!podeMudar('ABERTO', 'FATURADO'));
  assert.ok(!podeMudar('FATURADO', 'ABERTO'));
});

test('total da OS, horas e preço', () => {
  assert.deepEqual(totalOS({ itens: [{ quantidade: 2, precoUnitario: 1957.5 }], apontamentos: [{ horas: 2.5, valorHora: 180 }] }), { pecas: 3915, maoDeObra: 450, total: 4365 });
  assert.equal(horasEntre('08:10', '10:40'), 2.5);
  assert.equal(precoVenda(1450, 35), 1957.5);
});

test('hash encadeado muda se o anterior mudar', () => {
  const a = hashRegistro({ valor: 10 }, 'x');
  assert.equal(a.length, 64);
  assert.notEqual(a, hashRegistro({ valor: 10 }, 'y'));
});

test('natureza e valor efetivo (RN02 na entrada, taxa soma na saída)', () => {
  assert.equal(naturezaDe('RECEBER'), 'ENTRADA');
  assert.equal(naturezaDe('AVULSO_SAIDA'), 'SAIDA');
  assert.equal(valorEfetivo('ENTRADA', 6200, 150, 128.09, 2.9), 6175.19);
  assert.equal(valorEfetivo('SAIDA', 1000, 0, 20, 3.5), 1023.5);
});

test('dias úteis pulam o fim de semana', () => {
  const sexta = new Date(2026, 10, 6, 10); // 06/11/2026, sexta
  assert.equal(somarDiasUteis(sexta, 1).getDate(), 9); // segunda
  assert.equal(somarDiasUteis(sexta, 0).getDate(), 6);
});

test('prazo da condição de pagamento', () => {
  assert.equal(prazoDias('28 dias · boleto'), 28);
  assert.equal(prazoDias('À vista · PIX'), 0);
  assert.equal(prazoDias(undefined), 0);
});

test('liquidez D+1', () => {
  const agora = new Date(2026, 10, 9, 10); // segunda, 10h
  const amanha = new Date(2026, 10, 10, 9);
  const r = calcularLiquidez(
    [{ _id: 'a', nomeBanco: 'Banco A', saldoAtual: 1000, ativa: true }, { _id: 'b', nomeBanco: 'Inativa', saldoAtual: 999, ativa: false }],
    [
      { natureza: 'ENTRADA', status: 'LIQUIDADO', tipo: 'RECEBER', contaId: 'a', valorBruto: 300, valorLiquido: 300, dataCompensacao: amanha },
      { natureza: 'ENTRADA', status: 'PENDENTE', tipo: 'RECEBER', valorBruto: 200, dataVencimento: amanha },
      { natureza: 'SAIDA', status: 'PENDENTE', tipo: 'PAGAR', valorBruto: 150, dataVencimento: new Date(2026, 10, 5) },
      { natureza: 'ENTRADA', status: 'PENDENTE', tipo: 'RECEBER', valorBruto: 80, dataVencimento: new Date(2026, 10, 2) },
    ],
    agora,
  );
  assert.equal(r.d1, '2026-11-10');
  assert.equal(r.disponivelHoje, 700); // 1000 − 300 a compensar
  assert.equal(r.projecaoD1, 1050); // 700 − 150 (vencida) + 300 + 200
  assert.deepEqual(r.vencidos, { receber: 80, pagar: 150 });
  assert.equal(r.dias.length, 7);
});
