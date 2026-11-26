// Dicionário Oficial de Divisão Territorial de Portugal (18 Distritos + 2 Regiões Autónomas + 308 Concelhos)

export const PORTUGAL_DISTRICTS: string[] = [
  'Âmbito Nacional (Todo o País)',
  'Aveiro',
  'Beja',
  'Braga',
  'Bragança',
  'Castelo Branco',
  'Coimbra',
  'Évora',
  'Faro',
  'Guarda',
  'Leiria',
  'Lisboa',
  'Portalegre',
  'Porto',
  'Santarém',
  'Setúbal',
  'Viana do Castelo',
  'Vila Real',
  'Viseu',
  'Região Autónoma dos Açores',
  'Região Autónoma da Madeira',
];

export const PORTUGAL_COUNTIES_BY_DISTRICT: Record<string, string[]> = {
  'Âmbito Nacional (Todo o País)': ['Todos os Concelhos (Nacional)'],
  Nacional: ['Todos os Concelhos (Nacional)'],
  Aveiro: [
    'Águeda',
    'Albergaria-a-Velha',
    'Anadia',
    'Arouca',
    'Aveiro',
    'Castelo de Paiva',
    'Espinho',
    'Estarreja',
    'Ílhavo',
    'Mealhada',
    'Murtosa',
    'Oliveira de Azeméis',
    'Oliveira do Bairro',
    'Ovar',
    'Santa Maria da Feira',
    'São João da Madeira',
    'Sever do Vouga',
    'Vagos',
    'Vale de Cambra',
  ],
  Beja: [
    'Aljustrel',
    'Almodôvar',
    'Alvito',
    'Barrancos',
    'Beja',
    'Castro Verde',
    'Cuba',
    'Ferreira do Alentejo',
    'Mértola',
    'Moura',
    'Odemira',
    'Ourique',
    'Serpa',
    'Vidigueira',
  ],
  Braga: [
    'Amares',
    'Barcelos',
    'Braga',
    'Cabeceiras de Basto',
    'Celorico de Basto',
    'Esposende',
    'Fafe',
    'Guimarães',
    'Póvoa de Lanhoso',
    'Terras de Bouro',
    'Vieira do Minho',
    'Vila Nova de Famalicão',
    'Vila Verde',
    'Vizela',
  ],
  Bragança: [
    'Alfândega da Fé',
    'Bragança',
    'Carrazeda de Ansiães',
    'Freixo de Espada à Cinta',
    'Macedo de Cavaleiros',
    'Miranda do Douro',
    'Mirandela',
    'Mogadouro',
    'Torre de Moncorvo',
    'Vila Flor',
    'Vimioso',
    'Vinhais',
  ],
  'Castelo Branco': [
    'Belmonte',
    'Castelo Branco',
    'Covilhã',
    'Fundão',
    'Idanha-a-Nova',
    'Oleiros',
    'Penamacor',
    'Proença-a-Nova',
    'Sertã',
    'Vila de Rei',
    'Vila Velha de Ródão',
  ],
  Coimbra: [
    'Arganil',
    'Cantanhede',
    'Coimbra',
    'Condeixa-a-Nova',
    'Figueira da Foz',
    'Góis',
    'Lousã',
    'Mira',
    'Miranda do Corvo',
    'Montemor-o-Velho',
    'Oliveira do Hospital',
    'Pampilhosa da Serra',
    'Penacova',
    'Penela',
    'Soure',
    'Tábua',
    'Vila Nova de Poiares',
  ],
  Évora: [
    'Alandroal',
    'Arraiolos',
    'Borba',
    'Estremoz',
    'Évora',
    'Montemor-o-Novo',
    'Mora',
    'Mourão',
    'Portel',
    'Redondo',
    'Reguengos de Monsaraz',
    'Vendas Novas',
    'Viana do Alentejo',
    'Vila Viçosa',
  ],
  Faro: [
    'Albufeira',
    'Alcoutim',
    'Aljezur',
    'Castro Marim',
    'Faro',
    'Lagoa',
    'Lagos',
    'Loulé',
    'Monchique',
    'Olhão',
    'Portimão',
    'São Brás de Alportel',
    'Silves',
    'Tavira',
    'Vila do Bispo',
    'Vila Real de Santo António',
  ],
  Guarda: [
    'Aguiar da Beira',
    'Almeida',
    'Celorico da Beira',
    'Figueira de Castelo Rodrigo',
    'Fornos de Algodres',
    'Gouveia',
    'Guarda',
    'Manteigas',
    'Mêda',
    'Pinhel',
    'Sabugal',
    'Seia',
    'Trancoso',
    'Vila Nova de Foz Côa',
  ],
  Leiria: [
    'Alcobaça',
    'Alvaiázere',
    'Ansião',
    'Batalha',
    'Bombarral',
    'Caldas da Rainha',
    'Castanheira de Pêra',
    'Figueiró dos Vinhos',
    'Leiria',
    'Marinha Grande',
    'Nazaré',
    'Óbidos',
    'Pedrógão Grande',
    'Peniche',
    'Pombal',
    'Porto de Mós',
  ],
  Lisboa: [
    'Alenquer',
    'Amadora',
    'Arruda dos Vinhos',
    'Azambuja',
    'Cadaval',
    'Cascais',
    'Lisboa',
    'Loures',
    'Lourinhã',
    'Mafra',
    'Odivelas',
    'Oeiras',
    'Sintra',
    'Sobral de Monte Agraço',
    'Torres Vedras',
    'Vila Franca de Xira',
  ],
  Portalegre: [
    'Alter do Chão',
    'Arronches',
    'Avis',
    'Campo Maior',
    'Castelo de Vide',
    'Crato',
    'Elvas',
    'Fronteira',
    'Gavião',
    'Marvão',
    'Monforte',
    'Nisa',
    'Ponte de Sor',
    'Portalegre',
    'Sousel',
  ],
  Porto: [
    'Amarante',
    'Baião',
    'Felgueiras',
    'Gondomar',
    'Lousada',
    'Maia',
    'Marco de Canaveses',
    'Matosinhos',
    'Paços de Ferreira',
    'Paredes',
    'Penafiel',
    'Porto',
    'Póvoa de Varzim',
    'Santo Tirso',
    'Trofa',
    'Valongo',
    'Vila do Conde',
    'Vila Nova de Gaia',
  ],
  Santarém: [
    'Abrantes',
    'Alcanena',
    'Almeirim',
    'Alpiarça',
    'Benavente',
    'Cartaxo',
    'Chamusca',
    'Constância',
    'Coruche',
    'Entroncamento',
    'Ferreira do Zêzere',
    'Golegã',
    'Mação',
    'Ourém',
    'Rio Maior',
    'Salvaterra de Magos',
    'Santarém',
    'Sardoal',
    'Tomar',
    'Torres Novas',
    'Vila Nova da Barquinha',
  ],
  Setúbal: [
    'Alcácer do Sal',
    'Alcochete',
    'Almada',
    'Barreiro',
    'Grândola',
    'Moita',
    'Montijo',
    'Palmela',
    'Santiago do Cacém',
    'Seixal',
    'Sesimbra',
    'Setúbal',
    'Sines',
  ],
  'Viana do Castelo': [
    'Arcos de Valdevez',
    'Caminha',
    'Melgaço',
    'Monção',
    'Paredes de Coura',
    'Ponte da Barca',
    'Ponte de Lima',
    'Valença',
    'Viana do Castelo',
    'Vila Nova de Cerveira',
  ],
  'Vila Real': [
    'Alijó',
    'Boticas',
    'Chaves',
    'Mesão Frio',
    'Mondim de Basto',
    'Montalegre',
    'Murça',
    'Peso da Régua',
    'Ribeira de Pena',
    'Sabrosa',
    'Santa Marta de Penaguião',
    'Valpaços',
    'Vila Pouca de Aguiar',
    'Vila Real',
  ],
  Viseu: [
    'Armamar',
    'Carregal do Sal',
    'Castro Daire',
    'Cinfães',
    'Lamego',
    'Mangualde',
    'Moimenta da Beira',
    'Mortágua',
    'Nelas',
    'Oliveira de Frades',
    'Penalva do Castelo',
    'Penedono',
    'Resende',
    'Santa Comba Dão',
    'São João da Pesqueira',
    'São Pedro do Sul',
    'Sátão',
    'Sernancelhe',
    'Tabuaço',
    'Tarouca',
    'Tondela',
    'Vila Nova de Paiva',
    'Viseu',
    'Vouzela',
  ],
  'Região Autónoma dos Açores': [
    'Angra do Heroísmo',
    'Calheta',
    'Corvo',
    'Horta',
    'Lagoa',
    'Lajes das Flores',
    'Lajes do Pico',
    'Madalena',
    'Nordeste',
    'Ponta Delgada',
    'Povoação',
    'Praia da Vitória',
    'Ribeira Grande',
    'Santa Cruz da Graciosa',
    'Santa Cruz das Flores',
    'São Roque do Pico',
    'Velas',
    'Vila do Porto',
    'Vila Franca do Campo',
  ],
  'Região Autónoma da Madeira': [
    'Calheta',
    'Câmara de Lobos',
    'Funchal',
    'Machico',
    'Ponta do Sol',
    'Porto Moniz',
    'Porto Santo',
    'Ribeira Brava',
    'Santa Cruz',
    'Santana',
    'São Vicente',
  ],
};

