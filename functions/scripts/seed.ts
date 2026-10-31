/**
 * Popula o MongoDB com dados de exemplo (os mesmos do modo demonstração).
 * Uso:  cd functions && npm run seed
 * ATENÇÃO: apaga os dados das coleções antes de inserir. Não rode em produção.
 */
import mongoose from 'mongoose';
import { conectar } from '../src/lib/db';
import { Cliente, Contador, MovimentoEstoque, OrdemServico, Peca, Veiculo } from '../src/models';
import { precoVenda } from '../src/domain/regras';

async function main() {
  await conectar();
  const modelos: mongoose.Model<any>[] = [Cliente, Veiculo, Peca, OrdemServico, Contador, MovimentoEstoque];
  await Promise.all(modelos.map((m) => m.deleteMany({})));

  const [sul, minas, rodolog] = await Cliente.create([
    { tipo: 'PJ', nome: 'Transportes Sul Ltda', cpfCnpj: '12.345.678/0001-90', telefone: '(35) 3621-4410', limiteCredito: 80000, condicoesPagamento: '28 dias · boleto' },
    { tipo: 'PJ', nome: 'Frota Minas Logística', cpfCnpj: '45.678.901/0001-23', telefone: '(31) 3333-2211', limiteCredito: 60000 },
    { tipo: 'PJ', nome: 'Rodolog Cargas Ltda', cpfCnpj: '56.789.012/0001-34', telefone: '(35) 3629-7712', limiteCredito: 40000 },
  ]);
  const [r450, actros] = await Veiculo.create([
    { clienteId: sul._id, placa: 'ABC-1D23', chassi: '9BSR6X400M3912345', marca: 'Scania', modelo: 'R450', ano: 2021, motor: 'DC13 450cv', hodometro: 530990 },
    { clienteId: minas._id, placa: 'QWE-4R56', chassi: '9BM958075LB112233', marca: 'Mercedes-Benz', modelo: 'Actros 2651', ano: 2020, motor: 'OM 471', hodometro: 701233 },
    { clienteId: rodolog._id, placa: 'PLK-8J76', chassi: '9BSG4X200N3987654', marca: 'Scania', modelo: 'G440', ano: 2022, motor: 'DC13 440cv', hodometro: 154220 },
  ]);
  const pecas = [
    ['BI-0445', 'Bico injetor Bosch 0445120', 'UN', 1450, 35, 6, 4],
    ['FC-1060', 'Filtro de combustível MANN WK 1060/3', 'UN', 86, 40, 4, 10],
    ['AN-22', 'Anel de vedação 22 mm', 'UN', 3.9, 60, 16, 10],
    ['KT-430', 'Kit embreagem 430 mm', 'KT', 4200, 30, 1, 2],
  ] as const;
  const [bico, , anel] = await Peca.create(pecas.map(([sku, descricao, unidade, custo, margem, saldo, estoqueMinimo]) =>
    ({ sku, descricao, unidade, custo, margem, saldo, estoqueMinimo, precoVenda: precoVenda(custo, margem) })));

  await Contador.create({ _id: 'os', valor: 30 });
  await OrdemServico.create([
    { numero: 1029, veiculoId: r450._id, clienteId: sul._id, descricao: 'Bomba injetora — revisão completa', status: 'EM_ANDAMENTO', tecnico: 'J. Pereira',
      itens: [
        { pecaId: bico._id, sku: bico.sku, descricao: bico.descricao, quantidade: 2, precoUnitario: bico.precoVenda, baixado: true },
        { pecaId: anel._id, sku: anel.sku, descricao: anel.descricao, quantidade: 12, precoUnitario: anel.precoVenda, baixado: false },
      ],
      apontamentos: [{ tecnico: 'J. Pereira', inicio: '08:10', fim: '10:40', horas: 2.5, valorHora: 180 }],
      historico: [{ status: 'ABERTO', por: 'seed' }, { status: 'EM_ANDAMENTO', por: 'seed' }] },
    { numero: 1030, veiculoId: actros._id, clienteId: minas._id, descricao: 'Troca do kit de embreagem', status: 'AGUARDANDO_PECAS', historico: [{ status: 'ABERTO', por: 'seed' }] },
  ]);
  console.log('Dados de exemplo inseridos.');
  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
