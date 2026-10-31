import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hashRegistro, horasEntre, jurosMultaAtraso, pendenciasRN01, podeMudar, precoVenda, totalOS, valorLiquido } from './regras';

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