// Lista plana e ordenada de todos os concelhos de Portugal
export const ALL_PORTUGAL_COUNTIES: string[] = Array.from(
  new Set(
    Object.entries(PORTUGAL_COUNTIES_BY_DISTRICT)
      .filter(([d]) => d !== 'Âmbito Nacional (Todo o País)' && d !== 'Nacional')
      .flatMap(([, counties]) => counties)
  )
).sort((a, b) => a.localeCompare(b, 'pt'));

/**
 * Converte strings separadas por vírgulas ou arrays num array de strings limpas
 */
export function parseLocations(input: string | string[] | null | undefined): string[] {
  if (!input) return [];
  if (Array.isArray(input)) {
    return Array.from(new Set(input.map((s) => String(s).trim()).filter(Boolean)));
  }
  const str = String(input).trim();
  if (!str) return [];
  if (str.startsWith('[') && str.endsWith(']')) {
    try {
      const parsed = JSON.parse(str);
      if (Array.isArray(parsed)) {
        return Array.from(new Set(parsed.map((s) => String(s).trim()).filter(Boolean)));
      }
    } catch {
      // fallback to comma split
    }
  }
  return Array.from(
    new Set(
      str
        .split(/[,;\n]+/)
        .map((s) => s.trim())
        .filter(Boolean)
    )
  );
}

/**
 * Retorna uma formatação legível e elegante do local de benefício de um parceiro
 */
export function formatPartnerLocation(
  districtRaw: string | null | undefined,
  cityRaw: string | null | undefined
): {
  isNational: boolean;
  districtsText: string;
  countiesText: string;
  fullLocationSummary: string;
} {
  const districts = parseLocations(districtRaw);
  const counties = parseLocations(cityRaw);

  const isNational =
    districts.some((d) => d.toLowerCase().includes('nacional')) ||
    counties.some((c) => c.toLowerCase().includes('nacional'));

  if (isNational) {
    return {
      isNational: true,
      districtsText: 'Âmbito Nacional (Todo o País)',
      countiesText: 'Todos os concelhos de Portugal',
      fullLocationSummary: 'Âmbito Nacional (Todo o País)',
    };
  }

  const districtsText = districts.length > 0 ? districts.join(', ') : 'Portugal';
  const countiesText =
    counties.length > 0 ? counties.join(', ') : 'Todos os concelhos do distrito';

  let fullLocationSummary = districtsText;
  if (counties.length > 0 && counties.length <= 4) {
    fullLocationSummary = `${districtsText} · ${countiesText}`;
  } else if (counties.length > 4) {
    fullLocationSummary = `${districtsText} · ${counties.slice(0, 3).join(', ')} (+${counties.length - 3})`;
  }

  return {
    isNational: false,
    districtsText,
    countiesText,
    fullLocationSummary,
  };
}
